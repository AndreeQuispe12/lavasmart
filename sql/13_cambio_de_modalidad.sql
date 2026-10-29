-- =====================================================================
--  LavaSmart — 13_cambio_de_modalidad.sql
--  La modalidad y el sueldo de un trabajador solo cambian con sus días
--  cerrados.
--
--  El problema: la modalidad y el sueldo diario se leen al CERRAR el día
--  (sql/10), no antes. Si a un lavador a destajo se lo pasara a sueldo
--  fijo a media tarde, al cerrar ese día la base calcularía el destajo de
--  sus autos (el porcentaje quedó congelado en cada lavado) Y ADEMÁS el
--  sueldo del día: se le pagaría dos veces. Si se le cambiara el sueldo
--  con días sin cerrar, esos días se pagarían con el sueldo nuevo.
--
--  La regla: modalidad y sueldo_dia solo cambian si el trabajador no tiene
--  autos en piso ni días con actividad (asistencia o autos entregados)
--  sin liquidación cerrada. Así cada día se paga con una sola regla, la
--  vigente ese día, y el cambio vale desde el día siguiente al cierre.
--
--  Nombre, apellidos, documento y frecuencia de pago cambian siempre: no
--  alteran cuánto se le debe a nadie.
--
--  Como en 06, 08, 09 y 12, no se aplica al editor SQL de Supabase.
--
--  Se corre después de 12. Es idempotente.
-- =====================================================================

create or replace function fn_proteger_trabajador()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if auth.role() is distinct from 'authenticated' then
        return new;
    end if;

    if new.modalidad is not distinct from old.modalidad
       and new.sueldo_dia is not distinct from old.sueldo_dia then
        return new;
    end if;

    if exists (select 1 from lavado l
               where l.trabajador_id = old.id and l.estado = 'en_proceso') then
        raise exception 'trabajador_autos_en_piso: tiene autos en piso; entrégalos y cierra su día antes de cambiar su modalidad o su sueldo.';
    end if;

    if exists (
        select 1
        from (
            select a.fecha
            from asistencia a
            where a.trabajador_id = old.id
            union
            select (l.fecha_hora_entrega at time zone 'America/Lima')::date
            from lavado l
            where l.trabajador_id = old.id and l.estado = 'entregado'
        ) dias
        where not exists (
            select 1 from liquidacion q
            where q.trabajador_id = old.id
              and q.fecha = dias.fecha
              and q.cerrada
        )
    ) then
        raise exception 'trabajador_dias_abiertos: tiene días sin cerrar; ciérralos en Liquidación antes de cambiar su modalidad o su sueldo. El cambio vale desde el día siguiente.';
    end if;

    return new;
end;
$$;

drop trigger if exists tr_trabajador_proteger on trabajador;
create trigger tr_trabajador_proteger
    before update on trabajador
    for each row execute function fn_proteger_trabajador();
