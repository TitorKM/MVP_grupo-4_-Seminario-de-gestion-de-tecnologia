begin;

create table public.empresas_despachantes (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null check (btrim(razon_social) <> ''),
  activa boolean not null default true,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

create table public.importadores (
  id uuid primary key default gen_random_uuid(),
  empresa_despachante_id uuid not null,
  razon_social text not null check (btrim(razon_social) <> ''),
  correo_contacto text not null check (btrim(correo_contacto) <> ''),
  activo boolean not null default true,
  creado_por uuid not null references auth.users(id) on delete restrict,
  actualizado_por uuid not null references auth.users(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint importadores_empresa_fk
    foreign key (empresa_despachante_id)
    references public.empresas_despachantes(id)
    on delete restrict,
  constraint importadores_id_empresa_uk
    unique (id, empresa_despachante_id)
);

create table public.perfiles (
  usuario_id uuid primary key references auth.users(id) on delete restrict,
  empresa_despachante_id uuid not null,
  nombre_visible text not null check (btrim(nombre_visible) <> ''),
  rol text not null check (rol in ('despachante', 'importador')),
  importador_id uuid,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint perfiles_empresa_fk
    foreign key (empresa_despachante_id)
    references public.empresas_despachantes(id)
    on delete restrict,
  constraint perfiles_importador_empresa_fk
    foreign key (importador_id, empresa_despachante_id)
    references public.importadores(id, empresa_despachante_id)
    on delete restrict,
  constraint perfiles_rol_importador_ck check (
    (rol = 'despachante' and importador_id is null)
    or
    (rol = 'importador' and importador_id is not null)
  ),
  constraint perfiles_usuario_empresa_uk
    unique (usuario_id, empresa_despachante_id)
);

create unique index perfiles_una_cuenta_despachante_por_empresa_idx
  on public.perfiles (empresa_despachante_id)
  where rol = 'despachante';

create unique index perfiles_una_cuenta_por_importador_idx
  on public.perfiles (importador_id)
  where rol = 'importador';

create table public.despachos (
  id uuid primary key default gen_random_uuid(),
  empresa_despachante_id uuid not null,
  importador_id uuid not null,
  referencia text not null check (btrim(referencia) <> ''),
  monto numeric(14, 2) not null check (monto > 0),
  fecha_limite date not null,
  estado_fondos text not null default 'pendiente_confirmacion'
    check (estado_fondos in ('disponibles', 'no_disponibles', 'pendiente_confirmacion')),
  version integer not null default 1 check (version > 0),
  creado_por uuid not null references auth.users(id) on delete restrict,
  actualizado_por uuid not null references auth.users(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint despachos_empresa_fk
    foreign key (empresa_despachante_id)
    references public.empresas_despachantes(id)
    on delete restrict,
  constraint despachos_importador_empresa_fk
    foreign key (importador_id, empresa_despachante_id)
    references public.importadores(id, empresa_despachante_id)
    on delete restrict,
  constraint despachos_referencia_empresa_uk
    unique (empresa_despachante_id, referencia),
  constraint despachos_id_empresa_uk
    unique (id, empresa_despachante_id)
);

create table public.historial_despachos (
  id bigint generated always as identity primary key,
  despacho_id uuid not null,
  empresa_despachante_id uuid not null,
  accion text not null check (accion in ('creado', 'actualizado')),
  modificado_por uuid not null references auth.users(id) on delete restrict,
  version_resultante integer not null check (version_resultante > 0),
  cambios jsonb not null check (
    jsonb_typeof(cambios) = 'object'
    and cambios <> '{}'::jsonb
  ),
  modificado_en timestamptz not null default now(),
  constraint historial_despachos_despacho_empresa_fk
    foreign key (despacho_id, empresa_despachante_id)
    references public.despachos(id, empresa_despachante_id)
    on delete restrict
);

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_despachante_id uuid not null,
  destinatario_id uuid not null,
  despacho_id uuid,
  tipo text not null check (btrim(tipo) <> ''),
  mensaje text not null check (btrim(mensaje) <> ''),
  creada_en timestamptz not null default now(),
  leida_en timestamptz,
  constraint notificaciones_destinatario_empresa_fk
    foreign key (destinatario_id, empresa_despachante_id)
    references public.perfiles(usuario_id, empresa_despachante_id)
    on delete restrict,
  constraint notificaciones_despacho_empresa_fk
    foreign key (despacho_id, empresa_despachante_id)
    references public.despachos(id, empresa_despachante_id)
    on delete restrict,
  constraint notificaciones_lectura_ck
    check (leida_en is null or leida_en >= creada_en)
);

create index perfiles_importador_idx
  on public.perfiles (importador_id)
  where importador_id is not null;

create index importadores_empresa_activos_idx
  on public.importadores (empresa_despachante_id)
  where activo;

create index despachos_empresa_fecha_idx
  on public.despachos (empresa_despachante_id, fecha_limite);

create index despachos_importador_fecha_idx
  on public.despachos (importador_id, fecha_limite);

create index despachos_estado_fondos_idx
  on public.despachos (estado_fondos);

create index historial_despachos_despacho_fecha_idx
  on public.historial_despachos (despacho_id, modificado_en desc);

create index notificaciones_destinatario_fecha_idx
  on public.notificaciones (destinatario_id, creada_en desc);

create index notificaciones_destinatario_no_leidas_idx
  on public.notificaciones (destinatario_id, creada_en desc)
  where leida_en is null;

commit;
