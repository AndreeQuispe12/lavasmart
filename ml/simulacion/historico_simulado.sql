-- =====================================================================
--  LavaSmart — ml/simulacion/historico_simulado.sql
--  Tres meses de operación SIMULADA para entrenar y demostrar los modelos.
--
--  SOLO PARA LavaSmart-dev. Nunca en producción: el bloque se niega a
--  correr si no encuentra los datos de 03_datos_prueba (placa ABC-123),
--  que solo existen en desarrollo.
--
--  Por qué existe: los modelos necesitan semanas de histórico y AquaBrillo
--  todavía no tiene ninguna en el sistema. Mientras se digitalizan los
--  cuadernos, este archivo genera un histórico con los patrones que se
--  observan en un lavadero de Lima. Son datos inventados y así deben
--  presentarse; las placas simuladas empiezan por Z.
--
--  Qué genera, del 13 de agosto al 12 de noviembre de 2026:
--    - Demanda diaria según el día de la semana (sábado y domingo altos),
--      la estación (invierno con garúa al inicio, primavera al final), los
--      días de pago (quincena y fin de mes), los feriados y días de garúa.
--    - Clientes con costumbres: frecuentes con su día y servicio, taxis que
--      lavan por fuera cada pocos días, ocasionales y de una sola visita.
--      Algunos dan nombre y celular; unos pocos comparten celular (un
--      mismo dueño con dos autos).
--    - Llegadas con picos de 9 a 12 y de 15 a 17:30, y la entrega entre
--      40 y 100 minutos después según los servicios.
--    - Asistencia con descansos semanales, tardanzas y alguna falta; el
--      descuento del trabajador fijo lo decide el dueño.
--    - Cobro en efectivo o Yape (Yape crece con las semanas) y algunos
--      pagos incompletos.
--    - Incidencias en cerca del 1,5 % de los lavados.
--    - Liquidación cerrada hasta el 11 de noviembre; pagada a diario o por
--      semana según el trabajador, con la última semana pendiente.
--
--  Cómo se carga: pasa por las mismas tablas, restricciones y disparadores
--  que la app (el porcentaje del destajo lo congela tr_lavado_fijar_porcentaje
--  desde la asistencia del día). Lo que solo controla la app con sesión
--  (bloqueo de día cerrado, hora de entrega con el reloj de la base) se
--  omite porque corre desde el editor SQL, y las fechas las pone el script.
--
--  Es reproducible (semilla fija) y se puede volver a correr: primero borra
--  lo que haya en el periodo y los clientes simulados que queden sin
--  visitas. Ese borrado es solo de datos de prueba de desarrollo.
-- =====================================================================

do $$
declare
    c_desde   constant date := date '2026-08-13';
    c_hasta   constant date := date '2026-11-12';
    c_cerrar  constant date := date '2026-11-11';  -- último día cerrado
    c_pagado  constant date := date '2026-11-07';  -- último sábado pagado a los semanales

    v_dueno   uuid;
    s_completo bigint; s_fuera bigint; s_dentro bigint; s_encerado bigint; s_motor bigint;
    t_sedan bigint; t_station bigint; t_suv bigint; t_camioneta bigint;

    nombres   text[] := array['Luis','Carlos','José','Jorge','Miguel','Juan','Ricardo','César','Víctor','Óscar',
                              'Rosa','María','Ana','Carmen','Patricia','Lucía','Jessica','Milagros','Gloria','Elena'];
    apellidos text[] := array['Quispe','Flores','Rodríguez','García','Huamán','Mendoza','Torres','Rojas','Vargas','Castillo',
                              'Chávez','Ramírez','Sánchez','Díaz','Paredes','Gutiérrez','Ríos','Salazar','Cárdenas','Espinoza'];
    observaciones text[] := array['Rayón previo en la puerta del conductor.','Cliente deja objetos en la maletera.',
                                  'Abolladura previa en el parachoques.','Llanta de repuesto en el asiento trasero.'];

    d          date;
    dow        int;
    progreso   numeric;
    factor     numeric;
    n_autos    int;
    minutos    int[];
    presentes  bigint[];
    carga      int[];
    i          int;
    k          int;
    contador   int := 0;

    r_trab     record;
    v_estado   estado_asistencia;
    v_hora     time;
    v_pct      numeric;
    v_desc     numeric;
    v_motivo   text;
    v_autoriza uuid;

    v_cli      bigint;
    v_perfil   text;
    v_tipo     bigint;
    v_servs    bigint[];
    v_trab     bigint;
    v_ingreso  timestamptz;
    v_entrega  timestamptz;
    v_lavado   bigint;
    v_total    numeric;
    v_cobrado  numeric;
    v_metodo   metodo_pago;
    v_nombre   text;
    v_tel      text;
    v_placa    text;
    v_reporte  timestamptz;
    v_tipo_inc tipo_incidencia;
    u1 numeric; u2 numeric;
