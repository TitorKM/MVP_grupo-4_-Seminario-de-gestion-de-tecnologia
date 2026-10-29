-- Requiere las cinco cuentas Auth documentadas en backend/docs/cuentas_prueba.md.
-- Las cuentas no deben tener perfiles previos.
-- Ejecutar solo en un proyecto de prueba, despues de las migraciones.
-- Toda la preparacion se revierte al finalizar.

begin;

do $$
begin
  if (
    select count(*)
    from auth.users
    where email in (
      'despachante.yad@anticipa.test',
      'importador.a.yad@anticipa.test',
      'importador.b.yad@anticipa.test',
      'despachante.logistic@anticipa.test',
      'importador.logistic@anticipa.test'
    )
  ) <> 5 then
    raise exception 'Faltan las cinco cuentas Auth de prueba.';
  end if;

  if exists (
    select 1
    from public.perfiles as p
    join auth.users as u on u.id = p.usuario_id
    where u.email in (
      'despachante.yad@anticipa.test',
      'importador.a.yad@anticipa.test',
      'importador.b.yad@anticipa.test',
      'despachante.logistic@anticipa.test',
      'importador.logistic@anticipa.test'
    )
  ) then
    raise exception 'Las cuentas Auth de prueba ya tienen perfiles.';
  end if;
end;
$$;

insert into public.empresas_despachantes (id, razon_social)
values
  ('10000000-0000-0000-0000-000000000001', 'YAD'),
  ('10000000-0000-0000-0000-000000000002', 'LOGISTIC');

insert into public.importadores (
  id,
  empresa_despachante_id,
  razon_social,
  correo_contacto,
  creado_por,
  actualizado_por
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Importador A YAD',
    'importador.a.yad@anticipa.test',
    (select id from auth.users where email = 'despachante.yad@anticipa.test'),
    (select id from auth.users where email = 'despachante.yad@anticipa.test')
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Importador B YAD',
    'importador.b.yad@anticipa.test',
    (select id from auth.users where email = 'despachante.yad@anticipa.test'),
    (select id from auth.users where email = 'despachante.yad@anticipa.test')
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Importador LOGISTIC',
    'importador.logistic@anticipa.test',
    (select id from auth.users where email = 'despachante.logistic@anticipa.test'),
    (select id from auth.users where email = 'despachante.logistic@anticipa.test')
  );

insert into public.perfiles (
  usuario_id,
  empresa_despachante_id,
  nombre_visible,
  rol,
  importador_id
)
values
  (
    (select id from auth.users where email = 'despachante.yad@anticipa.test'),
    '10000000-0000-0000-0000-000000000001',
    'Despachante YAD',
    'despachante',
    null
  ),
  (
    (select id from auth.users where email = 'importador.a.yad@anticipa.test'),
    '10000000-0000-0000-0000-000000000001',
    'Cuenta Importador A YAD',
    'importador',
    '20000000-0000-0000-0000-000000000001'
  ),
  (
    (select id from auth.users where email = 'importador.b.yad@anticipa.test'),
    '10000000-0000-0000-0000-000000000001',
    'Cuenta Importador B YAD',
    'importador',
    '20000000-0000-0000-0000-000000000003'
  ),
  (
    (select id from auth.users where email = 'despachante.logistic@anticipa.test'),
    '10000000-0000-0000-0000-000000000002',
    'Despachante LOGISTIC',
    'despachante',
    null
  ),
  (
    (select id from auth.users where email = 'importador.logistic@anticipa.test'),
    '10000000-0000-0000-0000-000000000002',
    'Cuenta Importador LOGISTIC',
    'importador',
    '20000000-0000-0000-0000-000000000002'
  );

insert into public.despachos (
  id,
  empresa_despachante_id,
  importador_id,
  referencia,
  monto,
  fecha_limite,
  estado_fondos,
  creado_por,
  actualizado_por
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'YAD-A-001',
    1000.00,
    current_date + 10,
    'pendiente_confirmacion',
    (select id from auth.users where email = 'despachante.yad@anticipa.test'),
    (select id from auth.users where email = 'despachante.yad@anticipa.test')
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    'YAD-B-001',
    1500.00,
    current_date + 12,
    'pendiente_confirmacion',
    (select id from auth.users where email = 'despachante.yad@anticipa.test'),
    (select id from auth.users where email = 'despachante.yad@anticipa.test')
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'LOGISTIC-001',
    2000.00,
    current_date + 15,
    'pendiente_confirmacion',
    (select id from auth.users where email = 'despachante.logistic@anticipa.test'),
    (select id from auth.users where email = 'despachante.logistic@anticipa.test')
  );

