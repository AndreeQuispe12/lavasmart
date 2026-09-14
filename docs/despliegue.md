# Despliegue

## Base de datos

Los cambios de esquema se aplican ejecutando archivos SQL numerados, nunca modificando tablas a mano desde el panel. El motivo es que un cambio hecho a mano existe en un solo entorno y desaparece del historial: quien levante el proyecto desde cero seis meses después obtendrá una base de datos distinta de la que está en producción.

Cada archivo nuevo se numera a continuación del último y no se modifica una vez ejecutado. Corregir un cambio equivocado se hace con un archivo nuevo, igual que en un libro contable.

## Aplicación web

Vercel se conecta al repositorio de GitHub y despliega automáticamente. Cada envío a la rama principal actualiza el sitio en producción, y cada solicitud de incorporación genera una vista previa con su propia dirección, que es la forma más cómoda de revisar un cambio antes de aceptarlo.

Las variables de entorno se configuran en el panel de Vercel y no viajan en el repositorio.

## Proceso de analítica

El entrenamiento se ejecuta una vez por semana. Puede programarse como una tarea del repositorio o ejecutarse a mano mientras el volumen de datos sea pequeño. Se conecta con la clave de servicio, porque necesita escribir en tablas que ningún rol de la aplicación puede modificar.

## Entornos

Conviene mantener dos proyectos de Supabase separados, uno de desarrollo y otro de producción, y no compartir la base de datos entre ambos. Probar contra la base real termina, tarde o temprano, con datos de prueba mezclados con lavados verdaderos, y separarlos después es mucho más caro que crear el segundo proyecto ahora.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
