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
