# Base de datos

Los archivos se ejecutan **en orden numérico** desde el editor SQL de Supabase.
Cada uno solo referencia objetos de los anteriores.

| Archivo | Qué hace |
| --- | --- |
| `01_esquema.sql` | Crea los 9 tipos enumerados, las 15 tablas, las 2 vistas, los 4 disparadores, los 13 índices y las políticas de seguridad. Carga los catálogos mínimos. |
| `02_tarifas.sql` | Reemplaza las tarifas de ejemplo por las reales de AquaBrillo. |
| `03_datos_prueba.sql` | Datos de desarrollo: lavadores, placas inventadas y una semana de lavados. **No ejecutar en producción.** |
| `04_seguridad_advisor.sql` | Corrige el Security Advisor: vistas con `security_invoker`, `search_path` fijo en los disparadores y `fn_es_dueno`/`fn_es_personal` fuera del alcance de `anon`. Solo depende de `01`. Ya aplicado en el proyecto actual. |
| `05_asistencia_para_todos.sql` | Corrige el disparador que congela el destajo: ahora exige asistencia también al de sueldo fijo, y rechaza los días de falta o no laborado. Va después de `04`, porque conserva el `search_path` fijo. |
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
| `pruebas/casos.sql` | 13 casos que comprueban que las reglas del negocio se cumplen. |

## Reglas

- Un archivo ya ejecutado **no se modifica**. Un cambio se corrige con un archivo nuevo.
- Ningún cambio de esquema se hace a mano desde el panel: se pierde del historial y los
  entornos divergen.
- Las placas de `03_datos_prueba.sql` son inventadas. La placa real es dato personal.
