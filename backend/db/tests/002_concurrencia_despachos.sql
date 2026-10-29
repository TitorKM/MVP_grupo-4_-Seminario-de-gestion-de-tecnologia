-- Verifica versiones obsoletas mediante llamadas consecutivas.
-- No simula dos transacciones ejecutandose al mismo tiempo.
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
values ('11000000-0000-0000-0000-000000000001', 'YAD CONCURRENCIA');

insert into public.importadores (
  id,
  empresa_despachante_id,
  razon_social,
  correo_contacto,
  creado_por,
  actualizado_por
)
values (
  '21000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'Importador concurrencia',
  'concurrencia@anticipa.test',
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
  '11000000-0000-0000-0000-000000000001',
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
  '31000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  'YAD-CONCURRENCIA-001',
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
  '31000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'creado',
  (select id from auth.users where email = 'despachante.yad@anticipa.test'),
  1,
  '{"referencia":{"anterior":null,"nuevo":"YAD-CONCURRENCIA-001"}}'
);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'despachante.yad@anticipa.test'),
  true
);
set local role authenticated;

select public.actualizar_despacho(
  '31000000-0000-0000-0000-000000000001',
  1,
  'YAD-CONCURRENCIA-001',
  1500.00,
  current_date + 10
);

-- Repetir exactamente los mismos valores no incrementa version ni historial.
select public.actualizar_despacho(
  '31000000-0000-0000-0000-000000000001',
  2,
  'YAD-CONCURRENCIA-001',
  1500.00,
  current_date + 10
);

do $$
declare
  v_conflicto boolean := false;
begin
  begin
    perform public.actualizar_despacho(
      '31000000-0000-0000-0000-000000000001',
      1,
      'YAD-CONCURRENCIA-001',
      2000.00,
      current_date + 10
    );
  exception
    when sqlstate 'PT409' then
      v_conflicto := true;
  end;

  if not v_conflicto then
    raise exception 'La segunda actualizacion con version obsoleta no fue rechazada.';
  end if;

  if (
    select version
    from public.despachos
    where id = '31000000-0000-0000-0000-000000000001'
  ) <> 2 then
    raise exception 'La version final debe ser 2.';
  end if;

  if (
    select monto
    from public.despachos
    where id = '31000000-0000-0000-0000-000000000001'
  ) <> 1500.00 then
    raise exception 'El intento obsoleto modifico el monto.';
  end if;

  if (
    select count(*)
    from public.historial_despachos
    where despacho_id = '31000000-0000-0000-0000-000000000001'
      and accion = 'actualizado'
  ) <> 1 then
    raise exception 'Debe existir un unico historial de actualizacion.';
  end if;
end;
$$;

reset role;
rollback;
