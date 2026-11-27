-- =====================================================================
--  LavaSmart — 18_planificacion.sql
--  Parámetro para convertir la predicción de demanda en lavadores.
--
--  El problema: el tablero muestra cuántos autos se esperan cada día,
--  pero la decisión del dueño es otra, cuántos lavadores convocar. Para
--  pasar de una a otra hace falta saber cuántos autos atiende un lavador
--  en un día. Ese número es del negocio, no del código: lo pone el dueño
--  en Tarifas y configuración, y la app calcula
--      lavadores sugeridos = autos esperados / autos por lavador,
--  redondeado hacia arriba.
--
--  Qué hace:
--    1. Agrega la clave autos_por_lavador a configuracion, con 5 de
--       partida (el dueño la ajusta).
--    2. Vuelve a crear fn_validar_configuracion de sql/12 con la clave
--       nueva: un número entero entre 1 y 50. Todo lo demás queda igual.
--
--  Como en 12, la validación no se aplica al editor SQL de Supabase.
--
--  Se corre después de 17. Es idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. El parámetro
-- ---------------------------------------------------------------------
insert into configuracion (clave, valor, descripcion)
values ('autos_por_lavador', '5',
        'Autos que atiende un lavador en un día. Sirve para sugerir cuántos lavadores convocar según la demanda esperada.')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
--  2. Su formato
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
        when 'autos_por_lavador' then
            if new.valor !~ '^[0-9]{1,2}$' then
                raise exception 'configuracion_autos_por_lavador_invalido: los autos por lavador son un número entero entre 1 y 50.';
            end if;
            if new.valor::integer not between 1 and 50 then
                raise exception 'configuracion_autos_por_lavador_invalido: los autos por lavador son un número entero entre 1 y 50.';
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
