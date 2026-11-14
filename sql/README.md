# Base de datos

Aquí está toda la base de LavaSmart. Son muchos archivos porque **cada uno es una decisión**:
cuando una regla cambió o apareció un error, no se editó el archivo viejo, sino que se agregó
uno nuevo que explica qué cambia y por qué. Es la forma habitual de llevar una base de datos
(migraciones numeradas) y permite saber exactamente qué tiene aplicado cada entorno.

Para entenderla no hace falta leerlos en orden. Empieza por el mapa.

---

## Mapa por tema

| Tema | Archivos | Qué resuelve |
| --- | --- | --- |
| **La base** | `01`, `04` | Las 15 tablas, las vistas, la seguridad por rol (RLS) y los ajustes que pidió el Security Advisor de Supabase. |
| **Recibir y entregar un auto** | `07`, `08`, `16` | El ingreso se guarda completo y sin cobro; la entrega cobra, pone la hora y deja el lavado cerrado; nombre y celular del cliente son opcionales y se autocompletan en la siguiente visita. |
| **Personal y asistencia** | `05`, `06`, `13` | Sin marcar entrada no se le asignan autos; el descuento por tardanza y el «no laboró» los decide solo el dueño; la modalidad y el sueldo cambian solo con los días cerrados. |
| **Pagos al personal** | `10`, `11` | Lo devengado de cada día, el cierre del día (lo congela) y la entrega del pago (devengar no es pagar). |
| **Reclamos** | `09` | La incidencia se ancla al auto y, si se sabe, a la visita; solo el dueño la resuelve. |
| **Configuración** | `12` | Tarifas y reglas de asistencia y destajo con formato válido. |
| **Tablero y analítica** | `14`, `15` | Resúmenes de solo lectura para el dueño y los resultados de los dos modelos (demanda para todos, segmentación solo para el dueño). |
| **Correcciones de las pruebas** | `17` | Tres huecos que encontraron las pruebas: el precio de un lavado entregado se podía cambiar, el operador podía saltarse el día cerrado y el dueño podía borrar filas. |
| *No van a producción* | `02`, `03`, `pruebas/` | Tarifas reales (pendiente del dueño), datos de prueba y los casos de prueba. |

El histórico simulado para entrenar los modelos no está aquí sino en
`ml/simulacion/historico_simulado.sql`, porque es parte de la analítica y solo corre en
desarrollo.

---

## ¿Dónde está la regla…?

| Pregunta | Archivo |
| --- | --- |
| ¿De dónde sale el precio de un servicio? | `07` (se copia de la tarifa al registrar el ingreso) |
| ¿Por qué no se puede cobrar al recibir el auto? | `01` (restricción `lavado_entrega_coherente`) |
| ¿Por qué no puedo cambiar un lavado ya entregado? | `08` (el lavado) y `17` (sus servicios y precios) |
| ¿Por qué no me deja asignar un auto a un lavador? | `05` (no marcó entrada, faltó o no laboró) o `10` (su día ya se cerró) |
| ¿Cómo se fija el 50 % o el 40 % del destajo? | `05` (se congela en el lavado según su asistencia) |
| ¿Quién puede poner un descuento al personal? | `06` (solo el dueño, solo al de sueldo fijo) |
| ¿Cómo se calcula lo que se le paga a cada uno? | `10` (`fn_calcular_liquidacion`) |
| ¿Cómo se registra que ya se le pagó? | `11` (`fn_entregar_pago`) |
| ¿Por qué no puedo cambiar el sueldo de un trabajador? | `13` (tiene autos en piso o días sin cerrar) |
| ¿Quién resuelve un reclamo? | `09` (solo el dueño) |
| ¿Qué valores acepta la configuración? | `12` |
| ¿Por qué nadie puede borrar nada? | `17` (sin permiso `DELETE`) y `01` (llaves foráneas que lo impiden) |
| ¿Qué ve cada rol? | `01` (políticas RLS) y `15` (segmentación solo del dueño) |
| ¿Cómo se buscan los datos de un cliente que vuelve? | `16` (`fn_buscar_cliente`, `fn_placas_del_telefono`) |

---

## Poner en marcha una base nueva

1. Ejecutar en orden `01` y luego `04` a `17`, desde el editor SQL de Supabase. Cada archivo
   solo usa objetos de los anteriores.
2. Solo en desarrollo: `03_datos_prueba.sql` y, si se quiere el histórico,
   `ml/simulacion/historico_simulado.sql`.
3. Solo en producción, cuando el dueño entregue sus precios: `02_tarifas.sql`.
4. En desarrollo, correr `pruebas/reglas.sql` y comprobar que todos los casos pasan.

## Lista completa, en orden

