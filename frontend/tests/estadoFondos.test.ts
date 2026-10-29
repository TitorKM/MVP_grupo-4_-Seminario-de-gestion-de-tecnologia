import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clasificarErrorFondos, ejecutarConIndicador } from '../src/estadoFondos.ts'

const errorHttp=(estadoHttp:number)=>Object.assign(new Error('API'),{estadoHttp})

describe('actualización del estado de fondos', () => {
  it('distingue versión obsoleta, anulación, red y servicio', () => {
    assert.equal(clasificarErrorFondos(errorHttp(409)).tipo,'version')
    assert.equal(clasificarErrorFondos(errorHttp(410)).tipo,'anulado')
    assert.equal(clasificarErrorFondos(Object.assign(new Error('Red'),{name:'ErrorRedApi'})).tipo,'red')
    assert.equal(clasificarErrorFondos(errorHttp(503)).tipo,'servicio')
    assert.equal(clasificarErrorFondos(errorHttp(409)).mensaje,'El despacho cambió. Actualizá sus datos antes de cambiar los fondos.')
  })

  it('devuelve el resultado de una actualización normal y libera el indicador', async () => {
    const estados:boolean[]=[]
    const resultado=await ejecutarConIndicador(async()=> 'guardado',activo=>estados.push(activo))
    assert.equal(resultado,'guardado')
    assert.deepEqual(estados,[true,false])
  })

  it('libera el indicador aunque falle la operación', async () => {
    const estados:boolean[]=[]
    await assert.rejects(()=>ejecutarConIndicador(async()=>{throw new Error('fallo')},activo=>estados.push(activo)))
    assert.deepEqual(estados,[true,false])
  })
})