insert into public.historial_despachos (
  despacho_id,
  empresa_despachante_id,
  accion,
  modificado_por,
  version_resultante,
  cambios
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'creado',
    (select id from auth.users where email = 'despachante.yad@anticipa.test'),
    1,
    '{"referencia":{"anterior":null,"nuevo":"YAD-A-001"}}'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'creado',
    (select id from auth.users where email = 'despachante.yad@anticipa.test'),
    1,
    '{"referencia":{"anterior":null,"nuevo":"YAD-B-001"}}'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'creado',
    (select id from auth.users where email = 'despachante.logistic@anticipa.test'),
    1,
    '{"referencia":{"anterior":null,"nuevo":"LOGISTIC-001"}}'
  );

insert into public.notificaciones (
  id,
  empresa_despachante_id,
  destinatario_id,
  despacho_id,
  tipo,
  mensaje
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    (select id from auth.users where email = 'importador.a.yad@anticipa.test'),
    '30000000-0000-0000-0000-000000000001',
    'prueba',
    'Notificacion YAD A'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    (select id from auth.users where email = 'importador.logistic@anticipa.test'),
    '30000000-0000-0000-0000-000000000002',
    'prueba',
    'Notificacion LOGISTIC'
  );

select set_config(
  'app.prueba.importador_a_id',
  (select id::text from auth.users where email = 'importador.a.yad@anticipa.test'),
  true
);

select set_config(
  'app.prueba.importador_b_id',
  (select id::text from auth.users where email = 'importador.b.yad@anticipa.test'),
  true
);

do $$
declare
  v_bloqueado boolean := false;
begin
  if has_table_privilege('anon', 'public.despachos', 'select') then
    raise exception 'anon no debe tener SELECT sobre despachos.';
  end if;

  if has_table_privilege('authenticated', 'public.perfiles', 'update') then
    raise exception 'authenticated no debe poder modificar perfiles directamente.';
  end if;

  if has_table_privilege('authenticated', 'public.despachos', 'update') then
    raise exception 'authenticated no debe poder modificar despachos directamente.';
  end if;

  begin
    update public.despachos
       set importador_id = '20000000-0000-0000-0000-000000000003'
     where id = '30000000-0000-0000-0000-000000000001';
  exception
    when check_violation then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'Fue posible cambiar el importador de un despacho existente.';
  end if;
end;
$$;

-- El despachante YAD ve toda su cartera, pero nada de LOGISTIC.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'despachante.yad@anticipa.test'),
  true
);
set local role authenticated;

do $$
declare
  v_bloqueado boolean := false;
  v_importador public.importadores%rowtype;
begin
  if (select count(*) from public.empresas_despachantes) <> 1 then
    raise exception 'El despachante YAD debe ver una sola empresa.';
  end if;

  if (select count(*) from public.importadores) <> 2 then
    raise exception 'El despachante YAD debe ver sus dos importadores.';
  end if;

  if (select count(*) from public.despachos) <> 2 then
    raise exception 'El despachante YAD debe ver sus dos despachos.';
  end if;

  if (select count(*) from public.historial_despachos) <> 2 then
    raise exception 'El despachante YAD debe ver solo su historial.';
  end if;

  select *
    into v_importador
    from public.crear_importador(
      'Nuevo importador YAD',
      'nuevo.importador.yad@anticipa.test'
    );

  if v_importador.empresa_despachante_id <>
     '10000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'crear_importador no tomo la empresa YAD desde el perfil.';
  end if;

  begin
    perform public.crear_despacho(
      'YAD-IMPORTADOR-AJENO',
      '20000000-0000-0000-0000-000000000002',
      3000.00,
      current_date + 30
    );
  exception
    when insufficient_privilege then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'YAD pudo crear un despacho para un importador de LOGISTIC.';
  end if;

  v_bloqueado := false;

  begin
    perform public.actualizar_despacho(
      '30000000-0000-0000-0000-000000000002',
      1,
      'LOGISTIC-ALTERADO',
      9999.00,
      current_date + 20
    );
  exception
    when sqlstate 'P0002' then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'YAD pudo modificar un despacho de LOGISTIC.';
  end if;

  v_bloqueado := false;

  begin
    update public.perfiles
       set rol = 'importador'
     where usuario_id = auth.uid();
  exception
    when insufficient_privilege then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'El usuario pudo autoasignarse otro rol.';
  end if;
