begin;

create or replace function private.impedir_cambio_importador_despacho()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.importador_id is distinct from old.importador_id then
    raise exception using
      errcode = '23514',
      message = 'El importador de un despacho no se puede modificar.';
  end if;

  return new;
end;
$$;

revoke all on function private.impedir_cambio_importador_despacho()
  from public, anon, authenticated, service_role;

create trigger despachos_importador_inmutable
before update of importador_id on public.despachos
for each row
execute function private.impedir_cambio_importador_despacho();

create or replace function public.crear_importador(
  p_razon_social text,
  p_correo_contacto text
)
returns public.importadores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_perfil public.perfiles%rowtype;
  v_importador public.importadores%rowtype;
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
    raise exception using errcode = '42501', message = 'El usuario no puede crear importadores.';
  end if;

  if p_razon_social is null or btrim(p_razon_social) = '' then
    raise exception using errcode = '22023', message = 'La razon social es obligatoria.';
  end if;

  if p_correo_contacto is null or btrim(p_correo_contacto) = '' then
    raise exception using errcode = '22023', message = 'El correo de contacto es obligatorio.';
  end if;

  insert into public.importadores (
    empresa_despachante_id,
    razon_social,
    correo_contacto,
    creado_por,
    actualizado_por
  )
  values (
    v_perfil.empresa_despachante_id,
    btrim(p_razon_social),
    lower(btrim(p_correo_contacto)),
    v_usuario_id,
    v_usuario_id
  )
  returning * into v_importador;

  return v_importador;
end;
$$;

create or replace function public.crear_despacho(
  p_referencia text,
  p_importador_id uuid,
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
    raise exception using errcode = '42501', message = 'El usuario no puede crear despachos.';
  end if;

  if p_referencia is null or btrim(p_referencia) = '' then
    raise exception using errcode = '22023', message = 'La referencia es obligatoria.';
  end if;

  if p_importador_id is null then
    raise exception using errcode = '22023', message = 'El importador es obligatorio.';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception using errcode = '22023', message = 'El monto debe ser mayor que cero.';
  end if;

  if p_fecha_limite is null then
    raise exception using errcode = '22023', message = 'La fecha limite es obligatoria.';
  end if;

  perform 1
    from public.importadores as i
   where i.id = p_importador_id
     and i.empresa_despachante_id = v_perfil.empresa_despachante_id
     and i.activo;

  if not found then
    raise exception using errcode = '42501', message = 'El importador no pertenece a la empresa autorizada.';
  end if;

  insert into public.despachos (
    empresa_despachante_id,
    importador_id,
    referencia,
    monto,
    fecha_limite,
    estado_fondos,
    version,
    creado_por,
    actualizado_por
  )
  values (
    v_perfil.empresa_despachante_id,
    p_importador_id,
    btrim(p_referencia),
    p_monto,
    p_fecha_limite,
    'pendiente_confirmacion',
    1,
    v_usuario_id,
    v_usuario_id
  )
  returning * into v_despacho;

  insert into public.historial_despachos (
    despacho_id,
    empresa_despachante_id,
    accion,
    modificado_por,
    version_resultante,
    cambios
  )
  values (
    v_despacho.id,
    v_despacho.empresa_despachante_id,
    'creado',
    v_usuario_id,
    v_despacho.version,
    jsonb_build_object(
      'referencia', jsonb_build_object('anterior', null, 'nuevo', v_despacho.referencia),
      'importadorId', jsonb_build_object('anterior', null, 'nuevo', v_despacho.importador_id),
      'monto', jsonb_build_object('anterior', null, 'nuevo', v_despacho.monto),
      'fechaLimite', jsonb_build_object('anterior', null, 'nuevo', v_despacho.fecha_limite),
      'estadoFondos', jsonb_build_object('anterior', null, 'nuevo', v_despacho.estado_fondos)
    )
  );

  return v_despacho;
end;
$$;

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
    join public.empresas_despachantes as e
      on e.id = p.empresa_despachante_id
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
    raise exception using errcode = '40001', message = 'El despacho fue modificado por otra operacion.';
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
    despacho_id,
    empresa_despachante_id,
    accion,
    modificado_por,
    version_resultante,
    cambios
  )
  values (
    v_despacho.id,
    v_despacho.empresa_despachante_id,
    'actualizado',
    v_usuario_id,
    v_despacho.version,
    v_cambios
  );

  return v_despacho;
end;
$$;

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
    join public.empresas_despachantes as e
      on e.id = p.empresa_despachante_id
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

  if v_despacho.version <> p_version_esperada then
    raise exception using errcode = '40001', message = 'El despacho fue modificado por otra operacion.';
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
    despacho_id,
    empresa_despachante_id,
    accion,
    modificado_por,
    version_resultante,
    cambios
  )
  values (
    v_despacho.id,
    v_despacho.empresa_despachante_id,
    'actualizado',
    v_usuario_id,
    v_despacho.version,
    v_cambios
  );

  return v_despacho;
end;
$$;

create or replace function public.marcar_notificacion_leida(
  p_notificacion_id uuid
)
returns public.notificaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_notificacion public.notificaciones%rowtype;
begin
  if v_usuario_id is null then
    raise exception using errcode = '28000', message = 'Se requiere una sesion autenticada.';
  end if;

  perform 1
    from public.perfiles as p
    join public.empresas_despachantes as e
      on e.id = p.empresa_despachante_id
   where p.usuario_id = v_usuario_id
     and p.activo
     and e.activa
     and (
       p.rol = 'despachante'
       or (
         p.rol = 'importador'
         and exists (
           select 1
           from public.importadores as i
           where i.id = p.importador_id
             and i.empresa_despachante_id = p.empresa_despachante_id
             and i.activo
         )
       )
     );

  if not found then
    raise exception using errcode = '42501', message = 'El usuario no puede actualizar notificaciones.';
  end if;

  select n.*
    into v_notificacion
    from public.notificaciones as n
   where n.id = p_notificacion_id
     and n.destinatario_id = v_usuario_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Notificacion no encontrada.';
  end if;

  if v_notificacion.leida_en is not null then
    return v_notificacion;
  end if;

  update public.notificaciones
     set leida_en = now()
   where id = v_notificacion.id
  returning * into v_notificacion;

  return v_notificacion;
end;
$$;

revoke all on function public.crear_importador(text, text)
  from public, anon, authenticated;
revoke all on function public.crear_despacho(text, uuid, numeric, date)
  from public, anon, authenticated;
revoke all on function public.actualizar_despacho(uuid, integer, text, numeric, date)
  from public, anon, authenticated;
revoke all on function public.actualizar_estado_fondos(uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.marcar_notificacion_leida(uuid)
  from public, anon, authenticated;

grant execute on function public.crear_importador(text, text)
  to authenticated;
grant execute on function public.crear_despacho(text, uuid, numeric, date)
  to authenticated;
grant execute on function public.actualizar_despacho(uuid, integer, text, numeric, date)
  to authenticated;
grant execute on function public.actualizar_estado_fondos(uuid, integer, text)
  to authenticated;
grant execute on function public.marcar_notificacion_leida(uuid)
  to authenticated;

commit;
