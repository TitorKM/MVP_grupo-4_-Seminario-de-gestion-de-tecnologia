-- Prueba la migracion 005. Requiere cuentas Auth de prueba sin perfiles previos.
-- No ejecutar en produccion. Todo el escenario termina con rollback.
begin;

do $$
begin
  if not exists (select 1 from auth.users where email = 'despachante.yad@anticipa.test')
     or not exists (select 1 from auth.users where email = 'importador.a.yad@anticipa.test') then
    raise exception 'Faltan las cuentas Auth de prueba requeridas.';
  end if;
  if exists (
    select 1 from public.perfiles p join auth.users u on u.id=p.usuario_id
    where u.email in ('despachante.yad@anticipa.test','importador.a.yad@anticipa.test')
  ) then
    raise exception 'Las cuentas Auth de prueba ya tienen perfiles.';
  end if;
end;
$$;

insert into public.empresas_despachantes (id, razon_social)
values ('13000000-0000-0000-0000-000000000001', 'YAD ANULACION');

insert into public.importadores (id, empresa_despachante_id, razon_social, correo_contacto, creado_por, actualizado_por)
values (
  '23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001',
  'Importador anulacion', 'importador.a.yad@anticipa.test',
  (select id from auth.users where email='despachante.yad@anticipa.test'),
  (select id from auth.users where email='despachante.yad@anticipa.test')
);

insert into public.perfiles (usuario_id, empresa_despachante_id, importador_id, nombre_visible, rol)
values
  ((select id from auth.users where email='despachante.yad@anticipa.test'), '13000000-0000-0000-0000-000000000001', null, 'Despachante YAD', 'despachante'),
  ((select id from auth.users where email='importador.a.yad@anticipa.test'), '13000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'Importador A', 'importador');

insert into public.despachos (id, empresa_despachante_id, importador_id, referencia, monto, fecha_limite, creado_por, actualizado_por)
values (
  '33000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000001', 'YAD-ANULACION-001', 1000, current_date + 2,
  (select id from auth.users where email='despachante.yad@anticipa.test'),
  (select id from auth.users where email='despachante.yad@anticipa.test')
);

select set_config('request.jwt.claim.sub', (select id::text from auth.users where email='despachante.yad@anticipa.test'), true);
set local role authenticated;

do $$
begin
  begin
    perform public.anular_despacho('33000000-0000-0000-0000-000000000001', 1, '   ');
    raise exception 'Se acepto un motivo vacio.';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

select public.actualizar_despacho('33000000-0000-0000-0000-000000000001', 1, 'YAD-ANULACION-EDITADO', 1200, current_date + 3);

do $$
begin
  begin
    perform public.anular_despacho('33000000-0000-0000-0000-000000000001', 1, 'Version vieja');
    raise exception 'Se acepto una version obsoleta.';
  exception when sqlstate 'PT409' then null;
  end;
end;
$$;

select public.anular_despacho('33000000-0000-0000-0000-000000000001', 2, 'Operacion cancelada por el cliente');

do $$
begin
  if (select motivo_anulacion from public.despachos where id='33000000-0000-0000-0000-000000000001') <> 'Operacion cancelada por el cliente' then
    raise exception 'No se guardo el motivo.';
  end if;
  if (select count(*) from public.historial_despachos where despacho_id='33000000-0000-0000-0000-000000000001' and accion='anulado') <> 1 then
    raise exception 'No se registro exactamente una anulacion.';
  end if;
  begin
    perform public.actualizar_despacho('33000000-0000-0000-0000-000000000001', 3, 'NO-PERMITIDO', 9999, current_date + 4);
    raise exception 'Se edito un despacho anulado.';
  exception when sqlstate '55000' then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email='importador.a.yad@anticipa.test'), true);
set local role authenticated;

do $$
begin
  begin
    perform public.actualizar_estado_fondos('33000000-0000-0000-0000-000000000001', 3, 'disponibles');
    raise exception 'Se cambiaron fondos de un despacho anulado.';
  exception when sqlstate 'PT410' then null;
  end;
  begin
    perform public.anular_despacho('33000000-0000-0000-0000-000000000001', 3, 'Sin permiso');
    raise exception 'El importador pudo anular.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
