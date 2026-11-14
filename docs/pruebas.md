# Pruebas y resultados

Cuatro pruebas, todas sobre la base de desarrollo (LavaSmart-dev), que tiene tres meses de operación simulada: unos 1 100 lavados y 443 clientes. Producción no recibe datos de prueba. Medido el 14 de noviembre de 2026.

| Prueba | Qué responde | Resultado |
| --- | --- | --- |
| Reglas y permisos | ¿La base hace cumplir las reglas del dueño y lo que puede hacer cada rol? | 88 de 88 casos, después de corregir tres huecos que la propia prueba encontró |
| Tiempo en la base | ¿Cuánto tarda cada consulta de las pantallas? | Todas por debajo de 20 ms |
| Tiempo de la aplicación | ¿Cuánto tarda una pantalla de punta a punta? | 0,6 a 1,1 s; casi todo es distancia entre servidores, no cálculo |
| Modelos de analítica | ¿Los modelos superan a una referencia simple? | La demanda tiene 30 % menos error que la referencia; la segmentación forma 4 grupos con silueta de 0,505 |

---

## 1. Reglas del negocio y permisos por rol

**Cómo se probó.** `sql/pruebas/reglas.sql` ejecuta 88 casos haciéndose pasar por cada tipo de usuario: el dueño, el operador, un usuario con sesión pero sin perfil y alguien sin sesión. Lo hace igual que la aplicación, con el rol autenticado y el usuario en la sesión, porque desde el editor SQL los disparadores no validan y una prueba así no probaría nada. Cada caso dice qué espera: un valor exacto o un rechazo con el nombre de la regla incumplida. Al terminar, todo lo creado se deshace.

| Grupo | Ejemplos de lo que se comprueba | Casos |
| --- | --- | --- |
| Ingreso | El precio sale de la tarifa; al ingresar no se cobra; sin asistencia no se asignan autos; el destajo queda congelado en 50 % o 40 % | 20 |
| Entrega | No se cobra más que el total; solo efectivo o Yape; la hora la pone la base; un lavado entregado no cambia | 11 |
| Asistencia | Solo el dueño pone descuentos y solo al de sueldo fijo; todo descuento lleva motivo | 7 |
| Incidencias | La visita tiene que ser del mismo auto; solo el dueño resuelve; una resuelta no se reabre | 7 |
| Personal | La modalidad y el sueldo cambian solo con los días cerrados | 3 |
| Configuración | Hora, tolerancia y porcentajes con formato válido; moneda fija | 5 |
| Liquidación | Se usa el porcentaje congelado y no el de hoy; un día cerrado no cambia; no se paga dos veces | 14 |
| Permisos | El operador no ve la liquidación ni la segmentación; sin perfil o sin sesión no se ve nada | 14 |
| Nada se borra | Nadie borra lavados, clientes, tarifas, configuración ni personal | 7 |

**Lo que encontró.** La primera corrida dio 82 de 88. Las seis fallas eran tres huecos reales del sistema:

| Hueco | Por qué pasaba | Corrección |
| --- | --- | --- |
| El precio de un lavado ya entregado se podía cambiar, o agregarle servicios | Se protegía la fila del lavado, pero no la de sus servicios | Un disparador congela los servicios cuando el lavado deja de estar en proceso |
| El operador podía asignar autos a un lavador con el día ya cerrado | La regla consultaba la liquidación con los permisos del operador, que no la puede ver | La regla corre con los permisos del sistema (SECURITY DEFINER) |
| El dueño podía borrar tarifas, parámetros y trabajadores | Sus permisos «para todo» incluían borrar | Se quitó el permiso de borrar a todos los usuarios de la aplicación |

Las tres se corrigieron en `sql/17_huecos_de_las_pruebas.sql`, aplicado en desarrollo y en producción. La segunda corrida dio **88 de 88**.

---

## 2. Tiempo de respuesta en la base

**Cómo se midió.** Cada consulta que usa una pantalla se ejecutó 30 veces, conectado como dueño para que las reglas de acceso también cuenten. Se informa la mediana y el percentil 95 (el 95 % de las veces tardó eso o menos).

| Pantalla | Consulta | Mediana | p95 |
| --- | --- | --- | --- |
| Lavados | Registrar el ingreso de un auto | 0,7 ms | 1,1 ms |
| Lavados | Registrar la entrega y el cobro | 0,3 ms | 0,4 ms |
| Lavados | Autos en piso | 0,1 ms | 0,3 ms |
| Lavados | Entregados del día | 7,7 ms | 8,0 ms |
| Lavados | Buscar al cliente por su placa | 0,1 ms | 0,1 ms |
| Inicio y Lavados | Caja del día | 7,4 ms | 7,5 ms |
| Tablero | Caja de los últimos 7 días | 7,4 ms | 7,5 ms |
| Tablero | Resumen (no cobrado y deuda al personal) | 17,1 ms | 17,4 ms |
| Tablero | Servicios más pedidos | 11,4 ms | 11,6 ms |
| Tablero | Demanda de los próximos 7 días | 0,2 ms | 0,2 ms |
| Tablero | Clientes por segmento | 6,4 ms | 6,5 ms |
| Liquidación | Lo devengado del día | 7,9 ms | 8,0 ms |
| Liquidación | Lo que falta pagar | 0,2 ms | 0,2 ms |