end;
$$;

reset role;

-- Importador A de YAD: solo ve y modifica su propio despacho.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'importador.a.yad@anticipa.test'),
  true
);
set local role authenticated;

do $$
declare
  v_bloqueado boolean := false;
begin
  if (select count(*) from public.importadores) <> 1 then
    raise exception 'El importador A debe ver solo su registro.';
  end if;

  if (select count(*) from public.despachos) <> 1 then
    raise exception 'El importador A debe ver solo su despacho.';
  end if;

  if exists (
    select 1 from public.despachos
    where id = '30000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'El importador A pudo ver el despacho del importador B.';
  end if;

  if (select count(*) from public.historial_despachos) <> 0 then
    raise exception 'El importador no debe consultar el historial.';
  end if;

  if (select count(*) from public.notificaciones) <> 1 then
    raise exception 'El importador A debe ver solo su notificacion.';
  end if;

  perform public.actualizar_estado_fondos(
    '30000000-0000-0000-0000-000000000001',
    1,
    'disponibles'
  );

  begin
    perform public.actualizar_estado_fondos(
      '30000000-0000-0000-0000-000000000003',
      1,
      'disponibles'
    );
  exception
    when sqlstate 'P0002' then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'El importador A pudo modificar el despacho del importador B.';
  end if;

  v_bloqueado := false;

  begin
    perform public.actualizar_despacho(
      '30000000-0000-0000-0000-000000000001',
      2,
      'YAD-A-ALTERADO',
      9999.00,
      current_date + 40
    );
  exception
    when insufficient_privilege then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'El importador pudo editar referencia, monto o fecha limite.';
  end if;
end;
$$;

reset role;

-- Importador B de YAD: solo ve y modifica su propio despacho.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'importador.b.yad@anticipa.test'),
  true
);
set local role authenticated;

do $$
declare
  v_bloqueado boolean := false;
begin
  if (select count(*) from public.importadores) <> 1 then
    raise exception 'El importador B debe ver solo su registro.';
  end if;

  if (select count(*) from public.despachos) <> 1 then
    raise exception 'El importador B debe ver solo su despacho.';
  end if;

  if exists (
    select 1 from public.despachos
    where id = '30000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'El importador B pudo ver el despacho del importador A.';
  end if;

  perform public.actualizar_estado_fondos(
    '30000000-0000-0000-0000-000000000003',
    1,
    'no_disponibles'
  );

  begin
    perform public.actualizar_estado_fondos(
      '30000000-0000-0000-0000-000000000001',
      2,
      'no_disponibles'
    );
  exception
    when sqlstate 'P0002' then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'El importador B pudo modificar el despacho del importador A.';
  end if;
end;
$$;

reset role;

-- El despachante YAD ve los valores persistidos y el autor real del historial.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'despachante.yad@anticipa.test'),
  true
);
set local role authenticated;

do $$
begin
  if not exists (
    select 1
    from public.despachos
    where id = '30000000-0000-0000-0000-000000000001'
      and estado_fondos = 'disponibles'
      and version = 2
  ) then
    raise exception 'No se guardo el estado de fondos del importador A.';
  end if;

  if not exists (
    select 1
    from public.despachos
    where id = '30000000-0000-0000-0000-000000000003'
      and estado_fondos = 'no_disponibles'
      and version = 2
  ) then
    raise exception 'No se guardo el estado de fondos del importador B.';
  end if;

  if not exists (
    select 1
    from public.historial_despachos as h
    where h.despacho_id = '30000000-0000-0000-0000-000000000001'
      and h.modificado_por = current_setting('app.prueba.importador_a_id')::uuid
      and h.cambios -> 'estadoFondos' ->> 'nuevo' = 'disponibles'
  ) then
    raise exception 'El historial no identifica al importador A como autor.';
  end if;

  if not exists (
    select 1
    from public.historial_despachos as h
    where h.despacho_id = '30000000-0000-0000-0000-000000000003'
      and h.modificado_por = current_setting('app.prueba.importador_b_id')::uuid
      and h.cambios -> 'estadoFondos' ->> 'nuevo' = 'no_disponibles'
  ) then
    raise exception 'El historial no identifica al importador B como autor.';
  end if;
