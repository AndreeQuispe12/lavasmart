-- =====================================================================
--  LavaSmart — 07_registrar_ingreso.sql
--  Registra la llegada de un auto en una sola transacción.
--
--  El problema: el ingreso toca tres tablas. Si la placa es nueva se crea
--  el cliente; después el lavado; después una fila de detalle por cada
--  servicio. Hechas como tres llamadas separadas desde la aplicación, si
--  la última falla queda en piso un lavado sin servicios, que nadie puede
--  entregar (fn_validar_cobro lo impide) ni borrar (nada se borra).
--
--  Esta función hace las tres cosas juntas: o se guarda todo, o nada.
--  Además copia el precio desde tarifa aquí mismo, así que la aplicación
--  no puede mandar un precio inventado: el dato congelado lo pone la base.
--
--  Corre con los permisos de quien la llama (SECURITY INVOKER, el valor
--  por defecto): RLS y los disparadores se aplican igual que si la app
--  escribiera tabla por tabla. En particular, tr_lavado_fijar_porcentaje
--  sigue exigiendo la asistencia del lavador (sql/05).
--
--  Se corre después de 06. Es idempotente.
-- =====================================================================

create or replace function fn_registrar_ingreso(
    p_placa            text,
    p_tipo_vehiculo_id bigint,
    p_trabajador_id    bigint,
    p_servicios        bigint[],
    p_observacion      text default null
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
    v_placa     text;
    v_cliente   cliente%rowtype;
    v_lavado_id bigint;
    v_faltantes text;
begin
    -- La misma limpieza que fn_normalizar_placa, para poder buscarla.
    v_placa := upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'));
    if length(v_placa) = 6 then
        v_placa := substr(v_placa, 1, 3) || '-' || substr(v_placa, 4, 3);
    end if;

    if coalesce(cardinality(p_servicios), 0) = 0 then
        raise exception 'lavado_sin_servicios: elija al menos un servicio.';
    end if;

    -- 1. El cliente es la placa. Si ya existe, su tipo de vehículo manda:
    --    un cliente es un vehículo y no cambia de tipo entre visitas.
    select * into v_cliente from cliente where placa = v_placa;
    if found then
        if v_cliente.tipo_vehiculo_id <> p_tipo_vehiculo_id then
            raise exception 'cliente_tipo_distinto: la placa % ya está registrada con otro tipo de vehículo.', v_placa;
        end if;
    else
        insert into cliente (placa, tipo_vehiculo_id)
        values (v_placa, p_tipo_vehiculo_id)
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

-- Solo la llama la aplicación con sesión. Supabase le da permiso a todos
-- por defecto; se le quita a anon.
revoke execute on function fn_registrar_ingreso(text, bigint, bigint, bigint[], text) from public, anon;
grant  execute on function fn_registrar_ingreso(text, bigint, bigint, bigint[], text) to authenticated;
