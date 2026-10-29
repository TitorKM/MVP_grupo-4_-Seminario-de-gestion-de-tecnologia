import {
  ErrorValidacionToken,
  type CategoriaFalloValidacion,
  type ValidarToken,
} from '../tipos/autenticacion.js'
import { crearClienteVerificacion } from '../supabase/clientes.js'

type ErrorGetClaims = {
  name?: unknown
  code?: unknown
  status?: unknown
}

function textoSeguro(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor ? valor : undefined
}

function estadoNumerico(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isInteger(valor) ? valor : undefined
}

function estadoHttpSeguro(valor: unknown): number | undefined {
  const estado = estadoNumerico(valor)
  return estado !== undefined && estado >= 100 && estado <= 599 ? estado : undefined
}

function obtenerCategoria(error: ErrorGetClaims): CategoriaFalloValidacion {
  const nombre = textoSeguro(error.name)
  const estado = estadoNumerico(error.status)

  if (nombre === 'AuthRetryableFetchError' && estado === 0) {
    return 'fallo_red'
  }

  if (
    nombre === 'AuthInvalidJwtError' ||
    estado === 400 ||
    estado === 401 ||
    estado === 403
  ) {
    return 'sesion_invalida'
  }

  return 'fallo_supabase'
}

export function convertirErrorGetClaims(error: unknown): ErrorValidacionToken {
  const detalle =
    typeof error === 'object' && error !== null ? (error as ErrorGetClaims) : {}

  return new ErrorValidacionToken(
    obtenerCategoria(detalle),
    textoSeguro(detalle.name),
    textoSeguro(detalle.code),
    estadoHttpSeguro(detalle.status),
  )
}

export function crearValidadorToken(
  supabaseUrl: string,
  clavePublicable: string,
): ValidarToken {
  const cliente = crearClienteVerificacion(supabaseUrl, clavePublicable)

  return async (token) => {
    let resultado

    try {
      resultado = await cliente.auth.getClaims(token)
    } catch (error) {
      throw convertirErrorGetClaims(error)
    }

    const { data, error } = resultado
    const usuarioId = data?.claims?.sub

    if (error) {
      throw convertirErrorGetClaims(error)
    }

    if (typeof usuarioId !== 'string' || !usuarioId) {
      throw new ErrorValidacionToken('fallo_supabase')
    }

    return usuarioId
  }
}
