import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Rol } from '../servicios/autenticacion'
import { useAutenticacion } from './AutenticacionContext'

export function RutaProtegida({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { sesion, perfil, cargando } = useAutenticacion()

  if (cargando && (!sesion || !perfil)) {
    return <main className="auth-state">Validando sesión...</main>
  }

  if (!sesion || !perfil) {
    return <Navigate to="/login" replace />
  }

  if (perfil.rol !== rol) {
    return <Navigate to={`/${perfil.rol}`} replace />
  }

  return children
}

export function RutaLogin({ children }: { children: ReactNode }) {
  const { sesion, perfil, cargando } = useAutenticacion()

  if (cargando && (!sesion || !perfil)) {
    return <main className="auth-state">Restaurando sesión...</main>
  }

  if (sesion && perfil) {
    return <Navigate to={`/${perfil.rol}`} replace />
  }

  return children
}
