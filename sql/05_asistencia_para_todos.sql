-- =====================================================================
--  LavaSmart — 05_asistencia_para_todos.sql
--  Exige asistencia también a los trabajadores de sueldo fijo.
--
--  El problema: fn_fijar_porcentaje_destajo (01_esquema.sql) preguntaba
--  primero si el trabajador era de sueldo fijo y, si lo era, salía sin
--  mirar su asistencia. Resultado: a un fijo se le podía asignar un auto
--  sin haber marcado entrada, o en un día marcado como falta. Eso rompe
--  la regla "primero se marca entrada, después se reciben autos", que es
--  para todos y no solo para los de destajo.
--
--  La corrección invierte el orden: primero la asistencia, para todos;
--  después, solo para los de destajo, el porcentaje. Además, un día con
--  falta o "no laboró" tampoco recibe autos: antes solo lo impedía, de
--  rebote, que esas filas no llevan porcentaje.
--
--  Lo demás no cambia: la función se sigue llamando igual y el disparador
--  tr_lavado_fijar_porcentaje la sigue usando, así que no se toca.
--
--  Se corre después de 01 y de 04. Es idempotente.
-- =====================================================================

create or replace function fn_fijar_porcentaje_destajo()
returns trigger
language plpgsql
-- create or replace reemplaza también la configuración de la función: sin
-- esta línea se perdería el search_path fijo que puso 04_seguridad_advisor.
set search_path = public
as $$
declare
    v_modalidad  modalidad_pago;
    v_estado     estado_asistencia;
    v_porcentaje numeric(5,2);
    v_fecha      date;
begin
    -- El día del negocio es el de Lima, no el de UTC.
    v_fecha := (new.fecha_hora_ingreso at time zone 'America/Lima')::date;

    select a.estado, a.porcentaje_destajo
      into v_estado, v_porcentaje
    from asistencia a
    where a.trabajador_id = new.trabajador_id
      and a.fecha = v_fecha;

    -- 1. Para todos: sin entrada marcada ese día, no recibe autos.
    if not found or v_estado in ('falta', 'no_laboro') then
        raise exception
            'El lavador % no tiene asistencia registrada para el %. Registre su ingreso antes de asignarle un auto.',
            new.trabajador_id, v_fecha;
    end if;

    select modalidad into v_modalidad
    from trabajador where id = new.trabajador_id;

    -- 2. El de sueldo fijo no cobra porcentaje.
    if v_modalidad = 'fijo' then
        new.porcentaje_destajo := null;
        return new;
    end if;

    -- 3. El de destajo: se congela el porcentaje que se fijó al marcar.
    if v_porcentaje is null then
        raise exception
            'La asistencia del lavador % del % no tiene porcentaje de destajo. Revise cómo se registró.',
            new.trabajador_id, v_fecha;
    end if;

    new.porcentaje_destajo := v_porcentaje;
    return new;
end;
$$;