Registrar y entregar un auto, lo que se hace frente al cliente, tarda menos de un milisegundo y medio. Las consultas de 7 a 17 ms recorren todo el histórico para convertir cada fecha a la hora de Lima, así que crecen con los datos: con un año de operación rondarían los 30 a 70 ms. No es urgente; si hiciera falta, se resuelve con un índice sobre la fecha de entrega en hora de Lima.

---

## 3. Tiempo de carga de la aplicación

**Cómo se midió.** Con sesión de dueño en la aplicación publicada (`lavasmart.vercel.app`), se pidió cada pantalla 6 veces desde el navegador, en Lima. El tiempo incluye ir hasta el servidor de la aplicación, que este consulte la base y que la página vuelva.

| Pantalla | Mediana | Máximo |
| --- | --- | --- |
| Asistencia | 0,60 s | 0,63 s |
| Personal | 0,63 s | 0,80 s |
| Tarifas y configuración | 0,71 s | 0,99 s |
| Incidencias | 0,73 s | 0,75 s |
| Lavados | 0,94 s | 1,11 s |
| Inicio | 0,98 s | 1,33 s |
| Liquidación | 1,04 s | 1,18 s |
| Tablero | 1,14 s | 1,17 s |

La carga completa de Inicio en el navegador, con estilos y scripts, fue de 1,5 s. No hubo arranques en frío: la primera petición tardó lo mismo que las siguientes. Ese era el motivo para descartar un servidor propio en Render, donde la primera petición tardaba casi un minuto.

**Lo que encontró.** La base responde en menos de 20 ms, pero la pantalla tarda alrededor de un segundo. La diferencia es distancia: la aplicación corre en Vercel en Washington (región `iad1`, la que Vercel usa por defecto) y la base está en São Paulo. Cada consulta cruza el continente de ida y vuelta, unos 120 ms, y una pantalla hace varias seguidas: validar la sesión, leer el perfil y después los datos. Mover la aplicación a la región de São Paulo (`gru1`) dejaría servidor y base en la misma ciudad.

**Otro hallazgo.** La aplicación publicada muestra la predicción de demanda, que solo existe en la base de desarrollo: hoy `lavasmart.vercel.app` está conectada a desarrollo y no a producción. Separar esas variables es la tarea pendiente #25.

---

## 4. Modelos de analítica

Entrenados sobre el histórico simulado: 92 días con 1 111 autos y 443 clientes. Como el generador se construyó con patrones conocidos, estos resultados demuestran que el proceso funciona de punta a punta, no que AquaBrillo se comporte así. Esa conclusión necesita el histórico real.

**Predicción de demanda.** Cada una de las últimas cuatro semanas se predijo usando solo los días anteriores a ella, como se usaría de verdad.

| Candidato | Error medio (autos/día) | RMSE | Error porcentual |
| --- | --- | --- | --- |
| Referencia: el promedio de cada día de la semana | 2,60 | 3,16 | 20,9 % |
| **Regresión Ridge (elegida)** | **1,82** | **2,55** | **16,6 %** |
| Random Forest | 2,37 | 3,02 | 19,2 % |

Ridge se equivoca en promedio en 1,8 autos por día, un 30 % menos que la referencia, y el 80 % de sus errores cae dentro de ±3,7 autos. Sus coeficientes se leen directo: el sábado suma unos 8 autos, un feriado 3,4, la quincena o el fin de mes 1,5.

**Segmentación de clientes.** K-Means sobre recencia, frecuencia y monto gastado, probando 3, 4 y 5 grupos.

| Grupos | Coeficiente de silueta |
| --- | --- |
| 3 | 0,478 |
| **4 (elegido)** | **0,505** |
| 5 | 0,491 |

| Segmento | Clientes | Última visita | Visitas | Gasto promedio |
| --- | --- | --- | --- | --- |
| Frecuentes | 54 | hace 5 días | 9,3 | S/ 185 |
| Ocasionales | 125 | hace 14 días | 2,7 | S/ 65 |
| Nuevos | 120 | hace 26 días | 1,1 | S/ 25 |
| Inactivos | 144 | hace 74 días | 1,0 | S/ 25 |

---

## Cómo repetir las pruebas

- **Reglas y permisos:** pegar `sql/pruebas/reglas.sql` en el editor SQL de LavaSmart-dev y ejecutarlo. Devuelve un caso por fila y el resumen.
- **Modelos:** desde `ml/`, `.venv\Scripts\python demanda.py --hasta 2026-11-12 --seco` y lo mismo con `segmentacion.py`. Con `--seco` muestran los resultados sin escribirlos.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
