import 'dotenv/config'

function requerida(nombre: string): string {
  const valor = process.env[nombre]?.trim()

  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}.`)
  }

  return valor
}

function leerPuerto(): number {
  const valor = process.env.PORT?.trim() || '3000'
  const puerto = Number(valor)

  if (!Number.isInteger(puerto) || puerto <= 0 || puerto > 65535) {
    throw new Error('PORT debe ser un puerto valido.')
  }

  return puerto
}

export function cargarEntorno() {
  return {
    supabaseUrl: requerida('SUPABASE_URL'),
    supabasePublishableKey: requerida('SUPABASE_PUBLISHABLE_KEY'),
    puerto: leerPuerto(),
  }
}
