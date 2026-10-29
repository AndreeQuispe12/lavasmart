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
| `pruebas/casos.sql` | 13 casos que comprueban que las reglas del negocio se cumplen. |

## Reglas

- Un archivo ya ejecutado **no se modifica**. Un cambio se corrige con un archivo nuevo.
- Ningún cambio de esquema se hace a mano desde el panel: se pierde del historial y los
  entornos divergen.
- Las placas de `03_datos_prueba.sql` son inventadas. La placa real es dato personal.
