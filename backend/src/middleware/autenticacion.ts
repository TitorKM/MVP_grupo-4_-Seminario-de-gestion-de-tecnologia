import type { RequestHandler } from 'express'
import {
  ErrorValidacionToken,
  type SesionValidada,
  type ValidarToken,
} from '../tipos/autenticacion.js'
import { medirEtapa } from '../diagnostico/rendimiento.js'

type DiagnosticoAutenticacion = {
  categoria: string
  nombre?: string
  codigo?: string
  estadoHttp?: number
}

function registrarDiagnostico(diagnostico: DiagnosticoAutenticacion): void {
  console.warn('Diagnostico de autenticacion:', diagnostico)
}

function diagnosticarFalloValidacion(error: unknown): DiagnosticoAutenticacion {
  if (!(error instanceof ErrorValidacionToken)) {
    return { categoria: 'fallo_validacion_desconocido' }
  }

  return {
    categoria: error.categoria,
    ...(error.nombreOriginal ? { nombre: error.nombreOriginal } : {}),
    ...(error.codigo ? { codigo: error.codigo } : {}),
    ...(error.estadoHttp !== undefined ? { estadoHttp: error.estadoHttp } : {}),
  }
}

function nombreOperacion(metodo: string, ruta: string): string {
  if (metodo === 'PATCH' && /\/despachos\/[^/]+\/fondos$/.test(ruta)) return 'actualizar_fondos'
  if (metodo === 'POST' && /\/despachos\/[^/]+\/anulacion$/.test(ruta)) return 'anular_despacho'
  if (metodo === 'GET' && /\/despachos\/[^/]+\/historial$/.test(ruta)) return 'consultar_historial'
  if (metodo === 'PATCH' && /\/despachos\/[^/]+$/.test(ruta)) return 'editar_despacho'
  if (metodo === 'GET' && /\/despachos\/[^/]+$/.test(ruta)) return 'consultar_despacho'
  if (metodo === 'GET' && ruta.endsWith('/despachos')) return 'listar_despachos'
  if (metodo === 'POST' && ruta.endsWith('/despachos')) return 'crear_despacho'
  if (metodo === 'GET' && ruta.endsWith('/importadores')) return 'listar_importadores'
  return 'autenticacion_perfil'
}

export function extraerTokenBearer(authorization: string | undefined): string | null {
  if (!authorization) {
    return null
  }

  const coincidencia = authorization.match(/^Bearer\s+([^\s]+)$/i)
  return coincidencia?.[1] ?? null
}

export function crearMiddlewareAutenticacion(validarToken: ValidarToken): RequestHandler {
  return async (request, response, next) => {
    const authorization = request.header('Authorization')

    if (!authorization) {
      registrarDiagnostico({ categoria: 'header_ausente' })
      response.status(401).json({ error: 'Se requiere una sesion valida.' })
      return
    }

    const token = extraerTokenBearer(authorization)

    if (!token) {
      registrarDiagnostico({ categoria: 'header_malformado' })
      response.status(401).json({ error: 'Se requiere una sesion valida.' })
      return
    }

    try {
      const usuarioId = await medirEtapa(
        nombreOperacion(request.method, request.path),
        'autenticacion',
        () => validarToken(token),
      )
      response.locals.sesion = { usuarioId, token } satisfies SesionValidada
      next()
    } catch (error) {
      registrarDiagnostico(diagnosticarFalloValidacion(error))
      response.status(401).json({ error: 'Se requiere una sesion valida.' })
    }
  }
}
