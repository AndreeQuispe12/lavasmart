-- =====================================================================
--  LavaSmart — pruebas/reglas.sql
--
--  Casos que comprueban que la base hace cumplir las reglas del negocio
--  (sql/05 a sql/17) y los permisos de cada rol (RLS), comportándose como
--  lo hace cuando la aplicación llama: con un usuario autenticado.
--
--  Por qué así:
--    Los disparadores no validan cuando no hay un usuario conectado
--    (auth.role() distinto de 'authenticated'), para que el editor SQL y
--    el proceso de analítica puedan corregir datos. Una prueba corrida
--    "a pelo" desde el editor dejaría pasar lo que la app rechazaría. Por
--    eso cada caso se ejecuta con SET ROLE authenticated y el usuario
--    puesto en request.jwt.claims, igual que hace PostgREST.
--
--  Cómo ejecutarlo:
--    Solo en LavaSmart-dev (se niega a correr si no encuentra los datos
--    de prueba de 03). Pegar el archivo entero en el editor SQL de
--    Supabase y ejecutar. Devuelve una tabla: un caso por fila, con lo
--    esperado, lo obtenido y si pasa, y al final el resumen.
--
--  No deja rastro:
--    Todo ocurre dentro de un bloque que termina lanzando un error a
--    propósito, así que cada fila creada (trabajadores, clientes,
--    lavados, usuarios de prueba) se deshace. Los resultados sobreviven
--    porque se acumulan en una variable, y las variables no se deshacen.
--    Se puede correr cuantas veces haga falta.
--
--  Cómo leer "esperado":
--    rechazo:<texto>  el motor tiene que negarse con un error que diga
--                     <texto> (el nombre de la regla incumplida).
--    rechazo:         tiene que negarse, con cualquier error.
--    otro valor       el resultado exacto que tiene que devolver.
-- =====================================================================


-- Ejecuta un caso y lo compara con lo esperado. Cada caso corre en su
-- propio subbloque: si falla, se deshace solo él y la prueba sigue.
create or replace function pg_temp.probar(
    p_grupo text, p_caso text, p_sql text, p_espera text
)
returns jsonb
language plpgsql
as $f$
declare
    v_valor    text;
    v_obtenido text;
    v_pasa     boolean;
begin
    begin
        execute p_sql into v_valor;
        v_obtenido := coalesce(v_valor, '(nulo)');
    exception when others then
        v_obtenido := 'ERROR: ' || sqlerrm;
    end;

    if p_espera like 'rechazo:%' then
        v_pasa := v_obtenido like 'ERROR: %'
              and position(substr(p_espera, 9) in v_obtenido) > 0;
    else
        v_pasa := v_obtenido = p_espera;
    end if;

    return jsonb_build_array(jsonb_build_object(
        'grupo', p_grupo, 'caso', p_caso, 'esperado', p_espera,
        'obtenido', left(v_obtenido, 160), 'pasa', v_pasa));
end;
$f$;

-- Se hace pasar por un usuario: 'dueno', 'operador', 'sin_perfil',
-- 'anon' o 'admin' (vuelve al usuario del editor, que ignora RLS).
create or replace function pg_temp.como(p_quien text)
returns void
language plpgsql
as $f$
begin
    if p_quien = 'admin' then
        perform set_config('role', 'none', true);
        perform set_config('request.jwt.claims', '', true);
        return;
    end if;
    perform set_config('request.jwt.claims', json_build_object(
        'sub',  case when p_quien = 'anon' then null
                     else current_setting('pruebas.' || p_quien) end,
        'role', case when p_quien = 'anon' then 'anon' else 'authenticated' end
    )::text, true);
    perform set_config('role',
        case when p_quien = 'anon' then 'anon' else 'authenticated' end, true);
end;
$f$;

-- Atajos para escribir los casos sin repetir subconsultas.
create or replace function pg_temp.hoy() returns date
language sql as $f$ select (now() at time zone 'America/Lima')::date $f$;

create or replace function pg_temp.tb(p_letra text) returns bigint
language sql as $f$ select id from trabajador where documento = 'PRUEBA-' || p_letra $f$;

create or replace function pg_temp.cli(p_placa text) returns bigint
language sql as $f$ select id from cliente where placa = p_placa $f$;

-- El último lavado de una placa.
create or replace function pg_temp.lv(p_placa text) returns bigint
language sql as $f$
    select l.id from lavado l join cliente c on c.id = l.cliente_id
    where c.placa = p_placa order by l.id desc limit 1
