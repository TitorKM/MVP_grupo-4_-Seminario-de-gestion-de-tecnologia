import { Router } from 'express'

export function crearRutaSalud() {
  const ruta = Router()

  ruta.get('/', (_request, response) => {
    response.json({ estado: 'ok' })
  })

  return ruta
}
