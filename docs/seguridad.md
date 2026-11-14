# Seguridad

## Autenticación

La autenticación la gestiona Supabase. El sistema no almacena contraseñas ni implementa su propio inicio de sesión, lo que elimina de raíz toda una categoría de errores. Cada usuario autenticado tiene una fila en la tabla de perfiles que lo asocia con su rol dentro del negocio y, opcionalmente, con su ficha de personal.

El ingreso es con correo y contraseña. El registro público está desactivado en Supabase: las cuentas las crea el dueño, porque los lavadores no usan el sistema y nadie de fuera tiene por qué tener una. La sesión viaja en cookies, y antes de cada página la aplicación verifica el token y lo renueva si venció; quien no tiene sesión termina en la pantalla de ingreso. Si el ingreso falla, el mensaje no distingue entre un correo inexistente y una contraseña equivocada, para no confirmarle a un extraño qué correos tienen cuenta.

El primer perfil de dueño no lo puede crear la aplicación: según las políticas, solo un dueño administra perfiles, y al principio no existe ninguno. Ese único perfil se inserta una vez desde el editor SQL de Supabase. No va en un archivo de sql/ porque es un dato de una persona y no un cambio de esquema, y el repositorio es público.

## Autorización por fila

Las quince tablas tienen activada la seguridad a nivel de fila antes de que se inserte el primer dato. El estado por defecto es el más restrictivo: sin una política que lo autorice explícitamente, ninguna consulta devuelve nada.

Dos funciones auxiliares resuelven la identidad de quien consulta: una comprueba que el usuario tenga perfil en el negocio y la otra que además sea el dueño. Ambas se declaran de modo que una tabla suplantadora no pueda alterar su resultado, y solo puede ejecutarlas un usuario autenticado: el rol anónimo no tiene permiso sobre ellas.

Las dos vistas se ejecutan con los permisos de quien consulta y no con los de su creador, así que también pasan por las políticas de las tablas que suman. Las funciones de los disparadores tienen la ruta de búsqueda fija por la misma razón que las auxiliares.

| Conjunto de tablas | Operador | Dueño |
| --- | --- | --- |
| Catálogos, tarifas, configuración, personal | Solo lectura | Lectura y escritura |
| Clientes, lavados, detalle, incidencias, asistencia | Leer, crear y editar | Leer, crear y editar |
| Perfiles | Solo el propio | Todos, y es el único que los administra |
| Liquidaciones | Sin acceso | Lectura y escritura |
| Salidas de los modelos: demanda y métricas | Solo lectura | Solo lectura |
| Salidas de los modelos: segmentación de clientes (contiene placas) | Sin acceso | Solo lectura |

Las pantallas que son solo del dueño tienen además una guardia en el servidor: si otro rol abre su dirección escribiéndola a mano, la aplicación lo devuelve al inicio. La misma guardia protege las acciones que esas pantallas ejecutan, porque una acción del servidor se puede invocar sin pasar por la pantalla. La guardia es una comodidad, no la defensa: aunque faltara, las políticas de la base rechazarían la escritura.

Hay una decisión del dueño que vive en una tabla que el operador sí puede editar: la asistencia, donde el dueño pone el descuento o el día no laborado de un trabajador de sueldo fijo. Ahí las políticas por tabla no alcanzan, porque permiten editar la fila entera. Un disparador revisa la columna que cambia: si es el descuento o el no laborado, exige que quien escribe sea el dueño, y anota quién lo decidió.

Nadie borra desde la aplicación: a los usuarios autenticados y anónimos se les quitó el permiso de borrar (y el de vaciar tablas) en todas las tablas, de modo que ninguna política puede concederlo aunque diga «para todo». Así estaba descrito desde el principio, pero las políticas del dueño de la forma «para todo» incluían el borrado; lo detectaron las pruebas de sql/pruebas/reglas.sql y lo cerró 17_huecos_de_las_pruebas.sql.

Un disparador corre con los permisos de quien escribe, y por tanto solo ve lo que las políticas le dejan ver a ese usuario. Cuando una regla necesita leer una tabla que el usuario no ve, el disparador corre con los permisos de su dueño (SECURITY DEFINER), como el que impide asignar autos a un lavador con el día cerrado: lee la liquidación para decidir sin mostrársela al operador.

Las tablas de salida son de solo lectura incluso para el dueño: quien escribe en ellas es el proceso de analítica, que se conecta con la clave de servicio y por tanto no pasa por estas políticas.

## Datos personales

El sistema identifica a los clientes por la placa del vehículo. Eso reduce la cantidad de datos personales almacenados, pero no los elimina: la placa permite llegar al titular a través del registro vehicular, de modo que es una seudonimización y no una anonimización. El tratamiento queda sujeto a la Ley N.° 29733 de Protección de Datos Personales.

En la práctica esto significa tres cosas. Que el nombre y el teléfono del cliente son opcionales y solo se registran si los entrega voluntariamente; la pantalla de ingreso dice para qué se pide el celular (avisarle que su auto está listo o de un inconveniente), y usarlo para promociones exigiría un consentimiento aparte. El autocompletado sale solo de lo que el propio lavadero guardó: se evaluó consultar el registro vehicular con la placa para obtener el nombre del titular y se descartó, porque identificaría a una persona sin su consentimiento, el titular no siempre es quien trae el auto y dependería de servicios de terceros. Que el acceso a la información está limitado por rol dentro de la propia base de datos. Y que ningún registro real de clientes puede salir del entorno controlado, lo que incluye de forma muy especial el repositorio de código.

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
