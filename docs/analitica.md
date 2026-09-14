# Capa de analítica

La capa de analítica es un proceso independiente que se ejecuta por lotes, lee el histórico de la base de datos, entrena dos modelos y escribe sus resultados en tres tablas de salida. La aplicación web nunca entrena nada: solo lee esas tablas.

Esta separación tiene una consecuencia práctica que conviene subrayar: si el entrenamiento falla, el negocio sigue operando con normalidad. Lo único que ocurre es que el tablero muestra las predicciones de la ejecución anterior.

## Predicción de demanda

Un modelo de regresión estima cuántos vehículos se esperan cada día de la semana siguiente, para planificar cuánto personal convocar. Las variables predictoras salen del propio histórico: el día de la semana, el mes, si es feriado y promedios móviles de las semanas anteriores. El clima puede incorporarse más adelante como variable externa, pero no es requisito para una primera versión útil.

La salida se guarda con su estimación puntual, un intervalo y la versión del modelo que la produjo. Guardar la versión permite comparar el desempeño de modelos sucesivos sin borrar las predicciones anteriores.

## Segmentación de clientes

Un agrupamiento K-Means sobre el modelo RFM clasifica a los clientes según hace cuánto vinieron por última vez, con qué frecuencia vuelven y cuánto han gastado. El objetivo es distinguir al cliente recurrente del ocasional y del que dejó de venir, para dirigir promociones con algún criterio.

Cada fila de salida guarda no solo el segmento asignado sino también los tres valores que llevaron a esa asignación, de modo que el resultado sea explicable y no una etiqueta sin sustento.

## Trazabilidad del entrenamiento

Una tercera tabla registra las métricas de cada entrenamiento: error cuadrático medio y error absoluto medio para la regresión, coeficiente de silueta y número de grupos para el agrupamiento, junto con cuántas filas se usaron. Sin esa tabla no habría forma de sostener que un modelo mejoró, ni de explicar por qué un modelo entrenado en el primer mes de operación es menos confiable que el mismo modelo seis meses después.

## El prerrequisito que no se puede saltar

Ninguno de los dos modelos funciona sin histórico. Una regresión de demanda necesita varios meses de operación registrada para distinguir el patrón semanal del ruido, y una segmentación necesita clientes con más de una visita para que la frecuencia signifique algo.

Por eso la digitalización de los cuadernos físicos no es una tarea administrativa previa sino la primera dependencia técnica del proyecto. Mientras no exista ese histórico, la capa de analítica no tiene nada que entrenar, y cualquier resultado que produjera sería una ilusión estadística.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
