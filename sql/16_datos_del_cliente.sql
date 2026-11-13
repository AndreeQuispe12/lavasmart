-- =====================================================================
--  LavaSmart — 16_datos_del_cliente.sql
--  Nombre y teléfono opcionales del cliente al registrar el ingreso, y
--  búsquedas para autocompletarlos en la siguiente visita.
--
--  El cliente sigue siendo la placa (un cliente = un vehículo). Nombre y
--  teléfono existen desde 01 como columnas opcionales, pero la app nunca
--  los pedía. Aquí:
--
--  1. Se validan: el nombre no puede ser solo espacios ni pasar de 80
--     caracteres; el teléfono es un celular peruano de 9 dígitos que
--     empieza por 9, porque su finalidad es avisar por WhatsApp o llamada
--     que el auto está listo o que surgió un inconveniente.
--  2. fn_registrar_ingreso recibe p_nombre y p_telefono. Si la placa es
--     nueva se guardan con el cliente; si ya existe, un valor escrito
--     reemplaza al anterior (corrección) y uno vacío no borra nada.
--  3. fn_buscar_cliente(placa): lo que se sabe de esa placa, para
--     rellenar el formulario cuando el auto vuelve.
--  4. fn_placas_del_telefono(telefono): otras placas con el mismo
--     teléfono. Así se reconoce a un cliente con varios autos sin cambiar
--     el modelo: el vínculo es el teléfono que él mismo dio.
--
--  Datos personales (Ley 29733): los dos campos son opcionales y solo se
--  guardan si el cliente los entrega. Las funciones corren con los
--  permisos de quien llama (SECURITY INVOKER): RLS de cliente se aplica
--  igual, y anon no puede ejecutarlas.
--
--  Se corre después de 15. Es idempotente.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Limpieza de placa y teléfono, en un solo lugar.
-- ---------------------------------------------------------------------

