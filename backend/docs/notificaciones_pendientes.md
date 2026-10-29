# Notificaciones persistidas pendientes

La campana actual no usa esta tabla: calcula avisos vigentes a partir de los despachos que la sesión ya puede consultar por RLS. Un aviso aparece cuando faltan tres días o menos —incluidos vencidos— y los fondos están `pendiente_confirmacion` o `no_disponibles`. Desaparece al actualizar cuando los fondos pasan a `disponibles`.

La tabla `notificaciones` queda reservada para una historia futura que necesite persistir mensajes, lecturas o descartes. Las notificaciones por mail o WhatsApp también están fuera del alcance actual.

Antes de agregar triggers, tareas programadas o lógica de Express se debe acordar:

- Qué eventos generan una notificación.
- Quién es el destinatario de cada evento.
- Cuándo una notificación se considera duplicada.
- Si existen vencimientos o recordatorios programados.
- Qué tipos de notificación son válidos.
- Si una notificación puede archivarse o eliminarse.

Hasta contar con estas reglas:

- No se crea ningún trigger de generación.
- No se concede inserción directa a usuarios autenticados.
- `tipo` permanece como texto no vacío, sin inventar un catálogo prematuro.
- Cada usuario solo puede consultar y marcar como leídas sus propias notificaciones.
