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

La liquidación de un día cubre a los dos tipos de trabajador. Al de destajo le corresponde el porcentaje congelado en cada lavado aplicado a lo cobrado; al de sueldo fijo, su sueldo del día si trabajó, menos el descuento que el dueño puso en la asistencia. Un auto cuenta para el día en que se entrega, porque el destajo es sobre lo cobrado y se cobra al entregar. El total a pagar no se guarda: lo calcula la vista de liquidación.

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
| No se asigna un auto a un lavador sin asistencia, ni en un día de falta o no laborado, sea de destajo o de sueldo fijo | Disparador | Registrar trabajo de alguien que nunca llegó. Hasta 05_asistencia_para_todos.sql, el de sueldo fijo se saltaba esta revisión. |
| El descuento y el día no laborado los decide solo el dueño, y el descuento solo es para el de sueldo fijo | Disparador | Que un operador se ponga o se quite un descuento llamando a la API directamente. La base anota quién decidió. |
| El ingreso de un auto se guarda completo o no se guarda: cliente, lavado y servicios juntos | Función fn_registrar_ingreso | Un lavado sin servicios en piso, que no se puede entregar ni borrar. |
| El precio de cada servicio lo copia la base desde la tarifa vigente | Función fn_registrar_ingreso | Que la aplicación mande un precio distinto al del tarifario. |
| Un auto no puede estar dos veces en piso, y una placa no cambia de tipo de vehículo | Función fn_registrar_ingreso | Duplicar una visita o cobrar un auto con la tarifa de otro tipo. |
| Una visita entregada ya no se modifica desde la aplicación, ni por el dueño | Disparador | Bajar después el monto cobrado: la caja cuadraría con un cajón al que le falta dinero y el destajo del lavador cambiaría. Una corrección se hace desde el editor SQL. |
| La hora de entrega la pone la base, y el auto y el lavador de una visita no cambian | Disparador | Una entrega con una hora inventada, o un porcentaje de destajo congelado para otro lavador. |
| Una incidencia ligada a una visita solo puede ser de una visita de ese mismo auto | Disparador | Que un reclamo de un auto termine atribuido al lavador que atendió a otro. |
| Solo el dueño resuelve una incidencia; lo registrado no cambia y una resuelta queda cerrada | Disparador | Que el operador cierre un reclamo que puede implicar plata, o que se reescriba lo que se reportó. |
| No se entrega una visita sin servicios | Disparador | Cerrar un lavado sin saber qué se le hizo al auto. |
| No se cobra más que el total facturado | Disparador | Un cobro superior a lo que corresponde. |
| Una liquidación cerrada es inmutable y no se reabre | Disparador | Modificar el monto de un pago ya acordado. |
| La liquidación la calcula y la cierra la base, y solo el dueño | Función fn_cerrar_dia | Montos sumados en la aplicación, o un destajo calculado con el porcentaje de hoy en vez del congelado. |
| Con su día de hoy cerrado, un lavador no recibe ni entrega autos hoy | Disparador | Un cobro que quedaría fuera de toda liquidación. |

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
