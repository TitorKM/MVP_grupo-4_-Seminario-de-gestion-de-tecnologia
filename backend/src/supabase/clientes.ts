import { createClient } from '@supabase/supabase-js'

const opcionesServidor = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
}

export function crearClienteVerificacion(url: string, clavePublicable: string) {
  return createClient(url, clavePublicable, opcionesServidor)
}

export function crearClienteUsuario(
  url: string,
  clavePublicable: string,
  token: string,
) {
  return createClient(url, clavePublicable, {
    ...opcionesServidor,
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}
