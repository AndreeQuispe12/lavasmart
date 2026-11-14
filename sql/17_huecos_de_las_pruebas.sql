-- =====================================================================
--  LavaSmart — 17_huecos_de_las_pruebas.sql
--  Cierra los tres huecos que encontró sql/pruebas/reglas.sql.
--
--  1. El detalle de un lavado entregado se podía cambiar.
--     08 vuelve inmutable la fila de lavado, pero el precio vive en
--     detalle_lavado, que no tenía ningún disparador: un operador podía
--     cambiar el precio cobrado de un auto ya entregado, o agregarle
--     servicios, y así reescribir la caja y el destajo de días pasados.
--     Ahora detalle_lavado solo cambia mientras su lavado está en proceso.
--
--  2. El operador podía asignar autos a un lavador con el día cerrado.
--     El disparador de 10 (fn_lavado_dia_cerrado) busca la liquidación
--     cerrada, pero corría con los permisos de quien escribe, y RLS no le
--     deja ver liquidacion al operador: para él nunca había nada cerrado.
--     La regla solo se cumplía cuando registraba el dueño. Ahora corre
--     como SECURITY DEFINER, igual que fn_es_dueno: lee la liquidación
--     para decidir, sin dársela a ver al operador.
--
--  3. El dueño podía borrar filas.
--     Las políticas "FOR ALL" de tarifa, configuracion, trabajador,
--     perfil, liquidacion y los catálogos incluyen DELETE, y Supabase da
--     a anon y authenticated el permiso DELETE sobre cada tabla nueva. La
--     regla del modelo es que nada se borra (baja lógica con activo), así
--     que se quita el permiso de raíz: sin él, ninguna política vale. La
--     app no borra en ningún lado; el proceso de analítica usa
--     service_role, que no se toca. TRUNCATE, que ignora RLS, también.
--
--  Como en 06 a 13, los disparadores no actúan cuando no hay un usuario
--  conectado (editor SQL), que es por donde se corrigen los errores.
--
--  Se corre después de 16. Es idempotente.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. detalle_lavado: congelado cuando el lavado deja de estar en proceso
-- ---------------------------------------------------------------------

create or replace function fn_proteger_detalle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_estado estado_lavado;
begin
    if auth.role() is distinct from 'authenticated' then
        return coalesce(new, old);
    end if;

    -- Se revisa el lavado de la fila nueva y, si cambió de lavado, también
    -- el de la anterior: ninguno de los dos puede estar cerrado.
    select estado into v_estado
    from lavado where id = coalesce(new.lavado_id, old.lavado_id);

    if v_estado is distinct from 'en_proceso' then
        raise exception 'detalle_lavado_cerrado: el lavado % ya fue entregado; sus servicios y precios no cambian.',
            coalesce(new.lavado_id, old.lavado_id);
    end if;

    if tg_op = 'UPDATE' and new.lavado_id <> old.lavado_id then
        raise exception 'detalle_lavado_fijo: un servicio no se pasa de un lavado a otro.';
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists tr_detalle_proteger on detalle_lavado;
create trigger tr_detalle_proteger
    before insert or update on detalle_lavado
    for each row execute function fn_proteger_detalle();


-- ---------------------------------------------------------------------
-- 2. El día cerrado se respeta, registre quien registre
-- ---------------------------------------------------------------------

-- Misma función de 10; solo cambia con qué permisos corre. Un disparador
-- no se puede llamar directamente, así que no expone la liquidación.
alter function fn_lavado_dia_cerrado() security definer;


-- ---------------------------------------------------------------------
-- 3. Nada se borra desde la aplicación
-- ---------------------------------------------------------------------

revoke delete, truncate on all tables in schema public from anon, authenticated;

-- Y para las tablas que se creen después con este mismo usuario.
alter default privileges in schema public
    revoke delete, truncate on tables from anon, authenticated;
