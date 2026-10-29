-- =====================================================================
--  LavaSmart — 14_tablero.sql
--  Los resúmenes del tablero del dueño, sumados por la base.
--
--  El tablero muestra totales de varios días y de varios trabajadores.
--  Como toda suma de dinero del sistema, se hacen aquí y no en la
--  aplicación (que solo los dibuja). Ninguna de estas funciones escribe.
--
--  La cobranza por día ya existe (v_caja_dia); aquí se agrega:
--    - fn_tablero_resumen: lo no cobrado por pagos incompletos (solo de
--      autos ENTREGADOS: uno en proceso no es deuda) y lo que se le debe
--      al personal;
--    - fn_servicios_mas_pedidos: cuántas veces se pidió cada servicio y
--      cuánto sumó, con el precio congelado de cada visita.
--
--  Corren con los permisos de quien las llama: lo que se le debe al
--  personal sale de liquidacion, que solo ve el dueño (RLS).
--
--  Se corre después de 13. Es idempotente.
-- =====================================================================

create or replace function fn_tablero_resumen(p_desde date)
returns table (
    saldo_no_cobrado       numeric,
    autos_con_saldo        integer,
    por_pagar              numeric,
    trabajadores_por_pagar integer
)
language sql
stable
set search_path = public
as $$
    select
        coalesce(sum(v.saldo), 0),
        count(v.id)::integer,
        (select coalesce(sum(p.monto), 0) from v_por_pagar p),
        (select count(*)::integer from v_por_pagar p)
    from v_lavado v
    where v.estado = 'entregado'
      and v.saldo > 0
      and (v.fecha_hora_entrega at time zone 'America/Lima')::date >= p_desde;
$$;

create or replace function fn_servicios_mas_pedidos(p_desde date)
returns table (servicio text, cantidad integer, monto numeric)
language sql
stable
set search_path = public
as $$
    select t.nombre, count(*)::integer, sum(d.precio_cobrado)
    from detalle_lavado d
    join lavado      l on l.id = d.lavado_id
    join tipo_lavado t on t.id = d.tipo_lavado_id
    where l.estado <> 'anulado'
      and (l.fecha_hora_ingreso at time zone 'America/Lima')::date >= p_desde
    group by t.nombre
    order by count(*) desc, t.nombre;
$$;

revoke execute on function fn_tablero_resumen(date) from public, anon;
grant  execute on function fn_tablero_resumen(date) to authenticated;
revoke execute on function fn_servicios_mas_pedidos(date) from public, anon;
grant  execute on function fn_servicios_mas_pedidos(date) to authenticated;
