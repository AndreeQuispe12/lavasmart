# Despliegue

## Base de datos

Los cambios de esquema se aplican ejecutando archivos SQL numerados, nunca modificando tablas a mano desde el panel. El motivo es que un cambio hecho a mano existe en un solo entorno y desaparece del historial: quien levante el proyecto desde cero seis meses después obtendrá una base de datos distinta de la que está en producción.

Cada archivo nuevo se numera a continuación del último y no se modifica una vez ejecutado. Corregir un cambio equivocado se hace con un archivo nuevo, igual que en un libro contable.

## Aplicación web

Vercel se conecta al repositorio de GitHub y despliega automáticamente. Cada envío a la rama principal actualiza el sitio en producción, y cada solicitud de incorporación genera una vista previa con su propia dirección, que es la forma más cómoda de revisar un cambio antes de aceptarlo.

Las variables de entorno se configuran en el panel de Vercel y no viajan en el repositorio.

La aplicación corre en la región de São Paulo de Vercel (`gru1`), fijada en `web/vercel.json`, la misma ciudad que la base de datos. Por defecto Vercel la ejecutaba en Washington (`iad1`), y cada consulta cruzaba el continente de ida y vuelta: las pantallas tardaban alrededor de un segundo aunque la base respondía en menos de 20 ms (ver [pruebas.md](pruebas.md)).

## Proceso de analítica

El entrenamiento se ejecuta una vez por semana. Puede programarse como una tarea del repositorio o ejecutarse a mano mientras el volumen de datos sea pequeño. Se conecta con la clave de servicio, porque necesita escribir en tablas que ningún rol de la aplicación puede modificar.

## Entornos

Conviene mantener dos proyectos de Supabase separados, uno de desarrollo y otro de producción, y no compartir la base de datos entre ambos. Probar contra la base real termina, tarde o temprano, con datos de prueba mezclados con lavados verdaderos, y separarlos después es mucho más caro que crear el segundo proyecto ahora.

Así está organizado:

| Proyecto de Supabase | Para qué | Quién lo usa | Datos |
| --- | --- | --- | --- |
| LavaSmart | Producción: el lavadero real | El sitio publicado (variables de Production en Vercel) | Solo reales |
| LavaSmart-dev | Desarrollo, pruebas y demostraciones | El entorno local (web/.env.local) y las vistas previas de cada solicitud de incorporación (variables de Preview en Vercel) | Inventados, de 03_datos_prueba.sql |

Los dos tienen el mismo esquema: 01 y del 04 al último archivo de sql/, en orden. El orden de trabajo con un archivo nuevo es siempre el mismo: se aplica primero en desarrollo, se prueba ahí con los datos de prueba y recién después se aplica en producción. El archivo 03 solo se ejecuta en desarrollo, y con la sesión en hora de Lima (set timezone = 'America/Lima'), porque usa la fecha actual y Supabase trabaja en UTC.

Cada proyecto tiene sus propios usuarios. Las cuentas de prueba existen solo en desarrollo, y las del dueño y el operador reales, solo en producción.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
