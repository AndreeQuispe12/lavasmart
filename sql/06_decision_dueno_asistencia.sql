-- =====================================================================
--  LavaSmart — 06_decision_dueno_asistencia.sql
--  El descuento y el "no laboró" los decide solo el dueño.
--
--  El problema: la política asi_edicion deja que todo el personal edite
--  cualquier asistencia. La pantalla solo le muestra al dueño los
--  controles de descuento y de "no laboró", pero un operador que llame a
--  la API directamente podría ponerse o quitarse un descuento. La regla
--  del negocio es que esa decisión es del dueño, así que tiene que vivir
--  en la base, no solo en la pantalla.
--
--  Lo que hace este disparador, antes de guardar una asistencia:
--    1. Si cambia el descuento, el motivo o el estado "no laboró", exige
--       que quien lo hace sea el dueño.
--    2. Un descuento solo existe para el de sueldo fijo: el de destajo ya
--       paga su tardanza con el porcentaje menor.
--    3. Anota en autorizado_por quién decidió, sin confiar en lo que mande
--       la aplicación.
--
--  Solo se aplica a peticiones con sesión de la aplicación (rol
--  authenticated). Una corrección hecha por el administrador desde el
--  editor SQL de Supabase no pasa por aquí.
--
--  Se corre después de 05. Es idempotente.
-- =====================================================================

create or replace function fn_proteger_decision_dueno()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_modalidad modalidad_pago;
    v_decide    boolean;
begin
    if auth.role() is distinct from 'authenticated' then
        return new;
    end if;

    -- ¿Esta escritura toca una decisión del dueño?
    if tg_op = 'INSERT' then
        v_decide := new.descuento_monto <> 0
                 or new.descuento_motivo is not null
                 or new.estado = 'no_laboro';
    else
        v_decide := new.descuento_monto  is distinct from old.descuento_monto
                 or new.descuento_motivo is distinct from old.descuento_motivo
                 or (new.estado = 'no_laboro') <> (old.estado = 'no_laboro');
    end if;

    if not v_decide then
        -- autorizado_por solo lo escribe este disparador.
        if tg_op = 'UPDATE' then
            new.autorizado_por := old.autorizado_por;
        else
            new.autorizado_por := null;
        end if;
        return new;
    end if;

    -- 1. Solo el dueño.
    if not fn_es_dueno() then
        raise exception 'asistencia_decision_dueno: el descuento y el día no laborado los decide solo el dueño.';
    end if;

    -- 2. El descuento es para el de sueldo fijo.
    if new.descuento_monto <> 0 then
        select modalidad into v_modalidad
        from trabajador where id = new.trabajador_id;
        if v_modalidad <> 'fijo' then
            raise exception 'asistencia_descuento_solo_fijo: el trabajador a destajo no lleva descuento; su tardanza ya baja el porcentaje.';
        end if;
    end if;

    -- 3. Queda anotado quién decidió.
    new.autorizado_por := auth.uid();
    return new;
end;
$$;

drop trigger if exists tr_asistencia_decision_dueno on asistencia;
create trigger tr_asistencia_decision_dueno
    before insert or update on asistencia
    for each row execute function fn_proteger_decision_dueno();
