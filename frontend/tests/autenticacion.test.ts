import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { accionParaEvento } from '../src/autenticacion/eventosAutenticacion.ts'

describe('eventos de autenticación', () => {
  it('valida el perfil al restaurar la sesión inicial', () => {
    assert.equal(accionParaEvento('INITIAL_SESSION', 'usuario-1', null, false), 'validar_perfil')
  })

  it('actualiza el token en segundo plano sin revalidar un perfil vigente', () => {
    assert.equal(accionParaEvento('TOKEN_REFRESHED', 'usuario-1', 'usuario-1', true), 'actualizar_sesion')
  })

  it('no reutiliza el perfil para otra identidad', () => {
    assert.equal(accionParaEvento('SIGNED_IN', 'usuario-2', 'usuario-1', true), 'validar_perfil')
  })

  it('revalida permisos en segundo plano ante un nuevo evento de ingreso', () => {
    assert.equal(accionParaEvento('SIGNED_IN', 'usuario-1', 'usuario-1', true), 'validar_perfil')
  })

  it('cierra el estado local cuando Supabase informa una sesión ausente', () => {
    assert.equal(accionParaEvento('SIGNED_OUT', null, 'usuario-1', true), 'cerrar_sesion')
  })
})
