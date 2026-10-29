import { Router, type Response } from 'express'
import { crearMiddlewareAutenticacion } from '../middleware/autenticacion.js'
import type {
  ObtenerPerfil,
  PerfilAutenticado,
  Rol,
  SesionValidada,
  ValidarToken,
} from '../tipos/autenticacion.js'
import {
  ErrorOperacion,
  type EstadoFondos,
  type ServicioDespachos,
} from '../tipos/despachos.js'
import { medirEtapa } from '../diagnostico/rendimiento.js'

type Dependencias = {
  validarToken: ValidarToken
  obtenerPerfil: ObtenerPerfil
  despachos: ServicioDespachos
}

const estadosFondos = new Set<EstadoFondos>([
  'disponibles',
  'no_disponibles',
  'pendiente_confirmacion',
])

function sesion(response: Response): SesionValidada {
  return response.locals.sesion as SesionValidada
}

async function obtenerPerfilAutorizado(
  response: Response,
  obtenerPerfil: ObtenerPerfil,
  operacion: string,
  rol?: Rol,
): Promise<PerfilAutenticado> {
  const actual = sesion(response)
  const perfil = await medirEtapa(operacion, 'perfil_permisos', () =>
    obtenerPerfil(actual.usuarioId, actual.token),
  )

  if (!perfil || (rol && perfil.rol !== rol)) {
    throw new ErrorOperacion(403, 'No tenés permiso para realizar esta operación.')
  }

  return perfil
}

function uuidValido(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
  )
}

function fechaValida(valor: unknown): valor is string {
  if (typeof valor !== 'string') {
    return false
  }

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (!partes) {
    return false
  }

  const anio = Number(partes[1])
  const mes = Number(partes[2])
  const dia = Number(partes[3])
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  )
}

function manejarError(response: Response, error: unknown): void {
  if (error instanceof ErrorOperacion) {
    if (error.estadoHttp >= 500) {
      console.error('Fallo en operaciones de despachos.', {
        categoria: 'datos',
        ...(error.codigoTecnico ? { codigo: error.codigoTecnico } : {}),
      })
    }

    response.status(error.estadoHttp).json({ error: error.message })
    return
  }

  console.error('Fallo inesperado en operaciones de despachos.', {
    categoria: 'desconocido',
  })
  response.status(500).json({ error: 'No se pudo completar la solicitud.' })
}

