-- Fuerza un error al insertar el historial y comprueba el rollback del despacho.
-- Requiere la cuenta despachante.yad@anticipa.test sin perfil previo.

begin;

do $$
begin
  if not exists (
    select 1 from auth.users where email = 'despachante.yad@anticipa.test'
  ) then
    raise exception 'Falta la cuenta Auth despachante.yad@anticipa.test.';
  end if;

  if exists (
    select 1
    from public.perfiles as p
    join auth.users as u on u.id = p.usuario_id
    where u.email = 'despachante.yad@anticipa.test'
  ) then
    raise exception 'La cuenta Auth despachante.yad@anticipa.test ya tiene perfil.';
  end if;
end;
$$;

insert into public.empresas_despachantes (id, razon_social)
values ('12000000-0000-0000-0000-000000000001', 'YAD ATOMICIDAD');

insert into public.importadores (
  id,
  empresa_despachante_id,
  razon_social,
  correo_contacto,
  creado_por,
  actualizado_por
)
values (
  '22000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  'Importador atomicidad',
  'atomicidad@anticipa.test',
  (select id from auth.users where email = 'despachante.yad@anticipa.test'),
  (select id from auth.users where email = 'despachante.yad@anticipa.test')
);

insert into public.perfiles (
  usuario_id,
  empresa_despachante_id,
  nombre_visible,
  rol
)
values (
  (select id from auth.users where email = 'despachante.yad@anticipa.test'),
  '12000000-0000-0000-0000-000000000001',
  'Despachante YAD',
  'despachante'
);

insert into public.despachos (
  id,
  empresa_despachante_id,
  importador_id,
  referencia,
  monto,
  fecha_limite,
  creado_por,
  actualizado_por
)
values (
  '32000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'YAD-ATOMICIDAD-001',
  1000.00,
  current_date + 10,
  (select id from auth.users where email = 'despachante.yad@anticipa.test'),
  (select id from auth.users where email = 'despachante.yad@anticipa.test')
);

insert into public.historial_despachos (
  despacho_id,
  empresa_despachante_id,
  accion,
  modificado_por,
  version_resultante,
  cambios
)
values (
  '32000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  'creado',
  (select id from auth.users where email = 'despachante.yad@anticipa.test'),
  1,
  '{"referencia":{"anterior":null,"nuevo":"YAD-ATOMICIDAD-001"}}'
);

create function pg_temp.fallar_insercion_historial()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Falla controlada de historial.';
end;
$$;

create trigger prueba_fallar_insercion_historial
before insert on public.historial_despachos
for each row
execute function pg_temp.fallar_insercion_historial();

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'despachante.yad@anticipa.test'),
  true
);
set local role authenticated;

do $$
declare
  v_fallo boolean := false;
begin
  begin
    perform public.actualizar_despacho(
      '32000000-0000-0000-0000-000000000001',
      1,
      'YAD-ATOMICIDAD-001',
      9999.00,
      current_date + 10
    );
  exception
    when others then
      if sqlerrm = 'Falla controlada de historial.' then
        v_fallo := true;
      else
        raise;
      end if;
  end;

  if not v_fallo then
    raise exception 'La prueba no produjo la falla controlada.';
  end if;

  if (
    select monto
    from public.despachos
    where id = '32000000-0000-0000-0000-000000000001'
  ) <> 1000.00 then
    raise exception 'El despacho quedo actualizado sin historial.';
  end if;

  if (
    select version
    from public.despachos
    where id = '32000000-0000-0000-0000-000000000001'
  ) <> 1 then
    raise exception 'La version cambio pese al fallo del historial.';
  end if;

  if (
    select count(*)
    from public.historial_despachos
    where despacho_id = '32000000-0000-0000-0000-000000000001'
      and accion = 'actualizado'
  ) <> 0 then
    raise exception 'Quedo un historial parcial despues del fallo.';
  end if;
end;
$$;

reset role;
rollback;
