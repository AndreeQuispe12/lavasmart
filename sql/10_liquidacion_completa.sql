-- =====================================================================
--  LavaSmart — 10_liquidacion_completa.sql
--  La liquidación del día, para destajo y para sueldo fijo, calculada y
--  cerrada por la base.
--
--  Los problemas:
--
--  1. liquidacion solo sabía guardar el destajo. El de sueldo fijo también
--     devenga cada día (su sueldo, menos el descuento si llegó tarde) y se
--     le paga cada semana; sin columnas para eso, el dueño seguiría
--     llevando a la mitad de su personal en el cuaderno.
--
--  2. Los montos no deben sumarse en la aplicación. Los calcula la base:
--     el destajo, sobre lo COBRADO y con el porcentaje CONGELADO en cada
--     lavado (nunca el de configuracion); el sueldo y el descuento, de la
--     asistencia del día.
--
--  3. Un auto cuenta para el día en que se ENTREGA, porque el destajo es
--     sobre lo cobrado y se cobra al entregar. Por eso, si se cerrara hoy
--     el día de un lavador y después se le entregara otro auto hoy mismo,
--     ese cobro quedaría fuera de toda liquidación. Se evita así:
--       - un día pasado se cierra siempre: lo que quede en piso se
--         entregará otro día y contará en ese día;
--       - el día de HOY de un lavador solo se cierra si no tiene autos en
--         piso;
--       - con su día de hoy cerrado, ese lavador ya no recibe ni entrega
--         autos hoy.
--
--  El total a pagar no se guarda: lo calcula la vista v_liquidacion.
--
--  Se corre después de 09.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Columnas para el sueldo fijo
-- ---------------------------------------------------------------------
alter table liquidacion
    add column if not exists monto_sueldo    numeric(10,2) not null default 0,
    add column if not exists monto_descuento numeric(10,2) not null default 0;

alter table liquidacion drop constraint if exists liquidacion_sueldo_no_negativo;
alter table liquidacion add  constraint liquidacion_sueldo_no_negativo
    check (monto_sueldo >= 0 and monto_descuento >= 0);

-- El descuento no puede dejar al trabajador debiendo.
alter table liquidacion drop constraint if exists liquidacion_total_no_negativo;
alter table liquidacion add  constraint liquidacion_total_no_negativo
    check (monto_destajo + monto_sueldo - monto_descuento >= 0);

comment on table  liquidacion is 'Lo devengado por cada trabajador en un día. Devengar no es pagar: se calcula y se cierra cada día; el dinero sale cuando se entrega.';
comment on column liquidacion.monto_sueldo    is 'DATO CONGELADO. Sueldo del día del trabajador fijo que trabajó, copiado al cerrar.';
comment on column liquidacion.monto_descuento is 'DATO CONGELADO. Descuento por tardanza que puso el dueño en la asistencia, copiado al cerrar.';

-- ---------------------------------------------------------------------
--  2. Una liquidación cerrada no cambia: ahora también sus columnas nuevas
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
    return new;
end;
$$;

-- ---------------------------------------------------------------------
--  3. El total a pagar se calcula
-- ---------------------------------------------------------------------
create or replace view v_liquidacion
with (security_invoker = true) as
select
    l.*,
    l.monto_destajo + l.monto_sueldo - l.monto_descuento as monto_a_pagar
from liquidacion l;

comment on view v_liquidacion is 'La liquidación con su total a pagar: destajo más sueldo menos descuento.';

