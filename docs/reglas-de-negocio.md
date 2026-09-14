# Reglas de negocio

Las reglas del lavadero tal como las describe el dueño. Este archivo es la fuente de verdad
del proyecto: cuando el código y este documento se contradigan, el equivocado es el código.

## Servicios y precios

- El precio sale del cruce **tipo de vehículo × tipo de lavado**. Un lavado completo cuesta
  distinto en sedán que en camioneta.
- Una visita puede incluir varios servicios. Camioneta con lavado completo más encerado son
  dos servicios y se cobran sumados.
- Tipos de vehículo: sedán, station wagon, SUV y camioneta.
- Tipos de lavado: completo, por fuera, por dentro, encerado y de motor.

## Clientes

- Se identifican por la **placa** del vehículo, no por el nombre.
- Supuesto del proyecto: un cliente equivale a un vehículo.
- El nombre y el teléfono son opcionales, solo si el cliente los da.
- La placa es **dato personal** bajo la Ley N.° 29733: usarla como identificador es
  seudonimización, no anonimización.

## Cobro

- El cobro se hace **al entregar el auto**, no al recibirlo.
- Solo se aceptan dos medios: **efectivo y Yape**.
- Un auto en proceso con cero cobrado **no es una deuda**: todavía no se le ha cobrado.
- Cuando el cliente paga incompleto, en la práctica **no vuelve a cancelar**. El saldo se
  anota únicamente para calcular el destajo, no para cobrarlo después.

## Personal

- Un solo lavador atiende cada vehículo.
- **Destajo**: 50 % de lo *cobrado* si marcó entrada dentro de la hora de referencia más la
  tolerancia; 40 % si llegó después. La regla se fija por la mañana y dura todo el día.
- Hora de referencia: 8:00. Tolerancia: 5 minutos.
- Si el cliente pagó incompleto, el porcentaje se calcula sobre lo que efectivamente pagó.
- **Sueldo fijo**: monto diario que asigna el dueño según la experiencia. Si el trabajador
  llega tarde, el dueño decide si lo deja trabajar y cuánto le descuenta ese día.
- **Frecuencia de pago**: los de sueldo fijo cobran siempre semanal; los de destajo, diario
  o semanal según prefieran.
- **Devengar no es pagar**: la liquidación se calcula todos los días, pero el dinero sale del
  cajón el día en que se entrega.

## Incidencias

- Ocurren durante el lavado: un rayón al secar, un aspirado que no se hizo, un objeto que
  falta.
- Se asocian siempre a la placa y, cuando se puede identificar, también a la visita. De ahí
  se derivan el lavador y la fecha.
- Un reclamo que llega días después queda sin visita asociada.

## Roles

| Rol | Qué hace |
| --- | --- |
| Operador | Recibe los autos, registra, cobra, marca asistencia y anota incidencias. |
| Dueño | Todo lo del operador, porque a veces cubre el turno, más tarifas, configuración, personal, liquidaciones y tablero. |

Los lavadores no usan el sistema.

---

_Si una regla del negocio cambia, se actualiza aquí primero y después en el código._
