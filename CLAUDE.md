# LavaSmart

Sistema web de gestión operativa con analítica predictiva para **AquaBrillo**, un lavadero de
autos en Lima, Perú. Proyecto del curso Innovación y Transformación Digital (UTP, 2026-2).

Sustituye el cuaderno físico donde hoy se registran los servicios, los cobros, la asistencia
del personal y los reclamos. Sobre esa misma información se aplican después dos modelos:
predicción de demanda y segmentación de clientes.

Responder y escribir comentarios **en español**.

---

## Estado actual

| Pieza | Estado |
| --- | --- |
| Modelo de datos | **Terminado y verificado.** `sql/01_esquema.sql` corre de una pasada sobre PostgreSQL 15+. Validado con 13 casos de prueba de comportamiento. |
| Documentación | Terminada, en `docs/`. |
| Mockups | 9 pantallas de escritorio, rol dueño. |
| Proyecto en Supabase | **No creado todavía.** |
| Aplicación web | **No existe todavía.** Falta andamiar. |
| Proceso de analítica | **No existe todavía.** Y no puede entrenarse: no hay histórico. |

Lo primero que toca es crear el proyecto en Supabase, ejecutar el esquema y andamiar Next.js.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Aplicación | Next.js (App Router) + TypeScript + React |
| Datos | PostgreSQL 15+ gestionado en Supabase, región São Paulo |
| Autenticación | Supabase Auth |
| Despliegue | Vercel, conectado a la rama principal de GitHub |
| Analítica | Python + scikit-learn, proceso semanal por lotes |

No hay backend propio y es deliberado. La aplicación habla directo con Supabase; la
autorización la resuelve la base de datos con seguridad a nivel de fila (RLS). Se descartó un
servicio en Render porque en el plan gratuito se suspende y la primera petición tarda casi un
minuto, lo que es inaceptable en un mostrador con un cliente esperando.

---

## Estructura

```
web/    aplicación Next.js   (si todavía se llama app/, renombrarla:
                              el App Router crea su propio app/ dentro)
sql/    esquema y migraciones, numeradas por orden de ejecución
ml/     proceso de analítica
docs/   documentación técnica
```

---

## Reglas del negocio

Estas son del dueño, no mías. Si el código las contradice, el equivocado es el código.
El detalle completo está en `docs/reglas-de-negocio.md`.

- El **precio** sale del cruce tipo de vehículo × tipo de lavado. Una visita puede incluir
  varios servicios y se suman.
- El **cliente se identifica por la placa**. Un cliente equivale a un vehículo. Nombre y
  teléfono son opcionales.
- El **cobro se hace al entregar el auto**, nunca al recibirlo.
- Solo dos medios de pago: **efectivo y Yape**.
- Si el cliente paga incompleto, en la práctica **no vuelve a pagar**. El saldo se anota solo
  para calcular el destajo.
- **Un lavador por vehículo.**
- **Destajo:** 50 % de lo *cobrado* si marcó entrada dentro de la hora de referencia (8:00)
  más la tolerancia (5 min); 40 % si llegó después. Se fija por la mañana y dura todo el día.
- **Sueldo fijo:** monto diario que asigna el dueño. Si llega tarde, el dueño decide si lo deja
  trabajar y cuánto le descuenta. El descuento es un monto a mano, no una fórmula.
- **Frecuencia de pago:** los de sueldo fijo cobran semanal; los de destajo, diario o semanal.
- **Devengar no es pagar:** la liquidación se calcula todos los días; el dinero sale del cajón
  el día en que se entrega.
- Las **incidencias** ocurren durante el lavado y se anclan a la placa; si se identifica la
  visita, también al lavado.

**Roles.** Solo dos: `operador` y `dueno`. Los permisos del dueño son un **superconjunto** de
los del operador, no un conjunto distinto — el dueño a veces cubre el turno y tiene que poder
registrar servicios. Los lavadores no usan el sistema.

---

## Modelo de datos

15 tablas normalizadas hasta 3FN, 2 vistas, 4 disparadores, 13 índices, RLS en todas.
Ficha campo por campo en `docs/modelo-de-datos.md` y en el diccionario de datos.

