-- =====================================================================
--  LavaSmart — 19_segmentos_accionables.sql
--  Dos lecturas para que el dueño haga algo con la segmentación.
--
--  El problema: el tablero mostraba cuántos clientes hay en cada
--  segmento, pero no cuánto dinero representa cada uno ni a quién
--  conviene llamar. Las dos respuestas son sumas y cálculos sobre
--  lavados, y las sumas de dinero las hace la base, no la aplicación.
--
--  Qué hace:
--    1. fn_segmentos_resumen(): por segmento, cuántos clientes, qué parte
--       del total, cuánto pagaron en total y qué parte del ingreso es,
--       los promedios de recencia, visitas y gasto, y cuánto volvería si
--       regresara uno de cada diez (útil sobre todo en Inactivos). Lee
--       v_segmento_vigente: hereda su RLS, solo el dueño ve filas.
--
--    2. fn_clientes_alejandose(): clientes que tenían costumbre y la
--       están perdiendo. Se calcula en el momento con los lavados, no con
--       el último entrenamiento: alguien con tres o más visitas, que
--       venía cada N días y ya lleva más del doble sin venir, pero menos
--       de 60 (todavía se puede recuperar). Ordenados por lo que pagaron
--       en total: el dinero en riesgo. Trae nombre y celular para que el
--       dueño lo reconozca, así que solo devuelve filas al dueño, aunque
--       el operador vea los lavados.
--
--  Las dos son de solo lectura (stable) y corren con los permisos de
--  quien llama.
--
--  Se corre después de 18. Es idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Cuánto vale cada segmento
-- ---------------------------------------------------------------------
create or replace function fn_segmentos_resumen()
returns table (
    segmento         text,
    clientes         integer,
    pct_clientes     numeric,
    ingreso          numeric,
    pct_ingreso      numeric,
    recencia_prom    numeric,
    visitas_prom     numeric,
    gasto_prom       numeric,
    recuperar_decimo numeric
)
language sql
stable
set search_path = public
as $$
    with s as (select * from v_segmento_vigente),
    total as (select count(*) as clientes, sum(monetario) as ingreso from s)
    select
        s.segmento,
        count(*)::integer,
        round(100.0 * count(*) / nullif(t.clientes, 0), 1),
        sum(s.monetario),
        round(100 * sum(s.monetario) / nullif(t.ingreso, 0), 1),
        round(avg(s.recencia_dias), 0),
        round(avg(s.frecuencia), 1),
        round(avg(s.monetario), 2),
        -- Si volviera uno de cada diez, a su gasto promedio.
        round(round(count(*) / 10.0) * avg(s.monetario), 2)
    from s cross join total t
    group by s.segmento, t.clientes, t.ingreso
    order by avg(s.frecuencia) desc;
$$;

-- ---------------------------------------------------------------------
--  2. A quién llamar: los que se están alejando
-- ---------------------------------------------------------------------
create or replace function fn_clientes_alejandose(p_limite integer default 15)
returns table (
    placa          text,
    nombre         text,
    telefono       text,
    visitas        integer,
    cada_dias      integer,
    dias_sin_venir integer,
    gastado        numeric
)
language sql
stable
set search_path = public
as $$
    with visitas as (
        select l.cliente_id,
               count(*) as n,
               min((l.fecha_hora_entrega at time zone 'America/Lima')::date) as primera,
               max((l.fecha_hora_entrega at time zone 'America/Lima')::date) as ultima,
               sum(l.monto_cobrado) as gastado
        from lavado l
        where l.estado = 'entregado'
        group by l.cliente_id
        having count(*) >= 3
    ),
    costumbre as (
        select v.*,
               greatest(1, round((v.ultima - v.primera)::numeric / (v.n - 1)))::integer as cada,
               ((now() at time zone 'America/Lima')::date - v.ultima) as sin_venir
        from visitas v
    )
    select c.placa, c.nombre, c.telefono, k.n::integer, k.cada, k.sin_venir, k.gastado
    from costumbre k
    join cliente c on c.id = k.cliente_id
    where fn_es_dueno()
      and k.sin_venir > 2 * k.cada
      and k.sin_venir <= 60
    order by k.gastado desc, k.sin_venir
    limit p_limite;
$$;

revoke execute on function fn_segmentos_resumen() from public, anon;
grant  execute on function fn_segmentos_resumen() to authenticated;
revoke execute on function fn_clientes_alejandose(integer) from public, anon;
grant  execute on function fn_clientes_alejandose(integer) to authenticated;
