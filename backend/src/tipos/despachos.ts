export type EstadoFondos =
  | 'disponibles'
  | 'no_disponibles'
  | 'pendiente_confirmacion'

export type ImportadorResumen = {
  id: string
  razonSocial: string
}

export type Despacho = {
  id: string
  referencia: string
  importador: ImportadorResumen
  monto: number
  fechaLimite: string
  estadoFondos: EstadoFondos
  version: number
  actualizadoEn: string
  anuladoEn: string | null
  anuladoPor: string | null
  motivoAnulacion: string | null
}

export type CambioHistorial = {
  campo: string
  anterior: unknown
  nuevo: unknown
}

export type HistorialDespacho = {
  id: string
  accion: 'creado' | 'actualizado' | 'anulado'
  autor: {
    usuarioId: string
    nombreVisible: string
  }
  versionResultante: number
  cambios: CambioHistorial[]
  modificadoEn: string
}

export type CrearDespacho = {
  referencia: string
  importadorId: string
  monto: number
  fechaLimite: string
}

export type ActualizarFondos = {
  versionEsperada: number
  estadoFondos: EstadoFondos
}

export type EditarDespacho = {
  versionEsperada: number
  referencia: string
  monto: number
  fechaLimite: string
}

export type AnularDespacho = {
  versionEsperada: number
  motivo: string
}

export class ErrorOperacion extends Error {
  constructor(
    public readonly estadoHttp: number,
    mensaje: string,
    public readonly codigoTecnico?: string,
  ) {
    super(mensaje)
    this.name = 'ErrorOperacion'
  }
}

export type ServicioDespachos = {
  listarImportadores: (token: string) => Promise<ImportadorResumen[]>
  listarDespachos: (token: string) => Promise<Despacho[]>
  obtenerDespacho: (token: string, despachoId: string) => Promise<Despacho>
  crearDespacho: (token: string, datos: CrearDespacho) => Promise<Despacho>
  editarDespacho: (token: string, despachoId: string, datos: EditarDespacho) => Promise<Despacho>
  anularDespacho: (token: string, despachoId: string, datos: AnularDespacho) => Promise<Despacho>
  actualizarFondos: (
    token: string,
    despachoId: string,
    datos: ActualizarFondos,
  ) => Promise<Despacho>
  obtenerHistorial: (token: string, despachoId: string) => Promise<HistorialDespacho[]>
}
