# Backend de Anticipa

El backend de Anticipa utiliza Node.js, TypeScript, Express y PostgreSQL alojado en Supabase.

La API expone salud, perfil autenticado, importadores, despachos, edición, anulación, actualización de fondos e historial. Las lecturas respetan RLS y las escrituras usan las funciones transaccionales de PostgreSQL.

## Contenido

- `db/migrations/`: esquema, Row Level Security y funciones transaccionales.
- `db/tests/`: pruebas SQL manuales para un proyecto Supabase de prueba.
- `src/`: API Express, middleware de autenticación y acceso a perfiles y despachos.
- `tests/`: pruebas HTTP automatizadas con dependencias controladas.
- `docs/modelo_de_datos.md`: modelo, reglas e índices.
- `docs/contrato_autenticacion.md`: contrato que deberá respetar HU-09.
- `docs/ejecucion_supabase.md`: orden para aplicar migraciones y pruebas.
- `docs/cuentas_prueba.md`: procedimiento administrativo para vincular cuentas.
- `docs/notificaciones_pendientes.md`: decisiones de negocio aún no definidas.
- `docs/desarrollo_local.md`: configuración, ejecución y recorrido del login.

Las migraciones no deben ejecutarse automáticamente en producción. Primero deben revisarse y probarse en un proyecto Supabase separado.

Las migraciones pendientes deben aplicarse en el orden documentado en `docs/ejecucion_supabase.md`. La 007 normaliza los conflictos de fondos y anulación sin modificar datos existentes.
