# Modelo de datos del MVP

## Límite de pertenencia

`empresas_despachantes` es el límite de aislamiento del MVP. Cada perfil, importador, despacho, historial y notificación queda asociado a una empresa despachante.

No se asignan despachos a operadores individuales. La cuenta con rol `despachante` puede consultar y gestionar toda la cartera de su empresa.

Para esta versión se permite:

- Una cuenta despachante por empresa despachante.
- Una cuenta importadora por registro de importador.
- Un registro independiente si una misma empresa importadora trabaja con más de una empresa despachante.

## Tablas

### `empresas_despachantes`

Identifica a cada empresa que usa Anticipa, por ejemplo YAD o LOGISTIC.

### `perfiles`

Vincula `auth.users` con la empresa y el rol de negocio. Un perfil importador también referencia su registro en `importadores`.

Los usuarios autenticados no pueden insertar ni modificar perfiles. El rol, la empresa y el importador se administran mediante el procedimiento documentado en `cuentas_prueba.md` y, en el futuro, mediante una operación administrativa equivalente.

### `importadores`

Representa un importador dentro de la cartera de una empresa despachante. Incluye razón social y correo de contacto.

`crear_importador` crea este registro dentro de la empresa obtenida del perfil autenticado. No crea una cuenta en Supabase Auth.

### `despachos`

Almacena referencia, monto, fecha límite, estado de fondos y versión. La clave foránea compuesta `(importador_id, empresa_despachante_id)` impide asociar un importador de otra empresa.

La referencia es única dentro de cada empresa despachante.

El `importador_id` queda fijo al crear el despacho. `actualizar_despacho` no recibe ese campo y un trigger interno rechaza cualquier intento posterior de modificarlo, incluso por fuera de la función autorizada.

### `historial_despachos`

Registra la acción, la cuenta responsable, la versión resultante, el momento y los campos realmente modificados. No tiene permisos directos de escritura para usuarios autenticados.

### `notificaciones`

Persiste mensajes dirigidos a una cuenta. Las claves foráneas compuestas garantizan que destinatario, despacho y empresa sean consistentes.

## Estados de fondos

| Base de datos y API | Texto actual del frontend |
|---|---|
| `disponibles` | `disponibles` |
| `no_disponibles` | `no disponibles` |
| `pendiente_confirmacion` | `pendiente de confirmar` |

El frontend muestra los textos de la segunda columna y envía a la API exclusivamente los valores internos de la primera.

## Valores derivados

No se almacenan:

- Días restantes: se calculan a partir de `fecha_limite`.
- Urgencia: se deriva en la interfaz.

El frontend asocia `disponibles` con `ok`, `pendiente_confirmacion` con `atencion` y `no_disponibles` con `urgente`. No se agregó ninguna regla nueva basada en fechas.

Los días restantes se calculan comparando `fecha_limite` con la fecha de calendario local, usando componentes de año, mes y día. No se convierte el valor SQL `date` a UTC. Si el vencimiento pasó, la interfaz muestra `Vencido hace N días`; para el día actual muestra `Vence hoy`.

## Escrituras autorizadas

- `crear_importador`: solo cuenta despachante activa; toma la empresa del perfil.
- `crear_despacho`: solo cuenta despachante activa; valida que el importador pertenezca a su empresa.
- `actualizar_despacho`: solo cuenta despachante de la empresa; edita referencia, monto y fecha límite, y usa versión esperada.
- `actualizar_estado_fondos`: solo cuenta importadora vinculada al despacho; modifica únicamente los fondos.
- `marcar_notificacion_leida`: solo el destinatario.

Las cinco funciones públicas de negocio son `SECURITY DEFINER`, fijan `search_path = ''`, usan nombres calificados, obtienen el autor mediante `auth.uid()` y vuelven a validar perfil, empresa y permisos. Su permiso `EXECUTE` se concede exclusivamente a `authenticated`.

## Atomicidad y concurrencia

Las modificaciones de un despacho y la inserción de su historial ocurren dentro de la misma función PostgreSQL y, por lo tanto, dentro de la misma transacción.

Cada actualización recibe `p_version_esperada`, bloquea la fila con `SELECT ... FOR UPDATE` y compara la versión. Una versión obsoleta genera `PT409`, que PostgREST y la API exponen como HTTP `409 Conflict`. Un despacho ya anulado genera `PT410` en los flujos normalizados.

Si no cambia ningún campo, la función devuelve el despacho sin incrementar la versión ni insertar historial.

## Desactivación

- Una empresa con `activa = false` deja sin acceso privado y sin funciones de escritura a todas sus cuentas.
- Una cuenta importadora necesita perfil activo, empresa activa e importador activo.
- Un importador con `activo = false` no puede consultar datos privados ni modificar fondos.
- El despachante de una empresa activa conserva acceso a los importadores inactivos, sus despachos y su historial.
- Desactivar un importador no elimina ni modifica sus operaciones históricas.

## RLS

Las políticas no forman ciclos:

- La función interna `private.perfil_sesion_activa()` obtiene el perfil mediante `auth.uid()` y comprueba perfil, empresa e importador activos sin quedar sujeta a RLS.
- Las políticas consumen únicamente el resultado de esa función interna.
- Ninguna política consulta otra tabla protegida por RLS.
- El historial usa directamente `empresa_despachante_id` para autorizar al despachante.

`anon` no recibe permisos sobre las tablas. `authenticated` recibe solo lectura directa; todas las escrituras funcionales pasan por las funciones autorizadas.
