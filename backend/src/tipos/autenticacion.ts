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

export type SesionValidada = {
  usuarioId: string
  token: string
}

export type CategoriaFalloValidacion =
  | 'sesion_invalida'
  | 'fallo_red'
  | 'fallo_supabase'

export class ErrorValidacionToken extends Error {
  constructor(
    public readonly categoria: CategoriaFalloValidacion,
    public readonly nombreOriginal?: string,
    public readonly codigo?: string,
    public readonly estadoHttp?: number,
  ) {
    super('No se pudo validar la sesion.')
    this.name = 'ErrorValidacionToken'
  }
}

export type ValidarToken = (token: string) => Promise<string>

export type ObtenerPerfil = (
  usuarioId: string,
  token: string,
) => Promise<PerfilAutenticado | null>