```
Catálogos   tipo_vehiculo · tipo_lavado · tarifa · configuracion
Personas    trabajador · cliente · perfil
Operación   lavado · detalle_lavado · incidencia
Personal    asistencia · liquidacion
Salidas     prediccion_demanda · cliente_segmento · modelo_metrica
```

Cuatro ideas lo explican casi todo:

1. **Dato congelado ≠ redundancia.** `detalle_lavado.precio_cobrado`,
   `lavado.porcentaje_destajo`, `asistencia.hora_referencia` y `asistencia.tolerancia_minutos`
   guardan el valor vigente *ese día*. No son copias del catálogo: son un hecho distinto.
   Subir la tarifa no debe reescribir el reporte de junio.
2. **Los totales se calculan.** `lavado` **no tiene** columna `monto_total`. El total, el saldo
   y el estado de pago salen de la vista `v_lavado`, que suma `detalle_lavado`.
3. **Escritura en dos momentos.** El lavado se crea al ingresar el auto (sin cobro) y se
   completa al entregarlo (monto, método de pago, hora de entrega).
4. **Nada se borra.** Catálogos con `activo`, llaves foráneas con `ON DELETE RESTRICT`, y
   ninguna política RLS concede DELETE.

**Vistas.** `v_lavado` (total, saldo, estado de pago) y `v_caja_dia` (cobranza del día por
medio de pago, agrupada por fecha de *entrega* convertida a `America/Lima`).

**Disparadores.** Normalizan la placa; congelan el porcentaje de destajo e impiden asignar un
auto a un lavador sin asistencia; validan el cobro al entregar; y vuelven inmutable una
liquidación cerrada.

---

## Errores que se cometen con este modelo

Leer esta lista antes de escribir una consulta. Son trampas reales, no hipótesis.

- **No crear una columna `monto_total` en `lavado`.** No existe a propósito. Consultar
  `v_lavado`.
- **Un auto en proceso con cero cobrado no es una deuda.** Toda consulta de saldos filtra por
  `estado = 'entregado'`. `v_lavado.estado_pago` devuelve `sin_cobrar` para los no entregados
  justamente para evitar esto. Ignorarlo hace que el sistema reporte como morosos a los
  clientes cuyos autos se están lavando.
- **No cobrar al registrar el ingreso.** Una restricción lo impide: si el estado no es
  `entregado`, el monto cobrado tiene que ser 0 y no puede haber método de pago.
- **Para liquidar, usar `lavado.porcentaje_destajo`, no `configuracion`.** El porcentaje está
  congelado en cada lavado. Leerlo del catálogo reescribe pagos ya devengados.
- **Para un total histórico, usar `detalle_lavado.precio_cobrado`, no `tarifa`.** Misma razón.
- **Si el motor rechaza un lavado porque el lavador no tiene asistencia, no es un bug.** Es la
  regla: primero se marca entrada, después se reciben autos. No desactivar el disparador.
- **Un usuario recién creado en Supabase no ve nada** hasta que tenga fila en `perfil`. Inicia
  sesión bien y las consultas devuelven vacío. Es RLS funcionando, no un error.
- **Nunca usar la clave `service_role` en la aplicación web.** Ignora todas las políticas. Solo
  el proceso de analítica la usa.
- **No hacer DELETE.** Baja lógica con `activo = false`.
- **No modificar un archivo SQL ya ejecutado.** Se corrige con uno nuevo y numerado.
- **Nunca `NEXT_PUBLIC_` delante de un secreto.** Ese prefijo lo manda al navegador.
- **Dinero en `numeric`, nunca en flotante.** Tiempos en `timestamptz`; el día del negocio se
  obtiene convirtiendo a `America/Lima`, no en UTC.

---

## Seguridad

Este repositorio es **público**. Nunca deben entrar:

- la clave `service_role` de Supabase,
- la contraseña de la base de datos,
- datos reales de clientes.

La **placa vehicular es dato personal** bajo la Ley N.° 29733 del Perú: permite llegar al
titular por el registro vehicular. Usarla como identificador es seudonimización, no
anonimización. Los datos de prueba llevan placas inventadas.

