-- =====================================================================
--  LavaSmart — 03_datos_prueba.sql
--
--  ⚠  SOLO PARA DESARROLLO. NO EJECUTAR EN PRODUCCIÓN.
--
--  Carga una semana de operación simulada para poder construir y probar
--  las pantallas sin esperar a tener datos reales. Todas las placas y
--  todos los documentos son inventados: la placa real es dato personal
--  bajo la Ley N.° 29733 y no entra a este repositorio.
--
--  Se puede volver a ejecutar: empieza borrando lo que él mismo creó.
--  Ese borrado es una excepción de desarrollo; el sistema en operación
--  no borra nada.
--
--  Las fechas son relativas a hoy, así que los datos siguen teniendo
--  sentido sin importar cuándo se ejecute el archivo.
-- =====================================================================

-- ---------------------------------------------------------------------
--  0. Limpieza de la corrida anterior
--     El orden importa: las llaves foráneas son RESTRICT, así que hay
--     que ir de los hijos hacia los padres.
-- ---------------------------------------------------------------------

delete from incidencia
 where cliente_id in (select id from cliente where placa in
       ('ABC-123','DEF-456','GHI-789','JKL-012','MNO-345','PQR-678','STU-901','VWX-234'));

delete from lavado                      -- detalle_lavado cae en cascada
 where cliente_id in (select id from cliente where placa in
       ('ABC-123','DEF-456','GHI-789','JKL-012','MNO-345','PQR-678','STU-901','VWX-234'));

delete from liquidacion
 where trabajador_id in (select id from trabajador where documento in
       ('40111222','40333444','40555666'));

delete from asistencia
 where trabajador_id in (select id from trabajador where documento in
       ('40111222','40333444','40555666'));

delete from cliente
 where placa in ('ABC-123','DEF-456','GHI-789','JKL-012','MNO-345','PQR-678','STU-901','VWX-234');

delete from trabajador
 where documento in ('40111222','40333444','40555666');


-- ---------------------------------------------------------------------
--  1. Personal
--     Los tres casos que el modelo distingue: destajo con pago diario,
--     destajo con pago semanal, y sueldo fijo (que siempre es semanal).
-- ---------------------------------------------------------------------

insert into trabajador (nombres, apellidos, documento, modalidad, frecuencia, sueldo_dia, fecha_ingreso) values
    ('Julio',  'Ramos Quispe',   '40111222', 'destajo', 'diario',  null,  current_date - 400),
    ('Marco',  'Silva Paredes',  '40333444', 'destajo', 'semanal', null,  current_date - 200),
    ('Diana',  'Huamán Ríos',    '40555666', 'fijo',    'semanal', 55.00, current_date -  90);


-- ---------------------------------------------------------------------
--  2. Clientes
--     Un cliente equivale a un vehículo. Nombre y teléfono son
--     opcionales: aquí solo algunos los dieron.
-- ---------------------------------------------------------------------

insert into cliente (placa, tipo_vehiculo_id, nombre, telefono)
select c.placa, v.id, c.nombre, c.telefono
from (values
    ('ABC-123', 'Camioneta',     'Luis Vargas',   '999111222'),
    ('DEF-456', 'Sedán',         null,            null),
    ('GHI-789', 'SUV',           'Rosa Medina',   '988333444'),
    ('JKL-012', 'Sedán',         null,            null),
    ('MNO-345', 'Camioneta',     'Pedro Chávez',  null),
    ('PQR-678', 'Station wagon', null,            '977555666'),
    ('STU-901', 'SUV',           null,            null),
    ('VWX-234', 'Sedán',         'Ana Torres',    null)
) as c (placa, vehiculo, nombre, telefono)
join tipo_vehiculo v on v.nombre = c.vehiculo;


-- ---------------------------------------------------------------------
--  3. Asistencia de los últimos seis días
--     hora_referencia y tolerancia_minutos se copian de configuracion,
--     que es exactamente lo que hará la aplicación. El porcentaje sale
--     de comparar la hora de llegada contra ese límite.
-- ---------------------------------------------------------------------

do $$
declare
    v_hora_ref   time    := (select valor::time    from configuracion where clave = 'hora_entrada');
    v_tolerancia integer := (select valor::integer from configuracion where clave = 'tolerancia_minutos');
    v_pct_ok     numeric := (select valor::numeric from configuracion where clave = 'pct_destajo_puntual');
    v_pct_tarde  numeric := (select valor::numeric from configuracion where clave = 'pct_destajo_tardanza');
    r            record;
