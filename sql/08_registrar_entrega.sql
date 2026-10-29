-- =====================================================================
--  LavaSmart — 08_registrar_entrega.sql
--  La entrega con cobro, y un lavado entregado que ya no cambia.
--
--  Dos problemas:
--
--  1. La política lvd_edicion deja que todo el personal edite cualquier
--     lavado, también uno ya entregado. Un operador podía bajar el monto
--     cobrado de un auto entregado en la mañana: la caja cuadraría con
--     un cajón al que le falta dinero, y el destajo del lavador bajaría.
--     Un lavado entregado es un hecho cerrado; no se edita desde la app.
--
--  2. La hora de entrega no la debe poner la aplicación: depende del
--     reloj de quien escribe y podría mandarse cualquiera. La pone la
--     base, con su reloj.
--
--  Además, el lavador y el auto de un lavado no cambian: el porcentaje
--  del destajo se congeló para ESE lavador al registrar el ingreso.
--
--  Como en 06, el disparador solo se aplica a peticiones con sesión de la
--  aplicación. Una corrección del administrador desde el editor SQL de
--  Supabase no pasa por aquí.
--
--  Se corre después de 07. Es idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Disparador: lo que no se puede cambiar de un lavado
-- ---------------------------------------------------------------------
create or replace function fn_proteger_lavado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if auth.role() is distinct from 'authenticated' then
        return new;
    end if;

    -- Entregado (o anulado) es definitivo.
    if old.estado <> 'en_proceso' then
        raise exception 'lavado_cerrado: el lavado % ya fue entregado y no se puede modificar.', old.id;
    end if;

    if new.cliente_id <> old.cliente_id
       or new.trabajador_id <> old.trabajador_id then
        raise exception 'lavado_asignacion_fija: el auto y el lavador de un lavado no cambian.';
    end if;

    -- Al entregar, la hora la pone la base.
    if new.estado = 'entregado' then
        new.fecha_hora_entrega := now();
    end if;

    return new;
end;
$$;

-- El nombre empieza por "tr_lavado_c" para que corra antes que
-- tr_lavado_validar_cobro (los disparadores van en orden alfabético).
drop trigger if exists tr_lavado_cerrar on lavado;
create trigger tr_lavado_cerrar
    before update on lavado
    for each row execute function fn_proteger_lavado();

-- ---------------------------------------------------------------------
--  2. Función: entregar un auto
-- ---------------------------------------------------------------------
create or replace function fn_registrar_entrega(
    p_lavado_id bigint,
    p_monto     numeric,
    p_metodo    metodo_pago
)
returns void
language plpgsql
set search_path = public
as $$
declare
    v_estado estado_lavado;
begin
    -- for update: si dos personas entregan el mismo auto a la vez, la
    -- segunda espera a la primera y después ve que ya está entregado.
    select estado into v_estado
    from lavado where id = p_lavado_id
    for update;

    if not found then
        raise exception 'lavado_inexistente: no existe el lavado %.', p_lavado_id;
    end if;
    if v_estado <> 'en_proceso' then
        raise exception 'lavado_cerrado: el lavado % ya fue entregado y no se puede modificar.', p_lavado_id;
    end if;

    -- fn_validar_cobro revisa que tenga servicios y que no se cobre más
    -- que el total; lavado_entrega_coherente, que haya medio de pago.
    update lavado
       set estado             = 'entregado',
           fecha_hora_entrega = now(),
           monto_cobrado      = p_monto,
           metodo_pago        = p_metodo
     where id = p_lavado_id;
end;
$$;

revoke execute on function fn_registrar_entrega(bigint, numeric, metodo_pago) from public, anon;
grant  execute on function fn_registrar_entrega(bigint, numeric, metodo_pago) to authenticated;
