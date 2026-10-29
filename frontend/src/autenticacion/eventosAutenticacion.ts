export type AccionEventoAutenticacion =
  | 'cerrar_sesion'
  | 'actualizar_sesion'
  | 'validar_perfil'

export function accionParaEvento(
  evento: string,
  usuarioIdNuevo: string | null,
  usuarioIdActual: string | null,
  tienePerfilValidado: boolean,
): AccionEventoAutenticacion {
  if (!usuarioIdNuevo) return 'cerrar_sesion'

  const mismaIdentidad = usuarioIdActual === usuarioIdNuevo
  if (
    mismaIdentidad &&
    tienePerfilValidado &&
    evento === 'TOKEN_REFRESHED'
  ) {
    return 'actualizar_sesion'
  }

  return 'validar_perfil'
}
