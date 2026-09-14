-- =====================================================================
--  LavaSmart — 02_tarifas.sql
--  Tarifario vigente de AquaBrillo.
--
--  Este archivo es la ÚNICA forma de cambiar precios. Se ejecuta después
--  de 01_esquema.sql y se puede volver a ejecutar cuantas veces haga
--  falta: no duplica filas, actualiza las que ya existen.
--
--  IMPORTANTE — los precios de abajo son los de ejemplo que trae el
--  esquema. Reemplácelos por los precios reales del negocio antes de
--  usar el sistema.
--
--  Cambiar una tarifa NO altera ningún lavado ya registrado: el precio
--  quedó congelado en detalle_lavado.precio_cobrado el día del servicio.
--  El reporte del mes pasado sigue diciendo lo que se cobró el mes
--  pasado, que es justamente lo que se quiere.
-- =====================================================================

insert into tarifa (tipo_vehiculo_id, tipo_lavado_id, precio)
select v.id, s.id, t.precio
from (values
    --  Vehículo         Servicio              Precio (S/)
    ('Sedán',          'Lavado completo',      20.00),
    ('Sedán',          'Lavado por fuera',     15.00),
    ('Sedán',          'Lavado por dentro',    15.00),
    ('Sedán',          'Encerado',             15.00),
    ('Sedán',          'Lavado de motor',      10.00),

    ('Station wagon',  'Lavado completo',      22.00),
    ('Station wagon',  'Lavado por fuera',     16.00),
    ('Station wagon',  'Lavado por dentro',    16.00),
    ('Station wagon',  'Encerado',             17.00),
    ('Station wagon',  'Lavado de motor',      11.00),

    ('SUV',            'Lavado completo',      24.00),
    ('SUV',            'Lavado por fuera',     17.00),
    ('SUV',            'Lavado por dentro',    17.00),
    ('SUV',            'Encerado',             19.00),
    ('SUV',            'Lavado de motor',      12.00),

    ('Camioneta',      'Lavado completo',      25.00),
    ('Camioneta',      'Lavado por fuera',     18.00),
    ('Camioneta',      'Lavado por dentro',    18.00),
    ('Camioneta',      'Encerado',             20.00),
    ('Camioneta',      'Lavado de motor',      12.00)
) as t (vehiculo, servicio, precio)
join tipo_vehiculo v on v.nombre = t.vehiculo
join tipo_lavado   s on s.nombre = t.servicio
on conflict (tipo_vehiculo_id, tipo_lavado_id)
do update set precio         = excluded.precio,
              activo         = true,
              actualizado_en = now();


-- ---------------------------------------------------------------------
--  Parámetros del negocio.
--  Igual que arriba: se copian a la asistencia del día al registrarla,
--  así que cambiarlos no vuelve puntual a quien ya llegó tarde.
-- ---------------------------------------------------------------------

insert into configuracion (clave, valor, descripcion) values
    ('hora_entrada',         '08:00', 'Hora de referencia para evaluar la puntualidad del personal'),
    ('tolerancia_minutos',   '5',     'Minutos de tolerancia después de la hora de entrada'),
    ('pct_destajo_puntual',  '50',    'Porcentaje de lo cobrado que recibe el lavador puntual'),
    ('pct_destajo_tardanza', '40',    'Porcentaje de lo cobrado que recibe el lavador que llegó tarde')
on conflict (clave)
do update set valor = excluded.valor, actualizado_en = now();


-- ---------------------------------------------------------------------
--  Comprobación: debe devolver el tarifario completo, 20 filas.
-- ---------------------------------------------------------------------

select v.nombre as vehiculo, s.nombre as servicio, t.precio
from tarifa t
join tipo_vehiculo v on v.id = t.tipo_vehiculo_id
join tipo_lavado   s on s.id = t.tipo_lavado_id
where t.activo
order by v.nombre, s.nombre;
