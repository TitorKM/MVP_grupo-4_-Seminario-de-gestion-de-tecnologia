begin;

create or replace function public.consultar_historial_despacho(
  p_despacho_id uuid
)
returns table (
  id bigint,
  despacho_id uuid,
  accion text,
  modificado_por uuid,
  nombre_visible text,
  version_resultante integer,
  cambios jsonb,
  modificado_en timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_empresa_despachante_id uuid;
begin
  if v_usuario_id is null then
    raise exception using errcode = '28000', message = 'Se requiere una sesion autenticada.';
  end if;

  select p.empresa_despachante_id
    into v_empresa_despachante_id
    from public.perfiles as p
    join public.empresas_despachantes as e
      on e.id = p.empresa_despachante_id
    join public.despachos as d
      on d.empresa_despachante_id = p.empresa_despachante_id
     and d.id = p_despacho_id
   where p.usuario_id = v_usuario_id
     and p.rol = 'despachante'
     and p.activo
     and e.activa;

  if not found then
    raise exception using errcode = '42501', message = 'El usuario no puede consultar este historial.';
  end if;

  return query
    select
      h.id,
      h.despacho_id,
      h.accion,
      h.modificado_por,
      p.nombre_visible,
      h.version_resultante,
      h.cambios,
      h.modificado_en
    from public.historial_despachos as h
    join public.perfiles as p
      on p.usuario_id = h.modificado_por
     and p.empresa_despachante_id = h.empresa_despachante_id
    where h.despacho_id = p_despacho_id
      and h.empresa_despachante_id = v_empresa_despachante_id
    order by h.modificado_en desc, h.id desc;
end;
$$;

revoke all on function public.consultar_historial_despacho(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.consultar_historial_despacho(uuid)
  to authenticated;

commit;
