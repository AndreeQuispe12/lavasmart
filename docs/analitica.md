# Capa de analítica

La capa de analítica es un proceso independiente que se ejecuta por lotes, lee el histórico de la base de datos, entrena dos modelos y escribe sus resultados en tres tablas de salida. La aplicación web nunca entrena nada: solo lee esas tablas.

Esta separación tiene una consecuencia práctica que conviene subrayar: si el entrenamiento falla, el negocio sigue operando con normalidad. Lo único que ocurre es que el tablero muestra las predicciones de la ejecución anterior.

## Predicción de demanda

Un modelo de regresión estima cuántos vehículos se esperan cada día de la semana siguiente, para planificar cuánto personal convocar. Las variables predictoras salen del propio histórico: el día de la semana, el mes, si es feriado y promedios móviles de las semanas anteriores. El clima puede incorporarse más adelante como variable externa, pero no es requisito para una primera versión útil.

La salida se guarda con su estimación puntual, un intervalo y la versión del modelo que la produjo. Guardar la versión permite comparar el desempeño de modelos sucesivos sin borrar las predicciones anteriores.

Está implementada en `ml/demanda.py`. Lee los autos entregados por día desde `v_caja_dia` y describe cada día con lo que se sabe de antemano: el día de la semana (en columnas de 0 y 1, porque el viernes no está «entre» el jueves y el sábado), si es quincena o fin de mes, si es feriado y la tendencia. Compara tres candidatos como se usarían de verdad: cada una de las últimas cuatro semanas se predice solo con los días anteriores a ella. Los candidatos son una referencia (el promedio de cada día de la semana), una regresión lineal Ridge y un Random Forest; gana el de menor error absoluto medio, se entrena con todo y predice los próximos catorce días. El intervalo sale de los errores de esa prueba: el 80 % de ellos cae dentro del margen.

Se descartó usar como variable el promedio de las semanas anteriores: con pocos meses de datos, el Random Forest mezclaba los viernes con los domingos y predecía de más, y la referencia simple le ganaba. La comparación contra la referencia está para eso: un modelo que no la supera no se usa.

Con el histórico simulado de desarrollo gana Ridge, con 1,8 autos de error por día frente a 2,6 de la referencia (30 % menos), y sus coeficientes se leen directamente: el sábado suma unos 8 autos, un feriado 3,4, la quincena o el fin de mes 1,5, y la tendencia 1,1 por mes. Como el generador se construyó con esos mismos efectos, el resultado demuestra que el proceso los recupera, no que AquaBrillo se comporte así.

Se corre desde `ml/` con `.venv\Scripts\python demanda.py --hasta AAAA-MM-DD` (el último día completo; por defecto, ayer en Lima) y `--seco` para ver los resultados sin escribirlos. Lee `SUPABASE_URL` y la clave secreta de `ml/.env`, que no se versiona; la plantilla es `ml/.env.example`.

## Segmentación de clientes

Un agrupamiento K-Means sobre el modelo RFM clasifica a los clientes según hace cuánto vinieron por última vez, con qué frecuencia vuelven y cuánto han gastado. El objetivo es distinguir al cliente recurrente del ocasional y del que dejó de venir, para dirigir promociones con algún criterio.

Cada fila de salida guarda no solo el segmento asignado sino también los tres valores que llevaron a esa asignación, de modo que el resultado sea explicable y no una etiqueta sin sustento.

## Trazabilidad del entrenamiento

Una tercera tabla registra las métricas de cada entrenamiento: error cuadrático medio y error absoluto medio para la regresión, coeficiente de silueta y número de grupos para el agrupamiento, junto con cuántas filas se usaron. Sin esa tabla no habría forma de sostener que un modelo mejoró, ni de explicar por qué un modelo entrenado en el primer mes de operación es menos confiable que el mismo modelo seis meses después.

## Dónde se ven los resultados

En el tablero del dueño, al final, hay un bloque con los dos modelos: la demanda esperada para cada uno de los próximos siete días, con su intervalo; la cantidad de clientes en cada segmento, y al elegir uno, la lista de esos clientes con los tres valores que explican por qué están ahí; y debajo, cuándo se entrenó cada modelo, con cuántas filas y con qué métricas, para saber cuánto creerle. En la pantalla de inicio, los dos roles ven una sola línea con los autos esperados para hoy.

La segmentación es solo del dueño, y lo hace cumplir la base de datos: es una lista de placas, que son dato personal, y sirve para decisiones comerciales. La demanda no identifica a nadie y le sirve al operador para organizar el día.

Mientras las tablas de salida estén vacías, cada bloque dice que está pendiente. No se muestran datos simulados como si fueran del negocio.

## El prerrequisito que no se puede saltar

Ninguno de los dos modelos funciona sin histórico. Una regresión de demanda necesita varios meses de operación registrada para distinguir el patrón semanal del ruido, y una segmentación necesita clientes con más de una visita para que la frecuencia signifique algo.

Por eso la digitalización de los cuadernos físicos no es una tarea administrativa previa sino la primera dependencia técnica del proyecto. Mientras no exista ese histórico, la capa de analítica no tiene nada que entrenar, y cualquier resultado que produjera sería una ilusión estadística.

## El histórico simulado de desarrollo

Para construir y demostrar el proceso antes de tener datos reales, la base de desarrollo (LavaSmart-dev) tiene tres meses de operación simulada, del 13 de agosto al 12 de noviembre de 2026, generados por `ml/simulacion/historico_simulado.sql`. Producción nunca los recibe: el script se niega a correr donde no encuentra los datos de prueba de `03`.

El generador reproduce patrones de un lavadero de Lima en lugar de repartir autos al azar: más demanda el sábado y el domingo, menos en el invierno con garúa y una subida con la primavera, más autos en la quincena, el fin de mes y algunos feriados, y días nublados con menos clientes. Los clientes tienen costumbres (frecuentes con su día y servicio, taxis que lavan por fuera cada pocos días, ocasionales y de una sola visita), las llegadas se concentran de 9 a 12 y de 15 a 17:30, y hay tardanzas, faltas, pagos parciales, incidencias y liquidaciones cerradas y pagadas. Pasa por las mismas restricciones y disparadores que la aplicación, de modo que el porcentaje del destajo y la liquidación salen de las reglas del sistema y no del generador.

Son datos inventados y así se presentan: las placas simuladas empiezan por Z y los celulares por 9000. Los resultados que los modelos obtengan sobre ellos demuestran que el proceso funciona de punta a punta, no que el negocio se comporte así; esa conclusión solo puede salir del histórico real.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
