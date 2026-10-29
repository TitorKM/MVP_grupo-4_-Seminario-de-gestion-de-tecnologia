import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calcularIndicadores } from '../src/alertas.ts'
import { crearFiltrosIniciales, errorRangoFechas, filtrarDespachos, hayFiltrosActivos, type FiltrosDespachos } from '../src/filtrosDespachos.ts'

const hoy = new Date('2026-10-28T15:00:00.000Z')
const despachos = [
  { id: 'fuera', referencia: 'YAD-006', fechaLimite: '2026-11-13', estadoFondos: 'no_disponibles' as const, monto: 600, anuladoEn: null },
  { id: 'hoy', referencia: 'YAD-002', fechaLimite: '2026-10-28', estadoFondos: 'pendiente_confirmacion' as const, monto: 200, anuladoEn: null },
  { id: 'limite', referencia: 'YAD-005', fechaLimite: '2026-11-12', estadoFondos: 'disponibles' as const, monto: 500, anuladoEn: null },
  { id: 'vencido', referencia: 'YAD-001', fechaLimite: '2026-10-25', estadoFondos: 'pendiente_confirmacion' as const, monto: 100, anuladoEn: null },
  { id: 'atencion', referencia: 'YAD-003', fechaLimite: '2026-10-30', estadoFondos: 'no_disponibles' as const, monto: 300, anuladoEn: null },
  { id: 'seguimiento', referencia: 'YAD-004', fechaLimite: '2026-11-01', estadoFondos: 'pendiente_confirmacion' as const, monto: 400, anuladoEn: null },
  { id: 'anulado', referencia: 'YAD-007', fechaLimite: '2026-10-29', estadoFondos: 'pendiente_confirmacion' as const, monto: 700, anuladoEn: '2026-10-27T12:00:00Z' },
]
const filtros = (cambios: Partial<FiltrosDespachos> = {}): FiltrosDespachos => ({ ...crearFiltrosIniciales(), ...cambios })
const ids = (valor: FiltrosDespachos, fecha = hoy) => filtrarDespachos(despachos, valor, fecha).map(d => d.id)