-- La misma regla que fn_normalizar_placa (el disparador), como función
-- normal para poder buscar con ella: 'abc 123' -> 'ABC-123'.
create or replace function fn_limpiar_placa(p_placa text)
returns text
language sql
immutable
set search_path = public
as $$
    select case
        when length(l) = 6 then substr(l, 1, 3) || '-' || substr(l, 4, 3)
        else l
    end
    from (select upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g')) as l) x;
$$;

-- Solo dígitos, sin el código de país: '+51 987 654 321' -> '987654321'.
-- Vacío -> null. No valida: eso lo hace la restricción de cliente.
create or replace function fn_limpiar_telefono(p_telefono text)
returns text
language sql
immutable
set search_path = public
as $$
    select case
        when d = '' then null
        when length(d) = 11 and left(d, 2) = '51' then substr(d, 3)
        else d
    end
    from (select regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g') as d) x;
$$;


-- ---------------------------------------------------------------------
-- Reglas sobre los datos guardados.
-- ---------------------------------------------------------------------

alter table cliente drop constraint if exists cliente_nombre_llenado;
alter table cliente add constraint cliente_nombre_llenado
    check (nombre is null or length(trim(nombre)) between 1 and 80);

alter table cliente drop constraint if exists cliente_telefono_formato;
alter table cliente add constraint cliente_telefono_formato
    check (telefono is null or telefono ~ '^9[0-9]{8}$');

comment on column cliente.telefono is
    'Opcional. Celular de 9 dígitos que el cliente entrega para que le avisen cuando su auto está listo o si surge un inconveniente. No se usa para promociones sin un consentimiento aparte.';

create index if not exists idx_cliente_telefono on cliente (telefono) where telefono is not null;


-- ---------------------------------------------------------------------
-- El ingreso, ahora con nombre y teléfono.
-- Cambia la firma, así que se borra la versión de 07 antes de crearla:
-- con las dos vivas, una llamada sin los parámetros nuevos sería ambigua.
-- ---------------------------------------------------------------------

drop function if exists fn_registrar_ingreso(text, bigint, bigint, bigint[], text);

create or replace function fn_registrar_ingreso(
    p_placa            text,
    p_tipo_vehiculo_id bigint,
    p_trabajador_id    bigint,
    p_servicios        bigint[],
    p_observacion      text default null,
    p_nombre           text default null,
    p_telefono         text default null
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
    v_placa     text := fn_limpiar_placa(p_placa);
    v_nombre    text := nullif(trim(coalesce(p_nombre, '')), '');
    v_telefono  text := fn_limpiar_telefono(p_telefono);
    v_cliente   cliente%rowtype;
    v_lavado_id bigint;
    v_faltantes text;
begin
    if coalesce(cardinality(p_servicios), 0) = 0 then
        raise exception 'lavado_sin_servicios: elija al menos un servicio.';
    end if;

    if v_telefono is not null and v_telefono !~ '^9[0-9]{8}$' then
        raise exception 'cliente_telefono_formato: el teléfono debe ser un celular de 9 dígitos que empiece por 9.';
    end if;

    -- 1. El cliente es la placa. Si ya existe, su tipo de vehículo manda:
    --    un cliente es un vehículo y no cambia de tipo entre visitas.
    select * into v_cliente from cliente where placa = v_placa;
    if found then
        if v_cliente.tipo_vehiculo_id <> p_tipo_vehiculo_id then
            raise exception 'cliente_tipo_distinto: la placa % ya está registrada con otro tipo de vehículo.', v_placa;
        end if;
        -- Lo escrito corrige lo guardado; lo vacío no borra nada.
        if v_nombre is not null or v_telefono is not null then
            update cliente
            set nombre   = coalesce(v_nombre, nombre),
                telefono = coalesce(v_telefono, telefono)
            where id = v_cliente.id;
        end if;
    else
        insert into cliente (placa, tipo_vehiculo_id, nombre, telefono)
        values (v_placa, p_tipo_vehiculo_id, v_nombre, v_telefono)
        returning * into v_cliente;
    end if;

    -- Un mismo auto no puede estar dos veces en piso.
    if exists (
        select 1 from lavado
        where cliente_id = v_cliente.id and estado = 'en_proceso'
    ) then
        raise exception 'lavado_ya_en_proceso: el auto % ya está en piso.', v_placa;
    end if;

    -- Todo servicio pedido tiene que tener tarifa activa para este tipo.
    select string_agg(s.id::text, ', ') into v_faltantes
    from unnest(p_servicios) as s(id)
    where not exists (
        select 1 from tarifa t
        where t.tipo_vehiculo_id = p_tipo_vehiculo_id
          and t.tipo_lavado_id  = s.id
          and t.activo
    );
    if v_faltantes is not null then
        raise exception 'tarifa_inexistente: no hay tarifa activa para los servicios % en este tipo de vehículo.', v_faltantes;
    end if;

    -- 2. El lavado, sin cobro. El disparador congela el porcentaje del
    --    destajo y rechaza al lavador sin asistencia.
    insert into lavado (cliente_id, trabajador_id, registrado_por, observacion)
    values (v_cliente.id, p_trabajador_id, auth.uid(), nullif(trim(p_observacion), ''))
    returning id into v_lavado_id;

    -- 3. Los servicios, con el precio de HOY copiado de tarifa.
    insert into detalle_lavado (lavado_id, tipo_lavado_id, precio_cobrado)
    select v_lavado_id, t.tipo_lavado_id, t.precio
    from tarifa t
    where t.tipo_vehiculo_id = p_tipo_vehiculo_id
      and t.tipo_lavado_id  = any (p_servicios)
      and t.activo;

    return v_lavado_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Búsquedas para autocompletar.
-- ---------------------------------------------------------------------

-- Lo que se sabe de una placa. Sin filas si nunca vino.
create or replace function fn_buscar_cliente(p_placa text)
returns table (tipo_vehiculo_id bigint, nombre text, telefono text)
language sql
stable
set search_path = public
as $$
    select c.tipo_vehiculo_id, c.nombre, c.telefono
    from cliente c
    where c.placa = fn_limpiar_placa(p_placa);
$$;

-- Las placas que ya tienen ese teléfono, con el nombre que se guardó.
-- p_excepto deja fuera la placa que se está registrando.
create or replace function fn_placas_del_telefono(p_telefono text, p_excepto text default null)
returns table (placa text, nombre text)
language sql
stable
set search_path = public
as $$
    select c.placa, c.nombre
    from cliente c
    where c.telefono = fn_limpiar_telefono(p_telefono)
      and c.placa is distinct from fn_limpiar_placa(p_excepto)
    order by c.placa;
$$;


-- ---------------------------------------------------------------------
-- Permisos: solo usuarios con sesión. Supabase da EXECUTE a todos por
-- defecto; se le quita a anon.
-- ---------------------------------------------------------------------

revoke execute on function fn_limpiar_placa(text)                                         from public, anon;
revoke execute on function fn_limpiar_telefono(text)                                      from public, anon;
revoke execute on function fn_registrar_ingreso(text, bigint, bigint, bigint[], text, text, text) from public, anon;
revoke execute on function fn_buscar_cliente(text)                                        from public, anon;
revoke execute on function fn_placas_del_telefono(text, text)                             from public, anon;

grant execute on function fn_limpiar_placa(text)                                          to authenticated;
grant execute on function fn_limpiar_telefono(text)                                       to authenticated;
grant execute on function fn_registrar_ingreso(text, bigint, bigint, bigint[], text, text, text) to authenticated;
grant execute on function fn_buscar_cliente(text)                                         to authenticated;
grant execute on function fn_placas_del_telefono(text, text)                              to authenticated;
