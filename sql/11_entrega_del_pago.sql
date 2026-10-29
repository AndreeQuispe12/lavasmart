-- =====================================================================
--  LavaSmart — 11_entrega_del_pago.sql
--  Registrar que el dinero salió del cajón.
--
--  Devengar no es pagar: el día se cierra (sql/10) y el dinero se entrega
--  después. Al de destajo diario, normalmente al día siguiente; al de
--  sueldo fijo y al de destajo semanal, una vez por semana, juntando los
--  días cerrados que tenga pendientes. Por eso se paga "todo lo pendiente
--  de un trabajador hasta tal día", no día por día.
--
--  Reglas:
--    - Solo el dueño paga.
--    - Solo se paga lo cerrado (ya lo exige liquidacion_entrega_requiere_cierre).
--    - La fecha de pago la pone la base: el día de hoy en Lima.
--    - Un pago registrado no se deshace ni cambia de fecha.
--    - Se paga hasta el último día que el dueño vio en pantalla: si
--      mientras tanto se cerró otro día, ese no se incluye a ciegas.
--
--  Se corre después de 10.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Un pago registrado no se deshace
-- ---------------------------------------------------------------------
create or replace function fn_proteger_liquidacion_cerrada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if old.cerrada
       and (old.monto_cobrado_base is distinct from new.monto_cobrado_base
            or old.monto_destajo   is distinct from new.monto_destajo
            or old.monto_sueldo    is distinct from new.monto_sueldo
            or old.monto_descuento is distinct from new.monto_descuento
            or old.trabajador_id   is distinct from new.trabajador_id
            or old.fecha           is distinct from new.fecha
            or not new.cerrada) then
        raise exception 'liquidacion_cerrada: una liquidación cerrada no puede modificar sus montos, su fecha ni reabrirse.';
    end if;

    if old.entregada
       and (not new.entregada
            or new.fecha_entrega is distinct from old.fecha_entrega) then
        raise exception 'liquidacion_pagada: un pago ya registrado no se deshace ni cambia de fecha.';
    end if;

    return new;
end;
$$;

-- ---------------------------------------------------------------------
--  2. Lo que se le debe a cada trabajador
-- ---------------------------------------------------------------------
create or replace view v_por_pagar
with (security_invoker = true) as
select
    l.trabajador_id,
    count(*)::integer   as dias,
    min(l.fecha)        as desde,
    max(l.fecha)        as hasta,
    sum(l.monto_destajo + l.monto_sueldo - l.monto_descuento) as monto
from liquidacion l
where l.cerrada and not l.entregada
group by l.trabajador_id;

comment on view v_por_pagar is 'Por trabajador: los días cerrados que todavía no se le pagaron y cuánto suman.';

-- ---------------------------------------------------------------------
--  3. Pagar
-- ---------------------------------------------------------------------
create or replace function fn_entregar_pago(
    p_trabajador_id bigint,
    p_hasta         date
)
returns table (dias integer, monto numeric)
language plpgsql
set search_path = public
as $$
begin
    if not fn_es_dueno() then
        raise exception 'liquidacion_solo_dueno: solo el dueño registra los pagos.';
    end if;

    with pagadas as (
        update liquidacion l
           set entregada     = true,
               fecha_entrega = (now() at time zone 'America/Lima')::date
         where l.trabajador_id = p_trabajador_id
           and l.cerrada
           and not l.entregada
           and l.fecha <= p_hasta
        returning l.monto_destajo + l.monto_sueldo - l.monto_descuento as a_pagar
    )
    select count(*)::integer, coalesce(sum(a_pagar), 0)
      into dias, monto
      from pagadas;

    if dias = 0 then
        raise exception 'liquidacion_nada_por_pagar: este trabajador no tiene días cerrados pendientes de pago.';
    end if;

    return next;
end;
$$;

revoke execute on function fn_entregar_pago(bigint, date) from public, anon;
grant  execute on function fn_entregar_pago(bigint, date) to authenticated;