describe('filtros combinados de despachos', () => {
  it('sin filtros conserva los datos y ordena por vencimiento sin modificar la cartera', () => {
    const original = despachos.map(d => d.id)
    Object.freeze(despachos)
    const resultado = filtrarDespachos(despachos, filtros(), hoy)
    assert.deepEqual(resultado.map(d => d.id), ['vencido', 'hoy', 'anulado', 'atencion', 'seguimiento', 'limite', 'fuera'])
    assert.deepEqual(despachos.map(d => d.id), original)
    assert.equal(resultado[0].monto, 100)
    assert.notEqual(resultado, despachos)
  })

  it('distingue los tres estados de fondos del nivel de urgencia', () => {
    assert.deepEqual(ids(filtros({ estadoFondos: 'disponibles' })), ['limite'])
    assert.deepEqual(ids(filtros({ estadoFondos: 'no_disponibles' })), ['atencion', 'fuera'])
    assert.deepEqual(ids(filtros({ estadoFondos: 'pendiente_confirmacion' })), ['vencido', 'hoy', 'anulado', 'seguimiento'])
    assert.deepEqual(ids(filtros({ nivel: 'urgente' })), ['vencido', 'hoy'])
    assert.deepEqual(ids(filtros({ nivel: 'anulado' })), ['anulado'])
  })

  it('combina fondos, nivel y rango por intersección', () => {
    assert.deepEqual(ids(filtros({ estadoFondos: 'no_disponibles', nivel: 'atencion', periodo: 'rango', desde: '2026-10-28', hasta: '2026-10-30' })), ['atencion'])
    assert.deepEqual(ids(filtros({ estadoFondos: 'disponibles', nivel: 'urgente' })), [])
  })

  it('incluye ambos extremos y permite consultar un solo día', () => {
    assert.deepEqual(ids(filtros({ periodo: 'rango', desde: '2026-10-28', hasta: '2026-10-30' })), ['hoy', 'anulado', 'atencion'])
    assert.deepEqual(ids(filtros({ periodo: 'rango', desde: '2026-10-28', hasta: '2026-10-28' })), ['hoy'])
  })

  it('permite usar solamente Desde o solamente Hasta', () => {
    assert.deepEqual(ids(filtros({ periodo: 'rango', desde: '2026-11-01' })), ['seguimiento', 'limite', 'fuera'])
    assert.deepEqual(ids(filtros({ periodo: 'rango', hasta: '2026-10-28' })), ['vencido', 'hoy'])
  })

  it('informa un rango invertido y evita mostrar resultados engañosos', () => {
    const rango = filtros({ periodo: 'rango', desde: '2026-11-01', hasta: '2026-10-28' })
    assert.match(errorRangoFechas(rango)!, /Desde.*posterior.*Hasta/)
    assert.deepEqual(ids(rango), [])
    assert.equal(errorRangoFechas(filtros({ periodo: 'rango', desde: '2026-10-28', hasta: '2026-10-28' })), null)
  })

  it('conserva los accesos de próximos 15 días y vencidos, con hoy incluido solo en próximos', () => {
    assert.deepEqual(ids(filtros({ periodo: 'proximos' })), ['hoy', 'anulado', 'atencion', 'seguimiento', 'limite'])
    assert.deepEqual(ids(filtros({ periodo: 'vencidos' })), ['vencido'])
  })

  it('usa el día de Argentina aunque en UTC ya sea el día siguiente', () => {
    const madrugadaUtc = new Date('2026-10-29T01:00:00.000Z')
    assert.deepEqual(ids(filtros({ periodo: 'vencidos' }), madrugadaUtc), ['vencido'])
    assert.ok(ids(filtros({ periodo: 'proximos' }), madrugadaUtc).includes('hoy'))
  })

  it('los períodos predefinidos no se combinan con límites de un rango anterior', () => {
    assert.deepEqual(ids(filtros({ periodo: 'vencidos', desde: '2026-11-01', hasta: '2026-10-28' })), ['vencido'])
  })

  it('limpiar todos los criterios recupera la cartera y el estado inicial', () => {
    assert.equal(hayFiltrosActivos(filtros({ estadoFondos: 'disponibles', periodo: 'rango', desde: '2026-11-01' })), true)
    const limpios = crearFiltrosIniciales()
    assert.equal(hayFiltrosActivos(limpios), false)
    assert.equal(hayFiltrosActivos(filtros({ periodo: 'rango' })), false)
    assert.equal(ids(limpios).length, despachos.length)
  })

  it('vuelve a aplicar los criterios al recibir una fecha editada sin mutar el filtro', () => {
    const seleccion = filtros({ periodo: 'rango', desde: '2026-10-28', hasta: '2026-10-30' })
    const actualizados = despachos.map(d => d.id === 'seguimiento' ? { ...d, fechaLimite: '2026-10-28' } : d)
    assert.deepEqual(filtrarDespachos(actualizados, seleccion, hoy).map(d => d.id), ['hoy', 'seguimiento', 'anulado', 'atencion'])
    assert.equal(seleccion.desde, '2026-10-28')
  })
})

describe('indicadores del resultado filtrado', () => {
  it('calcula riesgo, distribución y monto sobre los activos del resultado', () => {
    const resultado = filtrarDespachos(despachos, filtros({ periodo: 'rango', desde: '2026-10-28', hasta: '2026-10-30' }), hoy)
    const indicadores = calcularIndicadores(resultado, hoy)
    assert.equal(resultado.length, 3)
    assert.deepEqual(indicadores, { activos: 2, enRiesgo: 2, porEstadoFondos: { disponibles: 0, no_disponibles: 1, pendiente_confirmacion: 1 } })
    assert.equal(resultado.filter(d => !d.anuladoEn).reduce((total, d) => total + d.monto, 0), 500)
  })

  it('un resultado con anulados conserva sus filas pero no suma indicadores activos', () => {
    const resultado = filtrarDespachos(despachos, filtros({ nivel: 'anulado' }), hoy)
    assert.equal(resultado.length, 1)
    assert.deepEqual(calcularIndicadores(resultado, hoy), { activos: 0, enRiesgo: 0, porEstadoFondos: { disponibles: 0, no_disponibles: 0, pendiente_confirmacion: 0 } })
  })

  it('maneja resultados vacíos y una cartera vacía sin cifras inválidas', () => {
    const resultado = filtrarDespachos(despachos, filtros({ periodo: 'rango', desde: '2027-01-01' }), hoy)
    assert.deepEqual(resultado, [])
    assert.equal(calcularIndicadores(resultado, hoy).activos, 0)
    assert.deepEqual(filtrarDespachos([], filtros(), hoy), [])
  })
})
