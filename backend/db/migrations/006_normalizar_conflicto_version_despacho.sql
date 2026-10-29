begin;

-- 40001 representa un fallo de serializacion reintentable. El conflicto de
-- version es una decision de negocio definitiva, por lo que PostgREST debe
-- recibir un codigo PT409 y responder inmediatamente con HTTP 409.
create or replace function public.actualizar_despacho(
  p_despacho_id uuid,
  p_version_esperada integer,
  p_referencia text,
  p_monto numeric,
  p_fecha_limite date
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
  v_referencia text;
  v_cambios jsonb := '{}'::jsonb;
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
    raise exception using errcode = '42501', message = 'El usuario no puede actualizar despachos.';
  end if;

  if p_despacho_id is null then
    raise exception using errcode = '22023', message = 'El despacho es obligatorio.';
  end if;
  if p_version_esperada is null or p_version_esperada <= 0 then
    raise exception using errcode = '22023', message = 'La version esperada no es valida.';
  end if;

  v_referencia := btrim(p_referencia);
  if p_referencia is null or v_referencia = '' then
    raise exception using errcode = '22023', message = 'La referencia es obligatoria.';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception using errcode = '22023', message = 'El monto debe ser mayor que cero.';
  end if;
  if p_fecha_limite is null then
    raise exception using errcode = '22023', message = 'La fecha limite es obligatoria.';
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
  if v_despacho.version <> p_version_esperada then
    raise exception using errcode = 'PT409', message = 'El despacho fue modificado por otra operacion.';
  end if;

  if v_despacho.referencia is distinct from v_referencia then
    v_cambios := v_cambios || jsonb_build_object(
      'referencia', jsonb_build_object('anterior', v_despacho.referencia, 'nuevo', v_referencia)
    );
  end if;
  if v_despacho.monto is distinct from p_monto then
    v_cambios := v_cambios || jsonb_build_object(
      'monto', jsonb_build_object('anterior', v_despacho.monto, 'nuevo', p_monto)
    );
  end if;
  if v_despacho.fecha_limite is distinct from p_fecha_limite then
    v_cambios := v_cambios || jsonb_build_object(
      'fechaLimite', jsonb_build_object('anterior', v_despacho.fecha_limite, 'nuevo', p_fecha_limite)
    );
  end if;

  if v_cambios = '{}'::jsonb then
    return v_despacho;
  end if;

  update public.despachos
     set referencia = v_referencia,
         monto = p_monto,
         fecha_limite = p_fecha_limite,
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

revoke all on function public.actualizar_despacho(uuid, integer, text, numeric, date)
  from public, anon, authenticated;
grant execute on function public.actualizar_despacho(uuid, integer, text, numeric, date)
  to authenticated;

commit;
