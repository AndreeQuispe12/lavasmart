-- =====================================================================
--  LavaSmart — 12_configuracion_valida.sql
--  Valores válidos en configuracion, y la fecha de cambio la pone la base.
--
--  Los problemas:
--
--  1. configuracion guarda todo como texto. Si el dueño escribiera "8 am"
--     en la hora de entrada, la pantalla de asistencia dejaría de poder
--     marcar a nadie (no sabría contra qué hora comparar). La base tiene
--     que rechazar un valor que no sirve, igual que rechaza una placa mal
--     escrita.
--
--  2. moneda y zona_horaria no se cambian desde la aplicación: el sistema
--     entero asume soles y la hora de Lima.
--
--  3. tarifa.actualizado_en y configuracion.actualizado_en solo tomaban la
--     hora al crearse. Ahora la toman también al cambiar, con el reloj de
--     la base.
--
--  Cambiar una tarifa o un porcentaje no toca el pasado: el precio quedó
--  congelado en cada detalle_lavado, y la hora, la tolerancia y el
--  porcentaje, en cada asistencia y cada lavado.
--
--  Como en 06, 08 y 09, las reglas de la aplicación no se aplican al
--  editor SQL de Supabase.
--
--  Se corre después de 11. Es idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. La hora del último cambio
-- ---------------------------------------------------------------------
create or replace function fn_tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.actualizado_en := now();
    return new;
end;
$$;

drop trigger if exists tr_tarifa_actualizado_en on tarifa;
create trigger tr_tarifa_actualizado_en
    before update on tarifa
    for each row execute function fn_tocar_actualizado_en();

drop trigger if exists tr_configuracion_actualizado_en on configuracion;
create trigger tr_configuracion_actualizado_en
    before update on configuracion
    for each row execute function fn_tocar_actualizado_en();

-- ---------------------------------------------------------------------
--  2. Cada clave con su formato
-- ---------------------------------------------------------------------
create or replace function fn_validar_configuracion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if auth.role() is distinct from 'authenticated' then
        return new;
    end if;

    if tg_op = 'UPDATE' and new.clave is distinct from old.clave then
        raise exception 'configuracion_clave_fija: la clave de un parámetro no se cambia.';
    end if;

    case new.clave
        when 'hora_entrada' then
            if new.valor !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
                raise exception 'configuracion_hora_invalida: la hora de entrada va en formato HH:MM de 24 horas, por ejemplo 08:00.';
            end if;
        -- El formato se revisa antes de convertir: un OR no garantiza el
        -- orden, y '8 am'::integer fallaría con un error sin explicación.
        when 'tolerancia_minutos' then
            if new.valor !~ '^[0-9]{1,3}$' then
                raise exception 'configuracion_tolerancia_invalida: la tolerancia es un número entero de minutos, entre 0 y 120.';
            end if;
            if new.valor::integer > 120 then
                raise exception 'configuracion_tolerancia_invalida: la tolerancia es un número entero de minutos, entre 0 y 120.';
            end if;
        when 'pct_destajo_puntual', 'pct_destajo_tardanza' then
            if new.valor !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then
                raise exception 'configuracion_porcentaje_invalido: el porcentaje va entre 0 y 100, con hasta dos decimales.';
            end if;
            if new.valor::numeric > 100 then
                raise exception 'configuracion_porcentaje_invalido: el porcentaje va entre 0 y 100, con hasta dos decimales.';
            end if;
        when 'moneda', 'zona_horaria' then
            if tg_op = 'INSERT' or new.valor is distinct from old.valor then
                raise exception 'configuracion_fija: % no se cambia desde la aplicación.', new.clave;
            end if;
        else
            raise exception 'configuracion_clave_desconocida: % no es un parámetro del sistema.', new.clave;
    end case;

    return new;
end;
$$;

drop trigger if exists tr_configuracion_validar on configuracion;
create trigger tr_configuracion_validar
    before insert or update on configuracion
    for each row execute function fn_validar_configuracion();
