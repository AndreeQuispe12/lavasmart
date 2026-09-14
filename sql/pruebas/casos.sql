-- =====================================================================
--  LavaSmart — pruebas/casos.sql
--
--  Trece casos que comprueban que el motor hace cumplir las reglas del
--  negocio. No prueban que el esquema se cree: eso ya lo sabemos si
--  01_esquema.sql terminó sin errores. Prueban que el sistema RECHACE
--  lo que tiene que rechazar.
--
--  Cómo ejecutarlo:
--    Sobre una base de datos de desarrollo con 01_esquema.sql y
--    02_tarifas.sql ejecutados. NUNCA sobre la base con datos reales:
--    el archivo crea y borra sus propias filas de prueba. En Supabase,
--    usar una rama de desarrollo.
--
--    psql "$DATABASE_URL" -f pruebas/casos.sql
--
--    Se puede volver a ejecutar cuantas veces haga falta: empieza
--    borrando lo que él mismo creó, y usa la placa ZZZ-999 y documentos
--    que empiezan por 99000 para no tocar ningún otro dato.
--
--  Cómo leer el resultado:
--    Los casos marcados DEBE FALLAR tienen que imprimir un ERROR. Si uno
--    de ellos pasa sin error, la regla dejó de aplicarse y hay un
--    problema. Los demás imprimen el valor que se espera al lado.
--
--  ON_ERROR_STOP queda en off a propósito: queremos ver los errores y
--  seguir con el resto de los casos.
-- =====================================================================

\set ON_ERROR_STOP off

\echo ''
\echo '=== Limpieza de la corrida anterior ============================='

delete from incidencia where cliente_id in (select id from cliente where placa = 'ZZZ-999');
delete from lavado      where cliente_id in (select id from cliente where placa = 'ZZZ-999');
delete from liquidacion where trabajador_id in (select id from trabajador where documento like '9900000%');
delete from asistencia  where trabajador_id in (select id from trabajador where documento like '9900000%');
delete from cliente     where placa = 'ZZZ-999';
delete from trabajador  where documento like '9900000%';

\echo ''
\echo '=== Preparación: un lavador a destajo y una camioneta ==========='

insert into trabajador (nombres, apellidos, documento, modalidad, frecuencia)
values ('Julio', 'Prueba', '99000001', 'destajo', 'diario');

insert into cliente (placa, tipo_vehiculo_id)
values ('zzz 999', (select id from tipo_vehiculo where nombre = 'Camioneta'));


\echo ''
\echo '=== 1. La placa se normaliza — se espera ZZZ-999 ================'
select placa from cliente where placa = 'ZZZ-999';


\echo ''
\echo '=== 2. Lavado sin asistencia previa — DEBE FALLAR ==============='
insert into lavado (cliente_id, trabajador_id)
values ((select id from cliente where placa = 'ZZZ-999'), (select id from trabajador where documento = '99000001'));


\echo ''
\echo '=== 3. Se registra asistencia puntual ==========================='
insert into asistencia (trabajador_id, fecha, hora_ingreso, estado,
                        hora_referencia, tolerancia_minutos, porcentaje_destajo)
values ((select id from trabajador where documento = '99000001'),
        current_date, '07:52', 'puntual', '08:00', 5, 50);


\echo ''
\echo '=== 4. Ahora sí entra, y congela 50 % — se espera 50.00 ========='
insert into lavado (cliente_id, trabajador_id)
values ((select id from cliente where placa = 'ZZZ-999'), (select id from trabajador where documento = '99000001'));

select id, estado, porcentaje_destajo, monto_cobrado
from lavado where id = (select id from lavado where cliente_id = (select id from cliente where placa = 'ZZZ-999'));


\echo ''
\echo '=== 5. Entregar sin servicios — DEBE FALLAR ====================='
update lavado
   set estado = 'entregado', fecha_hora_entrega = now(),
       metodo_pago = 'efectivo', monto_cobrado = 0
 where id = (select id from lavado where cliente_id = (select id from cliente where placa = 'ZZZ-999'));


\echo ''
\echo '=== 6. Total calculado — se espera 45.00 y sin_cobrar ==========='
insert into detalle_lavado (lavado_id, tipo_lavado_id, precio_cobrado)
select (select id from lavado where cliente_id = (select id from cliente where placa = 'ZZZ-999')), s.id, t.precio
from tarifa t
join tipo_lavado s on s.id = t.tipo_lavado_id
where t.tipo_vehiculo_id = (select id from tipo_vehiculo where nombre = 'Camioneta')
  and s.nombre in ('Lavado completo', 'Encerado');

select monto_total, monto_cobrado, saldo, estado_pago
from v_lavado where id = (select id from lavado where cliente_id = (select id from cliente where placa = 'ZZZ-999'));


\echo ''
\echo '=== 7. Cobrar más que el total — DEBE FALLAR ===================='
update lavado
   set estado = 'entregado', fecha_hora_entrega = now(),
       metodo_pago = 'efectivo', monto_cobrado = 100
 where id = (select id from lavado where cliente_id = (select id from cliente where placa = 'ZZZ-999'));


\echo ''
\echo '=== 8. Cobro parcial de 40 sobre 45 — se espera saldo 5, parcial '
update lavado
   set estado = 'entregado', fecha_hora_entrega = now(),
       metodo_pago = 'efectivo', monto_cobrado = 40
 where id = (select id from lavado where cliente_id = (select id from cliente where placa = 'ZZZ-999'));

select placa, monto_total, monto_cobrado, saldo, estado_pago, porcentaje_destajo
from v_lavado where id = (select id from lavado where cliente_id = (select id from cliente where placa = 'ZZZ-999'));


\echo ''
\echo '=== 9. Caja del día — sobre base limpia: efectivo 40.00, 1 auto ='
select * from v_caja_dia where fecha = current_date;


\echo ''
\echo '=== 10. Destajo devengado — se espera 20.00 (50 % de 40) ========'
select round(sum(monto_cobrado * porcentaje_destajo / 100), 2) as a_pagar
from lavado where estado = 'entregado'
  and cliente_id = (select id from cliente where placa = 'ZZZ-999');


\echo ''
\echo '=== 11. Sueldo fijo con pago diario — DEBE FALLAR ==============='
insert into trabajador (nombres, apellidos, documento, modalidad, frecuencia, sueldo_dia)
values ('Fernando', 'Prueba', '99000002', 'fijo', 'diario', 60);


\echo ''
\echo '=== 12. Descuento sin motivo — DEBE FALLAR ======================'
insert into trabajador (nombres, apellidos, documento, modalidad, frecuencia, sueldo_dia)
values ('Diana', 'Prueba', '99000003', 'fijo', 'semanal', 55);

insert into asistencia (trabajador_id, fecha, hora_ingreso, estado,
                        hora_referencia, tolerancia_minutos, descuento_monto)
values ((select id from trabajador where documento = '99000003'),
        current_date, '08:12', 'tardanza', '08:00', 5, 5.00);


\echo ''
\echo '=== 13. Placa con formato inválido — DEBE FALLAR ================'
insert into cliente (placa, tipo_vehiculo_id)
values ('XX-1', (select id from tipo_vehiculo limit 1));


\echo ''
\echo '=== Fin. Revise que los seis casos DEBE FALLAR hayan fallado. ==='
