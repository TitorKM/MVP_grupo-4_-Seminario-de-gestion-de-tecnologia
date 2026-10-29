export type Rol = 'despachante' | 'importador'

export type PerfilAutenticado = {
  usuarioId: string
  nombreVisible: string
  rol: Rol
  empresaDespachante: {
    id: string
    razonSocial: string
  }
  importador: {
    id: string
    razonSocial: string
  } | null
}

type ErrorApi = {
  error?: string
}

export class ErrorConsultaPerfil extends Error {
  constructor(
    mensaje: string,
    public readonly estadoHttp?: number,
    public readonly esFalloRed = false,
  ) {
    super(mensaje)
    this.name = 'ErrorConsultaPerfil'
  }
}

export async function consultarPerfil(token: string): Promise<PerfilAutenticado> {
  let response: Response
  try {
    response = await fetch('/api/autenticacion/perfil', {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ErrorConsultaPerfil(
      'No se pudo conectar con la API para validar el perfil.',
      undefined,
      true,
    )
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorApi
    throw new ErrorConsultaPerfil(
      body.error || 'No se pudo consultar el perfil.',
      response.status,
    )
  }

  return response.json() as Promise<PerfilAutenticado>
}