-- ---------------------------------------------------------------------
--  4. Cálculo del día (no escribe nada)
-- ---------------------------------------------------------------------
create or replace function fn_calcular_liquidacion(p_fecha date)
returns table (
    trabajador_id      bigint,
    modalidad          modalidad_pago,
    monto_cobrado_base numeric,
    monto_destajo      numeric,
    monto_sueldo       numeric,
    monto_descuento    numeric,
    autos_en_piso      integer
)
language sql
stable
set search_path = public
as $$
    with entregados as (
        -- Lo cobrado ese día (por fecha de ENTREGA en Lima). El destajo usa
        -- el porcentaje congelado en cada lavado; el del fijo es nulo.
        select l.trabajador_id,
               sum(l.monto_cobrado) as base,
               round(sum(l.monto_cobrado * coalesce(l.porcentaje_destajo, 0) / 100), 2) as destajo
        from lavado l
        where l.estado = 'entregado'
          and (l.fecha_hora_entrega at time zone 'America/Lima')::date = p_fecha
        group by l.trabajador_id
    ),
    asistio as (
        select a.trabajador_id, a.estado, a.descuento_monto
        from asistencia a
        where a.fecha = p_fecha
    ),
    en_piso as (
        select l.trabajador_id, count(*)::integer as n
        from lavado l
        where l.estado = 'en_proceso'
        group by l.trabajador_id
    ),
    involucrados as (
        select e.trabajador_id from entregados e
        union
        select a.trabajador_id from asistio a
    )
    select
        t.id,
        t.modalidad,
        coalesce(e.base, 0),
        coalesce(e.destajo, 0),
        -- El fijo cobra su sueldo si trabajó ese día (no si faltó ni si el
        -- dueño lo mandó a casa), menos el descuento que puso el dueño.
        case when t.modalidad = 'fijo' and a.estado in ('puntual', 'tardanza')
             then t.sueldo_dia else 0 end,
        case when t.modalidad = 'fijo' and a.estado in ('puntual', 'tardanza')
             then coalesce(a.descuento_monto, 0) else 0 end,
        coalesce(p.n, 0)
    from involucrados i
    join trabajador t on t.id = i.trabajador_id
    left join entregados e on e.trabajador_id = t.id
    left join asistio    a on a.trabajador_id = t.id
    left join en_piso    p on p.trabajador_id = t.id;
$$;

-- ---------------------------------------------------------------------
--  5. Cierre del día (solo el dueño)
-- ---------------------------------------------------------------------
create or replace function fn_cerrar_dia(p_fecha date)
returns table (trabajador_id bigint, resultado text)
language plpgsql
set search_path = public
as $$
declare
    v_hoy date := (now() at time zone 'America/Lima')::date;
    r     record;
begin
    if not fn_es_dueno() then
        raise exception 'liquidacion_solo_dueno: solo el dueño cierra el día.';
    end if;
    if p_fecha > v_hoy then
        raise exception 'liquidacion_fecha_futura: no se puede cerrar un día que todavía no llega.';
    end if;

    for r in select * from fn_calcular_liquidacion(p_fecha) loop
        trabajador_id := r.trabajador_id;

        if exists (select 1 from liquidacion l
                   where l.trabajador_id = r.trabajador_id
                     and l.fecha = p_fecha and l.cerrada) then
            resultado := 'ya_cerrada';
        elsif p_fecha = v_hoy and r.autos_en_piso > 0 then
            resultado := 'autos_en_piso';
        else
            insert into liquidacion (
                trabajador_id, fecha, monto_cobrado_base, monto_destajo,
                monto_sueldo, monto_descuento, cerrada, fecha_cierre)
            values (
                r.trabajador_id, p_fecha, r.monto_cobrado_base, r.monto_destajo,
                r.monto_sueldo, r.monto_descuento, true, now())
            on conflict on constraint liquidacion_unica do update
               set monto_cobrado_base = excluded.monto_cobrado_base,
                   monto_destajo      = excluded.monto_destajo,
                   monto_sueldo       = excluded.monto_sueldo,
                   monto_descuento    = excluded.monto_descuento,
                   cerrada            = true,
                   fecha_cierre       = now();
            resultado := 'cerrada';
        end if;

        return next;
    end loop;
end;
$$;

-- ---------------------------------------------------------------------
--  6. Con el día de hoy cerrado, el lavador no recibe ni entrega autos hoy
-- ---------------------------------------------------------------------
create or replace function fn_lavado_dia_cerrado()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_dia date;
begin
    if auth.role() is distinct from 'authenticated' then
        return new;
    end if;

    if tg_op = 'INSERT' then
        v_dia := (new.fecha_hora_ingreso at time zone 'America/Lima')::date;
    elsif new.estado = 'entregado' and old.estado <> 'entregado' then
        v_dia := (now() at time zone 'America/Lima')::date;
    else
        return new;
    end if;

    if exists (select 1 from liquidacion l
               where l.trabajador_id = new.trabajador_id
                 and l.fecha = v_dia and l.cerrada) then
        raise exception 'liquidacion_dia_cerrado: el día de este lavador ya se cerró; asigne el auto a otro lavador.';
    end if;
    return new;
end;
$$;

drop trigger if exists tr_lavado_dia_cerrado on lavado;
create trigger tr_lavado_dia_cerrado
    before insert or update on lavado
    for each row execute function fn_lavado_dia_cerrado();

revoke execute on function fn_calcular_liquidacion(date) from public, anon;
grant  execute on function fn_calcular_liquidacion(date) to authenticated;
revoke execute on function fn_cerrar_dia(date) from public, anon;
grant  execute on function fn_cerrar_dia(date) to authenticated;
