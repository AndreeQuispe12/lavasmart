# Entorno de desarrollo y convenciones

## Entorno de desarrollo

### Requisitos

- Node.js en versión con soporte activo, con npm.
- Python 3.11 o superior, únicamente para la capa de analítica.
- Git y una cuenta de GitHub con acceso al repositorio.
- Una cuenta de Supabase y otra de Vercel, ambas en plan gratuito.
- Visual Studio Code con ESLint, Prettier y GitLens.

### Estructura del repositorio

```
lavasmart/
  web/          aplicación Next.js
  sql/          esquema, tarifas, datos de prueba y pruebas
  ml/           proceso de analítica
  docs/         esta documentación
  .env.example  nombres de las variables, sin valores
  .gitignore
  README.md
```

| Carpeta | Qué contiene |
| --- | --- |
| web/ | La aplicación. La genera la herramienta de andamiaje de Next.js; no se crean carpetas a mano dentro. |
| sql/ | Archivos numerados por orden de ejecución, más las pruebas de comportamiento. |
| ml/ | Los datos digitalizados, los cuadernos de exploración y los guiones de entrenamiento. |
| docs/ | Documentación en Markdown, versionada junto con el código para que no se desactualice en silencio. |

### Variables de entorno

| Variable | Para qué sirve | Visibilidad |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Dirección del proyecto de Supabase. | Pública |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Clave publicable que usa el navegador. | Pública |
| SUPABASE_SERVICE_ROLE_KEY | Clave del proceso de analítica. Ignora las políticas de seguridad. | Privada |
| DATABASE_URL | Cadena de conexión directa para migraciones y para el proceso de analítica. | Privada |

Las variables cuyo nombre empieza por NEXT_PUBLIC quedan incrustadas en el código que se descarga al navegador. Ese prefijo no debe aparecer nunca delante de un secreto.

### Puesta en marcha

El orden importa, porque la aplicación no puede levantarse contra una base de datos que todavía no existe.

- Crear el proyecto en Supabase, en la región de São Paulo, y guardar sus credenciales.
- Ejecutar los archivos de sql/ en orden numérico desde el editor SQL de Supabase.
- Reemplazar las tarifas de ejemplo por las tarifas reales del negocio.
- Copiar .env.example a .env.local y completar los valores.
- Instalar las dependencias y levantar la aplicación en modo desarrollo.
- Crear el primer usuario desde el panel de Supabase y asignarle el rol de dueño en la tabla de perfiles, porque sin perfil ninguna política de seguridad lo deja ver nada.

El último paso es el que más confusión causa la primera vez: un usuario recién creado en Supabase existe para la autenticación pero no para el negocio, de modo que inicia sesión correctamente y no ve absolutamente ningún dato hasta que se le crea su perfil.

## Convenciones y flujo de trabajo

### Base de datos

- Nombres de tablas y columnas en singular, minúsculas, sin tildes y con guion bajo entre palabras.
- Toda restricción lleva nombre explícito que empieza por el nombre de su tabla, para que el mensaje de error identifique la regla incumplida.
- Los montos son numeric y nunca de punto flotante.
- Las marcas de tiempo son timestamptz; el día del negocio se obtiene convirtiendo a la zona horaria de Lima.

### Código

- El formato lo decide Prettier y no se discute en las revisiones.
- ESLint marca los errores reales; las advertencias no se silencian sin comentario que lo justifique.
- Los tipos del esquema se generan desde Supabase en lugar de escribirse a mano.

### Git

- La rama principal se mantiene siempre desplegable.
- Cada tarea se trabaja en su propia rama y entra por solicitud de incorporación.
- El mensaje de commit describe qué cambió y por qué, no qué archivos se tocaron.
- Ningún archivo de entorno, credencial ni dato real de clientes entra al repositorio.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
