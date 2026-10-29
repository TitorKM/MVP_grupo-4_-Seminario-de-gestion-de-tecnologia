import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, describe, it } from 'node:test'
import { crearAplicacion } from '../src/app.js'
import {
  ErrorValidacionToken,
  type PerfilAutenticado,
} from '../src/tipos/autenticacion.js'
import {
  ErrorOperacion,
  type Despacho,
  type HistorialDespacho,
  type ServicioDespachos,
} from '../src/tipos/despachos.js'
import { convertirErrorSupabase } from '../src/servicios/despachos.js'

const idDespacho = '30000000-0000-4000-8000-000000000001'
const idImportadorA = '20000000-0000-4000-8000-000000000001'
const idImportadorB = '20000000-0000-4000-8000-000000000002'
const idEmpresaYad = '10000000-0000-4000-8000-000000000001'
const idEmpresaLogistic = '10000000-0000-4000-8000-000000000002'
const idUsuarioYad = '00000000-0000-4000-8000-000000000001'
const idUsuarioA = '00000000-0000-4000-8000-000000000002'

const perfiles: Record<string, PerfilAutenticado> = {
  'token-yad': {
    usuarioId: idUsuarioYad,
    nombreVisible: 'Despachante YAD',
    rol: 'despachante',
    empresaDespachante: { id: idEmpresaYad, razonSocial: 'YAD' },
    importador: null,
  },
  'token-a': {
    usuarioId: idUsuarioA,
    nombreVisible: 'Importador A',
    rol: 'importador',
    empresaDespachante: { id: idEmpresaYad, razonSocial: 'YAD' },
    importador: { id: idImportadorA, razonSocial: 'Importador A' },
  },
  'token-b': {
    usuarioId: '00000000-0000-4000-8000-000000000003',
    nombreVisible: 'Importador B',
    rol: 'importador',
    empresaDespachante: { id: idEmpresaYad, razonSocial: 'YAD' },
    importador: { id: idImportadorB, razonSocial: 'Importador B' },
  },
  'token-logistic': {
    usuarioId: '00000000-0000-4000-8000-000000000004',
    nombreVisible: 'Despachante LOGISTIC',
    rol: 'despachante',
    empresaDespachante: { id: idEmpresaLogistic, razonSocial: 'LOGISTIC' },
    importador: null,
  },
}

function despachoInicial(): Despacho {
  return {
    id: idDespacho,
    referencia: 'YAD-001',
    importador: { id: idImportadorA, razonSocial: 'Importador A' },
    monto: 1500,
    fechaLimite: '2026-11-15',
    estadoFondos: 'pendiente_confirmacion',
    version: 1,
    actualizadoEn: '2026-10-27T12:00:00.000Z',
    anuladoEn: null,
    anuladoPor: null,
    motivoAnulacion: null,
  }
}

