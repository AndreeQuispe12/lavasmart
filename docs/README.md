# Documentación de LavaSmart

## Contenido

- [Arquitectura y stack](arquitectura.md)
- [Modelo de datos y reglas](modelo-de-datos.md)
- [Seguridad](seguridad.md)
- [Capa de analítica](analitica.md)
- [Entorno de desarrollo y convenciones](desarrollo.md)
- [Despliegue](despliegue.md)
- [Riesgos técnicos](riesgos.md)
- [Diccionario de datos](diccionario-de-datos.docx) — ficha campo por campo de las 15 tablas
- [Reglas de negocio](reglas-de-negocio.md) — las reglas del lavadero en palabras del dueño

## Introducción

### Propósito del documento

Este documento describe cómo está construido LavaSmart: de qué piezas se compone, por qué se eligió cada una, cómo se comunican entre sí y qué hace falta para levantarlo, modificarlo y desplegarlo. Está dirigido a quien tenga que trabajar sobre el sistema, incluido el propio equipo dentro de seis meses, cuando los motivos de cada decisión ya no se recuerden.

No es un manual de usuario ni un documento académico. Cuando una decisión tuvo alternativas razonables, aquí se explica cuál se descartó y por qué, porque esa es la información que se pierde primero y la que más cuesta reconstruir.

### Alcance

Cubre la arquitectura, el stack, la capa de datos, la seguridad, la capa de analítica, el entorno de desarrollo y el despliegue. El detalle campo por campo de las quince tablas no está aquí: vive en el diccionario de datos, que es un documento aparte y más extenso.

El sistema se encuentra en desarrollo. Las secciones que describen componentes todavía no construidos lo indican de forma explícita; todo lo demás describe lo que ya existe y está verificado.

Al momento de esta versión, el modelo de datos está terminado y verificado, y el proyecto en la nube está creado con el esquema aplicado. La aplicación web está publicada en Vercel con inicio de sesión, con el marco de navegación —un menú lateral que muestra a cada rol solo sus secciones— y con la pantalla de personal. Las pantallas de operación diaria todavía no están construidas.

### Documentos relacionados

| Documento | Qué contiene |
| --- | --- |
| Diccionario de datos | Ficha campo por campo de las 15 tablas, las 2 vistas, los 4 disparadores, los índices y el modelo de permisos. |
| 01_esquema.sql | El guion ejecutable que crea toda la estructura. Es la fuente de verdad del modelo. |
| reglas-de-negocio.md | Las reglas del lavadero tal como las describe el dueño, sin traducción técnica. |
| APF1 | El avance académico: problema, entorno, propuesta y metodología. |

## Visión general del sistema

LavaSmart es un sistema web de gestión operativa para el lavadero de autos AquaBrillo, con una capa de analítica que se alimenta de la misma operación que el sistema registra. Sustituye el cuaderno físico donde hoy se anotan los servicios, los pagos, la asistencia del personal y los reclamos.

El sistema se usa principalmente desde una computadora de escritorio situada en el punto de recepción, donde el operador recibe los vehículos. Es responsive y se consulta desde el celular, pero el diseño parte del escritorio porque ahí es donde ocurre el trabajo de registro.

### Usuarios y roles

El sistema tiene dos roles y solo dos. Los lavadores no son usuarios: sus datos los registra otra persona.

| Rol | Quién es | Qué puede hacer |
| --- | --- | --- |
| Operador | Quien recibe los autos en el punto de recepción. | Registrar vehículos y servicios, cobrar y entregar, marcar asistencia, anotar incidencias, consultar el historial. |
| Dueño | El propietario del negocio. | Todo lo del operador, porque a veces cubre el turno, y además tarifas, configuración, personal, liquidaciones y tablero. |

El principio que ordena los permisos es que el dueño tiene un superconjunto de los del operador, no un conjunto distinto. Modelarlos como conjuntos separados llevaría al error de que el dueño no pueda registrar un servicio el día que atiende él mismo.

### Módulos funcionales

| Módulo | Qué resuelve | Estado |
| --- | --- | --- |
| Registro de servicios | Ingreso del vehículo, asignación del lavador y de los servicios contratados. | Diseñado |
| Cobro y entrega | Cierre de la visita: monto cobrado, método de pago y hora de entrega. | Diseñado |
| Asistencia | Marcación diaria del personal y determinación del porcentaje de destajo del día. | Diseñado |
| Liquidación | Cierre diario de lo devengado por cada lavador y registro de la entrega del dinero. | Diseñado |
| Incidencias | Registro y seguimiento de reclamos ocurridos durante el lavado. | Diseñado |
| Catálogos y configuración | Tipos de vehículo, servicios, tarifas y parámetros del negocio. | Diseñado |
| Tablero | Caja del día, autos en piso, indicadores y salidas de los modelos. | Diseñado |

«Diseñado» significa que el módulo tiene su modelo de datos definido y verificado y su pantalla especificada en los mockups, pero todavía no está implementado.

El registro del personal está implementado: el dueño agrega trabajadores, corrige sus datos, los da de baja y los reactiva. El nombre, el documento y la frecuencia de pago se corrigen siempre; la modalidad y el sueldo, solo cuando todos sus días están cerrados en la liquidación, de modo que el cambio vale desde el día siguiente y ningún día se paga con dos reglas. Va antes que la asistencia porque no se puede marcar la entrada de alguien que no existe en el sistema.