begin
    for r in
        select * from (values
            -- documento,  días atrás, hora de llegada, estado
            ('40111222', 5, '07:52'::time, 'puntual'),
            ('40111222', 4, '07:58',       'puntual'),
            ('40111222', 3, '07:45',       'puntual'),
            ('40111222', 2, '08:14',       'tardanza'),   -- llegó tarde: cobra 40 % todo el día
            ('40111222', 1, '07:50',       'puntual'),
            ('40111222', 0, '07:55',       'puntual'),

            ('40333444', 5, '07:49',       'puntual'),
            ('40333444', 4, '08:22',       'tardanza'),
            ('40333444', 3, '07:57',       'puntual'),
            ('40333444', 2, '08:03',       'puntual'),     -- 08:03 entra en la tolerancia
            ('40333444', 1, null,          'falta'),       -- no vino: ese día no recibe autos
            ('40333444', 0, '07:51',       'puntual'),

            ('40555666', 5, '07:55',       'puntual'),     -- sueldo fijo: no lleva porcentaje
            ('40555666', 4, '07:58',       'puntual'),
            ('40555666', 3, '08:19',       'tardanza'),    -- el dueño le descuenta a mano
            ('40555666', 2, '07:52',       'puntual'),
            ('40555666', 1, '07:56',       'puntual'),
            ('40555666', 0, '07:54',       'puntual')
        ) as a (documento, dias, hora, estado)
    loop
        insert into asistencia (
            trabajador_id, fecha, hora_ingreso, estado,
            hora_referencia, tolerancia_minutos, porcentaje_destajo,
            descuento_monto, descuento_motivo)
        select
            t.id,
            current_date - r.dias,
            r.hora,
            r.estado::estado_asistencia,
            v_hora_ref,
            v_tolerancia,
            case
                when t.modalidad = 'fijo'    then null
                when r.estado = 'falta'      then null
                when r.estado = 'puntual'    then v_pct_ok
                else                              v_pct_tarde
            end,
            case when t.modalidad = 'fijo' and r.estado = 'tardanza' then 10.00 else 0 end,
            case when t.modalidad = 'fijo' and r.estado = 'tardanza'
                 then 'Llegó 19 minutos tarde. El dueño autorizó que trabaje con descuento.'
                 else null end
        from trabajador t
        where t.documento = r.documento;
    end loop;
end $$;


-- ---------------------------------------------------------------------
--  4. Lavados de la semana
--     Cada visita se escribe en dos momentos, igual que en el negocio:
--     primero ingresa el auto sin cobro, y solo al entregarlo se
--     registran el monto y el método de pago. Los dos últimos quedan
--     en proceso para que el tablero de "autos en piso" tenga algo.
-- ---------------------------------------------------------------------

do $$
declare
    r         record;
    v_lavado  bigint;
    v_total   numeric(10,2);
    v_cobrado numeric(10,2);
begin
    for r in
        select * from (values
            -- días, hora,  placa,     documento,  servicios,                                    pago
            (5, '08:30'::time, 'ABC-123', '40111222', array['Lavado completo'],                    'completo'),
            (5, '09:15',       'DEF-456', '40333444', array['Lavado completo','Encerado'],         'completo'),
            (5, '11:00',       'GHI-789', '40111222', array['Lavado por fuera'],                   'completo'),
            (5, '15:40',       'JKL-012', '40555666', array['Lavado completo'],                    'completo'),

            (4, '08:45',       'MNO-345', '40111222', array['Lavado completo','Lavado de motor'],  'completo'),
            (4, '10:20',       'PQR-678', '40333444', array['Lavado por dentro'],                  'parcial'),
            (4, '14:10',       'ABC-123', '40555666', array['Lavado por fuera'],                   'completo'),

            (3, '09:00',       'STU-901', '40111222', array['Lavado completo'],                    'completo'),
            (3, '10:30',       'VWX-234', '40333444', array['Lavado completo','Encerado'],         'completo'),
            (3, '16:00',       'DEF-456', '40111222', array['Lavado por fuera'],                   'completo'),

            (2, '08:20',       'GHI-789', '40111222', array['Lavado completo'],                    'completo'),
            (2, '11:45',       'JKL-012', '40333444', array['Lavado completo'],                    'completo'),
            (2, '13:30',       'MNO-345', '40111222', array['Encerado'],                           'completo'),

            (1, '09:10',       'PQR-678', '40111222', array['Lavado completo','Lavado de motor'],  'completo'),
            (1, '12:00',       'ABC-123', '40555666', array['Lavado completo'],                    'completo'),
            (1, '17:20',       'STU-901', '40111222', array['Lavado por fuera'],                   'parcial'),

            (0, '08:35',       'VWX-234', '40111222', array['Lavado completo'],                    'completo'),
            (0, '09:50',       'DEF-456', '40333444', array['Lavado completo','Encerado'],         'completo'),
            (0, '11:20',       'GHI-789', '40111222', array['Lavado por dentro'],                  null),
            (0, '11:55',       'JKL-012', '40333444', array['Lavado completo'],                    null)
        ) as l (dias, hora, placa, documento, servicios, pago)
    loop
        -- 4.1 Ingresa el auto. Sin cobro: el trigger congela aquí el
        --     porcentaje de destajo que el lavador tenga ese día.
        insert into lavado (cliente_id, trabajador_id, fecha_hora_ingreso)
        select c.id, t.id,
               ((current_date - r.dias)::text || ' ' || r.hora)::timestamp at time zone 'America/Lima'
        from cliente c, trabajador t
        where c.placa = r.placa and t.documento = r.documento
        returning id into v_lavado;

        -- 4.2 Servicios prestados, con el precio copiado del tarifario.
        insert into detalle_lavado (lavado_id, tipo_lavado_id, precio_cobrado)
        select v_lavado, s.id, tf.precio
        from unnest(r.servicios) as u(nombre_servicio)
        join tipo_lavado s  on s.nombre = u.nombre_servicio
        join cliente     c  on c.placa  = r.placa
        join tarifa      tf on tf.tipo_lavado_id = s.id
                           and tf.tipo_vehiculo_id = c.tipo_vehiculo_id;

        continue when r.pago is null;   -- se queda en proceso

        -- 4.3 Se entrega y se cobra. El total no está guardado en ningún
        --     lado: se suma el detalle.
        select coalesce(sum(precio_cobrado), 0) into v_total
        from detalle_lavado where lavado_id = v_lavado;

        v_cobrado := case when r.pago = 'parcial'
                          then greatest(v_total - 5, 0)
                          else v_total end;

        update lavado
           set estado             = 'entregado',
               fecha_hora_entrega = fecha_hora_ingreso + interval '45 minutes',
               metodo_pago        = (case when extract(hour from r.hora)::int % 3 = 0 then 'yape' else 'efectivo' end)::metodo_pago,
               monto_cobrado      = v_cobrado,
               observacion        = case when r.pago = 'parcial'
                                         then 'Pagó S/ ' || v_cobrado || ' de S/ ' || v_total || '. Dijo que volvía.'
                                         else null end
         where id = v_lavado;
    end loop;
