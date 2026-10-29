begin;

create or replace function public.actualizar_estado_fondos(
  p_despacho_id uuid,
  p_version_esperada integer,
  p_estado_fondos text
)
returns public.despachos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_perfil public.perfiles%rowtype;
  v_despacho public.despachos%rowtype;
  v_cambios jsonb;
begin
  if v_usuario_id is null then
    raise exception using errcode = '28000', message = 'Se requiere una sesion autenticada.';
  end if;

  select p.*
    into v_perfil
    from public.perfiles as p
    join public.empresas_despachantes as e on e.id = p.empresa_despachante_id
    join public.importadores as i
      on i.id = p.importador_id
     and i.empresa_despachante_id = p.empresa_despachante_id
   where p.usuario_id = v_usuario_id
     and p.rol = 'importador'
     and p.activo
     and e.activa
     and i.activo;

  if not found then
    raise exception using errcode = '42501', message = 'El usuario no puede actualizar fondos.';
  end if;
  if p_despacho_id is null then
    raise exception using errcode = '22023', message = 'El despacho es obligatorio.';
  end if;
  if p_version_esperada is null or p_version_esperada <= 0 then
    raise exception using errcode = '22023', message = 'La version esperada no es valida.';
  end if;
  if p_estado_fondos is null
     or p_estado_fondos not in ('disponibles', 'no_disponibles', 'pendiente_confirmacion') then
    raise exception using errcode = '22023', message = 'El estado de fondos no es valido.';
  end if;

  select d.*
    into v_despacho
    from public.despachos as d
   where d.id = p_despacho_id
     and d.empresa_despachante_id = v_perfil.empresa_despachante_id
     and d.importador_id = v_perfil.importador_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Despacho no encontrado.';
  end if;
  if v_despacho.anulado_en is not null then
    raise exception using errcode = 'PT410', message = 'El despacho fue anulado.';
  end if;
  if v_despacho.version <> p_version_esperada then
    raise exception using errcode = 'PT409', message = 'El despacho fue modificado por otra operacion.';
  end if;

  if v_despacho.estado_fondos = p_estado_fondos then
    return v_despacho;
  end if;

  v_cambios := jsonb_build_object(
    'estadoFondos', jsonb_build_object(
      'anterior', v_despacho.estado_fondos,
      'nuevo', p_estado_fondos
    )
  );

  update public.despachos
     set estado_fondos = p_estado_fondos,
         version = version + 1,
         actualizado_por = v_usuario_id,
         actualizado_en = now()
   where id = v_despacho.id
  returning * into v_despacho;

  insert into public.historial_despachos (
    despacho_id, empresa_despachante_id, accion, modificado_por,
    version_resultante, cambios
  ) values (
    v_despacho.id, v_despacho.empresa_despachante_id, 'actualizado',
    v_usuario_id, v_despacho.version, v_cambios
  );

  return v_despacho;
end;
$$;

create or replace function public.anular_despacho(
  p_despacho_id uuid,
  p_version_esperada integer,
  p_motivo text
)
returns public.despachos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_perfil public.perfiles%rowtype;
  v_despacho public.despachos%rowtype;
  v_motivo text;
begin
  if v_usuario_id is null then
    raise exception using errcode = '28000', message = 'Se requiere una sesion autenticada.';
  end if;

  select p.*
    into v_perfil
    from public.perfiles as p
    join public.empresas_despachantes as e on e.id = p.empresa_despachante_id
   where p.usuario_id = v_usuario_id
     and p.rol = 'despachante'
     and p.activo
     and e.activa;

  if not found then
    raise exception using errcode = '42501', message = 'El usuario no puede anular despachos.';
  end if;

  v_motivo := btrim(p_motivo);
  if p_despacho_id is null then
    raise exception using errcode = '22023', message = 'El despacho es obligatorio.';
  end if;
  if p_version_esperada is null or p_version_esperada <= 0 then
    raise exception using errcode = '22023', message = 'La version esperada no es valida.';
  end if;
  if p_motivo is null or v_motivo = '' then
    raise exception using errcode = '22023', message = 'El motivo de anulacion es obligatorio.';
  end if;

  select d.*
    into v_despacho
    from public.despachos as d
   where d.id = p_despacho_id
     and d.empresa_despachante_id = v_perfil.empresa_despachante_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Despacho no encontrado.';
  end if;
  if v_despacho.anulado_en is not null then
    raise exception using errcode = 'PT410', message = 'El despacho ya esta anulado.';
  end if;
  if v_despacho.version <> p_version_esperada then
    raise exception using errcode = 'PT409', message = 'El despacho fue modificado por otra operacion.';
  end if;

  update public.despachos
     set anulado_en = now(),
         anulado_por = v_usuario_id,
         motivo_anulacion = v_motivo,
         version = version + 1,
         actualizado_por = v_usuario_id,
         actualizado_en = now()
   where id = v_despacho.id
  returning * into v_despacho;

  insert into public.historial_despachos (
    despacho_id, empresa_despachante_id, accion, modificado_por,
    version_resultante, cambios
  ) values (
    v_despacho.id, v_despacho.empresa_despachante_id, 'anulado', v_usuario_id,
    v_despacho.version,
    jsonb_build_object(
      'motivoAnulacion', jsonb_build_object('anterior', null, 'nuevo', v_motivo)
    )
  );

  return v_despacho;
end;
$$;

revoke all on function public.actualizar_estado_fondos(uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.anular_despacho(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.actualizar_estado_fondos(uuid, integer, text)
  to authenticated;
grant execute on function public.anular_despacho(uuid, integer, text)
  to authenticated;

commit;
