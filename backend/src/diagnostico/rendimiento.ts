type ErrorTecnico = {
  code?: unknown
  codigoTecnico?: unknown
  estadoHttp?: unknown
  status?: unknown
}

function diagnosticoActivo(): boolean {
  return process.env.DIAGNOSTICO_RENDIMIENTO === 'true'
}

function codigoSeguro(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const detalle = error as ErrorTecnico
  const codigo = detalle.codigoTecnico ?? detalle.code
  return typeof codigo === 'string' && /^[A-Z0-9_]+$/i.test(codigo) ? codigo : undefined
}

function estadoSeguro(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const detalle = error as ErrorTecnico
  const estado = detalle.estadoHttp ?? detalle.status
  return typeof estado === 'number' && estado >= 100 && estado <= 599 ? estado : undefined
}

export async function medirEtapa<T>(
  operacion: string,
  etapa: 'autenticacion' | 'perfil_permisos' | 'supabase',
  accion: () => Promise<T>,
): Promise<T> {
  if (!diagnosticoActivo()) return accion()

  const inicio = performance.now()
  try {
    const resultado = await accion()
    console.info('Rendimiento API:', {
      operacion,
      etapa,
      duracionMs: Math.round(performance.now() - inicio),
      resultado: 'correcto',
    })
    return resultado
  } catch (error) {
    console.info('Rendimiento API:', {
      operacion,
      etapa,
      duracionMs: Math.round(performance.now() - inicio),
      resultado: 'error',
      ...(estadoSeguro(error) ? { estadoHttp: estadoSeguro(error) } : {}),
      ...(codigoSeguro(error) ? { codigo: codigoSeguro(error) } : {}),
    })
    throw error
  }
}