end $$;


-- ---------------------------------------------------------------------
--  5. Incidencias
--     Una atada a su visita, otra sin visita porque el cliente reclamó
--     días después y no se pudo identificar cuál fue.
-- ---------------------------------------------------------------------

insert into incidencia (cliente_id, lavado_id, tipo, descripcion, estado, fecha_reporte, fecha_resolucion, resolucion)
select c.id, l.id, 'dano', 'Rayón en la puerta del copiloto al secar.', 'resuelta',
       l.fecha_hora_entrega, l.fecha_hora_entrega + interval '2 days',
       'Se pulió la zona sin costo para el cliente.'
from cliente c
join lavado l on l.cliente_id = c.id
where c.placa = 'GHI-789'
  and (l.fecha_hora_ingreso at time zone 'America/Lima')::date = current_date - 2;

insert into incidencia (cliente_id, tipo, descripcion, estado, fecha_reporte)
select c.id, 'objeto_faltante', 'El cliente reporta que falta un cargador del portavasos.', 'abierta', now() - interval '1 day'
from cliente c where c.placa = 'PQR-678';


-- ---------------------------------------------------------------------
--  6. Liquidación del destajo
--     Devengar no es pagar. A Julio, que cobra diario, se le cerró y se
--     le entregó cada día. A Marco, que cobra semanal, se le cerró pero
--     todavía no se le entrega: ese es el dinero que el negocio debe.
-- ---------------------------------------------------------------------

insert into liquidacion (trabajador_id, fecha, monto_cobrado_base, monto_destajo,
                         cerrada, fecha_cierre, entregada, fecha_entrega)
select
    l.trabajador_id,
    (l.fecha_hora_entrega at time zone 'America/Lima')::date          as fecha,
    sum(l.monto_cobrado)                                              as base,
    round(sum(l.monto_cobrado * l.porcentaje_destajo / 100), 2)       as destajo,
    true,
    (l.fecha_hora_entrega at time zone 'America/Lima')::date + time '20:00',
    t.frecuencia = 'diario',
    case when t.frecuencia = 'diario'
         then (l.fecha_hora_entrega at time zone 'America/Lima')::date
         else null end
from lavado l
join trabajador t on t.id = l.trabajador_id
where l.estado = 'entregado'
  and t.modalidad = 'destajo'
  and (l.fecha_hora_entrega at time zone 'America/Lima')::date < current_date
group by l.trabajador_id, 2, t.frecuencia;


-- =====================================================================
--  Comprobaciones
-- =====================================================================

\echo ''
\echo '--- Autos en piso ahora mismo'
select placa, fecha_hora_ingreso, monto_total, estado_pago
from v_lavado where estado = 'en_proceso' order by fecha_hora_ingreso;

\echo ''
\echo '--- Caja de los últimos días'
select * from v_caja_dia order by fecha desc limit 7;

\echo ''
\echo '--- Lo que el negocio le debe al personal'
select t.nombres, t.frecuencia, count(*) as dias_sin_pagar, sum(q.monto_destajo) as total
from liquidacion q join trabajador t on t.id = q.trabajador_id
where not q.entregada
group by t.nombres, t.frecuencia;

\echo ''
\echo '--- Saldos no cobrados (solo lavados ya entregados)'
select placa, monto_total, monto_cobrado, saldo, estado_pago
from v_lavado where estado = 'entregado' and saldo > 0;