begin
    -- ---------------------------------------------------------------
    -- Guardas: solo en desarrollo.
    -- ---------------------------------------------------------------
    if not exists (select 1 from cliente where placa = 'ABC-123') then
        raise exception 'historico_simulado: esta base no tiene 03_datos_prueba; parece producción. No se generó nada.';
    end if;

    select id into v_dueno from perfil where rol = 'dueno' order by creado_en limit 1;
    if v_dueno is null then
        raise exception 'historico_simulado: no hay un perfil de dueño.';
    end if;

    perform setseed(0.2026);

    select id into s_completo  from tipo_lavado where nombre = 'Lavado completo';
    select id into s_fuera     from tipo_lavado where nombre = 'Lavado por fuera';
    select id into s_dentro    from tipo_lavado where nombre = 'Lavado por dentro';
    select id into s_encerado  from tipo_lavado where nombre = 'Encerado';
    select id into s_motor     from tipo_lavado where nombre = 'Lavado de motor';
    select id into t_sedan     from tipo_vehiculo where nombre = 'Sedán';
    select id into t_station   from tipo_vehiculo where nombre = 'Station wagon';
    select id into t_suv       from tipo_vehiculo where nombre = 'SUV';
    select id into t_camioneta from tipo_vehiculo where nombre = 'Camioneta';

    -- ---------------------------------------------------------------
    -- Limpiar el periodo (solo datos de prueba de desarrollo).
    -- ---------------------------------------------------------------
    delete from incidencia where lavado_id in (
        select id from lavado where (fecha_hora_ingreso at time zone 'America/Lima')::date between c_desde and c_hasta);
    delete from detalle_lavado where lavado_id in (
        select id from lavado where (fecha_hora_ingreso at time zone 'America/Lima')::date between c_desde and c_hasta);
    delete from lavado where (fecha_hora_ingreso at time zone 'America/Lima')::date between c_desde and c_hasta;
    delete from liquidacion where fecha between c_desde and c_hasta;
    delete from asistencia  where fecha between c_desde and c_hasta;
    delete from cliente_segmento where cliente_id in (select id from cliente where placa like 'Z%');
    delete from cliente c where c.placa like 'Z%'
        and not exists (select 1 from lavado l where l.cliente_id = c.id)
        and not exists (select 1 from incidencia x where x.cliente_id = c.id);

    -- ---------------------------------------------------------------
    -- Cartera de clientes y sus costumbres (solo dura esta corrida).
    -- ---------------------------------------------------------------
    create temp table sim_cliente (
        id        bigint primary key,
        perfil    text,      -- frecuente | taxi | ocasional | unica
        intervalo int,       -- días entre visitas
        dia_pref  int,       -- día preferido (1 = lunes)
        servicios bigint[],
        ultima    date,
        proxima   date
    ) on commit drop;

    -- Los autos de 03_datos_prueba pasan a ser clientes frecuentes.
    insert into sim_cliente
    select c.id, 'frecuente', 7 + floor(random() * 8)::int, 1 + floor(random() * 7)::int,
           case when random() < 0.6 then array[s_completo] else array[s_fuera] end,
           null, c_desde + floor(random() * 10)::int
    from cliente c where c.placa not like 'Z%' and c.creado_en < date '2026-11-13';

    -- ---------------------------------------------------------------
    -- Día por día.
    -- ---------------------------------------------------------------
    d := c_desde;
    while d <= c_hasta loop
        dow      := extract(isodow from d)::int;
        progreso := (d - c_desde)::numeric / (c_hasta - c_desde);

        -- Demanda del día.
        factor := (array[9, 8, 9, 10, 13, 22, 19])[dow]
                * (0.85 + 0.27 * progreso)                                   -- invierno -> primavera
                * case when extract(day from d) in (14, 15, 16, 29, 30, 31, 1) then 1.15 else 1 end  -- días de pago
                * case d when date '2026-08-30' then 1.20                    -- Santa Rosa
                         when date '2026-10-08' then 1.35                    -- Combate de Angamos
                         when date '2026-11-01' then 1.15                    -- Todos los Santos
                         else 1 end;
        -- El CASE va entre paréntesis: dentro de un IF, PL/pgSQL corta la
        -- condición en el primer THEN que encuentra.
        if random() < (case extract(month from d) when 8 then 0.22 when 9 then 0.18 when 10 then 0.10 else 0.05 end) then
            factor := factor * 0.70;                                         -- garúa o nublado
        end if;
        u1 := greatest(random(), 1e-9); u2 := random();
        factor  := factor * (1 + 0.12 * sqrt(-2 * ln(u1)) * cos(2 * pi() * u2));
        n_autos := greatest(3, round(factor)::int);

        -- Asistencia. Descanso semanal: Julio el lunes, Marco el martes,
        -- Diana el miércoles. El resto de días, alguna falta o tardanza.
        presentes := '{}';
        for r_trab in
            select t.id, t.modalidad,
                   case t.id when 1 then 0.85 when 2 then 0.70 else 0.80 end as puntualidad,
                   case t.id when 1 then 1 when 2 then 2 else 3 end as descanso
            from trabajador t where t.activo and t.fecha_ingreso <= d order by t.id
        loop
            continue when dow = r_trab.descanso;
            v_desc := 0; v_motivo := null; v_autoriza := null; v_pct := null;
            if random() < 0.03 then
                v_estado := 'falta'; v_hora := null;
            elsif random() < r_trab.puntualidad then
                v_estado := 'puntual';
                v_hora   := time '07:45' + make_interval(mins => floor(random() * 21)::int);
                if r_trab.modalidad = 'destajo' then v_pct := 50; end if;
            else
                v_estado := 'tardanza';
                k        := 6 + floor(random() * 35)::int;
                v_hora   := time '08:00' + make_interval(mins => k);
                if r_trab.modalidad = 'destajo' then
                    v_pct := 40;
                elsif random() < 0.6 then
                    v_desc := case when k > 20 then 10 else 5 end;
                    v_motivo := format('Tardanza de %s minutos', k);
                    v_autoriza := v_dueno;
                end if;
            end if;

            insert into asistencia (trabajador_id, fecha, hora_ingreso, estado, hora_referencia,
                                    tolerancia_minutos, porcentaje_destajo, descuento_monto,
                                    descuento_motivo, autorizado_por, registrado_en)
            values (r_trab.id, d, v_hora, v_estado, time '08:00', 5, v_pct, v_desc, v_motivo, v_autoriza,
                    (d + coalesce(v_hora, time '08:30')) at time zone 'America/Lima');

            if v_estado <> 'falta' then
                presentes := presentes || r_trab.id;
            end if;
        end loop;

        if cardinality(presentes) = 0 then
            d := d + 1;
            continue;
        end if;
        carga := array_fill(0, array[cardinality(presentes)]);

        -- Horas de llegada del día, en orden: picos de 9 a 12 y de 15 a 17:30.
        select array_agg(m order by m) into minutos
        from (
            select case
                     when random() < 0.70 then
                         case when random() < 0.5 then 540 + floor(random() * 180)
                              else 900 + floor(random() * 150) end
                     else 490 + floor(random() * 590)
                   end::int as m
            from generate_series(1, n_autos)
        ) x;

        for i in 1 .. n_autos loop
            -- 1. ¿Quién llega? Primero un cliente al que le toca volver.
            v_cli := null;
            if random() < 0.85 then
                select s.id into v_cli
                from sim_cliente s
                where s.proxima <= d
                  and s.ultima is distinct from d
                  and (s.perfil <> 'frecuente' or s.dia_pref = dow or s.proxima <= d - 2)
                order by random()
                limit 1;
            end if;

            if v_cli is null then
                -- Un auto nuevo: decide sus costumbres.
                u1 := random();
                v_perfil := case when u1 < 0.10 then 'frecuente'
                                 when u1 < 0.14 then 'taxi'
                                 when u1 < 0.50 then 'ocasional'
                                 else 'unica' end;
                u2 := random();
                v_tipo := case
                    when v_perfil = 'taxi' then case when u2 < 0.7 then t_sedan else t_station end
                    when u2 < 0.40 then t_sedan
                    when u2 < 0.65 then t_suv
                    when u2 < 0.85 then t_camioneta
                    else t_station end;

                contador := contador + 1;
                v_placa  := 'Z' || chr(65 + (contador / 1000) % 26) || chr(65 + (contador / 100) % 10 + floor(random() * 16)::int)
                            || '-' || lpad((contador % 1000)::text, 3, '0');

                v_nombre := null; v_tel := null;
                if random() < (case v_perfil when 'frecuente' then 0.70 when 'taxi' then 0.60
                                             when 'ocasional' then 0.30 else 0.15 end) then
                    v_nombre := nombres[1 + floor(random() * 20)::int] || ' ' || apellidos[1 + floor(random() * 20)::int];
                    if random() < 0.70 then
                        v_tel := '9000' || lpad(floor(random() * 100000)::text, 5, '0');
                        -- Unos pocos son el mismo dueño con otro auto.
                        if random() < 0.10 then
                            select c.nombre, c.telefono into v_nombre, v_tel
                            from cliente c where c.placa like 'Z%' and c.telefono is not null
                            order by random() limit 1;
                        end if;
                    end if;
                end if;

                insert into cliente (placa, tipo_vehiculo_id, nombre, telefono, creado_en)
                values (v_placa, v_tipo, v_nombre, v_tel,
                        (d + make_interval(mins => minutos[i])) at time zone 'America/Lima')
                returning id into v_cli;

                insert into sim_cliente values (
                    v_cli, v_perfil,
                    case v_perfil when 'frecuente' then 7 + floor(random() * 8)::int
                                  when 'taxi'      then 3 + floor(random() * 4)::int
                                  when 'ocasional' then 21 + floor(random() * 25)::int end,
                    dow,
                    case when v_perfil = 'frecuente' then
                        case when random() < 0.60 then array[s_completo]
                             when random() < 0.60 then array[s_fuera]
                             else array[s_completo, s_encerado] end end,
                    null, null);
            end if;

            select perfil, servicios into v_perfil, v_servs from sim_cliente where id = v_cli;
            select tipo_vehiculo_id into v_tipo from cliente where id = v_cli;

            -- 2. Servicios.
            if v_perfil = 'taxi' then
                v_servs := case when random() < 0.75 then array[s_fuera] else array[s_completo] end;
            elsif v_servs is null then
                u1 := random();
                v_servs := case when u1 < 0.55 then array[s_completo]
                                when u1 < 0.77 then array[s_fuera]
                                when u1 < 0.90 then array[s_dentro]
                                else array[s_fuera, s_dentro] end;
                if (s_completo = any (v_servs) or s_fuera = any (v_servs)) and random() < 0.15 then
                    v_servs := v_servs || s_encerado;
                end if;
                if random() < 0.07 then
                    v_servs := v_servs || s_motor;
                end if;
            end if;

            -- 3. Lavador: el presente con menos autos ese día.
            k := 1;
            for i2 in 2 .. cardinality(presentes) loop
                if carga[i2] < carga[k] or (carga[i2] = carga[k] and random() < 0.5) then
                    k := i2;
                end if;
            end loop;
            carga[k] := carga[k] + 1;
            v_trab := presentes[k];

            -- 4. Ingreso, servicios con el precio de la tarifa, y entrega.
            v_ingreso := (d + make_interval(mins => minutos[i])) at time zone 'America/Lima';

            insert into lavado (cliente_id, trabajador_id, registrado_por, observacion, fecha_hora_ingreso)
            values (v_cli, v_trab, v_dueno,
                    case when random() < 0.05 then observaciones[1 + floor(random() * 4)::int] end,
                    v_ingreso)
            returning id into v_lavado;

            insert into detalle_lavado (lavado_id, tipo_lavado_id, precio_cobrado)
            select v_lavado, t.tipo_lavado_id, t.precio
            from tarifa t
            where t.tipo_vehiculo_id = v_tipo and t.tipo_lavado_id = any (v_servs) and t.activo;

            select sum(precio_cobrado) into v_total from detalle_lavado where lavado_id = v_lavado;

            v_entrega := v_ingreso + make_interval(mins =>
                           35 + 15 * (cardinality(v_servs) - 1)
                           + case when v_tipo in (t_suv, t_camioneta) then 10 else 0 end
                           + floor(random() * 30)::int);

            v_cobrado := case when random() < 0.04 then greatest(v_total - (2 + floor(random() * 4)), 0)
                              else v_total end;
            v_metodo  := case when random() < 0.30 + 0.20 * progreso then 'yape' else 'efectivo' end;

            update lavado
               set estado = 'entregado', monto_cobrado = v_cobrado,
                   metodo_pago = v_metodo, fecha_hora_entrega = v_entrega
             where id = v_lavado;

            update sim_cliente
               set ultima  = d,
                   proxima = case when perfil = 'unica' then null
                                  else d + intervalo + floor(random() * 5)::int - 2 end
             where id = v_cli;

            -- 5. Incidencia (cerca del 1,5 %).
            if random() < 0.015 then
                u1 := random();
                v_tipo_inc := case when u1 < 0.30 then 'dano' when u1 < 0.70 then 'servicio_incompleto'
                                   when u1 < 0.90 then 'objeto_faltante' else 'otro' end;
                v_reporte := v_entrega + make_interval(mins => floor(random() * 120)::int);
                insert into incidencia (cliente_id, lavado_id, tipo, descripcion, estado,
                                        fecha_reporte, fecha_resolucion, resolucion, registrado_por)
                select v_cli, v_lavado, v_tipo_inc, x.descripcion,
                       case when d < c_hasta - 7 then 'resuelta'::estado_incidencia
                            when random() < 0.5 then 'en_proceso' else 'abierta' end,
                       v_reporte,
                       case when d < c_hasta - 7 then v_reporte + make_interval(hours => 18 + floor(random() * 48)::int) end,
                       case when d < c_hasta - 7 then x.resolucion end,
                       v_dueno
                from (values
                    ('dano'::tipo_incidencia, 'Cliente reporta un rayón leve en la puerta trasera después del secado.',
                     'Se revisó con el lavador; se pulió la zona sin costo.'),
                    ('servicio_incompleto', 'Quedaron manchas de agua en el capó y los aros sin limpiar.',
                     'Se volvió a lavar sin costo.'),
                    ('objeto_faltante', 'Cliente no encuentra los lentes de sol que dejó en la guantera.',
                     'Se encontraron en el área de aspirado y se devolvieron al cliente.'),
                    ('otro', 'El cliente esperó más de lo acordado para la entrega.',
                     'Se conversó con el cliente y se le ofreció un descuento en su próxima visita.')
                ) as x(tipo, descripcion, resolucion)
                where x.tipo = v_tipo_inc;
            end if;
        end loop;

        -- Liquidación del día: cerrada a las 19:30, con los montos que
        -- calcula la misma función que usa la app.
        if d <= c_cerrar then
            insert into liquidacion (trabajador_id, fecha, monto_cobrado_base, monto_destajo,
                                     monto_sueldo, monto_descuento, cerrada, fecha_cierre,
                                     entregada, fecha_entrega)
            select q.trabajador_id, d, q.monto_cobrado_base, q.monto_destajo, q.monto_sueldo, q.monto_descuento,
                   true, (d + time '19:30') at time zone 'America/Lima',
                   (t.frecuencia = 'diario') or (d + (6 - dow + 7) % 7 <= c_pagado),
                   case when t.frecuencia = 'diario' then d
                        when d + (6 - dow + 7) % 7 <= c_pagado then d + (6 - dow + 7) % 7 end
            from fn_calcular_liquidacion(d) q
            join trabajador t on t.id = q.trabajador_id;
        end if;

        d := d + 1;
    end loop;
end $$;
