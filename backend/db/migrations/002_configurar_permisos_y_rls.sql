begin;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

alter default privileges for role postgres
  revoke execute on functions from public;

revoke all on table
  public.empresas_despachantes,
  public.perfiles,
  public.importadores,
  public.despachos,
  public.historial_despachos,
  public.notificaciones
from anon, authenticated, service_role;

grant usage on schema public to authenticated, service_role;

grant select on table
  public.empresas_despachantes,
  public.perfiles,
  public.importadores,
  public.despachos,
  public.historial_despachos,
  public.notificaciones
to authenticated;

grant all on table
  public.empresas_despachantes,
  public.perfiles,
  public.importadores,
  public.despachos,
  public.historial_despachos,
  public.notificaciones
to service_role;

grant usage, select on sequence public.historial_despachos_id_seq
  to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create or replace function private.perfil_sesion_activa()
returns table (
  usuario_id uuid,
  empresa_despachante_id uuid,
  rol text,
  importador_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.usuario_id,
    p.empresa_despachante_id,
    p.rol,
    p.importador_id
  from public.perfiles as p
  join public.empresas_despachantes as e
    on e.id = p.empresa_despachante_id
  where p.usuario_id = auth.uid()
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
$$;

revoke all on function private.perfil_sesion_activa()
  from public, anon, authenticated, service_role;
grant execute on function private.perfil_sesion_activa()
  to authenticated;

alter table public.empresas_despachantes enable row level security;
alter table public.perfiles enable row level security;
alter table public.importadores enable row level security;
alter table public.despachos enable row level security;
alter table public.historial_despachos enable row level security;
alter table public.notificaciones enable row level security;

create policy empresas_despachantes_consultar_empresa_propia
  on public.empresas_despachantes
  for select
  to authenticated
  using (
    exists (
      select 1
      from private.perfil_sesion_activa() as s
      where s.empresa_despachante_id = empresas_despachantes.id
    )
  );

create policy perfiles_consultar_perfil_propio
  on public.perfiles
  for select
  to authenticated
  using (
    usuario_id = (select auth.uid())
    and exists (
      select 1
      from private.perfil_sesion_activa() as s
      where s.usuario_id = perfiles.usuario_id
    )
  );

create policy importadores_consultar_cartera_autorizada
  on public.importadores
  for select
  to authenticated
  using (
    exists (
      select 1
      from private.perfil_sesion_activa() as s
      where s.empresa_despachante_id = importadores.empresa_despachante_id
        and (
          s.rol = 'despachante'
          or (
            s.rol = 'importador'
            and s.importador_id = importadores.id
          )
        )
    )
  );

create policy despachos_consultar_cartera_autorizada
  on public.despachos
  for select
  to authenticated
  using (
    exists (
      select 1
      from private.perfil_sesion_activa() as s
      where s.empresa_despachante_id = despachos.empresa_despachante_id
        and (
          s.rol = 'despachante'
          or (
            s.rol = 'importador'
            and s.importador_id = despachos.importador_id
          )
        )
    )
  );

create policy historial_despachos_consultar_empresa_despachante
  on public.historial_despachos
  for select
  to authenticated
  using (
    exists (
      select 1
      from private.perfil_sesion_activa() as s
      where s.empresa_despachante_id = historial_despachos.empresa_despachante_id
        and s.rol = 'despachante'
    )
  );

create policy notificaciones_consultar_notificaciones_propias
  on public.notificaciones
  for select
  to authenticated
  using (
    destinatario_id = (select auth.uid())
    and exists (
      select 1
      from private.perfil_sesion_activa() as s
      where s.usuario_id = notificaciones.destinatario_id
        and s.empresa_despachante_id = notificaciones.empresa_despachante_id
    )
  );

commit;
