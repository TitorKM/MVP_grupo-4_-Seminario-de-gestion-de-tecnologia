import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calcularAlertas, calcularIndicadores, diasRestantes, nivelDespacho } from '../src/alertas.ts'

const hoy = new Date('2026-10-27T15:00:00.000Z')
const despacho = (fechaLimite: string, estadoFondos: 'disponibles'|'no_disponibles'|'pendiente_confirmacion', anuladoEn: string|null = null) =>
  ({ id: `${fechaLimite}-${estadoFondos}`, referencia: 'YAD-001', fechaLimite, estadoFondos, anuladoEn })

describe('regla central de urgencia con fecha argentina', () => {
  it('calcula días de calendario en Argentina', () => {
    assert.equal(diasRestantes('2026-10-28', hoy), 1)
  })

  it('clasifica seguimiento, atención, urgente, confirmado y anulado', () => {
    assert.equal(nivelDespacho(despacho('2026-11-01','pendiente_confirmacion'),hoy),'seguimiento')
    assert.equal(nivelDespacho(despacho('2026-10-30','no_disponibles'),hoy),'atencion')
    assert.equal(nivelDespacho(despacho('2026-10-27','pendiente_confirmacion'),hoy),'urgente')
    assert.equal(nivelDespacho(despacho('2026-10-20','disponibles'),hoy),'fondos_confirmados')
    assert.equal(nivelDespacho(despacho('2026-10-28','no_disponibles','2026-10-26T10:00:00Z'),hoy),'anulado')
  })

  it('la campana incluye solo atención y urgente activos', () => {
    const alertas=calcularAlertas([
      despacho('2026-10-30','pendiente_confirmacion'),
      despacho('2026-10-27','no_disponibles'),
      despacho('2026-11-01','no_disponibles'),
      despacho('2026-10-28','disponibles'),
      despacho('2026-10-28','no_disponibles','2026-10-26T10:00:00Z'),
    ],hoy)
    assert.deepEqual(alertas.map(a=>a.nivel),['atencion','urgente'])
  })
})

describe('indicadores de cartera activa', () => {
  it('cuenta riesgo y distribución por los tres estados, excluyendo anulados', () => {
    const resultado=calcularIndicadores([
      despacho('2026-10-30','pendiente_confirmacion'),
      despacho('2026-10-27','no_disponibles'),
      despacho('2026-11-10','disponibles'),
      despacho('2026-10-28','no_disponibles','2026-10-26T10:00:00Z'),
    ],hoy)
    assert.equal(resultado.activos,3)
    assert.equal(resultado.enRiesgo,2)
    assert.deepEqual(resultado.porEstadoFondos,{disponibles:1,no_disponibles:1,pendiente_confirmacion:1})
  })

  it('maneja una cartera sin despachos activos', () => {
    assert.deepEqual(calcularIndicadores([],hoy),{activos:0,enRiesgo:0,porEstadoFondos:{disponibles:0,no_disponibles:0,pendiente_confirmacion:0}})
  })
})
