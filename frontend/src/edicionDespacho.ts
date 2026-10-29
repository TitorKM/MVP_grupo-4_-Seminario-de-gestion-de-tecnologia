export type ErrorEdicion = {
  tipo: 'conflicto' | 'red' | 'servicio' | 'validacion'
  mensaje: string
}

export function clasificarErrorEdicion(error: unknown): ErrorEdicion {
  const estadoHttp = error instanceof Error && 'estadoHttp' in error
    ? Number(error.estadoHttp)
    : undefined

  if (estadoHttp === 409) {
    return {
      tipo: 'conflicto',
      mensaje: 'Este despacho cambió desde que abriste el editor. Tus valores no se sobrescribieron.',
    }
  }
  if (error instanceof Error && error.name === 'ErrorRedApi') {
    return { tipo: 'red', mensaje: 'No se pudo conectar con la API. Revisá la conexión e intentá nuevamente.' }
  }
  if (estadoHttp !== undefined && estadoHttp >= 500) {
    return { tipo: 'servicio', mensaje: 'El servicio no pudo completar la edición. Intentá nuevamente más tarde.' }
  }
  return {
    tipo: 'validacion',
    mensaje: error instanceof Error ? error.message : 'No se pudo completar la edición.',
  }
}
