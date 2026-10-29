import {
  diasRestantes,
  nivelDespacho,
  type DespachoParaEstado,
  type EstadoFondosOperacion,
  type NivelOperacion,
} from './alertas.ts'

export type PeriodoDespachos = 'todas' | 'proximos' | 'vencidos' | 'rango'

export type FiltrosDespachos = {
  estadoFondos: EstadoFondosOperacion | 'todos'
  nivel: NivelOperacion | 'todos'
  periodo: PeriodoDespachos
  desde: string
  hasta: string
}

export function crearFiltrosIniciales(): FiltrosDespachos {
  return { estadoFondos: 'todos', nivel: 'todos', periodo: 'todas', desde: '', hasta: '' }
}

export function errorRangoFechas(filtros: FiltrosDespachos): string | null {
  if (filtros.periodo === 'rango' && filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    return 'La fecha Desde no puede ser posterior a la fecha Hasta.'
  }
  return null
}

export function hayFiltrosActivos(filtros: FiltrosDespachos): boolean {
  return filtros.estadoFondos !== 'todos' || filtros.nivel !== 'todos' ||
    filtros.periodo === 'proximos' || filtros.periodo === 'vencidos' ||
    (filtros.periodo === 'rango' && Boolean(filtros.desde || filtros.hasta))
}

export function filtrarDespachos<T extends DespachoParaEstado>(
  despachos: T[],
  filtros: FiltrosDespachos,
  hoy = new Date(),
): T[] {
  if (errorRangoFechas(filtros)) return []

  return despachos.filter((despacho) => {
    if (filtros.estadoFondos !== 'todos' && despacho.estadoFondos !== filtros.estadoFondos) return false
    if (filtros.nivel !== 'todos' && nivelDespacho(despacho, hoy) !== filtros.nivel) return false

    if (filtros.periodo === 'proximos' || filtros.periodo === 'vencidos') {
      const dias = diasRestantes(despacho.fechaLimite, hoy)
      return filtros.periodo === 'proximos' ? dias >= 0 && dias <= 15 : dias < 0
    }

    // Las fechas SQL date e input date son YYYY-MM-DD: se comparan como días
    // de calendario, sin convertirlas a UTC y desplazar sus límites.
    if (filtros.periodo === 'rango') {
      if (filtros.desde && despacho.fechaLimite < filtros.desde) return false
      if (filtros.hasta && despacho.fechaLimite > filtros.hasta) return false
    }
    return true
  }).sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite))
}
