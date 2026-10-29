import express from 'express'
import { crearRutaAutenticacion } from './rutas/autenticacion.js'
import { crearRutaDespachos } from './rutas/despachos.js'
import { crearRutaSalud } from './rutas/salud.js'
import type { ObtenerPerfil, ValidarToken } from './tipos/autenticacion.js'
import type { ServicioDespachos } from './tipos/despachos.js'

export type DependenciasAplicacion = {
  validarToken: ValidarToken
  obtenerPerfil: ObtenerPerfil
  despachos?: ServicioDespachos
}

export function crearAplicacion(dependencias: DependenciasAplicacion) {
  const aplicacion = express()

  aplicacion.disable('x-powered-by')
  aplicacion.use(express.json({ limit: '32kb' }))
  aplicacion.use('/api/salud', crearRutaSalud())
  aplicacion.use('/api/autenticacion', crearRutaAutenticacion(dependencias))
  if (dependencias.despachos) {
    aplicacion.use('/api',
      crearRutaDespachos({
        validarToken: dependencias.validarToken,
        obtenerPerfil: dependencias.obtenerPerfil,
        despachos: dependencias.despachos,
      }),
    )
  }

  aplicacion.use((_request, response) => {
    response.status(404).json({ error: 'Ruta no encontrada.' })
  })

  return aplicacion
}
