# Desarrollo local y recorrido del login

## Configuración

### Backend

Copiar `backend/.env.example` como `backend/.env` y completar:

- `SUPABASE_URL`: URL pública del proyecto.
- `SUPABASE_PUBLISHABLE_KEY`: clave publicable del proyecto.
- `PORT`: puerto local; el valor esperado por Vite es `3000`.

La API no usa `service_role` en solicitudes normales. No agregar claves secretas al frontend ni a archivos versionados.

### Frontend

Copiar `frontend/.env.example` como `frontend/.env.local` y completar:

- `VITE_SUPABASE_URL`: URL pública del proyecto.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publicable.

Vite expone todas las variables con prefijo `VITE_` al navegador. No son aptas para secretos.

## Ejecución

Terminal del backend:

```bash
cd backend
npm ci
npm run dev
```

Terminal del frontend:

```bash
cd frontend
npm ci
npm run dev
```

La configuración de desarrollo de Vite redirige `/api` hacia `http://localhost:3000`, evitando configurar CORS para el entorno local.

## Recorrido del login

1. La persona escribe email y contraseña en el frontend.
2. El frontend ejecuta `supabase.auth.signInWithPassword`.
3. Supabase Auth devuelve una sesión con access token si las credenciales son válidas.
4. El frontend llama `GET /api/autenticacion/perfil` con `Authorization: Bearer <token>`.
5. El middleware de Express extrae el token y llama `getClaims(token)` para verificarlo.
6. La API crea un cliente Supabase asociado a ese mismo token y consulta `perfiles`, `empresas_despachantes` e `importadores`.
7. Las consultas usan el rol `authenticated` y respetan RLS. No se usa `service_role`.
8. La API devuelve el perfil en camelCase.
9. El frontend dirige a `/despachante` o `/importador` según el rol recibido.
10. Las rutas privadas vuelven al login cuando falta una sesión o un perfil autorizado.

El selector de rol anterior fue eliminado. Ni la ruta solicitada ni un valor enviado por el navegador conceden permisos.

## Rutas y respuestas relevantes

- `GET /api/salud`: `200` con `{ "estado": "ok" }`.
- `GET /api/importadores`: importadores activos disponibles para el despachante.
- `GET /api/despachos`: cartera visible por RLS para la sesión.
- `POST /api/despachos`: creación mediante `crear_despacho`; solo despachante.
- `PATCH /api/despachos/:id`: edición mediante `actualizar_despacho`; solo despachante.
- `POST /api/despachos/:id/anulacion`: anulación mediante `anular_despacho`; requiere motivo y confirmación.
- `PATCH /api/despachos/:id/fondos`: cambio mediante `actualizar_estado_fondos`; solo importador asignado.
- `GET /api/despachos/:id/historial`: auditoría; solo despachante autorizado.
- Token ausente o inválido: `401`.
- Perfil inexistente, inactivo o no visible por RLS: `403`.
- Versión obsoleta: `409`; la interfaz vuelve a consultar los datos.
- Error interno de consulta: `500` sin detalles de Supabase en la respuesta.

## Prueba manual con las cuentas existentes

1. Confirmar que las migraciones 001–004 estén aplicadas y que los usuarios tengan perfiles activos.
2. Iniciar frontend y backend.
3. Ingresar como despachante YAD, crear una operación para Importador A y anotar su referencia.
4. Cerrar sesión, ingresar como Importador A, comprobar que aparece y cambiar sus fondos.
5. Volver a YAD, presionar **Actualizar** y comprobar el estado y el historial con autor, fecha y valores.
6. Ingresar como Importador B y comprobar que la operación de A no aparece.
7. Ingresar como una cuenta LOGISTIC y comprobar que la operación YAD no aparece.
8. Recargar cada pantalla y confirmar que los datos permanecen.
9. Probar una contraseña incorrecta y comprobar que no se habilita ninguna pantalla privada.
10. Editar referencia, monto y fecha como YAD; comprobar el cambio como importador y en el historial.
11. Anular con motivo y confirmación; comprobar que ambos roles ven **Anulado** y el motivo, y que ya no se puede editar ni cambiar fondos.
12. Verificar que la campana solo incluye **Atención** y **Urgente** de toda la cartera activa. En el panel del despachante, combinar estado de fondos, nivel de urgencia y un rango de fechas límite: la tabla, el contador, los indicadores y el gráfico deben reflejar el mismo resultado. Los indicadores activos excluyen los anulados, aunque aparezcan como filas al filtrar por **Anulado**.
13. Sin sesión, abrir directamente `/despachante` o `/importador`: debe redirigir al login.
14. Con una sesión importadora abrir `/despachante`, y con una despachante abrir `/importador`: ninguna debe mostrar la vista del otro rol.
15. Cerrar sesión, recargar y usar Atrás: no deben reaparecer datos privados.

### Filtros del despachante (HU-03)

- **Estado de fondos** y **Nivel de urgencia** son criterios distintos y se combinan.
- **Desde** y **Hasta** usan la fecha límite del despacho, incluyen ambos días y permiten completar un solo extremo. Un rango invertido muestra un error y no presenta coincidencias.
- Al elegir **Próximos 15 días**, **Vencidos** o **Todas las fechas**, se limpian los límites anteriores. Completar una fecha activa **Rango personalizado**.
- **Limpiar filtros** restablece todos los criterios. Un resultado vacío muestra un mensaje y los indicadores en cero.
- Los filtros se conservan al presionar **Actualizar**, crear, editar o anular una operación; se aplican nuevamente a los datos recibidos. El orden sigue siendo por fecha límite ascendente.
- La campana mantiene los avisos generales de la cartera autorizada: filtrar la tabla no oculta sus alertas.
- Comprobar un rango que incluya vencimientos en ambos extremos, un resultado sin coincidencias y el botón **Limpiar filtros**. Comprobar también que el monto, el porcentaje y la distribución cambian junto con la tabla.

El filtrado se realiza sobre la cartera que la API ya autorizó y cargó en el navegador. No agrega permisos ni modifica datos. Para una cartera que requiera paginación, el filtrado y los totales deberán trasladarse al servidor en una historia posterior.

No registrar contraseñas, tokens ni capturas que expongan credenciales.

## Alcance pendiente

No hay WebSockets: los cambios de otra sesión aparecen al recargar o presionar **Actualizar**. Para despachos activos con fondos pendientes o no disponibles: más de tres días es **En seguimiento**, de uno a tres es **Atención**, y hoy o vencido es **Urgente**. Los fondos disponibles son **Fondos confirmados**. La campana incluye Atención y Urgente. Los anulados no integran alertas ni indicadores activos. Las alertas no se persisten ni se marcan como leídas. La creación de importadores y las notificaciones por mail o WhatsApp permanecen fuera de este alcance.
