-- =====================================================================
--  LavaSmart — 04_seguridad_advisor.sql
--  Corrige los hallazgos del Security Advisor de Supabase sobre
--  01_esquema.sql.
--
--  Este cambio se aplicó directo en la base el 2026-09-12 (migración
--  20260912231308_fix_security_advisor_findings), antes de que existiera
--  como archivo. Se recuperó de supabase_migrations.schema_migrations
--  para que el repositorio vuelva a decir lo mismo que la base.
--
--  En el proyecto actual YA ESTÁ APLICADO. En un entorno nuevo se corre
--  después de 01_esquema.sql; no depende de 02 ni de 03, así que el
--  orden respecto de ellos da igual. Todas las sentencias son
--  idempotentes: correrlo dos veces no rompe nada.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Vistas: que respeten el RLS de quien consulta, no el del dueño de
--     la vista. Sin esto, v_lavado y v_caja_dia se saltan las políticas.
-- ---------------------------------------------------------------------
alter view public.v_lavado   set (security_invoker = true);
alter view public.v_caja_dia set (security_invoker = true);

-- ---------------------------------------------------------------------
--  2. Funciones de los disparadores: search_path fijo, para que nadie
--     pueda colar una tabla con el mismo nombre desde otro esquema.
-- ---------------------------------------------------------------------
alter function public.fn_normalizar_placa()             set search_path = public;
alter function public.fn_validar_cobro()                set search_path = public;
alter function public.fn_fijar_porcentaje_destajo()     set search_path = public;
alter function public.fn_proteger_liquidacion_cerrada() set search_path = public;

-- ---------------------------------------------------------------------
--  3. fn_es_dueno / fn_es_personal: fuera del alcance de anon. Solo las
--     necesitan las políticas RLS, que corren como usuario autenticado.
-- ---------------------------------------------------------------------
revoke execute on function public.fn_es_dueno()    from public, anon;
revoke execute on function public.fn_es_personal() from public, anon;
grant  execute on function public.fn_es_dueno()    to authenticated;
grant  execute on function public.fn_es_personal() to authenticated;
