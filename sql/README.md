# Base de datos

Los archivos se ejecutan **en orden numérico** desde el editor SQL de Supabase.
Cada uno solo referencia objetos de los anteriores.

| Archivo | Qué hace |
| --- | --- |
| `01_esquema.sql` | Crea los 9 tipos enumerados, las 15 tablas, las 2 vistas, los 4 disparadores, los 13 índices y las políticas de seguridad. Carga los catálogos mínimos. |
| `02_tarifas.sql` | Reemplaza las tarifas de ejemplo por las reales de AquaBrillo. |
| `03_datos_prueba.sql` | Datos de desarrollo: lavadores, placas inventadas y una semana de lavados. **No ejecutar en producción.** |
| `pruebas/casos.sql` | 13 casos que comprueban que las reglas del negocio se cumplen. |

## Reglas

- Un archivo ya ejecutado **no se modifica**. Un cambio se corrige con un archivo nuevo.
- Ningún cambio de esquema se hace a mano desde el panel: se pierde del historial y los
  entornos divergen.
- Las placas de `03_datos_prueba.sql` son inventadas. La placa real es dato personal.
