# Anticipa

Anticipa es una aplicación para coordinar despachos, fondos y vencimientos entre despachantes e importadores. El despachante administra las operaciones de su empresa y el importador consulta sus despachos y actualiza el estado de los fondos.

## Tecnologías principales

- Frontend: React, TypeScript y Vite.
- Backend: Node.js, TypeScript y Express.
- Autenticación y datos: Supabase Auth y PostgreSQL.

## Estructura

- `frontend/`: aplicación web.
- `backend/`: API y archivos de base de datos.
- `backend/docs/`: documentación técnica y guías del proyecto.

## Requisitos

- Node.js `20.19` o superior compatible.
- npm.
- Acceso a una cuenta de prueba, solicitada al equipo.

## Configuración inicial

Desde la raíz del repositorio, copiá los archivos de ejemplo:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Los ejemplos ya incluyen la configuración pública del proyecto Supabase compartido. Las cuentas de prueba deben solicitarse al equipo.

Instalá las dependencias:

```powershell
cd backend
npm ci

cd ../frontend
npm ci
```

## Ejecutar localmente

En una terminal, iniciá el backend:

```powershell
cd backend
npm run dev
```

La API queda disponible en `http://localhost:3000`.

En otra terminal, iniciá el frontend:

```powershell
cd frontend
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

## Pruebas y build

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
```

## Documentación técnica

Consultá [backend/docs/desarrollo_local.md](backend/docs/desarrollo_local.md) para conocer el recorrido de autenticación, las rutas de la API y las pruebas manuales. Los detalles de base de datos y migraciones están en `backend/docs/`.