| Archivo | Qué hace |
| --- | --- |
| `01_esquema.sql` | Crea los 9 tipos enumerados, las 15 tablas, las 2 vistas, los 4 disparadores, los 13 índices y las políticas de seguridad. Carga los catálogos mínimos. |
| `02_tarifas.sql` | Reemplaza las tarifas de ejemplo por las reales de AquaBrillo. |
| `03_datos_prueba.sql` | Datos de desarrollo: lavadores, placas inventadas y una semana de lavados. **No ejecutar en producción.** |
| `04_seguridad_advisor.sql` | Corrige el Security Advisor: vistas con `security_invoker`, `search_path` fijo en los disparadores y `fn_es_dueno`/`fn_es_personal` fuera del alcance de `anon`. |
| `05_asistencia_para_todos.sql` | Corrige el disparador que congela el destajo: ahora exige asistencia también al de sueldo fijo, y rechaza los días de falta o no laborado. |
| `06_decision_dueno_asistencia.sql` | Disparador en `asistencia`: el descuento y el "no laboró" solo los puede poner el dueño, el descuento solo es para el de sueldo fijo, y `autorizado_por` lo escribe la base con quien decidió. |
| `07_registrar_ingreso.sql` | Función `fn_registrar_ingreso`: crea el cliente si la placa es nueva, el lavado y sus servicios en una sola transacción, con el precio copiado de `tarifa`. Rechaza un auto que ya está en piso y una placa registrada con otro tipo de vehículo. |
| `08_registrar_entrega.sql` | Función `fn_registrar_entrega` y disparador `tr_lavado_cerrar`: la entrega pone la hora con el reloj de la base, un lavado entregado ya no se modifica desde la aplicación, y el auto y el lavador de un lavado no cambian. |
| `09_incidencia_coherente.sql` | Disparador en `incidencia`: la visita indicada tiene que ser del mismo auto, la base pone la fecha, el estado inicial y quién registró, lo registrado no cambia, y solo el dueño la marca como resuelta. |
| `10_liquidacion_completa.sql` | Agrega a `liquidacion` el sueldo y el descuento del trabajador fijo, la vista `v_liquidacion` con el total a pagar, `fn_calcular_liquidacion` (lo devengado en un día, sin escribir) y `fn_cerrar_dia` (lo congela; solo el dueño). Un día pasado se cierra siempre; el de hoy, solo para el lavador sin autos en piso, y desde ahí ese lavador no recibe ni entrega autos hoy. |
| `11_entrega_del_pago.sql` | Vista `v_por_pagar` (días cerrados sin pagar y su suma, por trabajador) y `fn_entregar_pago`, que marca pagado todo lo pendiente de un trabajador hasta un día, con la fecha de hoy en Lima. Solo el dueño; un pago registrado no se deshace. |
| `12_configuracion_valida.sql` | Disparadores: cada parámetro de `configuracion` con su formato (hora HH:MM, tolerancia 0 a 120, porcentajes 0 a 100), moneda y zona horaria fijas, ninguna clave nueva desde la aplicación; y `actualizado_en` de `tarifa` y `configuracion` con el reloj de la base al cambiar. |
| `13_cambio_de_modalidad.sql` | Disparador en `trabajador`: la modalidad y el sueldo diario solo cambian si no tiene autos en piso ni días con actividad sin liquidación cerrada, para que ningún día se pague con dos reglas. Nombre, documento y frecuencia cambian siempre. |
| `14_tablero.sql` | Funciones de solo lectura para el tablero: `fn_tablero_resumen` (lo no cobrado por pagos incompletos de autos entregados, y lo que se le debe al personal) y `fn_servicios_mas_pedidos` (cantidad y monto por servicio, con el precio congelado). |
| `15_analitica_visible.sql` | La segmentación de clientes pasa a ser solo del dueño (contiene placas, que son dato personal); la demanda y las métricas siguen para todo el personal. Vistas `v_demanda_vigente` y `v_segmento_vigente`, que eligen la versión más reciente de cada modelo. |
| `16_datos_del_cliente.sql` | Nombre y celular opcionales del cliente, validados, en `fn_registrar_ingreso`; `fn_buscar_cliente` y `fn_placas_del_telefono` para autocompletar en la siguiente visita. |
| `17_huecos_de_las_pruebas.sql` | Cierra lo que encontró `pruebas/reglas.sql`: el detalle de un lavado entregado ya no cambia, la regla del día cerrado se cumple también cuando registra el operador, y nadie puede borrar (se quita `DELETE` y `TRUNCATE` a `anon` y `authenticated`). |
| `pruebas/casos.sql` | 13 casos de `01_esquema.sql` (histórico, se corre con `psql`). |
| `pruebas/reglas.sql` | 88 casos de `05` a `17` y de permisos por rol, ejecutados como un usuario autenticado. Solo en LavaSmart-dev; se deshace solo. Pegar en el editor SQL y ejecutar: devuelve un caso por fila y el resumen. |

## Reglas

- Un archivo ya ejecutado **no se modifica**. Un cambio se corrige con un archivo nuevo, y se
  agrega aquí: en su tema del mapa y en la lista completa.
- Ningún cambio de esquema se hace a mano desde el panel: se pierde del historial y los
  entornos divergen.
- Todo archivo nuevo se aplica primero en LavaSmart-dev, se corren las pruebas y después se
  aplica en producción.
- Las placas de `03_datos_prueba.sql` son inventadas. La placa real es dato personal.