end;
$$;

reset role;

-- Desactivar un importador bloquea por completo su cuenta.
update public.importadores
   set activo = false,
       actualizado_en = now(),
       actualizado_por = (
         select id from auth.users where email = 'despachante.yad@anticipa.test'
       )
 where id = '20000000-0000-0000-0000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'importador.a.yad@anticipa.test'),
  true
);
set local role authenticated;

do $$
declare
  v_bloqueado boolean := false;
begin
  if (select count(*) from public.perfiles) <> 0
     or (select count(*) from public.empresas_despachantes) <> 0
     or (select count(*) from public.importadores) <> 0
     or (select count(*) from public.despachos) <> 0
     or (select count(*) from public.notificaciones) <> 0 then
    raise exception 'La cuenta del importador inactivo conserva acceso privado.';
  end if;

  begin
    perform public.actualizar_estado_fondos(
      '30000000-0000-0000-0000-000000000001',
      2,
      'no_disponibles'
    );
  exception
    when insufficient_privilege then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'El importador inactivo pudo modificar fondos.';
  end if;
end;
$$;

reset role;

-- El despachante activo conserva acceso al historial del importador inactivo.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'despachante.yad@anticipa.test'),
  true
);
set local role authenticated;

do $$
begin
  if not exists (
    select 1
    from public.importadores
    where id = '20000000-0000-0000-0000-000000000001'
      and not activo
  ) then
    raise exception 'El despachante no puede consultar el importador inactivo.';
  end if;

  if not exists (
    select 1
    from public.despachos
    where id = '30000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'El despachante no puede consultar el despacho historico.';
  end if;

  if not exists (
    select 1
    from public.historial_despachos
    where despacho_id = '30000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'El despachante no puede consultar el historial asociado.';
  end if;
end;
$$;

reset role;

-- Desactivar la empresa bloquea lecturas y escrituras de todas sus cuentas.
update public.empresas_despachantes
   set activa = false,
       actualizada_en = now()
 where id = '10000000-0000-0000-0000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'despachante.yad@anticipa.test'),
  true
);
set local role authenticated;

do $$
declare
  v_bloqueado boolean := false;
begin
  if (select count(*) from public.perfiles) <> 0
     or (select count(*) from public.empresas_despachantes) <> 0
     or (select count(*) from public.importadores) <> 0
     or (select count(*) from public.despachos) <> 0
     or (select count(*) from public.historial_despachos) <> 0
     or (select count(*) from public.notificaciones) <> 0 then
    raise exception 'La cuenta de una empresa inactiva conserva acceso privado.';
  end if;

  begin
    perform public.crear_importador(
      'Importador bloqueado',
      'bloqueado@anticipa.test'
    );
  exception
    when insufficient_privilege then
      v_bloqueado := true;
  end;

  if not v_bloqueado then
    raise exception 'La empresa inactiva pudo ejecutar una escritura.';
  end if;
end;
$$;

reset role;

-- LOGISTIC permanece aislada y activa.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users where email = 'despachante.logistic@anticipa.test'),
  true
);
set local role authenticated;

do $$
begin
  if (select count(*) from public.empresas_despachantes) <> 1 then
    raise exception 'El despachante LOGISTIC debe ver una sola empresa.';
  end if;

  if (select count(*) from public.despachos) <> 1 then
    raise exception 'El despachante LOGISTIC debe ver un solo despacho.';
  end if;

  if exists (
    select 1
    from public.despachos
    where empresa_despachante_id = '10000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'LOGISTIC pudo consultar un despacho de YAD.';
  end if;
end;
$$;

reset role;
rollback;
