# Procedimiento administrativo para cuentas de prueba

Este procedimiento es manual para el MVP. No representa registro público ni invitaciones automáticas.

## 1. Crear las cuentas Auth

En el panel de Supabase, crear cinco usuarios de prueba desde la administración de Authentication:

- `despachante.yad@anticipa.test`
- `importador.a.yad@anticipa.test`
- `importador.b.yad@anticipa.test`
- `despachante.logistic@anticipa.test`
- `importador.logistic@anticipa.test`

Usar credenciales de prueba gestionadas fuera del repositorio. No documentar ni compartir contraseñas o claves privadas en código, SQL, commits o chat.

Crear una cuenta Auth no crea automáticamente un perfil ni le asigna permisos de negocio.

Los scripts SQL incluidos requieren que estas cuentas no tengan filas previas en `perfiles`. Si alguna ya está vinculada, el script se detiene antes de preparar datos. Usar cuentas dedicadas exclusivamente a las pruebas.

## 2. Vincular cuentas en el MVP

En un entorno real, una operación administrativa deberá:

1. Crear `empresas_despachantes` para YAD y LOGISTIC.
2. Crear dos registros `importadores` dentro de YAD y uno dentro de LOGISTIC.
3. Obtener los UUID de `auth.users` desde la administración de Supabase.
4. Insertar un perfil `despachante` por empresa, con `importador_id = null`.
5. Insertar un perfil `importador` por registro de importador, con la misma `empresa_despachante_id`.
6. Verificar que las cuentas puedan consultar únicamente su empresa.

Las claves foráneas compuestas impedirán vincular un perfil importador con una empresa distinta a la de su registro.

## 3. Alta futura desde el flujo de despachos

El despachante podrá:

- Seleccionar un importador existente de su cartera.
- Ejecutar `crear_importador` indicando razón social y correo de contacto.

`crear_importador` toma la empresa desde `auth.uid()` y el perfil activo. No recibe una empresa desde el cliente y no crea una cuenta Auth.

La creación y vinculación posterior de una cuenta para ese importador continuará siendo administrativa hasta que se defina otro alcance.

## 4. Pruebas SQL incluidas

Los scripts de `backend/db/tests` localizan estas cinco cuentas por correo, comprueban que no tengan perfiles, crean datos temporales dentro de una transacción y terminan con `rollback`. No conservan empresas, perfiles, importadores ni despachos de prueba.