$f$;

create or replace function pg_temp.uid(p_quien text) returns uuid
language sql as $f$ select current_setting('pruebas.' || p_quien)::uuid $f$;


create or replace function pg_temp.correr()
returns table (n integer, grupo text, caso text, esperado text, obtenido text, resultado text)
language plpgsql
as $f$
declare
    r jsonb := '[]';
begin
    -- Guardia: solo en desarrollo, nunca en la base con datos reales.
    if not exists (select 1 from cliente where placa = 'ABC-123') then
        raise exception 'Estas pruebas solo corren en LavaSmart-dev: no encontré los datos de prueba de 03.';
    end if;
    if exists (select 1 from cliente where placa like 'PRB-%')
       or exists (select 1 from trabajador where documento like 'PRUEBA-%') then
        raise exception 'Ya hay placas PRB-* o trabajadores PRUEBA-*: alguien guardó datos de una corrida anterior.';
    end if;

    begin
        -- ============ Preparación (como administrador) ===================
        perform set_config('pruebas.dueno',
            (select id::text from perfil where rol = 'dueno' order by creado_en limit 1), true);
        perform set_config('pruebas.operador',   '00000000-0000-4000-8000-0000000000a1', true);
        perform set_config('pruebas.sin_perfil', '00000000-0000-4000-8000-0000000000a2', true);

        insert into auth.users (id, aud, role, email) values
            (pg_temp.uid('operador'),   'authenticated', 'authenticated', 'operador@pruebas.test'),
            (pg_temp.uid('sin_perfil'), 'authenticated', 'authenticated', 'sinperfil@pruebas.test');
        insert into perfil (id, rol) values (pg_temp.uid('operador'), 'operador');

        -- A: destajo puntual · B: destajo con tardanza · C: sueldo fijo
        -- D: faltó · E: todavía no marca entrada
        insert into trabajador (nombres, apellidos, documento, modalidad, frecuencia, sueldo_dia) values
            ('A', 'Prueba', 'PRUEBA-A', 'destajo', 'diario',  null),
            ('B', 'Prueba', 'PRUEBA-B', 'destajo', 'diario',  null),
            ('C', 'Prueba', 'PRUEBA-C', 'fijo',    'semanal', 60),
            ('D', 'Prueba', 'PRUEBA-D', 'destajo', 'diario',  null),
            ('E', 'Prueba', 'PRUEBA-E', 'destajo', 'diario',  null);

        -- La app calcula estado y porcentaje al marcar la entrada.
        insert into asistencia (trabajador_id, fecha, hora_ingreso, estado,
                                hora_referencia, tolerancia_minutos, porcentaje_destajo) values
            (pg_temp.tb('A'), pg_temp.hoy(), '07:55', 'puntual',  '08:00', 5, 50),
            (pg_temp.tb('B'), pg_temp.hoy(), '08:20', 'tardanza', '08:00', 5, 40),
            (pg_temp.tb('C'), pg_temp.hoy(), '07:50', 'puntual',  '08:00', 5, null),
            (pg_temp.tb('D'), pg_temp.hoy(), null,    'falta',    '08:00', 5, null);

        -- ============ Ingreso de un auto (sql/07, sql/16) ================
        perform pg_temp.como('operador');

        -- Una consulta no ve lo que su propia función acaba de insertar (usa
        -- la foto de la base del inicio de la sentencia): por eso cada
        -- ingreso se registra en un caso y se comprueba en el siguiente.
        r := r || pg_temp.probar('Ingreso', 'El operador registra un auto con nombre y celular',
            $c$ select (fn_registrar_ingreso('prb 001', 1, pg_temp.tb('A'), array[1,4]::bigint[],
                                             null, 'Cliente Prueba', '+51 987 654 321') is not null)::text $c$,
            'true');
        r := r || pg_temp.probar('Ingreso', 'El precio se copia de la tarifa y los servicios se suman',
            $c$ select monto_total::text from v_lavado where id = pg_temp.lv('PRB-001') $c$,
            '35.00');
        r := r || pg_temp.probar('Ingreso', 'La placa se guarda normalizada',
            $c$ select placa from v_lavado where id = pg_temp.lv('PRB-001') $c$,
            'PRB-001');
        r := r || pg_temp.probar('Ingreso', 'El celular se guarda sin +51 ni espacios',
            $c$ select telefono from cliente where placa = 'PRB-001' $c$,
            '987654321');
        r := r || pg_temp.probar('Ingreso', 'Al ingresar no se cobra',
            $c$ select estado_pago || ' ' || monto_cobrado from v_lavado where id = pg_temp.lv('PRB-001') $c$,
            'sin_cobrar 0.00');
        r := r || pg_temp.probar('Ingreso', 'El lavador puntual queda con 50 % congelado en el lavado',
            $c$ select porcentaje_destajo::text from lavado where id = pg_temp.lv('PRB-001') $c$,
            '50.00');
        r := r || pg_temp.probar('Ingreso', 'El operador registra un auto sin nombre ni celular',
            $c$ select (fn_registrar_ingreso('PRB-002', 3, pg_temp.tb('B'), array[2]::bigint[]) is not null)::text $c$,
            'true');
        r := r || pg_temp.probar('Ingreso', 'El lavador con tardanza queda con 40 %',
            $c$ select porcentaje_destajo::text from lavado where id = pg_temp.lv('PRB-002') $c$,
            '40.00');
        r := r || pg_temp.probar('Ingreso', 'Se registra un auto para el lavador de sueldo fijo',
            $c$ select (fn_registrar_ingreso('PRB-003', 1, pg_temp.tb('C'), array[1]::bigint[]) is not null)::text $c$,
            'true');
        r := r || pg_temp.probar('Ingreso', 'El lavador de sueldo fijo no lleva porcentaje',
            $c$ select coalesce(porcentaje_destajo::text, 'sin porcentaje') from lavado
                where id = pg_temp.lv('PRB-003') $c$,
            'sin porcentaje');
        r := r || pg_temp.probar('Ingreso', 'No se asigna un auto a quien no marcó entrada',
            $c$ select fn_registrar_ingreso('PRB-009', 1, pg_temp.tb('E'), array[1]::bigint[])::text $c$,
            'rechazo:no tiene asistencia');
        r := r || pg_temp.probar('Ingreso', 'No se asigna un auto a quien faltó',
            $c$ select fn_registrar_ingreso('PRB-009', 1, pg_temp.tb('D'), array[1]::bigint[])::text $c$,
            'rechazo:no tiene asistencia');
        r := r || pg_temp.probar('Ingreso', 'Un auto que ya está en piso no ingresa dos veces',
            $c$ select fn_registrar_ingreso('PRB-001', 1, pg_temp.tb('B'), array[2]::bigint[])::text $c$,
            'rechazo:lavado_ya_en_proceso');
        r := r || pg_temp.probar('Ingreso', 'Hay que elegir al menos un servicio',
            $c$ select fn_registrar_ingreso('PRB-009', 1, pg_temp.tb('A'), array[]::bigint[])::text $c$,
            'rechazo:lavado_sin_servicios');
        r := r || pg_temp.probar('Ingreso', 'Una placa no cambia de tipo de vehículo',
            $c$ select fn_registrar_ingreso('PRB-001', 3, pg_temp.tb('A'), array[1]::bigint[])::text $c$,
            'rechazo:cliente_tipo_distinto');
        r := r || pg_temp.probar('Ingreso', 'El celular tiene que ser de 9 dígitos y empezar por 9',
            $c$ select fn_registrar_ingreso('PRB-009', 1, pg_temp.tb('A'), array[1]::bigint[],
                                            null, null, '12345')::text $c$,
            'rechazo:cliente_telefono_formato');
        r := r || pg_temp.probar('Ingreso', 'No se cobra un servicio sin tarifa',
            $c$ select fn_registrar_ingreso('PRB-009', 1, pg_temp.tb('A'), array[999]::bigint[])::text $c$,
            'rechazo:tarifa_inexistente');
        r := r || pg_temp.probar('Ingreso', 'Ni por fuera de la función se cobra al ingresar',
            $c$ with x as (insert into lavado (cliente_id, trabajador_id, monto_cobrado)
                           values (pg_temp.cli('PRB-002'), pg_temp.tb('A'), 20) returning 1)
                select count(*)::text from x $c$,
            'rechazo:lavado_entrega_coherente');

        -- ============ Entrega y cobro (sql/08) ===========================
        r := r || pg_temp.probar('Entrega', 'No se cobra más que el total',
            $c$ select 'ok' from fn_registrar_entrega(pg_temp.lv('PRB-001'), 50, 'efectivo') $c$,
            'rechazo:supera el total');
        r := r || pg_temp.probar('Entrega', 'Solo efectivo o Yape',
            $c$ select 'ok' from fn_registrar_entrega(pg_temp.lv('PRB-001'), 35, 'tarjeta') $c$,
            'rechazo:metodo_pago');
        r := r || pg_temp.probar('Entrega', 'Se entrega y se cobra completo',
            $c$ select 'ok' from fn_registrar_entrega(pg_temp.lv('PRB-001'), 35, 'efectivo') $c$,
            'ok');
        r := r || pg_temp.probar('Entrega', 'La hora de entrega la pone la base, no quien escribe',
            $c$ with x as (update lavado
                              set estado = 'entregado', monto_cobrado = 10, metodo_pago = 'yape',
                                  fecha_hora_entrega = '2020-01-01'
                            where id = pg_temp.lv('PRB-002')
                        returning fecha_hora_entrega = now() as base)
                select bool_and(base)::text from x $c$,
            'true');
        r := r || pg_temp.probar('Entrega', 'Un pago incompleto queda como parcial con su saldo',
            $c$ select estado_pago || ' ' || saldo from v_lavado where id = pg_temp.lv('PRB-002') $c$,
            'parcial 7.00');
        r := r || pg_temp.probar('Entrega', 'Un auto en piso no aparece como deuda',
            $c$ select estado_pago from v_lavado where id = pg_temp.lv('PRB-003') $c$,
            'sin_cobrar');
        r := r || pg_temp.probar('Entrega', 'Un lavado entregado ya no se modifica',
            $c$ with x as (update lavado set monto_cobrado = 0 where id = pg_temp.lv('PRB-001') returning 1)
                select count(*)::text from x $c$,
            'rechazo:lavado_cerrado');
        r := r || pg_temp.probar('Entrega', 'Un auto no se entrega dos veces',
            $c$ select 'ok' from fn_registrar_entrega(pg_temp.lv('PRB-001'), 35, 'efectivo') $c$,
            'rechazo:lavado_cerrado');
        r := r || pg_temp.probar('Entrega', 'Un auto no cambia de lavador',
            $c$ with x as (update lavado set trabajador_id = pg_temp.tb('A')
                            where id = pg_temp.lv('PRB-003') returning 1)
                select count(*)::text from x $c$,
            'rechazo:lavado_asignacion_fija');
        r := r || pg_temp.probar('Entrega', 'El precio de un lavado entregado no se cambia',
            $c$ with x as (update detalle_lavado set precio_cobrado = 1
                            where lavado_id = pg_temp.lv('PRB-001') returning 1)
                select count(*)::text from x $c$,
            'rechazo:detalle_lavado_cerrado');
        r := r || pg_temp.probar('Entrega', 'A un lavado entregado no se le agregan servicios',
            $c$ with x as (insert into detalle_lavado (lavado_id, tipo_lavado_id, precio_cobrado)
                           values (pg_temp.lv('PRB-001'), 2, 15) returning 1)
                select count(*)::text from x $c$,
            'rechazo:detalle_lavado_cerrado');
        r := r || pg_temp.probar('Ingreso', 'El mismo auto vuelve otro día con el nombre en blanco',
            $c$ select (fn_registrar_ingreso('PRB-001', 1, pg_temp.tb('B'), array[2]::bigint[],
                                             null, '', null) is not null)::text $c$,
            'true');
        r := r || pg_temp.probar('Ingreso', 'Un nombre en blanco no borra el que ya estaba',
            $c$ select nombre from cliente where placa = 'PRB-001' $c$,
            'Cliente Prueba');

        -- ============ Asistencia (sql/05, sql/06) ========================
        r := r || pg_temp.probar('Asistencia', 'El operador marca la entrada de un lavador',
            $c$ with x as (insert into asistencia (trabajador_id, fecha, hora_ingreso, estado,
                                                   hora_referencia, tolerancia_minutos, porcentaje_destajo)
                           values (pg_temp.tb('E'), pg_temp.hoy(), '07:58', 'puntual', '08:00', 5, 50)
                           returning 1)
                select count(*)::text from x $c$,
            '1');
        r := r || pg_temp.probar('Asistencia', 'El operador no pone descuentos',
            $c$ with x as (update asistencia set descuento_monto = 5, descuento_motivo = 'tarde'
                            where trabajador_id = pg_temp.tb('C') and fecha = pg_temp.hoy() returning 1)
                select count(*)::text from x $c$,
            'rechazo:asistencia_decision_dueno');
        r := r || pg_temp.probar('Asistencia', 'El operador no decide que un lavador no trabaja',
            $c$ with x as (update asistencia set estado = 'no_laboro'
                            where trabajador_id = pg_temp.tb('C') and fecha = pg_temp.hoy() returning 1)
                select count(*)::text from x $c$,
            'rechazo:asistencia_decision_dueno');

        perform pg_temp.como('dueno');

        r := r || pg_temp.probar('Asistencia', 'El de destajo no lleva descuento: su tardanza ya baja el porcentaje',
            $c$ with x as (update asistencia set descuento_monto = 5, descuento_motivo = 'tarde'
                            where trabajador_id = pg_temp.tb('B') and fecha = pg_temp.hoy() returning 1)
                select count(*)::text from x $c$,
            'rechazo:asistencia_descuento_solo_fijo');
        r := r || pg_temp.probar('Asistencia', 'Un descuento lleva su motivo',
            $c$ with x as (update asistencia set descuento_monto = 10
                            where trabajador_id = pg_temp.tb('C') and fecha = pg_temp.hoy() returning 1)
                select count(*)::text from x $c$,
            'rechazo:asistencia_descuento_motivado');
        r := r || pg_temp.probar('Asistencia', 'El dueño descuenta al fijo y queda registrado quién lo autorizó',
            $c$ with x as (update asistencia set descuento_monto = 10, descuento_motivo = 'Llegó 08:40'
                            where trabajador_id = pg_temp.tb('C') and fecha = pg_temp.hoy()
                        returning autorizado_por = pg_temp.uid('dueno') as firmado)
                select bool_and(firmado)::text from x $c$,
            'true');
        r := r || pg_temp.probar('Asistencia', 'Una falta no tiene hora de entrada',
            $c$ with x as (update asistencia set hora_ingreso = '09:00'
                            where trabajador_id = pg_temp.tb('D') and fecha = pg_temp.hoy() returning 1)
                select count(*)::text from x $c$,
            'rechazo:asistencia_hora_coherente');

        -- ============ Incidencias (sql/09) ===============================
        perform pg_temp.como('operador');

        r := r || pg_temp.probar('Incidencias', 'La visita indicada tiene que ser de ese auto',
            $c$ with x as (insert into incidencia (cliente_id, lavado_id, tipo, descripcion)
                           values (pg_temp.cli('PRB-001'), pg_temp.lv('PRB-002'), 'dano', 'Rayón') returning 1)
                select count(*)::text from x $c$,
            'rechazo:incidencia_lavado_de_otro_auto');
        r := r || pg_temp.probar('Incidencias', 'Nace abierta y firmada por quien la registra, diga lo que diga el formulario',
            $c$ with x as (insert into incidencia (cliente_id, lavado_id, tipo, descripcion, estado,
                                                   registrado_por, resolucion, fecha_resolucion)
                           values (pg_temp.cli('PRB-002'), pg_temp.lv('PRB-002'), 'dano', 'Rayón en la puerta',
                                   'resuelta', pg_temp.uid('dueno'), 'nada', now())
                        returning estado::text || ' ' || (registrado_por = pg_temp.uid('operador')) as v)
                select v from x $c$,
            'abierta true');
        r := r || pg_temp.probar('Incidencias', 'El operador la pasa a en proceso',
            $c$ with x as (update incidencia set estado = 'en_proceso'
                            where cliente_id = pg_temp.cli('PRB-002') returning estado::text as v)
                select v from x $c$,
            'en_proceso');
        r := r || pg_temp.probar('Incidencias', 'El operador no la resuelve',
            $c$ with x as (update incidencia set estado = 'resuelta', resolucion = 'Se pulió'
                            where cliente_id = pg_temp.cli('PRB-002') returning 1)
                select count(*)::text from x $c$,
            'rechazo:incidencia_resuelve_dueno');
        r := r || pg_temp.probar('Incidencias', 'Lo registrado no se reescribe',
            $c$ with x as (update incidencia set descripcion = 'No pasó nada'
                            where cliente_id = pg_temp.cli('PRB-002') returning 1)
                select count(*)::text from x $c$,
            'rechazo:incidencia_datos_fijos');

        perform pg_temp.como('dueno');

        r := r || pg_temp.probar('Incidencias', 'El dueño la resuelve',
            $c$ with x as (update incidencia set estado = 'resuelta', resolucion = 'Se pulió la puerta'
                            where cliente_id = pg_temp.cli('PRB-002') returning estado::text as v)
                select v from x $c$,
            'resuelta');
        r := r || pg_temp.probar('Incidencias', 'Una incidencia resuelta no se reabre',
            $c$ with x as (update incidencia set estado = 'en_proceso'
                            where cliente_id = pg_temp.cli('PRB-002') returning 1)
                select count(*)::text from x $c$,
            'rechazo:incidencia_cerrada');

        -- ============ Cambio de modalidad (sql/13) =======================
        r := r || pg_temp.probar('Personal', 'No cambia el sueldo de quien tiene autos en piso',
            $c$ with x as (update trabajador set sueldo_dia = 70 where id = pg_temp.tb('C') returning 1)
                select count(*)::text from x $c$,
            'rechazo:trabajador_autos_en_piso');
        r := r || pg_temp.probar('Personal', 'No cambia la modalidad con días sin cerrar',
            $c$ with x as (update trabajador set modalidad = 'fijo', frecuencia = 'semanal', sueldo_dia = 50
                            where id = pg_temp.tb('A') returning 1)
                select count(*)::text from x $c$,
            'rechazo:trabajador_dias_abiertos');

        -- ============ Configuración (sql/12) =============================
        r := r || pg_temp.probar('Configuración', 'La hora de entrada va como HH:MM',
            $c$ with x as (update configuracion set valor = '8am' where clave = 'hora_entrada' returning 1)
                select count(*)::text from x $c$,
            'rechazo:configuracion_hora_invalida');
        r := r || pg_temp.probar('Configuración', 'La tolerancia va de 0 a 120 minutos',
            $c$ with x as (update configuracion set valor = '500' where clave = 'tolerancia_minutos' returning 1)
                select count(*)::text from x $c$,
            'rechazo:configuracion_tolerancia_invalida');
        r := r || pg_temp.probar('Configuración', 'Un porcentaje va de 0 a 100',
            $c$ with x as (update configuracion set valor = '150' where clave = 'pct_destajo_puntual' returning 1)
                select count(*)::text from x $c$,
            'rechazo:configuracion_porcentaje_invalido');
        r := r || pg_temp.probar('Configuración', 'La moneda no se cambia desde la app',
            $c$ with x as (update configuracion set valor = 'USD' where clave = 'moneda' returning 1)
                select count(*)::text from x $c$,
            'rechazo:configuracion_fija');
        r := r || pg_temp.probar('Configuración', 'No se inventan parámetros',
            $c$ with x as (insert into configuracion (clave, valor) values ('descuento_automatico', '1') returning 1)
                select count(*)::text from x $c$,
            'rechazo:configuracion_clave_desconocida');

        -- ============ Liquidación y pago (sql/10, sql/11) ================
        r := r || pg_temp.probar('Liquidación', 'El dueño sube el destajo puntual a 60 %',
            $c$ with x as (update configuracion set valor = '60' where clave = 'pct_destajo_puntual' returning 1)
                select count(*)::text from x $c$,
            '1');
        r := r || pg_temp.probar('Liquidación', 'Lo devengado usa el 50 % congelado en el lavado, no el 60 % nuevo',
            $c$ select monto_destajo::text from fn_calcular_liquidacion(pg_temp.hoy())
                where trabajador_id = pg_temp.tb('A') $c$,
            '17.50');
        r := r || pg_temp.probar('Liquidación', 'El destajo sale de lo cobrado, no del total (pagó 10 de 17)',
            $c$ select monto_destajo::text from fn_calcular_liquidacion(pg_temp.hoy())
                where trabajador_id = pg_temp.tb('B') $c$,
            '4.00');
        r := r || pg_temp.probar('Liquidación', 'Al fijo le corresponde su sueldo menos el descuento',
            $c$ select (monto_sueldo - monto_descuento)::text from fn_calcular_liquidacion(pg_temp.hoy())
                where trabajador_id = pg_temp.tb('C') $c$,
            '50.00');

        perform pg_temp.como('operador');
        r := r || pg_temp.probar('Liquidación', 'El operador no cierra el día',
            $c$ select count(*)::text from fn_cerrar_dia(pg_temp.hoy()) $c$,
            'rechazo:liquidacion_solo_dueno');

        perform pg_temp.como('dueno');
        r := r || pg_temp.probar('Liquidación', 'No se cierra un día que no llega',
            $c$ select count(*)::text from fn_cerrar_dia(pg_temp.hoy() + 1) $c$,
            'rechazo:liquidacion_fecha_futura');
        r := r || pg_temp.probar('Liquidación', 'Hoy solo se cierra a quien no tiene autos en piso',
            $c$ select string_agg(t.nombres || '=' || c.resultado, ', ' order by t.nombres)
                from fn_cerrar_dia(pg_temp.hoy()) c join trabajador t on t.id = c.trabajador_id
                where t.documento like 'PRUEBA-%' $c$,
            'A=cerrada, B=autos_en_piso, C=autos_en_piso, D=cerrada, E=cerrada');
        r := r || pg_temp.probar('Liquidación', 'Un día cerrado no cambia sus montos',
            $c$ with x as (update liquidacion set monto_destajo = 0
                            where trabajador_id = pg_temp.tb('A') and fecha = pg_temp.hoy() returning 1)
                select count(*)::text from x $c$,
            'rechazo:liquidacion_cerrada');
        r := r || pg_temp.probar('Liquidación', 'Un día cerrado no se reabre',
            $c$ with x as (update liquidacion set cerrada = false, fecha_cierre = null
                            where trabajador_id = pg_temp.tb('A') and fecha = pg_temp.hoy() returning 1)
                select count(*)::text from x $c$,
            'rechazo:liquidacion_cerrada');

        perform pg_temp.como('operador');
        r := r || pg_temp.probar('Liquidación', 'No se asignan autos a un lavador con el día cerrado',
            $c$ select fn_registrar_ingreso('PRB-005', 1, pg_temp.tb('A'), array[1]::bigint[])::text $c$,
            'rechazo:liquidacion_dia_cerrado');
        r := r || pg_temp.probar('Liquidación', 'El operador no registra pagos',
            $c$ select dias::text from fn_entregar_pago(pg_temp.tb('A'), pg_temp.hoy()) $c$,
            'rechazo:liquidacion_solo_dueno');

        perform pg_temp.como('dueno');
        r := r || pg_temp.probar('Liquidación', 'El dueño paga lo pendiente del lavador',
            $c$ select dias || ' día, S/ ' || monto from fn_entregar_pago(pg_temp.tb('A'), pg_temp.hoy()) $c$,
            '1 día, S/ 17.50');
        r := r || pg_temp.probar('Liquidación', 'Un pago registrado no se deshace',
            $c$ with x as (update liquidacion set entregada = false, fecha_entrega = null
                            where trabajador_id = pg_temp.tb('A') and fecha = pg_temp.hoy() returning 1)
                select count(*)::text from x $c$,
            'rechazo:liquidacion_pagada');
        r := r || pg_temp.probar('Liquidación', 'No se paga dos veces',
            $c$ select dias::text from fn_entregar_pago(pg_temp.tb('A'), pg_temp.hoy()) $c$,
            'rechazo:liquidacion_nada_por_pagar');
        r := r || pg_temp.probar('Personal', 'Con todo cerrado, la modalidad sí cambia (desde mañana)',
            $c$ with x as (update trabajador set modalidad = 'fijo', frecuencia = 'semanal', sueldo_dia = 50
                            where id = pg_temp.tb('D') returning 1)
                select count(*)::text from x $c$,
            '1');

        -- ============ Permisos por rol (RLS) =============================
        perform pg_temp.como('operador');
        r := r || pg_temp.probar('Permisos', 'Operador: ve los lavados',
            $c$ select (count(*) > 0)::text from lavado $c$, 'true');
        r := r || pg_temp.probar('Permisos', 'Operador: ve la demanda esperada',
            $c$ select (count(*) > 0)::text from prediccion_demanda $c$, 'true');
        r := r || pg_temp.probar('Permisos', 'Operador: no ve la segmentación de clientes',
            $c$ select count(*)::text from cliente_segmento $c$, '0');
        r := r || pg_temp.probar('Permisos', 'Operador: no ve la liquidación',
            $c$ select count(*)::text from liquidacion $c$, '0');
        r := r || pg_temp.probar('Permisos', 'Operador: no cambia tarifas',
            $c$ with x as (update tarifa set precio = precio + 1 returning 1) select count(*)::text from x $c$, '0');
        r := r || pg_temp.probar('Permisos', 'Operador: no cambia la configuración',
            $c$ with x as (update configuracion set valor = '07:00' where clave = 'hora_entrada' returning 1)
                select count(*)::text from x $c$, '0');
        r := r || pg_temp.probar('Permisos', 'Operador: no da de alta personal',
            $c$ with x as (insert into trabajador (nombres, apellidos, documento, modalidad, frecuencia)
                           values ('X', 'Prueba', 'PRUEBA-X', 'destajo', 'diario') returning 1)
                select count(*)::text from x $c$, 'rechazo:row-level security');
        r := r || pg_temp.probar('Permisos', 'Operador: no se asciende a dueño',
            $c$ with x as (update perfil set rol = 'dueno' where id = pg_temp.uid('operador') returning 1)
                select count(*)::text from x $c$, '0');

        perform pg_temp.como('dueno');
        r := r || pg_temp.probar('Permisos', 'Dueño: ve la segmentación',
            $c$ select (count(*) > 0)::text from cliente_segmento $c$, 'true');
        r := r || pg_temp.probar('Permisos', 'Dueño: ve la liquidación',
            $c$ select (count(*) > 0)::text from liquidacion $c$, 'true');

        perform pg_temp.como('sin_perfil');
        r := r || pg_temp.probar('Permisos', 'Usuario sin perfil: inicia sesión pero no ve nada',
            $c$ select count(*)::text from lavado $c$, '0');
        r := r || pg_temp.probar('Permisos', 'Usuario sin perfil: no registra autos',
            $c$ select fn_registrar_ingreso('PRB-008', 1, pg_temp.tb('B'), array[1]::bigint[])::text $c$,
            'rechazo:row-level security');

        perform pg_temp.como('anon');
        r := r || pg_temp.probar('Permisos', 'Sin sesión: no ve lavados',
            $c$ select count(*)::text from lavado $c$, '0');
        r := r || pg_temp.probar('Permisos', 'Sin sesión: no puede llamar a las funciones',
            $c$ select fn_registrar_ingreso('PRB-008', 1, 1, array[1]::bigint[])::text $c$,
            'rechazo:permission denied');

        -- ============ Nada se borra ======================================
        perform pg_temp.como('operador');
        r := r || pg_temp.probar('Nada se borra', 'Operador: no borra lavados',
            $c$ with x as (delete from lavado returning 1) select count(*)::text from x $c$, 'rechazo:permission denied');
        r := r || pg_temp.probar('Nada se borra', 'Operador: no borra clientes',
            $c$ with x as (delete from cliente returning 1) select count(*)::text from x $c$, 'rechazo:permission denied');

        perform pg_temp.como('dueno');
        r := r || pg_temp.probar('Nada se borra', 'Dueño: no borra incidencias',
            $c$ with x as (delete from incidencia returning 1) select count(*)::text from x $c$, 'rechazo:permission denied');
        r := r || pg_temp.probar('Nada se borra', 'Dueño: no borra una tarifa',
            $c$ with x as (delete from tarifa where tipo_vehiculo_id = 4 and tipo_lavado_id = 5 returning 1)
                select count(*)::text from x $c$, 'rechazo:permission denied');
        r := r || pg_temp.probar('Nada se borra', 'Dueño: no borra un parámetro de configuración',
            $c$ with x as (delete from configuracion where clave = 'hora_entrada' returning 1)
                select count(*)::text from x $c$, 'rechazo:permission denied');
        r := r || pg_temp.probar('Nada se borra', 'Dueño: da de alta a un trabajador nuevo',
            $c$ with x as (insert into trabajador (nombres, apellidos, documento, modalidad, frecuencia)
                           values ('F', 'Prueba', 'PRUEBA-F', 'destajo', 'diario') returning 1)
                select count(*)::text from x $c$, '1');
        r := r || pg_temp.probar('Nada se borra', 'Dueño: no borra a un trabajador (se da de baja con activo = false)',
            $c$ with x as (delete from trabajador where documento = 'PRUEBA-F' returning 1)
                select count(*)::text from x $c$, 'rechazo:permission denied');

        -- Fin: deshacer todo lo que se creó. Los resultados están en r.
        raise exception 'fin_de_las_pruebas';
    exception when others then
        if sqlerrm <> 'fin_de_las_pruebas' then
            r := r || jsonb_build_array(jsonb_build_object(
                'grupo', 'Error', 'caso', 'La prueba se detuvo antes de terminar',
                'esperado', '', 'obtenido', sqlerrm, 'pasa', false));
        end if;
    end;

    return query
        select e.i::integer, e.v->>'grupo', e.v->>'caso', e.v->>'esperado', e.v->>'obtenido',
               case when (e.v->>'pasa')::boolean then 'PASA' else 'FALLA' end
        from jsonb_array_elements(r) with ordinality as e(v, i)
        union all
        select null, 'Resumen',
               count(*) filter (where (v->>'pasa')::boolean) || ' de ' || count(*) || ' casos pasan',
               null, null, null
        from jsonb_array_elements(r) as v
        order by 1 nulls last;
end;
$f$;

select * from pg_temp.correr();
