export type EstadoFondosOperacion = 'disponibles' | 'no_disponibles' | 'pendiente_confirmacion'

export type DespachoParaEstado = {
  id: string
  referencia: string
  fechaLimite: string
  estadoFondos: EstadoFondosOperacion
  anuladoEn?: string | null
}

export type NivelOperacion = 'fondos_confirmados' | 'seguimiento' | 'atencion' | 'urgente' | 'anulado'

export const nivelMeta: Record<NivelOperacion, { label: string; color: string }> = {
  fondos_confirmados: { label: 'Fondos confirmados', color: '#5d876c' },
  seguimiento: { label: 'En seguimiento', color: '#416f91' },
  atencion: { label: 'Atención', color: '#F9A001' },
  urgente: { label: 'Urgente', color: '#d75e00' },
  anulado: { label: 'Anulado', color: '#72787d' },
}

export type AlertaDespacho = {
  despachoId: string
  referencia: string
  estadoFondos: Exclude<EstadoFondosOperacion, 'disponibles'>
  nivel: 'atencion' | 'urgente'
  diasRestantes: number
  vencimientoTexto: string
}

function fechaArgentina(hoy: Date): [number, number, number] {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(hoy)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value)
  return [valor('year'), valor('month'), valor('day')]
}

export function diasRestantes(fechaLimite: string, hoy = new Date()): number {
  const [anio, mes, dia] = fechaLimite.split('-').map(Number)
  const [anioHoy, mesHoy, diaHoy] = fechaArgentina(hoy)
  return Math.round((Date.UTC(anio, mes - 1, dia) - Date.UTC(anioHoy, mesHoy - 1, diaHoy)) / 86_400_000)
}

export function textoDiasRestantes(dias: number): string {
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  return `${dias} ${dias === 1 ? 'día restante' : 'días restantes'}`
}

export function nivelDespacho(despacho: DespachoParaEstado, hoy = new Date()): NivelOperacion {
  if (despacho.anuladoEn) return 'anulado'
  if (despacho.estadoFondos === 'disponibles') return 'fondos_confirmados'
  const dias = diasRestantes(despacho.fechaLimite, hoy)
  if (dias <= 0) return 'urgente'
  if (dias <= 3) return 'atencion'
  return 'seguimiento'
}

export function calcularAlertas(despachos: DespachoParaEstado[], hoy = new Date()): AlertaDespacho[] {
  return despachos.flatMap((despacho) => {
    const nivel = nivelDespacho(despacho, hoy)
    if (nivel !== 'atencion' && nivel !== 'urgente') return []
    const dias = diasRestantes(despacho.fechaLimite, hoy)
    return [{
      despachoId: despacho.id, referencia: despacho.referencia,
      estadoFondos: despacho.estadoFondos as Exclude<EstadoFondosOperacion, 'disponibles'>,
      nivel, diasRestantes: dias, vencimientoTexto: textoDiasRestantes(dias),
    }]
  })
}

export function calcularIndicadores(despachos: DespachoParaEstado[], hoy = new Date()) {
  const activos = despachos.filter((despacho) => !despacho.anuladoEn)
  return {
    activos: activos.length,
    enRiesgo: activos.filter((despacho) => ['atencion', 'urgente'].includes(nivelDespacho(despacho, hoy))).length,
    porEstadoFondos: {
      disponibles: activos.filter((despacho) => despacho.estadoFondos === 'disponibles').length,
      no_disponibles: activos.filter((despacho) => despacho.estadoFondos === 'no_disponibles').length,
      pendiente_confirmacion: activos.filter((despacho) => despacho.estadoFondos === 'pendiente_confirmacion').length,
    },
  }
}
