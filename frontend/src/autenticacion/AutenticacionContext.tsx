import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { obtenerClienteSupabase } from '../lib/supabase'
import {
  consultarPerfil,
  ErrorConsultaPerfil,
  type PerfilAutenticado,
} from '../servicios/autenticacion'
import { accionParaEvento } from './eventosAutenticacion'

type EstadoAutenticacion = {
  sesion: Session | null
  perfil: PerfilAutenticado | null
  cargando: boolean
  error: string | null
}

type AutenticacionContextType = EstadoAutenticacion & {
  iniciarSesion: (email: string, contrasena: string) => Promise<PerfilAutenticado>
  cerrarSesion: () => Promise<void>
}

const AutenticacionContext = createContext<AutenticacionContextType | null>(null)

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la autenticación.'
}

function invalidaIdentidad(error: unknown): boolean {
  return error instanceof ErrorConsultaPerfil &&
    (error.estadoHttp === 401 || error.estadoHttp === 403)
}

export function ProveedorAutenticacion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAutenticacion>({
    sesion: null,
    perfil: null,
    cargando: true,
    error: null,
  })
  const estadoActual = useRef(estado)
  const validacionEnCurso = useRef<{
    usuarioId: string
    promesa: Promise<PerfilAutenticado>
  } | null>(null)
  const inicioSesionEnCurso = useRef(false)

  function actualizarEstado(
    cambio: EstadoAutenticacion | ((actual: EstadoAutenticacion) => EstadoAutenticacion),
  ) {
    setEstado((actual) => {
      const siguiente = typeof cambio === 'function' ? cambio(actual) : cambio
      estadoActual.current = siguiente
      return siguiente
    })
  }

  function validarPerfilUnaVez(sesion: Session): Promise<PerfilAutenticado> {
    const usuarioId = sesion.user.id
    const enCurso = validacionEnCurso.current
    if (enCurso?.usuarioId === usuarioId) return enCurso.promesa

    const promesa = consultarPerfil(sesion.access_token).finally(() => {
      if (validacionEnCurso.current?.promesa === promesa) {
        validacionEnCurso.current = null
      }
    })
    validacionEnCurso.current = { usuarioId, promesa }
    return promesa
  }

  useEffect(() => {
    let activo = true
    let supabase

    try {
      supabase = obtenerClienteSupabase()
    } catch (error) {
      actualizarEstado({ sesion: null, perfil: null, cargando: false, error: mensajeError(error) })
      return
    }

    async function procesarEvento(evento: AuthChangeEvent, sesion: Session | null) {
      if (!activo) return

      const actual = estadoActual.current
      const accion = accionParaEvento(
        evento,
        sesion?.user.id ?? null,
        actual.sesion?.user.id ?? null,
        Boolean(actual.perfil),
      )

      if (accion === 'cerrar_sesion' || !sesion) {
        actualizarEstado({ sesion: null, perfil: null, cargando: false, error: null })
        return
      }

      if (evento === 'SIGNED_IN' && inicioSesionEnCurso.current) {
        actualizarEstado((vigente) => ({ ...vigente, sesion }))
        return
      }

      if (accion === 'actualizar_sesion') {
        actualizarEstado((vigente) => ({ ...vigente, sesion, cargando: false }))
        return
      }

      const esRevalidacion = Boolean(
        actual.perfil && actual.sesion?.user.id === sesion.user.id,
      )
      if (!esRevalidacion) {
        actualizarEstado((vigente) => ({ ...vigente, sesion, cargando: true, error: null }))
      }

      try {
        const perfil = await validarPerfilUnaVez(sesion)
        if (activo) actualizarEstado({ sesion, perfil, cargando: false, error: null })
      } catch (error) {
        if (!activo) return
        if (esRevalidacion && !invalidaIdentidad(error)) {
          actualizarEstado((vigente) => ({
            ...vigente,
            sesion,
            cargando: false,
            error: mensajeError(error),
          }))
          return
        }
        actualizarEstado({
          sesion: invalidaIdentidad(error) ? null : sesion,
          perfil: null,
          cargando: false,
          error: mensajeError(error),
        })
      }
    }

    // INITIAL_SESSION restaura la sesión; no se combina con getSession para evitar
    // validar dos veces el mismo perfil al montar el proveedor.
    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento, sesion) => {
      void procesarEvento(evento, sesion)
    })

    return () => {
      activo = false
      suscripcion.subscription.unsubscribe()
    }
  }, [])

  async function iniciarSesion(email: string, contrasena: string) {
    const supabase = obtenerClienteSupabase()
    inicioSesionEnCurso.current = true
    actualizarEstado((actual) => ({ ...actual, cargando: true, error: null }))

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: contrasena,
    })

    if (error || !data.session) {
      inicioSesionEnCurso.current = false
      const mensaje = error?.message || 'No se pudo iniciar sesión.'
      actualizarEstado({ sesion: null, perfil: null, cargando: false, error: mensaje })
      throw new Error(mensaje)
    }

    try {
      const perfil = await validarPerfilUnaVez(data.session)
      inicioSesionEnCurso.current = false
      actualizarEstado({ sesion: data.session, perfil, cargando: false, error: null })
      return perfil
    } catch (errorPerfil) {
      inicioSesionEnCurso.current = false
      if (invalidaIdentidad(errorPerfil)) await supabase.auth.signOut()
      const mensaje = mensajeError(errorPerfil)
      actualizarEstado({
        sesion: invalidaIdentidad(errorPerfil) ? null : data.session,
        perfil: null,
        cargando: false,
        error: mensaje,
      })
      throw new Error(mensaje)
    }
  }

  async function cerrarSesion() {
    const supabase = obtenerClienteSupabase()
    await supabase.auth.signOut()
    actualizarEstado({ sesion: null, perfil: null, cargando: false, error: null })
  }

  const valor = useMemo(
    () => ({ ...estado, iniciarSesion, cerrarSesion }),
    [estado],
  )

  return <AutenticacionContext.Provider value={valor}>{children}</AutenticacionContext.Provider>
}

export function useAutenticacion() {
  const contexto = useContext(AutenticacionContext)
  if (!contexto) throw new Error('useAutenticacion debe usarse dentro de ProveedorAutenticacion.')
  return contexto
}
