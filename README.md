# LavaSmart

Sistema web de gestión operativa con analítica predictiva para el lavadero de autos
**AquaBrillo** (Lima, Perú). Proyecto del curso Innovación y Transformación Digital, UTP.

Sustituye el cuaderno físico donde hoy se registran los servicios, los cobros, la
asistencia del personal y los reclamos, y sobre esa misma información aplica dos modelos:
predicción de demanda y segmentación de clientes.

## Estado

En desarrollo.

- **Modelo de datos:** terminado y verificado sobre PostgreSQL.
- **Aplicación web:** andamiada (Next.js + TypeScript + Tailwind, cliente de Supabase
  instalado). Sin pantallas todavía.
- **Proyecto en Supabase:** pendiente de crear.
- **Proceso de analítica:** pendiente. No puede entrenarse hasta tener histórico.

## Stack

| Capa | Tecnología |
| --- | --- |
| Aplicación web | Next.js (App Router) + TypeScript + Tailwind CSS, desplegada en Vercel |
| Datos | PostgreSQL gestionado en Supabase (São Paulo) |
| Analítica | Python + scikit-learn, proceso semanal por lotes |

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `web/` | Aplicación Next.js |
| `sql/` | Esquema, tarifas, datos de prueba y pruebas de comportamiento |
| `ml/` | Proceso de analítica |
| `docs/` | Documentación técnica |

## Puesta en marcha

1. Crear el proyecto en Supabase (región São Paulo).
2. Ejecutar los archivos de `sql/` en orden numérico.
3. Reemplazar las tarifas de ejemplo por las reales.
4. Copiar `.env.example` a `.env.local` y completar los valores.
5. Instalar dependencias y levantar la aplicación.
6. Crear el primer usuario y asignarle el rol `dueno` en la tabla `perfil`.

El paso 6 no es opcional: sin perfil, las políticas de seguridad no dejan ver ningún dato.

Detalle completo en [docs/](docs/README.md).

## Advertencia

Este repositorio es público. No debe contener nunca la clave `service_role` de Supabase,
la contraseña de la base de datos, ni datos reales de clientes: la placa vehicular es dato
personal bajo la Ley N.° 29733.
