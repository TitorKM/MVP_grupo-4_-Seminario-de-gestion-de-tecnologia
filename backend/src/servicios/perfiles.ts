import type { ObtenerPerfil, PerfilAutenticado, Rol } from '../tipos/autenticacion.js'
import { crearClienteUsuario } from '../supabase/clientes.js'

type FilaPerfil = {
  usuario_id: string
  empresa_despachante_id: string
  nombre_visible: string
  rol: string
  importador_id: string | null
  empresa_despachante: FilaEmpresa | FilaEmpresa[] | null
  importador: FilaImportador | FilaImportador[] | null
}

type FilaEmpresa = {
  id: string
  razon_social: string
}

type FilaImportador = {
  id: string
  razon_social: string
}

function esRol(valor: string): valor is Rol {
  return valor === 'despachante' || valor === 'importador'
}

function relacionUnica<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

export function crearServicioPerfiles(
  supabaseUrl: string,
  clavePublicable: string,
): ObtenerPerfil {
  return async (usuarioId, token) => {
    const cliente = crearClienteUsuario(supabaseUrl, clavePublicable, token)

    const { data: perfil, error: errorPerfil } = await cliente
      .from('perfiles')
      .select(`
        usuario_id,
        empresa_despachante_id,
        nombre_visible,
        rol,
        importador_id,
        empresa_despachante:empresas_despachantes!perfiles_empresa_fk(id, razon_social),
        importador:importadores!perfiles_importador_empresa_fk(id, razon_social)
      `)
      .eq('usuario_id', usuarioId)
      .maybeSingle<FilaPerfil>()

    if (errorPerfil) {
      throw errorPerfil
    }

    if (!perfil || !esRol(perfil.rol)) {
      return null
    }

    const empresa = relacionUnica(perfil.empresa_despachante)
    if (!empresa) {
      return null
    }

    let importador: PerfilAutenticado['importador'] = null

    if (perfil.rol === 'importador') {
      if (!perfil.importador_id) {
        return null
      }

      const filaImportador = relacionUnica(perfil.importador)
      if (!filaImportador) {
        return null
      }

      importador = {
        id: filaImportador.id,
        razonSocial: filaImportador.razon_social,
      }
    }

    return {
      usuarioId: perfil.usuario_id,
      nombreVisible: perfil.nombre_visible,
      rol: perfil.rol,
      empresaDespachante: {
        id: empresa.id,
        razonSocial: empresa.razon_social,
      },
      importador,
    }
  }
}
