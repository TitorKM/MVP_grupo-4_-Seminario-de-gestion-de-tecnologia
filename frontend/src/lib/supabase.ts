import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cliente: SupabaseClient | null = null

export function obtenerClienteSupabase(): SupabaseClient {
  if (cliente) {
    return cliente
  }

  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const clavePublicable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !clavePublicable) {
    throw new Error('Falta configurar Supabase en frontend/.env.local.')
  }

  cliente = createClient(url, clavePublicable)
  return cliente
}
