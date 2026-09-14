# Riesgos técnicos

| Riesgo | Consecuencia | Mitigación |
| --- | --- | --- |
| El proyecto de Supabase se pausa por inactividad en el plan gratuito | El sistema deja de responder hasta que alguien lo reactiva a mano. | Vigilar el estado del proyecto y contemplar el plan de pago antes de la puesta en producción real. |
| No hay histórico suficiente para entrenar | Los modelos producen resultados sin valor o no pueden entrenarse. | Tratar la digitalización de los cuadernos como primera dependencia del proyecto, no como tarea administrativa. |
| Una credencial de servicio llega al repositorio público | Acceso total a los datos, saltándose todas las políticas de seguridad. | Archivo de entorno excluido del control de versiones y rotación inmediata ante cualquier exposición. |
| Cambios de esquema aplicados a mano | Los entornos divergen y el proyecto deja de poder levantarse desde cero. | Todo cambio pasa por un archivo SQL numerado y versionado. |
| Datos reales de clientes en el repositorio | Incumplimiento de la Ley N.° 29733. | Los datos de prueba usan placas inventadas; el histórico real se mantiene fuera del repositorio. |
| Dependencia de una sola persona que conoce el sistema | El proyecto se detiene si esa persona no está disponible. | Esta documentación, versionada junto al código y actualizada con cada cambio relevante. |

---

_Parte de la documentación técnica de LavaSmart. Si cambias el sistema, cambia también este archivo en el mismo commit._
