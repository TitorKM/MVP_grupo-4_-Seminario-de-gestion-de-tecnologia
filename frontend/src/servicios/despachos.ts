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

export type NuevoDespacho = {
  referencia: string
  importadorId: string
  monto: number
  fechaLimite: string
}

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public readonly estadoHttp: number,
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
  }
}

export class ErrorRedApi extends Error {
  constructor(mensaje = 'No se pudo conectar con la API.') {
    super(mensaje)
    this.name = 'ErrorRedApi'
  }
}

async function solicitar<T>(
  operacion: string,
  ruta: string,
  token: string,
  opciones: RequestInit = {},
): Promise<T> {
  const inicio = performance.now()
  let response: Response
  try {
    response = await fetch(ruta, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
        ...opciones.headers,
      },
    })
  } catch {
    registrarRendimiento(operacion, inicio, 'red')
    throw new ErrorRedApi()
  }

  if (!response.ok) {
    const cuerpo = await response.json().catch(() => ({})) as { error?: string }
    registrarRendimiento(operacion, inicio, response.status)
    throw new ErrorApi(cuerpo.error || 'No se pudo completar la solicitud.', response.status)
  }

  const datos = await response.json() as T
  registrarRendimiento(operacion, inicio, response.status)
  return datos
}

function registrarRendimiento(
  operacion: string,
  inicio: number,
  resultado: number | 'red',
): void {
  if (import.meta.env?.VITE_DIAGNOSTICO_RENDIMIENTO !== 'true') return
  console.info('Rendimiento frontend:', {
    operacion,
    etapa: 'solicitud_api',
    duracionMs: Math.round(performance.now() - inicio),
    resultado,
  })
}

export function listarImportadores(token: string): Promise<ImportadorResumen[]> {
  return solicitar('listar_importadores', '/api/importadores', token)
}

export function listarDespachos(token: string): Promise<Despacho[]> {
  return solicitar('listar_despachos', '/api/despachos', token)
}

export function obtenerDespacho(token: string, despachoId: string): Promise<Despacho> {
  return solicitar('consultar_despacho', `/api/despachos/${despachoId}`, token)
}

export function crearDespacho(token: string, datos: NuevoDespacho): Promise<Despacho> {
  return solicitar('crear_despacho', '/api/despachos', token, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function actualizarEstadoFondos(
  token: string,
  despachoId: string,
  versionEsperada: number,
  estadoFondos: EstadoFondos,
): Promise<Despacho> {
  return solicitar('actualizar_fondos', `/api/despachos/${despachoId}/fondos`, token, {
    method: 'PATCH',
    body: JSON.stringify({ versionEsperada, estadoFondos }),
  })
}

export function consultarHistorial(
  token: string,
  despachoId: string,
): Promise<HistorialDespacho[]> {
  return solicitar('consultar_historial', `/api/despachos/${despachoId}/historial`, token)
}

export function editarDespacho(
  token: string,
  despachoId: string,
  datos: { versionEsperada: number; referencia: string; monto: number; fechaLimite: string },
): Promise<Despacho> {
  return solicitar('editar_despacho', `/api/despachos/${despachoId}`, token, {
    method: 'PATCH', body: JSON.stringify(datos),
  })
}

export function anularDespacho(
  token: string,
  despachoId: string,
  versionEsperada: number,
  motivo: string,
): Promise<Despacho> {
  return solicitar('anular_despacho', `/api/despachos/${despachoId}/anulacion`, token, {
    method: 'POST', body: JSON.stringify({ versionEsperada, motivo, confirmado: true }),
  })
}
