-- =====================================================================
--  LavaSmart — 15_analitica_visible.sql
--  Qué ve cada rol de los resultados de los modelos, y cuál es el vigente.
--
--  1. La segmentación es solo del dueño. Es una lista de placas, y la
--     placa es dato personal (Ley N.° 29733): permite llegar al titular por
--     el registro vehicular. Sirve para decisiones comerciales, no para
--     atender el mostrador. Desde 01 la podía leer todo el personal
--     (seg_lectura); ocultarla de la pantalla no bastaba.
--     La predicción de demanda y las métricas siguen visibles para todo el
--     personal: no tienen datos de personas, y la demanda del día le sirve
--     al operador para organizarse.
--
--  2. Cada entrenamiento agrega filas con una versión nueva y no borra las
--     anteriores (así se comparan modelos). La aplicación necesita solo la
--     más reciente: dos vistas la eligen.
--
--  Las tres tablas las escribe el proceso de ml/, con la clave de
--  servicio, que no pasa por RLS. Ningún rol de la aplicación escribe en
--  ellas.
--
--  Se corre después de 14. Es idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. La segmentación, solo para el dueño
-- ---------------------------------------------------------------------
drop policy if exists seg_lectura       on cliente_segmento;
drop policy if exists seg_lectura_dueno on cliente_segmento;
create policy seg_lectura_dueno on cliente_segmento
    for select to authenticated using (fn_es_dueno());

-- ---------------------------------------------------------------------
--  2. Lo vigente: la predicción más reciente de cada día ...
-- ---------------------------------------------------------------------
create or replace view v_demanda_vigente
with (security_invoker = true) as
select distinct on (p.fecha_objetivo)
    p.fecha_objetivo,
    p.vehiculos_estimados,
    p.intervalo_inferior,
    p.intervalo_superior,
    p.modelo_version,
    p.generado_en
from prediccion_demanda p
order by p.fecha_objetivo, p.generado_en desc;

comment on view v_demanda_vigente is 'La predicción más reciente para cada día: una fila por fecha.';

-- ---------------------------------------------------------------------
--  ... y el segmento más reciente de cada cliente, con su placa
-- ---------------------------------------------------------------------
create or replace view v_segmento_vigente
with (security_invoker = true) as
select distinct on (s.cliente_id)
    s.cliente_id,
    c.placa,
    s.segmento,
    s.recencia_dias,
    s.frecuencia,
    s.monetario,
    s.modelo_version,
    s.calculado_en
from cliente_segmento s
join cliente c on c.id = s.cliente_id
order by s.cliente_id, s.calculado_en desc;

comment on view v_segmento_vigente is 'El segmento más reciente de cada cliente, con los tres valores RFM que lo explican. Solo el dueño (RLS de cliente_segmento).';
