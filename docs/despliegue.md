# Despliegue

## Base de datos

Los cambios de esquema se aplican ejecutando archivos SQL numerados, nunca modificando tablas a mano desde el panel. El motivo es que un cambio hecho a mano existe en un solo entorno y desaparece del historial: quien levante el proyecto desde cero seis meses después obtendrá una base de datos distinta de la que está en producción.

Cada archivo nuevo se numera a continuación del último y no se modifica una vez ejecutado. Corregir un cambio equivocado se hace con un archivo nuevo, igual que en un libro contable.

## Aplicación web

Vercel se conecta al repositorio de GitHub y despliega automáticamente. Cada envío a la rama principal actualiza el sitio en producción, y cada solicitud de incorporación genera una vista previa con su propia dirección, que es la forma más cómoda de revisar un cambio antes de aceptarlo.

Las variables de entorno se configuran en el panel de Vercel y no viajan en el repositorio.

La aplicación corre en la región de São Paulo de Vercel (`gru1`), fijada en `web/vercel.json`, la misma ciudad que la base de datos. Por defecto Vercel la ejecutaba en Washington (`iad1`), y cada consulta cruzaba el continente de ida y vuelta: las pantallas tardaban alrededor de un segundo aunque la base respondía en menos de 20 ms (ver [pruebas.md](pruebas.md)).

## Proceso de analítica

El entrenamiento corre solo, una vez por semana, con GitHub Actions (`.github/workflows/entrenamiento.yml`): cada lunes a las 6:00 de Lima instala las dependencias de `ml/`, ejecuta `demanda.py` y después `segmentacion.py` contra producción. Se conecta con la clave de servicio, porque necesita escribir en tablas que ningún rol de la aplicación puede modificar.

Mientras producción no tenga histórico suficiente (ocho semanas de días para la demanda, treinta clientes para la segmentación), cada script lo explica en el resumen de la ejecución y termina sin error: la ejecución queda en verde y el tablero sigue en «pendiente». El día que haya datos, empieza a entrenar sin que nadie toque nada. Un error de verdad, como una clave que falta o una base que no responde, sí deja la ejecución en rojo y GitHub avisa por correo.

También se lanza a mano desde la pestaña Actions del repositorio (Entrenamiento semanal → Run workflow), eligiendo el entorno, la fecha de corte y si solo muestra resultados sin escribir. Para entrenar con el histórico simulado de desarrollo, la fecha de corte es el 12 de noviembre de 2026, el último día del histórico simulado: así salen las métricas publicadas en [pruebas.md](pruebas.md). Con la fecha por defecto (ayer), los días vacíos posteriores contarían como días sin autos, y los pocos lavados cargados a mano el 14 y el 15 para la demostración tampoco representan un día normal: con corte el 15, el error de Ridge sube de 1,8 a 3 autos por día.

**Las claves del flujo.** Viven en dos entornos de GitHub (Settings → Environments), `produccion` y `desarrollo`, cada uno con los secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de su proyecto de Supabase. GitHub no los muestra a nadie una vez guardados, no los entrega a las solicitudes de incorporación que llegan desde copias del repositorio y los oculta en los registros. El flujo solo tiene permiso de lectura sobre el repositorio, y la fecha escrita a mano se valida antes de usarse.

## Entornos

Conviene mantener dos proyectos de Supabase separados, uno de desarrollo y otro de producción, y no compartir la base de datos entre ambos. Probar contra la base real termina, tarde o temprano, con datos de prueba mezclados con lavados verdaderos, y separarlos después es mucho más caro que crear el segundo proyecto ahora.

Así está organizado:

| Proyecto de Supabase | Para qué | Quién lo usa | Datos |
| --- | --- | --- | --- |
| LavaSmart | Producción: el lavadero real | El sitio publicado, `lavasmart.vercel.app` (variables de Production en Vercel) | Solo reales |
| LavaSmart-dev | Desarrollo, pruebas y demostraciones | El entorno local (web/.env.local), las vistas previas de cada solicitud de incorporación y la demo (variables de Preview y Development en Vercel) | Inventados: 03_datos_prueba.sql y tres meses de histórico simulado |

En Vercel, cada variable de Supabase aparece dos veces: una con los valores de producción, marcada solo para Production, y otra con los de desarrollo, para Preview y Development. Son variables con prefijo `NEXT_PUBLIC_`, que se copian dentro del código al compilar: después de cambiarlas hay que volver a desplegar. Hasta el 14 de noviembre de 2026 todas apuntaban a desarrollo, y el sitio publicado mostraba datos simulados.

**La demo.** La rama `demo` existe solo para tener una dirección fija conectada a desarrollo, con datos para mostrar: `lavasmart-git-demo-andry-u-s-projects.vercel.app`. No se fusiona con la rama principal. Para actualizarla con lo último de la principal, se fusiona la principal en ella y se sube; un commit vacío basta para que Vercel la vuelva a compilar. Las vistas previas no piden cuenta de Vercel (se desactivó la protección del proyecto), así que la demo abre desde cualquier computadora; solo contienen datos inventados y para ver algo igual hay que iniciar sesión en LavaSmart. En desarrollo hay una cuenta de dueño y una de operador para mostrar los dos roles.

Los dos tienen el mismo esquema: 01 y del 04 al último archivo de sql/, en orden. El orden de trabajo con un archivo nuevo es siempre el mismo: se aplica primero en desarrollo, se prueba ahí con los datos de prueba y recién después se aplica en producción. El archivo 03 solo se ejecuta en desarrollo, y con la sesión en hora de Lima (set timezone = 'America/Lima'), porque usa la fecha actual y Supabase trabaja en UTC.

Cada proyecto tiene sus propios usuarios. Las cuentas de prueba existen solo en desarrollo, y las del dueño y el operador reales, solo en producción.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
