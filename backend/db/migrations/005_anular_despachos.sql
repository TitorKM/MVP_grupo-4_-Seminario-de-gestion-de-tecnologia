begin;

alter table public.despachos
  add column anulado_en timestamptz,
  add column anulado_por uuid references auth.users(id) on delete restrict,
  add column motivo_anulacion text,
  add constraint despachos_anulacion_completa_ck check (
    (anulado_en is null and anulado_por is null and motivo_anulacion is null)
    or
    (anulado_en is not null and anulado_por is not null
      and motivo_anulacion is not null and btrim(motivo_anulacion) <> '')
  );

alter table public.historial_despachos
  drop constraint historial_despachos_accion_check,
  add constraint historial_despachos_accion_check
    check (accion in ('creado', 'actualizado', 'anulado'));

create or replace function private.impedir_modificacion_despacho_anulado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.anulado_en is not null then
    raise exception using
      errcode = '55000',
      message = 'El despacho anulado no admite modificaciones.';
  end if;

  return new;
end;
$$;

revoke all on function private.impedir_modificacion_despacho_anulado()
  from public, anon, authenticated, service_role;

create trigger despachos_anulados_inmutables
before update on public.despachos
for each row
execute function private.impedir_modificacion_despacho_anulado();

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
    join public.empresas_despachantes as e
      on e.id = p.empresa_despachante_id
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
    raise exception using errcode = '55000', message = 'El despacho ya esta anulado.';
  end if;

  if v_despacho.version <> p_version_esperada then
    raise exception using errcode = '40001', message = 'El despacho fue modificado por otra operacion.';
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

revoke all on function public.anular_despacho(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.anular_despacho(uuid, integer, text)
  to authenticated;

commit;
