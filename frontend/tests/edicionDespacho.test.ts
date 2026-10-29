import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clasificarErrorEdicion } from '../src/edicionDespacho.ts'

function errorApi(estadoHttp:number) {
  return Object.assign(new Error('Error de API'),{name:'ErrorApi',estadoHttp})
}

function errorRed() {
  return Object.assign(new Error('Error de red'),{name:'ErrorRedApi'})
}

describe('errores al editar un despacho', () => {
  it('distingue un conflicto y aclara que conserva el borrador', () => {
    const resultado=clasificarErrorEdicion(errorApi(409))
    assert.equal(resultado.tipo,'conflicto')
    assert.match(resultado.mensaje,/no se sobrescribieron/)
  })

  it('distingue red de un fallo del servicio', () => {
    assert.equal(clasificarErrorEdicion(errorRed()).tipo,'red')
    assert.equal(clasificarErrorEdicion(errorApi(503)).tipo,'servicio')
  })
})
