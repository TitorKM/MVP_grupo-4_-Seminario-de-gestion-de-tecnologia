export type TipoErrorFondos = 'version' | 'anulado' | 'red' | 'servicio' | 'otro'

export function clasificarErrorFondos(error: unknown): {
  tipo: TipoErrorFondos
  mensaje: string
} {
  const estadoHttp = error instanceof Error && 'estadoHttp' in error
    ? Number(error.estadoHttp)
    : undefined

  if (estadoHttp === 409) {
    return {
      tipo: 'version',
      mensaje: 'El despacho cambió. Actualizá sus datos antes de cambiar los fondos.',
    }
  }
  if (estadoHttp === 410) {
    return {
      tipo: 'anulado',
      mensaje: 'El despacho fue anulado y ya no admite cambios de fondos.',
    }
  }
  if (error instanceof Error && error.name === 'ErrorRedApi') {
    return {
      tipo: 'red',
      mensaje: 'No se pudo conectar con la API. Revisá la conexión e intentá nuevamente.',
    }
  }
  if (estadoHttp !== undefined && estadoHttp >= 500) {
    return {
      tipo: 'servicio',
      mensaje: 'El servicio no pudo actualizar los fondos. Intentá nuevamente más tarde.',
    }
  }
  return {
    tipo: 'otro',
    mensaje: error instanceof Error ? error.message : 'No se pudo actualizar el estado de fondos.',
  }
}

export async function ejecutarConIndicador<T>(
  operacion: () => Promise<T>,
  cambiarIndicador: (activo: boolean) => void,
): Promise<T> {
  cambiarIndicador(true)
  try {
    return await operacion()
  } finally {
    cambiarIndicador(false)
  }
}
