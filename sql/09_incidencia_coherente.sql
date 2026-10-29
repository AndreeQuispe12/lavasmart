-- =====================================================================
--  LavaSmart — 09_incidencia_coherente.sql
--  Una incidencia apunta al auto correcto, y solo el dueño la resuelve.
--
--  Los problemas:
--
--  1. incidencia guarda cliente_id y lavado_id por separado, y nada exige
--     que coincidan. Un reclamo de la placa ABC-123 podía quedar ligado a
--     un lavado de otro auto. Como del lavado salen el lavador y la fecha,
--     el reclamo terminaría culpando al lavador equivocado.
--
--  2. Resolver un reclamo puede implicar plata (pagarle un rayón al
--     cliente, descontárselo al lavador). La decisión es del dueño: el
--     operador lo registra y puede pasarlo a "en proceso", pero no
--     cerrarlo. Igual que en 06, la regla vive en la base y no solo en la
--     pantalla.
--
--  3. Quién registró y cuándo se resolvió los pone la base, no la app.
--
--  Lo que queda fijo desde que se registra: el auto, la visita, el tipo,
--  la descripción, la fecha y quién la registró. Lo único que avanza es
--  el estado. Una incidencia resuelta ya no cambia.
--
--  Como en 06 y 08, solo se aplica a peticiones con sesión de la
--  aplicación; el editor SQL de Supabase no pasa por aquí.
--
--  Se corre después de 08. Es idempotente.
-- =====================================================================

create or replace function fn_proteger_incidencia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_cliente_del_lavado bigint;
begin
    if auth.role() is distinct from 'authenticated' then
        return new;
    end if;

    if tg_op = 'INSERT' then
        -- 1. La visita, si se indica, tiene que ser de ese mismo auto.
        if new.lavado_id is not null then
            select cliente_id into v_cliente_del_lavado
            from lavado where id = new.lavado_id;
            if v_cliente_del_lavado is distinct from new.cliente_id then
                raise exception 'incidencia_lavado_de_otro_auto: la visita indicada no es de ese auto.';
            end if;
        end if;

        -- 3. Todo reclamo nace abierto, con la fecha y el autor de la base.
        new.estado           := 'abierta';
        new.fecha_reporte    := now();
        new.fecha_resolucion := null;
        new.resolucion       := null;
        new.registrado_por   := auth.uid();
        return new;
    end if;

    -- UPDATE
    if old.estado = 'resuelta' then
        raise exception 'incidencia_cerrada: la incidencia % ya está resuelta y no se puede modificar.', old.id;
    end if;

    if new.cliente_id     is distinct from old.cliente_id
       or new.lavado_id      is distinct from old.lavado_id
       or new.tipo           is distinct from old.tipo
       or new.descripcion    is distinct from old.descripcion
       or new.fecha_reporte  is distinct from old.fecha_reporte
       or new.registrado_por is distinct from old.registrado_por then
        raise exception 'incidencia_datos_fijos: lo registrado no cambia; solo avanza el estado.';
    end if;

    -- 2. Resolver es del dueño, y la fecha la pone la base.
    if new.estado = 'resuelta' then
        if not fn_es_dueno() then
            raise exception 'incidencia_resuelve_dueno: solo el dueño puede resolver una incidencia.';
        end if;
        new.fecha_resolucion := now();
    end if;

    return new;
end;
$$;

drop trigger if exists tr_incidencia_proteger on incidencia;
create trigger tr_incidencia_proteger
    before insert or update on incidencia
    for each row execute function fn_proteger_incidencia();
