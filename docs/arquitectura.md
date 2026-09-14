# Arquitectura y stack

## Arquitectura

### Vista general

El sistema tiene dos piezas desplegadas y un proceso que se ejecuta por lotes. No hay servidor propio que administrar en ninguna de las tres.

```
Navegador (escritorio / celular)
        |
        v
Aplicación Next.js  ——— desplegada en Vercel
        |
        | cliente de Supabase sobre HTTPS
        v
PostgreSQL gestionado ——— Supabase (São Paulo)
        ^
        | lectura del histórico / escritura de resultados
        |
Proceso de analítica ——— ejecución semanal por lotes
```

La aplicación web habla directamente con la base de datos a través del cliente de Supabase. No hay una capa intermedia de servicios propia, y eso es una decisión, no una omisión: la autorización que normalmente escribiría ese servidor está implementada dentro de la propia base de datos mediante seguridad a nivel de fila.

### Componentes y responsabilidades

| Componente | Responsabilidad | Dónde corre |
| --- | --- | --- |
| Aplicación web | Pantallas, validación de formularios, composición de las consultas y presentación de los resultados. | Vercel |
| Base de datos | Almacenamiento, integridad referencial, reglas de negocio invariantes y autorización por fila. | Supabase |
| Autenticación | Alta de usuarios, inicio de sesión y emisión del token que identifica a quien consulta. | Supabase Auth |
| Proceso de analítica | Entrenamiento de los modelos y escritura de sus resultados en las tablas de salida. | Ejecución programada |

El reparto de responsabilidades entre la aplicación y la base de datos sigue un criterio simple: si una regla debe cumplirse siempre, sin importar quién escriba ni desde dónde, vive en la base de datos. Si es una comodidad para quien usa el sistema, vive en la aplicación. Validar que el monto cobrado no supere el total es lo primero; avisar al operador antes de que envíe el formulario es lo segundo, y ambas cosas pueden coexistir sin contradecirse.

### Decisiones de arquitectura

Tres decisiones definen esta arquitectura y las tres tuvieron alternativas que se descartaron por razones concretas.

Sin backend dedicado. La propuesta inicial contemplaba un servicio propio desplegado en Render. Se descartó por dos motivos. El primero es que en el plan gratuito ese servicio se suspende por inactividad y la primera petición después de la pausa puede tardar cerca de un minuto, lo que en un punto de recepción con un cliente esperando es inaceptable. El segundo es que ese servicio habría existido casi únicamente para reimplementar una autorización que la base de datos ya sabe hacer por sí sola.

Autorización dentro de la base de datos. La seguridad a nivel de fila aplica las políticas en el motor, de modo que no hay forma de saltárselas: ni desde la aplicación, ni desde una carga masiva, ni desde una consulta escrita a mano en el panel de administración. Una capa de autorización en el servidor solo protege lo que pasa por el servidor.

Analítica por lotes y no en línea. Ningún resultado de los modelos se necesita al instante. La demanda se predice para la semana siguiente y la segmentación cambia con lentitud, así que un proceso semanal que escribe sus conclusiones en tablas es suficiente. Esto mantiene la aplicación web libre de dependencias de Python y permite que el entrenamiento falle sin que el negocio deje de operar.

## Stack tecnológico

| Capa | Tecnología | Por qué |
| --- | --- | --- |
| Lenguaje | TypeScript | Los errores de tipo aparecen al escribir y no en producción. Supabase genera los tipos del esquema, de modo que un nombre de columna mal escrito no compila. |
| Aplicación web | Next.js con React | Framework de referencia para React, con renderizado en servidor y despliegue directo en Vercel sin configuración. |
| Alojamiento web | Vercel | Despliegue automático desde GitHub, HTTPS incluido y plan gratuito suficiente para el volumen del negocio. |
| Base de datos | PostgreSQL 15+ | Motor relacional maduro, con tipos enumerados, restricciones expresivas, disparadores y seguridad a nivel de fila. |
| Plataforma de datos | Supabase (São Paulo) | PostgreSQL gestionado con autenticación, API y respaldos. La región reduce la latencia frente a alojar en Norteamérica. |
| Analítica | Python con scikit-learn | Ecosistema estándar para regresión y agrupamiento; pandas para la preparación de los datos. |
| Editor | Visual Studio Code | Con ESLint y Prettier para el estilo del código y GitLens para el historial. |
| Control de versiones | Git y GitHub | Historial del proyecto y origen de los despliegues automáticos. |

### Sobre las versiones

El esquema exige PostgreSQL 15 o superior por el uso de identidades generadas, agregados con filtro y tipos enumerados; se verificó sobre la versión 16. Para el resto de componentes conviene fijar las versiones en los archivos de dependencias en cuanto el proyecto se andamie, y no antes: anotar aquí un número de versión que luego nadie actualiza produce documentación que miente.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
