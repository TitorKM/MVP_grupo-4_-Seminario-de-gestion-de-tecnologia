import { crearClienteUsuario } from '../supabase/clientes.js'
import {
  ErrorOperacion,
  type CambioHistorial,
  type Despacho,
  type EstadoFondos,
  type HistorialDespacho,
  type ServicioDespachos,
} from '../tipos/despachos.js'

type ErrorSupabase = {
  code?: string
  status?: number
}

type FilaImportador = {
  id: string
  razon_social: string
}

type FilaDespacho = {
  id: string
  importador_id: string
  referencia: string
  monto: number | string
  fecha_limite: string
  estado_fondos: string
  version: number
  actualizado_en: string
  anulado_en: string | null
  anulado_por: string | null
  motivo_anulacion: string | null
  importador: FilaImportador | FilaImportador[] | null
}

type FilaHistorial = {
  id: number | string
  accion: 'creado' | 'actualizado' | 'anulado'
  modificado_por: string
  nombre_visible: string
  version_resultante: number
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>
  modificado_en: string
}

const estadosFondos = new Set<EstadoFondos>([
  'disponibles',
  'no_disponibles',
  'pendiente_confirmacion',
])

const seleccionDespacho = `
  id,
  importador_id,
  referencia,
  monto,
  fecha_limite,
  estado_fondos,
  version,
  actualizado_en,
  anulado_en,
  anulado_por,
  motivo_anulacion,
  importador:importadores!despachos_importador_empresa_fk(id, razon_social)
`

export function convertirErrorSupabase(error: ErrorSupabase): ErrorOperacion {
  if (error.code === 'PT409' || error.code === '40001') {
    return new ErrorOperacion(
      409,
      'El despacho fue modificado por otra persona. Actualizá la información e intentá nuevamente.',
      error.code,
    )
  }

  if (error.code === 'PT410' || error.code === '55000') {
    return new ErrorOperacion(410, 'El despacho está anulado y no admite modificaciones.', error.code)
  }

  if (error.code === '23505') {
    return new ErrorOperacion(409, 'Ya existe un despacho con esa referencia.', error.code)
  }

  if (error.code === '42501') {
    return new ErrorOperacion(403, 'No tenés permiso para realizar esta operación.', error.code)
  }

  if (error.code === 'P0002') {
    return new ErrorOperacion(404, 'No se encontró el despacho solicitado.', error.code)
  }

  if (error.code === '22023' || error.code === '22008' || error.code === '22P02') {
    return new ErrorOperacion(400, 'Los datos enviados no son válidos.', error.code)
  }

  return new ErrorOperacion(500, 'No se pudo completar la solicitud.', error.code)
}

function comprobarError(error: ErrorSupabase | null): void {
  if (error) {
    throw convertirErrorSupabase(error)
  }
}

function esEstadoFondos(valor: string): valor is EstadoFondos {
  return estadosFondos.has(valor as EstadoFondos)
}

function primeraFila<T>(datos: T | T[] | null): T {
  const fila = Array.isArray(datos) ? datos[0] : datos

  if (!fila) {
    throw new ErrorOperacion(500, 'Supabase no devolvió la operación guardada.')
  }

  return fila
}

function relacionUnica<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

function convertirDespacho(fila: FilaDespacho): Despacho {
  const importador = relacionUnica(fila.importador)

  if (!importador || !esEstadoFondos(fila.estado_fondos)) {
    throw new ErrorOperacion(500, 'La operación guardada tiene datos inconsistentes.')
  }

  return {
    id: fila.id,
    referencia: fila.referencia,
    importador: {
      id: importador.id,
      razonSocial: importador.razon_social,
    },
    monto: Number(fila.monto),
    fechaLimite: fila.fecha_limite,
    estadoFondos: fila.estado_fondos,
    version: fila.version,
    actualizadoEn: fila.actualizado_en,
    anuladoEn: fila.anulado_en,
    anuladoPor: fila.anulado_por,
    motivoAnulacion: fila.motivo_anulacion,
  }
}

function convertirCambios(
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>,
): CambioHistorial[] {
  return Object.entries(cambios).map(([campo, valores]) => ({
    campo,
    anterior: valores?.anterior ?? null,
    nuevo: valores?.nuevo ?? null,
  }))
}