Si una credencial llega al repositorio, hay que **rotarla**. Borrar el archivo no sirve: el
historial de Git la conserva.

Variables de entorno en `.env.example`. `.env.local` no se versiona.

---

## Convenciones

**Base de datos.** Nombres en singular, minúsculas, sin tildes, con guion bajo. Toda
restricción con nombre explícito que empieza por el nombre de su tabla, para que el error del
motor diga qué regla se incumplió. Cambios de esquema siempre por archivo numerado en `sql/`,
nunca a mano desde el panel de Supabase.

**Código.** El formato lo decide Prettier y no se discute. ESLint marca errores reales; las
advertencias no se silencian sin comentario que lo justifique. Los tipos del esquema se
generan desde Supabase, no se escriben a mano.

**Git.** La rama principal se mantiene desplegable. Cada tarea en su rama. El mensaje de commit
dice qué cambió y por qué, no qué archivos se tocaron.

---

## Cómo trabajar conmigo

**Escribe tú el código.** No me pidas que lo escriba yo ni me entregues el trabajo a medias
para que lo complete. Estoy aprendiendo, pero aprendo leyendo lo que hiciste y entendiendo por
qué, no peleándome con un ejercicio.

**Al terminar cada cambio, dame este informe.** Breve, en este orden, siempre:

```
Qué toqué
  ruta/del/archivo.tsx   — qué cambió, en una línea
  ruta/otro.ts           — qué cambió, en una línea

Cómo funciona
  El recorrido completo del cambio, en prosa: qué dispara qué, qué datos
  viajan, dónde termina. Sin repetir el código línea por línea.

Para repasar
  Nombre exacto del concepto — por qué aparece en este cambio (una frase)
  Nombre exacto del concepto — por qué aparece en este cambio (una frase)
```

Reglas del informe:

- **Nombres exactos y buscables** en «Para repasar». «Server Components de Next.js» sirve;
  «cómo funciona el renderizado» no me lleva a ninguna parte.
- **Máximo cinco conceptos** por cambio, ordenados del más importante al menos. Si hay más, es
  señal de que el cambio era demasiado grande.
- **No me des el tutorial.** Nombra el concepto y explica en una frase por qué aparece aquí. Si
  quiero más, te lo pido.
- **Marca lo nuevo.** Si el cambio usa algo que no habíamos usado antes en el proyecto, dilo
  explícitamente en lugar de dejarlo pasar como si fuera rutina.
- **Avísame de tus decisiones.** Cuando elijas entre dos caminos razonables, dime cuál tomaste y
  qué descartaste. Puede que yo lo quisiera al revés.

**Lo demás:**

- **Un cambio a la vez**, verificado, antes de pasar al siguiente.
- **Cuestióname si algo no cuadra.** Varias decisiones de este modelo salieron de que se
  discutiera la primera idea en vez de aceptarla.
- **Si te pido algo que contradice las reglas del negocio o del modelo, párate y dímelo**
  antes de hacerlo. Puede que se me haya olvidado por qué está así.
- Si cambias el comportamiento del sistema, **actualiza `docs/` en el mismo commit**.

---

## Dónde está el detalle

| Archivo | Qué contiene |
| --- | --- |
| `docs/README.md` | Índice, visión general y recorrido completo de una visita |
| `docs/arquitectura.md` | Arquitectura, decisiones descartadas y stack |
| `docs/modelo-de-datos.md` | Las 15 tablas y las reglas que hace cumplir el motor |
| `docs/seguridad.md` | Autenticación, RLS, datos personales y secretos |
| `docs/analitica.md` | Los dos modelos y por qué no pueden entrenarse todavía |
| `docs/desarrollo.md` | Requisitos, variables de entorno, puesta en marcha |
| `docs/despliegue.md` | Migraciones, Vercel, entornos |
| `docs/riesgos.md` | Riesgos técnicos y mitigaciones |
| `docs/reglas-de-negocio.md` | Las reglas del lavadero en palabras del dueño |
| `sql/01_esquema.sql` | La fuente de verdad del modelo |
