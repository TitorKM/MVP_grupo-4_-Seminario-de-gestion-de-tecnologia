# Contrato de autenticación para HU-09

## Token enviado a la API

El frontend enviará el access token emitido por Supabase Auth:

```http
Authorization: Bearer <access_token>
```

La API debe rechazar tokens ausentes, vencidos o inválidos. La validación se realizará con `getClaims` o el mecanismo oficial equivalente de Supabase; no se implementará validación criptográfica propia.

## Fuente de identidad y autorización

La API no aceptará como fuente de autorización valores enviados por el cliente como:

- `usuarioId`
- `rol`
- `empresaDespachanteId`
- `importadorId`
- `creadoPor`
- `actualizadoPor`

La identidad proviene del token validado. El rol, la empresa y el importador provienen de `perfiles`.

El selector de rol que actualmente existe en el frontend es demostrativo y no concede permisos.

## Respuesta mínima de perfil

Ruta prevista:

```http
GET /api/autenticacion/perfil
```

Cuenta despachante:

```json
{
  "usuarioId": "uuid",
  "nombreVisible": "Cuenta YAD",
  "rol": "despachante",
  "empresaDespachante": {
    "id": "uuid",
    "razonSocial": "YAD"
  },
  "importador": null
}
```

Cuenta importadora:

```json
{
  "usuarioId": "uuid",
  "nombreVisible": "Importador YAD",
  "rol": "importador",
  "empresaDespachante": {
    "id": "uuid",
    "razonSocial": "YAD"
  },
  "importador": {
    "id": "uuid",
    "razonSocial": "Importador YAD"
  }
}
```

## Errores mínimos

- `401 Unauthorized`: falta el token o no es válido.
- `403 Forbidden`: el token es válido, pero no existe un perfil activo y autorizado.
- `409 Conflict`: la versión enviada para modificar un despacho quedó obsoleta.

Una operación de otra empresa puede responder `404 Not Found` para no confirmar la existencia del recurso.

## Actualización de un despacho

El contrato de actualización acepta solamente:

```json
{
  "versionEsperada": 3,
  "referencia": "YAD-001",
  "monto": "2480000.00",
  "fechaLimite": "2026-11-10"
}
```

`importadorId` no forma parte de esta operación. El importador queda fijado al crear el despacho y cualquier intento de modificarlo directamente es rechazado también por PostgreSQL.

## Conexión de Express con Supabase

Para solicitudes normales, Express utilizará la URL del proyecto, una clave publicable y el token del usuario en `Authorization`. De esta manera, las lecturas se ejecutan como `authenticated` y quedan sujetas a RLS.

La API no utilizará `service_role` para solicitudes normales. Esa credencial evita RLS y solo corresponde a tareas administrativas explícitas, ejecutadas mediante un cliente separado y nunca expuesto al frontend.

## División de validaciones

Express validará forma y transporte:

- Header `Authorization`.
- Token.
- JSON bien formado.
- UUID, fecha, monto, estado y versión con tipos válidos.
- Conversión entre snake_case SQL y camelCase JSON.
- Conversión de errores SQL a HTTP.

PostgreSQL aplicará las reglas autoritativas:

- Perfil activo.
- Empresa despachante activa.
- Importador activo para cuentas con rol `importador`.
- Rol.
- Empresa de la sesión.
- Pertenencia del importador y despacho.
- Campos modificables por cada rol.
- Versión esperada.
- Escritura atómica del historial.
- RLS y restricciones de integridad.

Una cuenta vinculada a una empresa inactiva no obtiene datos privados. Una cuenta importadora vinculada a un importador inactivo tampoco obtiene datos privados, aunque su token continúe siendo válido.