export function crearRutaDespachos(dependencias: Dependencias) {
  const ruta = Router()
  const autenticar = crearMiddlewareAutenticacion(dependencias.validarToken)

  ruta.use(autenticar)

  ruta.get('/importadores', async (_request, response) => {
    try {
      await obtenerPerfilAutorizado(response, dependencias.obtenerPerfil, 'listar_importadores', 'despachante')
      const datos = await medirEtapa('listar_importadores', 'supabase', () =>
        dependencias.despachos.listarImportadores(sesion(response).token),
      )
      response.json(datos)
    } catch (error) {
      manejarError(response, error)
    }
  })

  ruta.get('/despachos', async (_request, response) => {
    try {
      await obtenerPerfilAutorizado(response, dependencias.obtenerPerfil, 'listar_despachos')
      const datos = await medirEtapa('listar_despachos', 'supabase', () =>
        dependencias.despachos.listarDespachos(sesion(response).token),
      )
      response.json(datos)
    } catch (error) {
      manejarError(response, error)
    }
  })

  ruta.get('/despachos/:despachoId', async (request, response) => {
    try {
      await obtenerPerfilAutorizado(response, dependencias.obtenerPerfil, 'consultar_despacho')
      const { despachoId } = request.params

      if (!uuidValido(despachoId)) {
        throw new ErrorOperacion(400, 'El despacho solicitado no es válido.')
      }

      const datos = await medirEtapa('consultar_despacho', 'supabase', () =>
        dependencias.despachos.obtenerDespacho(sesion(response).token, despachoId),
      )
      response.json(datos)
    } catch (error) {
      manejarError(response, error)
    }
  })

  ruta.post('/despachos', async (request, response) => {
    try {
      await obtenerPerfilAutorizado(response, dependencias.obtenerPerfil, 'crear_despacho', 'despachante')
      const { referencia, importadorId, monto, fechaLimite } = request.body ?? {}

      if (
        typeof referencia !== 'string' ||
        !referencia.trim() ||
        !uuidValido(importadorId) ||
        typeof monto !== 'number' ||
        !Number.isFinite(monto) ||
        monto <= 0 ||
        !fechaValida(fechaLimite)
      ) {
        throw new ErrorOperacion(400, 'Completá referencia, importador, monto y fecha límite.')
      }

      const datos = await medirEtapa('crear_despacho', 'supabase', () =>
        dependencias.despachos.crearDespacho(sesion(response).token, {
          referencia: referencia.trim(), importadorId, monto, fechaLimite,
        }),
      )
      response.status(201).json(datos)
    } catch (error) {
      manejarError(response, error)
    }
  })

  ruta.patch('/despachos/:despachoId/fondos', async (request, response) => {
    try {
      await obtenerPerfilAutorizado(response, dependencias.obtenerPerfil, 'actualizar_fondos', 'importador')
      const { despachoId } = request.params
      const { versionEsperada, estadoFondos } = request.body ?? {}

      if (
        !uuidValido(despachoId) ||
        !Number.isInteger(versionEsperada) ||
        versionEsperada <= 0 ||
        typeof estadoFondos !== 'string' ||
        !estadosFondos.has(estadoFondos as EstadoFondos)
      ) {
        throw new ErrorOperacion(400, 'El estado de fondos o la versión no son válidos.')
      }

      const datos = await medirEtapa('actualizar_fondos', 'supabase', () =>
        dependencias.despachos.actualizarFondos(
          sesion(response).token,
          despachoId,
          { versionEsperada, estadoFondos: estadoFondos as EstadoFondos },
        ),
      )
      response.json(datos)
    } catch (error) {
      manejarError(response, error)
    }
  })

  ruta.patch('/despachos/:despachoId', async (request, response) => {
    try {
      await obtenerPerfilAutorizado(response, dependencias.obtenerPerfil, 'editar_despacho', 'despachante')
      const { despachoId } = request.params
      const { versionEsperada, referencia, monto, fechaLimite } = request.body ?? {}

      if (
        !uuidValido(despachoId) || !Number.isInteger(versionEsperada) || versionEsperada <= 0 ||
        typeof referencia !== 'string' || !referencia.trim() ||
        typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0 ||
        !fechaValida(fechaLimite)
      ) {
        throw new ErrorOperacion(400, 'Los datos del despacho o la versión no son válidos.')
      }

      const datos = await medirEtapa('editar_despacho', 'supabase', () =>
        dependencias.despachos.editarDespacho(sesion(response).token, despachoId, {
          versionEsperada, referencia: referencia.trim(), monto, fechaLimite,
        }),
      )
      response.json(datos)
    } catch (error) {
      manejarError(response, error)
    }
  })

  ruta.post('/despachos/:despachoId/anulacion', async (request, response) => {
    try {
      await obtenerPerfilAutorizado(response, dependencias.obtenerPerfil, 'anular_despacho', 'despachante')
      const { despachoId } = request.params
      const { versionEsperada, motivo, confirmado } = request.body ?? {}

      if (
        !uuidValido(despachoId) || !Number.isInteger(versionEsperada) || versionEsperada <= 0 ||
        typeof motivo !== 'string' || !motivo.trim() || confirmado !== true
      ) {
        throw new ErrorOperacion(400, 'Indicá un motivo y confirmá la anulación.')
      }

      const datos = await medirEtapa('anular_despacho', 'supabase', () =>
        dependencias.despachos.anularDespacho(sesion(response).token, despachoId, {
          versionEsperada, motivo: motivo.trim(),
        }),
      )
      response.json(datos)
    } catch (error) {
      manejarError(response, error)
    }
  })

  ruta.get('/despachos/:despachoId/historial', async (request, response) => {
    try {
      await obtenerPerfilAutorizado(response, dependencias.obtenerPerfil, 'consultar_historial', 'despachante')
      const { despachoId } = request.params

      if (!uuidValido(despachoId)) {
        throw new ErrorOperacion(400, 'El despacho solicitado no es válido.')
      }

      const datos = await medirEtapa('consultar_historial', 'supabase', () =>
        dependencias.despachos.obtenerHistorial(sesion(response).token, despachoId),
      )
      response.json(datos)
    } catch (error) {
      manejarError(response, error)
    }
  })

  return ruta
}
