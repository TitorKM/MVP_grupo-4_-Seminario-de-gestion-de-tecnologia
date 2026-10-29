import { Router } from 'express'
import { crearMiddlewareAutenticacion } from '../middleware/autenticacion.js'
import type {
  ObtenerPerfil,
  SesionValidada,
  ValidarToken,
} from '../tipos/autenticacion.js'

type DependenciasAutenticacion = {
  validarToken: ValidarToken
  obtenerPerfil: ObtenerPerfil
}

export function crearRutaAutenticacion(dependencias: DependenciasAutenticacion) {
  const ruta = Router()
  const autenticar = crearMiddlewareAutenticacion(dependencias.validarToken)

  ruta.get('/perfil', autenticar, async (_request, response) => {
    const sesion = response.locals.sesion as SesionValidada

    try {
      const perfil = await dependencias.obtenerPerfil(sesion.usuarioId, sesion.token)

      if (!perfil) {
        response.status(403).json({ error: 'El perfil no esta habilitado.' })
        return
      }

      response.json(perfil)
    } catch (error) {
      console.error('No se pudo consultar el perfil autenticado.', error)
      response.status(500).json({ error: 'No se pudo completar la solicitud.' })
    }
  })

  return ruta
}