La asistencia está implementada en su parte diaria: el operador o el dueño marca la entrada o la falta de cada trabajador activo. La hora la pone el sistema en el momento de marcar, en hora de Lima y al minuto, de modo que llegar a las 8:05 todavía es puntual y a las 8:06 ya es tardanza. Al marcar se copian en la fila la hora de referencia y la tolerancia vigentes, y a los de destajo se les fija el porcentaje del día; a los de sueldo fijo no, porque no cobran porcentaje. Una falta marcada por error se corrige cuando el trabajador llega. Cuando uno de sueldo fijo llega tarde, el dueño decide en la misma pantalla: lo deja trabajar con un descuento en soles y su motivo, o lo marca como no laborado, y ese día ya no recibe autos. Esa decisión solo la puede tomar el dueño, y lo hace cumplir la base de datos, no solo la pantalla.

El ingreso de los autos está implementado. El operador escribe la placa, elige el tipo de vehículo, marca los servicios —cada uno muestra su precio de la tarifa vigente y abajo se ve el total estimado— y asigna un lavador entre los que marcaron entrada ese día. La base registra todo junto o nada: crea el cliente si la placa es nueva, el lavado sin cobro y un servicio por cada uno marcado, con el precio copiado de la tarifa. Debajo del formulario se listan los autos en piso con su total, su lavador y la hora de ingreso; ninguno figura como deuda, porque todavía no se entregó.

La entrega con cobro también está implementada. En cada auto en piso, el botón de entregar propone cobrar el total; si el cliente paga menos, se baja el monto y la pantalla muestra el saldo, que se anota solo para el destajo porque el cliente no vuelve a pagar. Cobrar cero se puede, pero hay que confirmar que el cliente se fue sin pagar. Al entregar, la base pone la hora con su propio reloj, y desde ese momento la visita ya no se modifica desde la aplicación. Arriba de la pantalla se ve la caja del día, por medio de pago, y abajo los autos entregados hoy con su estado de pago.

Las incidencias están implementadas. Para registrar un reclamo se busca la placa y el sistema muestra las últimas visitas de ese auto, con su fecha y su lavador; se elige en cuál pasó, o se indica que no tiene visita asociada cuando el reclamo llega días después y no se puede atribuir. Las pendientes se listan con su estado: el operador puede pasarlas a en proceso, pero solo el dueño las resuelve, escribiendo cómo, porque la resolución puede implicar dinero. Esa regla la hace cumplir la base de datos.

La liquidación está implementada en su parte de cierre. El dueño elige un día y ve, por trabajador, lo cobrado, el destajo, el sueldo, el descuento y el total a pagar, todo calculado por la base. Al cerrar el día esos montos quedan congelados. Un día pasado se cierra siempre; el día de hoy, solo para el lavador que no tiene autos en piso, porque un auto cuenta para el día en que se entrega, y desde que su día se cierra ese lavador ya no recibe ni entrega autos hoy.

La entrega del dinero también está implementada. Arriba de la liquidación se lista, por trabajador, lo que se le debe: cuántos días cerrados tiene sin pagar, desde cuándo y cuánto suman. Al pagar, el dueño confirma el monto y quedan marcados como pagados todos esos días hasta el último que vio en pantalla, con la fecha de hoy. Así sirve igual para quien cobra cada día y para quien cobra una vez por semana. Un pago registrado no se deshace.

Las tarifas y la configuración están implementadas. El dueño edita el tarifario como en el cuaderno, con los servicios en filas y los tipos de vehículo en columnas, y las reglas de asistencia: la hora de entrada, la tolerancia y los dos porcentajes del destajo. Lo que cambia vale desde ese momento; ningún lavado ni ninguna asistencia ya registrados cambian, porque cada uno guardó el precio y la regla de su día. La base rechaza un valor que no sirve, como una hora mal escrita.

En el menú de la aplicación, cada módulo aparece como una sección. Las secciones que solo ve el dueño son liquidación, personal, tarifas y configuración, y el tablero; las demás las ven los dos roles. Mientras un módulo no esté implementado, su sección se muestra sin enlace y con la marca «pronto».

### Recorrido de una visita

Conviene tener presente el recorrido completo, porque de él se desprenden varias decisiones técnicas que de otro modo parecerían arbitrarias.

- El lavador llega y marca su entrada. El sistema compara la hora contra la hora de referencia más la tolerancia y fija su porcentaje de destajo para todo el día.
- Llega un vehículo. El operador lo identifica por su placa, elige los servicios y asigna un lavador. La visita queda en proceso y todavía no hay cobro.
- Se termina el lavado y el cliente recoge el auto. En ese momento se registra el monto cobrado y el método de pago, y la visita pasa a entregada.
- Al cierre del día se liquida a cada lavador a destajo: se suma lo cobrado en los autos que atendió y se le aplica el porcentaje congelado esa mañana.
- El dinero sale del cajón cuando se le entrega, que puede ser ese mismo día o al final de la semana.

Dos hechos de este recorrido condicionan todo el modelo. El primero es que el cobro ocurre al final, de modo que una visita en curso no representa ninguna deuda del cliente. El segundo es que el porcentaje del destajo se determina por la mañana y no puede cambiar después, aunque el dueño modifique la regla general.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
