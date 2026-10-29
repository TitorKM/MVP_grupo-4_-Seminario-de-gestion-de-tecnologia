import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import type { Server } from 'node:http'
import { crearAplicacion } from '../src/app.js'
import { convertirErrorGetClaims } from '../src/servicios/autenticacion.js'
import {
  ErrorValidacionToken,
  type PerfilAutenticado,
} from '../src/tipos/autenticacion.js'

const perfilValido: PerfilAutenticado = {
  usuarioId: '00000000-0000-0000-0000-000000000001',
  nombreVisible: 'Cuenta YAD',
  rol: 'despachante',
  empresaDespachante: {
    id: '10000000-0000-0000-0000-000000000001',
    razonSocial: 'YAD',
  },
  importador: null,
}

describe('API de autenticacion', () => {
  let servidor: Server
  let baseUrl: string

  before(async () => {
    const aplicacion = crearAplicacion({
      validarToken: async (token) => {
        if (token === 'invalido') {
          throw new ErrorValidacionToken(
            'sesion_invalida',
            'AuthInvalidJwtError',
            'invalid_jwt',
            400,
          )
        }

        if (token === 'fallo-red') {
          throw new ErrorValidacionToken(
            'fallo_red',
            'AuthRetryableFetchError',
          )
        }

        if (token === 'fallo-supabase') {
          throw new ErrorValidacionToken(
            'fallo_supabase',
            'AuthApiError',
            'unexpected_failure',
            503,
          )
        }

        return perfilValido.usuarioId
      },
      obtenerPerfil: async (_usuarioId, token) => {
        if (token === 'sin-perfil') {
          return null
        }

        return perfilValido
      },
    })

    servidor = aplicacion.listen(0)
    await new Promise<void>((resolve) => servidor.once('listening', resolve))
    const direccion = servidor.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${direccion.port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      servidor.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it('responde el estado de salud', async () => {
    const response = await fetch(`${baseUrl}/api/salud`)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { estado: 'ok' })
  })

  it('rechaza una solicitud sin header y registra solo la categoria', async (contexto) => {
    const advertencia = contexto.mock.method(console, 'warn', () => undefined)
    const response = await fetch(`${baseUrl}/api/autenticacion/perfil`)

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Se requiere una sesion valida.' })
    assert.deepEqual(advertencia.mock.calls[0]?.arguments, [
      'Diagnostico de autenticacion:',
      { categoria: 'header_ausente' },
    ])
  })

  it('rechaza un header malformado y lo diferencia del ausente', async (contexto) => {
    const advertencia = contexto.mock.method(console, 'warn', () => undefined)
    const response = await fetch(`${baseUrl}/api/autenticacion/perfil`, {
      headers: { Authorization: 'Basic credencial-no-valida' },
    })

    assert.equal(response.status, 401)
    assert.deepEqual(advertencia.mock.calls[0]?.arguments, [
      'Diagnostico de autenticacion:',
      { categoria: 'header_malformado' },
    ])
  })

  it('rechaza un token invalido y registra metadatos seguros', async (contexto) => {
    const advertencia = contexto.mock.method(console, 'warn', () => undefined)
    const response = await fetch(`${baseUrl}/api/autenticacion/perfil`, {
      headers: { Authorization: 'Bearer invalido' },
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Se requiere una sesion valida.' })
    assert.deepEqual(advertencia.mock.calls[0]?.arguments, [
      'Diagnostico de autenticacion:',
      {
        categoria: 'sesion_invalida',
        nombre: 'AuthInvalidJwtError',
        codigo: 'invalid_jwt',
        estadoHttp: 400,
      },
    ])
  })

  it('diferencia un fallo de red de una sesion invalida', async (contexto) => {
    const advertencia = contexto.mock.method(console, 'warn', () => undefined)
    const response = await fetch(`${baseUrl}/api/autenticacion/perfil`, {
      headers: { Authorization: 'Bearer fallo-red' },
    })

    assert.equal(response.status, 401)
    assert.deepEqual(advertencia.mock.calls[0]?.arguments, [
      'Diagnostico de autenticacion:',
      {
        categoria: 'fallo_red',
        nombre: 'AuthRetryableFetchError',
      },
    ])
  })

  it('diferencia un fallo de Supabase de una sesion invalida', async (contexto) => {
    const advertencia = contexto.mock.method(console, 'warn', () => undefined)
    const response = await fetch(`${baseUrl}/api/autenticacion/perfil`, {
      headers: { Authorization: 'Bearer fallo-supabase' },
    })

    assert.equal(response.status, 401)
    assert.deepEqual(advertencia.mock.calls[0]?.arguments, [
      'Diagnostico de autenticacion:',
      {
        categoria: 'fallo_supabase',
        nombre: 'AuthApiError',
        codigo: 'unexpected_failure',
        estadoHttp: 503,
      },
    ])
  })

  it('devuelve el perfil asociado a un token valido', async () => {
    const response = await fetch(`${baseUrl}/api/autenticacion/perfil`, {
      headers: { Authorization: 'Bearer valido' },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), perfilValido)
  })

  it('rechaza un perfil inexistente o inactivo', async () => {
    const response = await fetch(`${baseUrl}/api/autenticacion/perfil`, {
      headers: { Authorization: 'Bearer sin-perfil' },
    })

    assert.equal(response.status, 403)
  })

  it('clasifica errores de Supabase sin conservar su mensaje', () => {
    const error = convertirErrorGetClaims({
      name: 'AuthApiError',
      code: 'unexpected_failure',
      status: 503,
      message: 'detalle interno que no debe registrarse',
    })

    assert.equal(error.categoria, 'fallo_supabase')
    assert.equal(error.nombreOriginal, 'AuthApiError')
    assert.equal(error.codigo, 'unexpected_failure')
    assert.equal(error.estadoHttp, 503)
    assert.equal(JSON.stringify(error).includes('detalle interno'), false)
  })

  it('clasifica status cero como red sin informarlo como estado HTTP', () => {
    const error = convertirErrorGetClaims({
      name: 'AuthRetryableFetchError',
      status: 0,
      message: 'detalle de red que no debe registrarse',
    })

    assert.equal(error.categoria, 'fallo_red')
    assert.equal(error.nombreOriginal, 'AuthRetryableFetchError')
    assert.equal(error.estadoHttp, undefined)
    assert.equal(JSON.stringify(error).includes('detalle de red'), false)
  })
})
