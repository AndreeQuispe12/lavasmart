# Modelo de datos y reglas

## Modelo de datos

El modelo consta de quince tablas normalizadas hasta la tercera forma normal, dos vistas, cuatro disparadores y trece índices, además de las políticas de seguridad de todas las tablas. El detalle completo está en el diccionario de datos; aquí va solo lo necesario para orientarse.

### Las quince tablas

| Bloque | Tablas | Qué guardan |
| --- | --- | --- |
| Catálogos | tipo_vehiculo, tipo_lavado, tarifa, configuracion | Lo que mantiene el dueño: categorías, servicios, la matriz de precios y los parámetros del negocio. |
| Personas | trabajador, cliente, perfil | El personal, los vehículos identificados por placa y el puente entre el usuario autenticado y su rol. |
| Operación | lavado, detalle_lavado, incidencia | El núcleo: cada visita, los servicios que incluyó y los reclamos asociados. |
| Personal | asistencia, liquidacion | La marcación diaria y el cierre de lo devengado por cada lavador. |
| Salidas | prediccion_demanda, cliente_segmento, modelo_metrica | Lo que escribe el proceso de analítica. La aplicación solo lee estas tres. |

### Principios del modelo

Cuatro ideas explican por qué el modelo es como es, y las cuatro se repiten en varias tablas.

Dato congelado no es redundancia. Cuatro columnas guardan una copia de un valor que también existe en otra tabla: el precio de cada servicio prestado, el porcentaje de destajo de cada lavado y la hora de referencia y la tolerancia de cada asistencia. No son la misma afirmación repetida, sino una afirmación distinta: no «cuánto cuesta esto», sino «cuánto se cobró por esto aquel día». Si el negocio sube los precios, el reporte de junio debe seguir diciendo lo que se cobró en junio.

Los totales se calculan. La tabla de lavados no almacena el total de la visita: se obtiene sumando el detalle y se expone en una vista. Un total almacenado habría que mantenerlo sincronizado, y un fallo de sincronización haría que la base de datos afirmara dos cosas distintas sobre el mismo lavado.

Devengar no es pagar. El destajo se calcula todos los días, pero el dinero sale del cajón cuando se entrega, que para varios lavadores es una vez por semana. Por eso la liquidación separa el cierre de la entrega, y varias liquidaciones diarias pueden compartir una misma fecha de entrega.

Nada se borra. Los catálogos se desactivan en lugar de eliminarse, las llaves foráneas impiden borrar aquello que ya se usó alguna vez y ninguna política de seguridad concede el permiso de borrado.

### Las dos vistas

| Vista | Qué entrega |
| --- | --- |
| v_lavado | La visita con su total, su saldo y su estado de pago ya calculados. Es la que consume la aplicación en lugar de la tabla cruda. |
| v_caja_dia | La cobranza del día separada en efectivo y Yape, agrupada por fecha de entrega convertida a la zona horaria de Lima. |

El estado de pago que devuelve la primera vista incluye un valor llamado sin_cobrar, reservado a las visitas que todavía no se entregaron. Sin esa categoría el sistema reportaría como morosos a los clientes cuyos autos se están lavando en ese momento, que es exactamente el error que el modelo quiere evitar.

## Reglas de negocio implementadas en la base de datos

Las reglas que siguen no dependen de que la aplicación se acuerde de aplicarlas: las hace cumplir el motor. Están listadas aquí porque son, en la práctica, la especificación funcional del sistema.

| Regla | Cómo se aplica | Qué impide |
| --- | --- | --- |
| El sueldo diario existe solo en la modalidad fija | Restricción de tabla | Un lavador a destajo con sueldo asignado, o uno fijo sin sueldo. |
| El sueldo fijo se paga semanalmente | Restricción de tabla | Configurar un trabajador fijo con pago diario. |
| Una visita entregada tiene hora de entrega y método de pago | Restricción de tabla | Cerrar una visita sin registrar cómo pagó el cliente. |
| Una visita no entregada tiene cero cobrado | Restricción de tabla | Que un auto en proceso aparezca como deuda. |
| Todo descuento lleva su motivo | Restricción de tabla | Descuentos al personal sin justificación registrada. |
| No se entrega dinero de un día no cerrado | Restricción de tabla | Pagar sobre cifras que aún pueden cambiar. |
| La placa se normaliza al guardarse | Disparador | Que la misma placa entre dos veces escrita de forma distinta. |
| El porcentaje de destajo se congela al registrar la visita | Disparador | Que un cambio posterior de la regla altere pagos ya devengados. |
| No se asigna un auto a un lavador sin asistencia | Disparador | Registrar trabajo de alguien que nunca llegó. |
| No se entrega una visita sin servicios | Disparador | Cerrar un lavado sin saber qué se le hizo al auto. |
| No se cobra más que el total facturado | Disparador | Un cobro superior a lo que corresponde. |
| Una liquidación cerrada es inmutable | Disparador | Modificar el monto de un pago ya acordado. |

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