describe('API de despachos', () => {
  let servidor: Server
  let baseUrl: string
  let despachos: Despacho[]
  let historial: HistorialDespacho[]

  const servicio: ServicioDespachos = {
    async listarImportadores(token) {
      if (token === 'token-yad') {
        return [
          { id: idImportadorA, razonSocial: 'Importador A' },
          { id: idImportadorB, razonSocial: 'Importador B' },
        ]
      }
      return []
    },
    async listarDespachos(token) {
      if (token === 'token-yad') return despachos
      if (token === 'token-a') {
        return despachos.filter((despacho) => despacho.importador.id === idImportadorA)
      }
      if (token === 'token-b') {
        return despachos.filter((despacho) => despacho.importador.id === idImportadorB)
      }
      return []
    },
    async obtenerDespacho(token, despachoId) {
      const actual = despachos.find((despacho) => despacho.id === despachoId)
      const autorizado =
        token === 'token-yad' ||
        (token === 'token-a' && actual?.importador.id === idImportadorA) ||
        (token === 'token-b' && actual?.importador.id === idImportadorB)
      if (!actual || !autorizado) throw new ErrorOperacion(404, 'No encontrado.')
      return actual
    },
    async crearDespacho(token, datos) {
      assert.equal(token, 'token-yad')
      const creado: Despacho = {
        id: idDespacho,
        referencia: datos.referencia,
        importador: { id: datos.importadorId, razonSocial: 'Importador A' },
        monto: datos.monto,
        fechaLimite: datos.fechaLimite,
        estadoFondos: 'pendiente_confirmacion',
        version: 1,
        actualizadoEn: '2026-10-27T12:00:00.000Z',
        anuladoEn: null,
        anuladoPor: null,
        motivoAnulacion: null,
      }
      despachos = [creado]
      return creado
    },
    async actualizarFondos(token, despachoId, datos) {
      assert.equal(token, 'token-a')
      const actual = despachos.find((despacho) => despacho.id === despachoId)
      assert.ok(actual)
      if (actual.anuladoEn) {
        throw new ErrorOperacion(410, 'El despacho está anulado.', 'PT410')
      }
      if (actual.version !== datos.versionEsperada) {
        throw new ErrorOperacion(
          409,
          'El despacho fue modificado por otra persona. Actualizá la información e intentá nuevamente.',
          '40001',
        )
      }
      const actualizado = {
        ...actual,
        estadoFondos: datos.estadoFondos,
        version: actual.version + 1,
      }
      despachos = [actualizado]
      historial = [
        {
          id: '2',
          accion: 'actualizado',
          autor: { usuarioId: idUsuarioA, nombreVisible: 'Importador A' },
          versionResultante: actualizado.version,
          cambios: [
            {
              campo: 'estadoFondos',
              anterior: actual.estadoFondos,
              nuevo: actualizado.estadoFondos,
            },
          ],
          modificadoEn: '2026-10-27T12:05:00.000Z',
        },
      ]
      return actualizado
    },
    async editarDespacho(token, despachoId, datos) {
      assert.equal(token, 'token-yad')
      const actual = despachos.find((despacho) => despacho.id === despachoId)
      assert.ok(actual)
      if (actual.anuladoEn) throw new ErrorOperacion(410, 'El despacho está anulado.', 'PT410')
      if (actual.version !== datos.versionEsperada) throw new ErrorOperacion(409, 'Versión desactualizada.', '40001')
      const actualizado={...actual,referencia:datos.referencia,monto:datos.monto,fechaLimite:datos.fechaLimite,version:actual.version+1}
      despachos=[actualizado]
      historial=[{id:'3',accion:'actualizado',autor:{usuarioId:idUsuarioYad,nombreVisible:'Despachante YAD'},versionResultante:actualizado.version,cambios:[{campo:'monto',anterior:actual.monto,nuevo:actualizado.monto}],modificadoEn:'2026-10-27T12:06:00.000Z'}]
      return actualizado
    },
    async anularDespacho(token, despachoId, datos) {
      assert.equal(token, 'token-yad')
      const actual=despachos.find((despacho)=>despacho.id===despachoId)
      assert.ok(actual)
      if (actual.anuladoEn) throw new ErrorOperacion(410,'El despacho está anulado.','PT410')
      if (actual.version!==datos.versionEsperada) throw new ErrorOperacion(409,'Versión desactualizada.','40001')
      const actualizado={...actual,version:actual.version+1,anuladoEn:'2026-10-27T12:07:00.000Z',anuladoPor:idUsuarioYad,motivoAnulacion:datos.motivo}
      despachos=[actualizado]
      historial=[{id:'4',accion:'anulado',autor:{usuarioId:idUsuarioYad,nombreVisible:'Despachante YAD'},versionResultante:actualizado.version,cambios:[{campo:'motivoAnulacion',anterior:null,nuevo:datos.motivo}],modificadoEn:actualizado.anuladoEn}]
      return actualizado
    },
    async obtenerHistorial(token, despachoId) {
      assert.equal(token, 'token-yad')
      assert.equal(despachoId, idDespacho)
      return historial
    },
  }

  before(async () => {
    const aplicacion = crearAplicacion({
      validarToken: async (token) => {
        if (token === 'invalido' || !perfiles[token]) {
          throw new ErrorValidacionToken('sesion_invalida', 'AuthInvalidJwtError')
        }
        return perfiles[token].usuarioId
      },
      obtenerPerfil: async (_usuarioId, token) => perfiles[token] ?? null,
      despachos: servicio,
    })

    servidor = aplicacion.listen(0)
    await new Promise<void>((resolve) => servidor.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
  })

  beforeEach(() => {
    despachos = []
    historial = []
  })

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      servidor.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it('rechaza solicitudes sin token o con token inválido', async (contexto) => {
    contexto.mock.method(console, 'warn', () => undefined)
    const sinToken = await fetch(`${baseUrl}/api/despachos`)
    const invalido = await fetch(`${baseUrl}/api/despachos`, {
      headers: { Authorization: 'Bearer invalido' },
    })

    assert.equal(sinToken.status, 401)
    assert.equal(invalido.status, 401)
  })

  it('lista importadores y permite al despachante crear un despacho', async () => {
    const importadores = await fetch(`${baseUrl}/api/importadores`, {
      headers: { Authorization: 'Bearer token-yad' },
    })
    assert.equal(importadores.status, 200)
    assert.equal((await importadores.json() as unknown[]).length, 2)

    const creado = await fetch(`${baseUrl}/api/despachos`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-yad',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        referencia: 'YAD-001',
        importadorId: idImportadorA,
        monto: 1500,
        fechaLimite: '2026-11-15',
      }),
    })

    assert.equal(creado.status, 201)
    assert.equal((await creado.json() as Despacho).estadoFondos, 'pendiente_confirmacion')
  })

  it('restringe creación e historial por rol', async () => {
    const crearComoImportador = await fetch(`${baseUrl}/api/despachos`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        referencia: 'NO-PERMITIDO',
        importadorId: idImportadorA,
        monto: 100,
        fechaLimite: '2026-11-15',
      }),
    })
    const historialComoImportador = await fetch(
      `${baseUrl}/api/despachos/${idDespacho}/historial`,
      { headers: { Authorization: 'Bearer token-a' } },
    )

    assert.equal(crearComoImportador.status, 403)
    assert.equal(historialComoImportador.status, 403)
  })

  it('rechaza una fecha de calendario inexistente', async () => {
    const respuesta = await fetch(`${baseUrl}/api/despachos`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-yad',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        referencia: 'FECHA-INVALIDA',
        importadorId: idImportadorA,
        monto: 100,
        fechaLimite: '2026-02-31',
      }),
    })

    assert.equal(respuesta.status, 400)
  })

  it('separa los listados por importador y empresa', async () => {
    despachos = [despachoInicial()]
    const consultar = (token: string) =>
      fetch(`${baseUrl}/api/despachos`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => response.json() as Promise<Despacho[]>)

    const [yad, importadorA, importadorB, logistic] = await Promise.all([
      consultar('token-yad'),
      consultar('token-a'),
      consultar('token-b'),
      consultar('token-logistic'),
    ])

    assert.equal(yad.length, 1)
    assert.equal(importadorA.length, 1)
    assert.equal(importadorB.length, 0)
    assert.equal(logistic.length, 0)
  })

  it('recupera solo el despacho afectado y conserva el aislamiento', async () => {
    despachos = [despachoInicial()]
    const consultar = (token: string) => fetch(`${baseUrl}/api/despachos/${idDespacho}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const propio = await consultar('token-a')
    const otroImportador = await consultar('token-b')
    const otraEmpresa = await consultar('token-logistic')

    assert.equal(propio.status, 200)
    assert.equal((await propio.json() as Despacho).id, idDespacho)
    assert.equal(otroImportador.status, 404)
    assert.equal(otraEmpresa.status, 404)
  })

  it('guarda el cambio de fondos y lo muestra en el historial', async () => {
    despachos = [despachoInicial()]
    const cambio = await fetch(`${baseUrl}/api/despachos/${idDespacho}/fondos`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versionEsperada: 1, estadoFondos: 'disponibles' }),
    })
    assert.equal(cambio.status, 200)
    assert.equal((await cambio.json() as Despacho).version, 2)

    const respuestaHistorial = await fetch(
      `${baseUrl}/api/despachos/${idDespacho}/historial`,
      { headers: { Authorization: 'Bearer token-yad' } },
    )
    const eventos = await respuestaHistorial.json() as HistorialDespacho[]
    assert.equal(respuestaHistorial.status, 200)
    assert.equal(eventos[0]?.autor.nombreVisible, 'Importador A')
    assert.deepEqual(eventos[0]?.cambios[0], {
      campo: 'estadoFondos',
      anterior: 'pendiente_confirmacion',
      nuevo: 'disponibles',
    })
  })

  it('responde 409 ante una versión desactualizada', async () => {
    despachos = [{ ...despachoInicial(), version: 2 }]
    const respuesta = await fetch(`${baseUrl}/api/despachos/${idDespacho}/fondos`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-a',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versionEsperada: 1, estadoFondos: 'disponibles' }),
    })

    assert.equal(respuesta.status, 409)
    assert.match((await respuesta.json() as { error: string }).error, /Actualizá/)
  })

  it('solo el despachante edita los campos permitidos', async () => {
    despachos=[despachoInicial()]
    const cuerpo={versionEsperada:1,referencia:'YAD-EDITADO',monto:2200,fechaLimite:'2026-11-20'}
    const prohibido=await fetch(`${baseUrl}/api/despachos/${idDespacho}`,{method:'PATCH',headers:{Authorization:'Bearer token-a','Content-Type':'application/json'},body:JSON.stringify(cuerpo)})
    const permitido=await fetch(`${baseUrl}/api/despachos/${idDespacho}`,{method:'PATCH',headers:{Authorization:'Bearer token-yad','Content-Type':'application/json'},body:JSON.stringify(cuerpo)})
    assert.equal(prohibido.status,403)
    assert.equal(permitido.status,200)
    const actualizado=await permitido.json() as Despacho
    assert.equal(actualizado.importador.id,idImportadorA)
    assert.equal(actualizado.version,2)
  })

  it('exige motivo no vacío y confirmación para anular', async () => {
    despachos=[despachoInicial()]
    for (const cuerpo of [{versionEsperada:1,motivo:'   ',confirmado:true},{versionEsperada:1,motivo:'Cancelado',confirmado:false}]) {
      const respuesta=await fetch(`${baseUrl}/api/despachos/${idDespacho}/anulacion`,{method:'POST',headers:{Authorization:'Bearer token-yad','Content-Type':'application/json'},body:JSON.stringify(cuerpo)})
      assert.equal(respuesta.status,400)
    }
  })

  it('anula, registra el motivo y rechaza cambios posteriores', async () => {
    despachos=[despachoInicial()]
    const anulacion=await fetch(`${baseUrl}/api/despachos/${idDespacho}/anulacion`,{method:'POST',headers:{Authorization:'Bearer token-yad','Content-Type':'application/json'},body:JSON.stringify({versionEsperada:1,motivo:'Operación cancelada',confirmado:true})})
    assert.equal(anulacion.status,200)
    assert.equal((await anulacion.json() as Despacho).motivoAnulacion,'Operación cancelada')
    const edicion=await fetch(`${baseUrl}/api/despachos/${idDespacho}`,{method:'PATCH',headers:{Authorization:'Bearer token-yad','Content-Type':'application/json'},body:JSON.stringify({versionEsperada:2,referencia:'NO',monto:10,fechaLimite:'2026-11-20'})})
    assert.equal(edicion.status,410)
    const fondos=await fetch(`${baseUrl}/api/despachos/${idDespacho}/fondos`,{method:'PATCH',headers:{Authorization:'Bearer token-a','Content-Type':'application/json'},body:JSON.stringify({versionEsperada:2,estadoFondos:'disponibles'})})
    assert.equal(fondos.status,410)
  })

  it('restringe la anulación por rol', async () => {
    despachos=[despachoInicial()]
    const respuesta=await fetch(`${baseUrl}/api/despachos/${idDespacho}/anulacion`,{method:'POST',headers:{Authorization:'Bearer token-a','Content-Type':'application/json'},body:JSON.stringify({versionEsperada:1,motivo:'No permitido',confirmado:true})})
    assert.equal(respuesta.status,403)
  })
})

describe('traducción de conflictos de Supabase', () => {
  it('traduce PT409 a un conflicto HTTP específico', () => {
    const error = convertirErrorSupabase({ code: 'PT409', status: 409 })
    assert.equal(error.estadoHttp, 409)
    assert.match(error.message, /modificado por otra persona/)
  })

  it('distingue un despacho anulado con PT410', () => {
    const error = convertirErrorSupabase({ code: 'PT410', status: 410 })
    assert.equal(error.estadoHttp, 410)
    assert.match(error.message, /anulado/)
  })
})
