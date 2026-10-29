# Ejecución en Supabase

## Advertencias

- Revisar los scripts antes de ejecutarlos.
- Aplicarlos primero en un proyecto Supabase de prueba.
- No pegar contraseñas, claves publicables ni claves secretas en archivos versionados.
- No ejecutar las pruebas de `db/tests` en producción.

## Migraciones

Desde el SQL Editor de Supabase, ejecutar cada archivo completo y esperar que finalice correctamente antes de continuar:

1. `backend/db/migrations/001_crear_modelo_inicial.sql`
2. `backend/db/migrations/002_configurar_permisos_y_rls.sql`
3. `backend/db/migrations/003_crear_funciones_transaccionales.sql`
4. `backend/db/migrations/004_consultar_historial_despacho.sql`
5. `backend/db/migrations/005_anular_despachos.sql`
6. `backend/db/migrations/006_normalizar_conflicto_version_despacho.sql`
7. `backend/db/migrations/007_normalizar_conflictos_fondos_y_anulacion.sql`

Cada migración incluye `begin` y `commit`. Si una sentencia falla, no continuar con la siguiente hasta revisar el error y confirmar el estado de la transacción.

La segunda migración revoca privilegios automáticos futuros en el esquema `public`. Por ese motivo, toda tabla, secuencia o función agregada posteriormente deberá recibir grants explícitos en su propia migración.

La migración 004 incorpora `consultar_historial_despacho`. La función verifica que la sesión corresponda al despachante activo de la misma empresa y devuelve el historial con el nombre visible del autor. Es necesaria porque la política de `perfiles` permite leer solo el perfil propio y no corresponde ampliar esa política para toda la empresa.

La migración 005 agrega los datos de anulación al despacho, admite la acción `anulado` en el historial y crea `anular_despacho`. Un trigger impide cualquier actualización posterior; la función bloquea la fila y valida la versión para resolver carreras con ediciones o cambios de fondos.

La migración 006 conserva `actualizar_despacho` y su control de versión, pero representa la versión obsoleta con `PT409`. PostgREST responde así con HTTP 409 sin tratar el conflicto de negocio como un fallo de serialización reintentable. Debe aplicarse después de la 005 y no modifica registros existentes.

La migración 007 aplica el mismo criterio a `actualizar_estado_fondos` y `anular_despacho`. Usa `PT409` para versión obsoleta y `PT410` cuando el despacho ya fue anulado. No modifica datos existentes.

## Preparación de las pruebas

1. Crear las cinco cuentas Auth descritas en `cuentas_prueba.md`.
2. No crear manualmente perfiles para esas cuentas: los tests requieren cuentas Auth sin perfiles previos. Cada prueba prepara sus propios datos y termina con `rollback`.
3. Ejecutar, por separado y en este orden:
   - `backend/db/tests/001_permisos_y_separacion.sql`
   - `backend/db/tests/002_concurrencia_despachos.sql`
   - `backend/db/tests/003_atomicidad_historial.sql`
   - `backend/db/tests/004_anulacion_despachos.sql` (después de aplicar la migración 005)
4. Confirmar que cada script finaliza sin una excepción no controlada.

Las pruebas simulan sesiones mediante el rol PostgreSQL `authenticated` y el claim `request.jwt.claim.sub`. Deben ejecutarse desde el SQL Editor con una cuenta de proyecto autorizada.

## Qué comprueba cada prueba

- `001_permisos_y_separacion.sql`: grants, RLS, dos importadores aislados dentro de YAD, separación YAD/LOGISTIC, desactivación, fondos, autoría del historial, importador fijo y rechazo de autoasignación de rol.
- `002_concurrencia_despachos.sql`: una actualización con versión obsoleta falla y no genera un historial adicional. Usa llamadas consecutivas; no prueba simultaneidad real entre transacciones.
- `003_atomicidad_historial.sql`: si falla la inserción del historial, también se revierte el cambio del despacho.
- `004_anulacion_despachos.sql`: motivo obligatorio, permisos, versión obsoleta, historial y rechazo de edición o fondos sobre anulados. Termina con `rollback`.