export function crearServicioDespachos(
  supabaseUrl: string,
  clavePublicable: string,
): ServicioDespachos {
  function cliente(token: string) {
    return crearClienteUsuario(supabaseUrl, clavePublicable, token)
  }

  async function cargarImportadores(token: string, soloActivos: boolean) {
    let consulta = cliente(token)
      .from('importadores')
      .select('id, razon_social')
      .order('razon_social')

    if (soloActivos) {
      consulta = consulta.eq('activo', true)
    }

    const { data, error } = await consulta
    comprobarError(error)

    return ((data ?? []) as FilaImportador[]).map((fila) => ({
      id: fila.id,
      razonSocial: fila.razon_social,
    }))
  }

  function convertirResultadoDespacho(data: FilaDespacho | FilaDespacho[] | null) {
    return convertirDespacho(primeraFila(data))
  }

  return {
    listarImportadores: (token) => cargarImportadores(token, true),

    async listarDespachos(token) {
      const { data, error } = await cliente(token)
        .from('despachos')
        .select(seleccionDespacho)
        .order('fecha_limite')

      comprobarError(error)
      return ((data ?? []) as unknown as FilaDespacho[]).map(convertirDespacho)
    },

    async obtenerDespacho(token, despachoId) {
      const { data, error } = await cliente(token)
        .from('despachos')
        .select(seleccionDespacho)
        .eq('id', despachoId)
        .maybeSingle()

      comprobarError(error)
      if (!data) throw new ErrorOperacion(404, 'No se encontró el despacho solicitado.')
      return convertirDespacho(data as unknown as FilaDespacho)
    },

    async crearDespacho(token, datos) {
      const { data, error } = await cliente(token)
        .rpc('crear_despacho', {
          p_referencia: datos.referencia,
          p_importador_id: datos.importadorId,
          p_monto: datos.monto,
          p_fecha_limite: datos.fechaLimite,
        })
        .select(seleccionDespacho)

      comprobarError(error)
      return convertirResultadoDespacho(data as unknown as FilaDespacho | FilaDespacho[] | null)
    },

    async actualizarFondos(token, despachoId, datos) {
      const { data, error } = await cliente(token)
        .rpc('actualizar_estado_fondos', {
          p_despacho_id: despachoId,
          p_version_esperada: datos.versionEsperada,
          p_estado_fondos: datos.estadoFondos,
        })
        .select(seleccionDespacho)

      comprobarError(error)
      return convertirResultadoDespacho(data as unknown as FilaDespacho | FilaDespacho[] | null)
    },

    async editarDespacho(token, despachoId, datos) {
      const { data, error } = await cliente(token)
        .rpc('actualizar_despacho', {
          p_despacho_id: despachoId,
          p_version_esperada: datos.versionEsperada,
          p_referencia: datos.referencia,
          p_monto: datos.monto,
          p_fecha_limite: datos.fechaLimite,
        })
        .select(seleccionDespacho)

      comprobarError(error)
      return convertirResultadoDespacho(data as unknown as FilaDespacho | FilaDespacho[] | null)
    },

    async anularDespacho(token, despachoId, datos) {
      const { data, error } = await cliente(token)
        .rpc('anular_despacho', {
          p_despacho_id: despachoId,
          p_version_esperada: datos.versionEsperada,
          p_motivo: datos.motivo,
        })
        .select(seleccionDespacho)

      comprobarError(error)
      return convertirResultadoDespacho(data as unknown as FilaDespacho | FilaDespacho[] | null)
    },

    async obtenerHistorial(token, despachoId) {
      const { data, error } = await cliente(token).rpc('consultar_historial_despacho', {
        p_despacho_id: despachoId,
      })

      comprobarError(error)

      return ((data ?? []) as FilaHistorial[]).map(
        (fila): HistorialDespacho => ({
          id: String(fila.id),
          accion: fila.accion,
          autor: {
            usuarioId: fila.modificado_por,
            nombreVisible: fila.nombre_visible,
          },
          versionResultante: fila.version_resultante,
          cambios: convertirCambios(fila.cambios),
          modificadoEn: fila.modificado_en,
        }),
      )
    },
  }
}
