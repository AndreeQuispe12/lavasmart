# Seguridad

## Autenticación

La autenticación la gestiona Supabase. El sistema no almacena contraseñas ni implementa su propio inicio de sesión, lo que elimina de raíz toda una categoría de errores. Cada usuario autenticado tiene una fila en la tabla de perfiles que lo asocia con su rol dentro del negocio y, opcionalmente, con su ficha de personal.

## Autorización por fila

Las quince tablas tienen activada la seguridad a nivel de fila antes de que se inserte el primer dato. El estado por defecto es el más restrictivo: sin una política que lo autorice explícitamente, ninguna consulta devuelve nada.

Dos funciones auxiliares resuelven la identidad de quien consulta: una comprueba que el usuario tenga perfil en el negocio y la otra que además sea el dueño. Ambas se declaran de modo que una tabla suplantadora no pueda alterar su resultado.

| Conjunto de tablas | Operador | Dueño |
| --- | --- | --- |
| Catálogos, tarifas, configuración, personal | Solo lectura | Lectura y escritura |
| Clientes, lavados, detalle, incidencias, asistencia | Leer, crear y editar | Leer, crear y editar |
| Perfiles | Solo el propio | Todos, y es el único que los administra |
| Liquidaciones | Sin acceso | Lectura y escritura |
| Salidas de los modelos | Solo lectura | Solo lectura |

Ninguna política concede el permiso de borrado a ningún rol. Las tablas de salida son de solo lectura incluso para el dueño: quien escribe en ellas es el proceso de analítica, que se conecta con la clave de servicio y por tanto no pasa por estas políticas.

## Datos personales

El sistema identifica a los clientes por la placa del vehículo. Eso reduce la cantidad de datos personales almacenados, pero no los elimina: la placa permite llegar al titular a través del registro vehicular, de modo que es una seudonimización y no una anonimización. El tratamiento queda sujeto a la Ley N.° 29733 de Protección de Datos Personales.

En la práctica esto significa tres cosas. Que el nombre y el teléfono del cliente son opcionales y solo se registran si los entrega voluntariamente. Que el acceso a la información está limitado por rol dentro de la propia base de datos. Y que ningún registro real de clientes puede salir del entorno controlado, lo que incluye de forma muy especial el repositorio de código.

## Gestión de secretos

El repositorio del proyecto es público. Dos credenciales no pueden aparecer nunca en él: la clave de servicio de Supabase, que ignora todas las políticas de seguridad, y la contraseña de la base de datos.

| Credencial | Dónde vive | Quién la usa |
| --- | --- | --- |
| URL del proyecto | Variable de entorno pública | La aplicación web, en el navegador. |
| Clave publicable | Variable de entorno pública | La aplicación web. Es segura de exponer porque las políticas de seguridad la limitan. |
| Clave de servicio | Variable de entorno privada | Únicamente el proceso de analítica. Nunca llega al navegador. |
| Contraseña de la base | Gestor de contraseñas | Conexiones administrativas puntuales. |

El archivo de variables de entorno se excluye del control de versiones y se acompaña de un archivo de ejemplo que declara los nombres sin los valores. Si una clave de servicio llega a subirse al repositorio, rotarla es obligatorio: borrar el archivo no sirve, porque el historial de Git la conserva.

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
