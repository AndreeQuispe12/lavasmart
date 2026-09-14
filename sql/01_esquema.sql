-- =====================================================================
--  LavaSmart — Esquema de base de datos
--  Sistema web de gestión operativa con analítica predictiva
--  para el lavadero de autos AquaBrillo (Lima, Perú)
--
--  Motor      : PostgreSQL 15+ (Supabase)
--  Región     : South America (São Paulo)
--  Zona horaria: America/Lima
--  Normalizado: Tercera Forma Normal (3FN)
--
--  Orden de ejecución: este archivo se ejecuta de una sola vez y en
--  este orden. Cada bloque solo referencia objetos de bloques
--  anteriores, por lo que ninguna llave foránea apunta a algo que
--  todavía no existe.
-- =====================================================================


-- =====================================================================
--  BLOQUE 0 — TIPOS ENUMERADOS
--  Los dominios cerrados se declaran como tipos propios en lugar de
--  CHECK sobre texto: quedan documentados en el catálogo del motor y
--  Supabase los traduce a uniones de TypeScript.
-- =====================================================================

create type modalidad_pago    as enum ('destajo', 'fijo');
create type frecuencia_pago   as enum ('diario', 'semanal');
create type rol_usuario       as enum ('dueno', 'operador');
create type estado_lavado     as enum ('en_proceso', 'entregado', 'anulado');
create type metodo_pago       as enum ('efectivo', 'yape');
create type tipo_incidencia   as enum ('dano', 'servicio_incompleto', 'objeto_faltante', 'otro');
create type estado_incidencia as enum ('abierta', 'en_proceso', 'resuelta');
create type estado_asistencia as enum ('puntual', 'tardanza', 'no_laboro', 'falta');
create type tipo_modelo       as enum ('regresion', 'kmeans');


-- =====================================================================
--  BLOQUE 1 — CATÁLOGOS
--  Tablas de configuración que mantiene el dueño. Cambian poco y
--  alimentan cálculos, por lo que ninguna se consulta para reconstruir
--  un dato histórico: para eso están las columnas congeladas.
-- =====================================================================

create table tipo_vehiculo (
    id          bigint generated always as identity primary key,
    nombre      text        not null,
    activo      boolean     not null default true,
    creado_en   timestamptz not null default now(),

    constraint tipo_vehiculo_nombre_unico   unique (nombre),
    constraint tipo_vehiculo_nombre_llenado check (length(trim(nombre)) > 0)
);

comment on table  tipo_vehiculo is 'Categorías tarifarias del parque vehicular. Cada una es una columna del tarifario.';
comment on column tipo_vehiculo.activo is 'Baja lógica. Un tipo con lavados asociados nunca se borra: se desactiva.';


create table tipo_lavado (
    id          bigint generated always as identity primary key,
    nombre      text        not null,
    descripcion text,
    activo      boolean     not null default true,
    creado_en   timestamptz not null default now(),

    constraint tipo_lavado_nombre_unico   unique (nombre),
    constraint tipo_lavado_nombre_llenado check (length(trim(nombre)) > 0)
);

comment on table  tipo_lavado is 'Servicios que ofrece el negocio. Cada uno es una fila del tarifario.';
comment on column tipo_lavado.descripcion is 'Qué incluye el servicio. Se muestra al cliente al momento de elegir.';


create table tarifa (
    id               bigint       generated always as identity primary key,
    tipo_vehiculo_id bigint       not null,
    tipo_lavado_id   bigint       not null,
    precio           numeric(8,2) not null,
    activo           boolean      not null default true,
    actualizado_en   timestamptz  not null default now(),

    constraint tarifa_tipo_vehiculo_fk foreign key (tipo_vehiculo_id)
        references tipo_vehiculo (id) on delete restrict,
    constraint tarifa_tipo_lavado_fk foreign key (tipo_lavado_id)
        references tipo_lavado (id) on delete restrict,
    constraint tarifa_combinacion_unica unique (tipo_vehiculo_id, tipo_lavado_id),
    constraint tarifa_precio_no_negativo check (precio >= 0)
);

comment on table  tarifa is 'Precio vigente en el cruce tipo de vehículo x tipo de lavado. Es el precio de HOY, no el histórico.';
comment on column tarifa.precio is 'Se copia a detalle_lavado.precio_cobrado al registrar un servicio. Cambiarlo no altera lavados pasados.';


create table configuracion (
    clave          text        primary key,
    valor          text        not null,
    descripcion    text,
    actualizado_en timestamptz not null default now()
);

comment on table configuracion is 'Parámetros del negocio. Nada de esto va escrito en el código de la aplicación.';


-- =====================================================================
--  BLOQUE 2 — PERSONAS
-- =====================================================================

create table trabajador (
    id            bigint          generated always as identity primary key,
    nombres       text            not null,
    apellidos     text            not null,
    documento     text            not null,
    modalidad     modalidad_pago  not null,
    frecuencia    frecuencia_pago not null,
    sueldo_dia    numeric(8,2),
    fecha_ingreso date            not null default current_date,
    activo        boolean         not null default true,
    creado_en     timestamptz     not null default now(),

    constraint trabajador_documento_unico unique (documento),

    -- El sueldo diario existe si y solo si la modalidad es fija.
    constraint trabajador_sueldo_coherente check (
        (modalidad = 'fijo'    and sueldo_dia is not null and sueldo_dia > 0) or
        (modalidad = 'destajo' and sueldo_dia is null)
    ),

    -- Regla del negocio: el sueldo fijo siempre se paga semanal.
    constraint trabajador_fijo_es_semanal check (
        modalidad <> 'fijo' or frecuencia = 'semanal'
    )
);

comment on table  trabajador is 'Personal del lavadero. No son usuarios del sistema: sus datos los registra el operador o el dueño.';
comment on column trabajador.frecuencia is 'Cada cuánto se le entrega el dinero. Define qué sale del cajón cada día, no cuánto se devenga.';
comment on column trabajador.sueldo_dia is 'Monto diario del trabajador de sueldo fijo, asignado por el dueño según experiencia. Nulo en destajo.';


create table cliente (
    id               bigint      generated always as identity primary key,
    placa            text        not null,
    tipo_vehiculo_id bigint      not null,
    nombre           text,
    telefono         text,
    creado_en        timestamptz not null default now(),

    constraint cliente_placa_unica unique (placa),
    constraint cliente_tipo_vehiculo_fk foreign key (tipo_vehiculo_id)
        references tipo_vehiculo (id) on delete restrict,
    constraint cliente_placa_formato check (placa ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$')
);

comment on table  cliente is 'Un cliente equivale a un vehículo, identificado por su placa.';
comment on column cliente.placa is 'Identificador seudonimizado del cliente. Se normaliza a mayúsculas sin espacios por trigger.';
comment on column cliente.nombre is 'Opcional. Solo si el cliente lo entrega voluntariamente.';


create table perfil (
    id            uuid        primary key,
    trabajador_id bigint,
    rol           rol_usuario not null default 'operador',
    creado_en     timestamptz not null default now(),

    constraint perfil_usuario_fk foreign key (id)
        references auth.users (id) on delete cascade,
    constraint perfil_trabajador_fk foreign key (trabajador_id)
        references trabajador (id) on delete set null,
    constraint perfil_trabajador_unico unique (trabajador_id)
);

comment on table perfil is 'Puente entre el usuario autenticado de Supabase y su rol en el negocio. Es la base de todas las políticas RLS.';
comment on column perfil.rol is 'Los permisos del dueño son un superconjunto de los del operador: puede hacer todo lo del operador y además administrar.';


-- =====================================================================
--  BLOQUE 3 — OPERACIÓN DIARIA
--  El núcleo del sistema y la fuente de datos de los modelos.
--  Un lavado se escribe en dos momentos: al ingresar el auto y al
--  entregarlo, porque el cobro ocurre cuando el auto ya está lavado.
-- =====================================================================

create table lavado (
    id                 bigint        generated always as identity primary key,
    cliente_id         bigint        not null,
    trabajador_id      bigint        not null,
    registrado_por     uuid,
    fecha_hora_ingreso timestamptz   not null default now(),
    fecha_hora_entrega timestamptz,
    estado             estado_lavado not null default 'en_proceso',
    monto_cobrado      numeric(8,2)  not null default 0,
    metodo_pago        metodo_pago,
    porcentaje_destajo numeric(5,2),
    observacion        text,

    constraint lavado_cliente_fk foreign key (cliente_id)
        references cliente (id) on delete restrict,
    constraint lavado_trabajador_fk foreign key (trabajador_id)
        references trabajador (id) on delete restrict,
    constraint lavado_registrado_por_fk foreign key (registrado_por)
        references perfil (id) on delete set null,

    constraint lavado_cobrado_no_negativo check (monto_cobrado >= 0),

    constraint lavado_porcentaje_valido check (
        porcentaje_destajo is null or (porcentaje_destajo >= 0 and porcentaje_destajo <= 100)
    ),

    -- La entrega no puede ser anterior al ingreso.
    constraint lavado_entrega_posterior check (
        fecha_hora_entrega is null or fecha_hora_entrega >= fecha_hora_ingreso
    ),

    -- Un lavado entregado tiene hora de entrega y método de pago.
    -- Uno que no lo está no tiene nada cobrado: cero cobrado NO es deuda.
    constraint lavado_entrega_coherente check (
        (estado =  'entregado' and fecha_hora_entrega is not null and metodo_pago is not null)
     or (estado <> 'entregado' and fecha_hora_entrega is null     and metodo_pago is null
                              and monto_cobrado = 0)
    )
);

comment on table  lavado is 'La visita completa: un vehículo, un lavador, uno o más servicios. Se crea al ingresar y se completa al entregar.';
comment on column lavado.fecha_hora_ingreso is 'Hora exacta, no solo fecha: la predicción de demanda necesita la franja horaria.';
comment on column lavado.monto_cobrado is 'Lo que el cliente entregó de verdad. Arranca en cero mientras el auto está en proceso.';
comment on column lavado.porcentaje_destajo is 'DATO CONGELADO. 50 o 40 según la asistencia del lavador ese día. Nulo si es de sueldo fijo.';
comment on column lavado.registrado_por is 'Quién capturó el registro, que no siempre es quien lavó: el dueño también registra cuando cubre el turno.';


create table detalle_lavado (
    id             bigint       generated always as identity primary key,
    lavado_id      bigint       not null,
    tipo_lavado_id bigint       not null,
    precio_cobrado numeric(8,2) not null,

    constraint detalle_lavado_fk foreign key (lavado_id)
        references lavado (id) on delete cascade,
    constraint detalle_tipo_lavado_fk foreign key (tipo_lavado_id)
        references tipo_lavado (id) on delete restrict,
    constraint detalle_servicio_unico unique (lavado_id, tipo_lavado_id),
    constraint detalle_precio_no_negativo check (precio_cobrado >= 0)
);

comment on table  detalle_lavado is 'Cada servicio dentro de la visita. Un completo más un encerado son dos filas.';
comment on column detalle_lavado.precio_cobrado is 'DATO CONGELADO. Copiado de tarifa al registrar. El reporte de junio debe seguir diciendo lo que se cobró en junio.';


create table incidencia (
    id               bigint            generated always as identity primary key,
    cliente_id       bigint            not null,
    lavado_id        bigint,
    tipo             tipo_incidencia   not null,
    descripcion      text              not null,
    estado           estado_incidencia not null default 'abierta',
    fecha_reporte    timestamptz       not null default now(),
    fecha_resolucion timestamptz,
    resolucion       text,
    registrado_por   uuid,

    constraint incidencia_cliente_fk foreign key (cliente_id)
        references cliente (id) on delete restrict,
    constraint incidencia_lavado_fk foreign key (lavado_id)
        references lavado (id) on delete set null,
    constraint incidencia_registrado_por_fk foreign key (registrado_por)
        references perfil (id) on delete set null,

    constraint incidencia_descripcion_llenada check (length(trim(descripcion)) > 0),

    constraint incidencia_resolucion_coherente check (
        (estado =  'resuelta' and fecha_resolucion is not null and resolucion is not null)
     or (estado <> 'resuelta' and fecha_resolucion is null)
    )
);

comment on table  incidencia is 'Rayones al secar, un aspirado que no se hizo, un objeto faltante. Ocurren durante el lavado.';
comment on column incidencia.lavado_id is 'Nulo cuando el reclamo llega días después y no se puede atribuir a una visita. Cuando existe, de él se derivan el lavador y la fecha.';


-- =====================================================================
--  BLOQUE 4 — PERSONAL Y LIQUIDACIÓN
-- =====================================================================

create table asistencia (
    id                 bigint            generated always as identity primary key,
    trabajador_id      bigint            not null,
    fecha              date              not null default current_date,
    hora_ingreso       time,
    estado             estado_asistencia not null,
    hora_referencia    time              not null,
    tolerancia_minutos integer           not null,
    porcentaje_destajo numeric(5,2),
    descuento_monto    numeric(8,2)      not null default 0,
    descuento_motivo   text,
    autorizado_por     uuid,
    registrado_en      timestamptz       not null default now(),

    constraint asistencia_trabajador_fk foreign key (trabajador_id)
        references trabajador (id) on delete restrict,
    constraint asistencia_autorizado_por_fk foreign key (autorizado_por)
        references perfil (id) on delete set null,

    constraint asistencia_unica unique (trabajador_id, fecha),

    -- Solo la falta carece de hora de ingreso.
    constraint asistencia_hora_coherente check (
        (estado =  'falta' and hora_ingreso is null)
     or (estado <> 'falta' and hora_ingreso is not null)
    ),

    -- Todo descuento lleva su motivo: lo decide el dueño, no una fórmula.
    constraint asistencia_descuento_motivado check (
        descuento_monto = 0 or descuento_motivo is not null
    ),
    constraint asistencia_descuento_no_negativo check (descuento_monto >= 0),
    constraint asistencia_tolerancia_valida  check (tolerancia_minutos >= 0),
    constraint asistencia_porcentaje_valido  check (
        porcentaje_destajo is null or (porcentaje_destajo >= 0 and porcentaje_destajo <= 100)
    )
);

comment on table  asistencia is 'Una fila por lavador y día. De aquí sale el porcentaje del destajo que se congela en cada lavado.';
comment on column asistencia.hora_referencia is 'DATO CONGELADO. La hora de entrada vigente ese día. Moverla después no vuelve puntual a quien llegó tarde.';
comment on column asistencia.tolerancia_minutos is 'DATO CONGELADO. Los minutos de tolerancia vigentes ese día.';
comment on column asistencia.descuento_monto is 'Solo para sueldo fijo. Se escribe a mano: el dueño decide cuánto y si lo deja trabajar.';


create table liquidacion (
    id                 bigint        generated always as identity primary key,
    trabajador_id      bigint        not null,
    fecha              date          not null,
    monto_cobrado_base numeric(10,2) not null default 0,
    monto_destajo      numeric(10,2) not null default 0,
    cerrada            boolean       not null default false,
    fecha_cierre       timestamptz,
    entregada          boolean       not null default false,
    fecha_entrega      date,

    constraint liquidacion_trabajador_fk foreign key (trabajador_id)
        references trabajador (id) on delete restrict,
    constraint liquidacion_unica unique (trabajador_id, fecha),

    constraint liquidacion_montos_no_negativos check (
        monto_cobrado_base >= 0 and monto_destajo >= 0
    ),
    constraint liquidacion_cierre_coherente  check (cerrada   = (fecha_cierre  is not null)),
    constraint liquidacion_entrega_coherente check (entregada = (fecha_entrega is not null)),

    -- No se entrega dinero de un día que todavía no se cerró.
    constraint liquidacion_entrega_requiere_cierre check (not entregada or cerrada)
);

comment on table  liquidacion is 'Cierre diario del destajo. Devengar no es pagar: el monto se calcula todos los días, el dinero sale cuando se entrega.';
comment on column liquidacion.entregada is 'Si el dinero ya se le entregó al lavador. Para quien cobra semanal, varias liquidaciones comparten fecha_entrega.';


-- =====================================================================
--  BLOQUE 5 — SALIDAS DE LOS MODELOS
--  Estas tablas no las escribe la aplicación: las llena el proceso de
--  entrenamiento por lotes. El sistema web solo las lee.
-- =====================================================================

create table prediccion_demanda (
    id                  bigint       generated always as identity primary key,
    fecha_objetivo      date         not null,
    vehiculos_estimados numeric(6,2) not null,
    intervalo_inferior  numeric(6,2),
    intervalo_superior  numeric(6,2),
    modelo_version      text         not null,
    generado_en         timestamptz  not null default now(),

    constraint prediccion_unica unique (fecha_objetivo, modelo_version),
    constraint prediccion_estimado_no_negativo check (vehiculos_estimados >= 0),
    constraint prediccion_intervalo_coherente check (
        intervalo_inferior is null
     or intervalo_superior is null
     or intervalo_inferior <= intervalo_superior
    )
);

comment on table prediccion_demanda is 'Salida del modelo de regresión: vehículos esperados por día para la semana siguiente.';


create table cliente_segmento (
    id             bigint        generated always as identity primary key,
    cliente_id     bigint        not null,
    segmento       text          not null,
    recencia_dias  integer       not null,
    frecuencia     integer       not null,
    monetario      numeric(10,2) not null,
    modelo_version text          not null,
    calculado_en   timestamptz   not null default now(),

    constraint cliente_segmento_cliente_fk foreign key (cliente_id)
        references cliente (id) on delete cascade,
    constraint cliente_segmento_unico unique (cliente_id, modelo_version),
    constraint cliente_segmento_rfm_valido check (
        recencia_dias >= 0 and frecuencia >= 0 and monetario >= 0
    )
);

comment on table cliente_segmento is 'Salida del K-Means sobre el modelo RFM. Una fila por cliente y versión del modelo.';


create table modelo_metrica (
    id                  bigint        generated always as identity primary key,
    modelo              tipo_modelo   not null,
    version             text          not null,
    metrica             text          not null,
    valor               numeric(10,4) not null,
    filas_entrenamiento integer       not null,
    entrenado_en        timestamptz   not null default now(),

    constraint modelo_metrica_unica unique (modelo, version, metrica),
    constraint modelo_metrica_filas_validas check (filas_entrenamiento >= 0)
);

comment on table modelo_metrica is 'Trazabilidad del entrenamiento: RMSE y MAE para la regresión, silhouette y k para el clustering.';


-- =====================================================================
--  BLOQUE 6 — VISTAS
--  Los totales no se guardan: se calculan. Guardarlos obligaría a
--  mantenerlos sincronizados con el detalle y abriría la puerta a que
--  ambos digan cosas distintas.
-- =====================================================================

create view v_lavado as
select
    l.id,
    l.cliente_id,
    c.placa,
    c.tipo_vehiculo_id,
    l.trabajador_id,
    l.registrado_por,
    l.fecha_hora_ingreso,
    l.fecha_hora_entrega,
    l.estado,
    coalesce(d.monto_total, 0)                       as monto_total,
    l.monto_cobrado,
    coalesce(d.monto_total, 0) - l.monto_cobrado     as saldo,
    l.metodo_pago,
    l.porcentaje_destajo,
    case
        when l.estado <> 'entregado'                              then 'sin_cobrar'
        when l.monto_cobrado >= coalesce(d.monto_total, 0)        then 'pagado'
        when l.monto_cobrado > 0                                  then 'parcial'
        else                                                           'pendiente'
    end                                              as estado_pago,
    l.observacion
from lavado l
join cliente c on c.id = l.cliente_id
left join (
    select lavado_id, sum(precio_cobrado) as monto_total
    from detalle_lavado
    group by lavado_id
) d on d.lavado_id = l.id;

comment on view v_lavado is 'El lavado con su total, su saldo y su estado de pago calculados. Es la vista que consume la aplicación.';


create view v_caja_dia as
select
    (l.fecha_hora_entrega at time zone 'America/Lima')::date as fecha,
    sum(l.monto_cobrado) filter (where l.metodo_pago = 'efectivo') as cobrado_efectivo,
    sum(l.monto_cobrado) filter (where l.metodo_pago = 'yape')     as cobrado_yape,
    sum(l.monto_cobrado)                                           as cobrado_total,
    count(*)                                                       as autos_entregados
from lavado l
where l.estado = 'entregado'
group by 1;

comment on view v_caja_dia is 'Cobranza del día separada por medio de pago. El efectivo es la cifra que se compara contra el cajón físico.';


-- =====================================================================
--  BLOQUE 7 — FUNCIONES Y DISPARADORES
--  Reglas que el motor hace cumplir por sí mismo, sin depender de que
--  la aplicación se acuerde de aplicarlas.
-- =====================================================================

-- Normaliza la placa antes de guardarla: la pasa a mayúsculas, le quita
-- todo lo que no sea letra o número y le coloca el guion en su sitio.
-- Así "abc123", "ABC 123" y "abc-123" quedan todas como 'ABC-123', que
-- es lo que necesita un operador escribiendo rápido.
create or replace function fn_normalizar_placa()
returns trigger
language plpgsql
as $$
declare
    v_limpia text;
begin
    v_limpia := upper(regexp_replace(new.placa, '[^A-Za-z0-9]', '', 'g'));

    if length(v_limpia) = 6 then
        new.placa := substr(v_limpia, 1, 3) || '-' || substr(v_limpia, 4, 3);
    else
        new.placa := v_limpia;   -- queda inválida y el CHECK la rechaza
    end if;

    return new;
end;
$$;

create trigger tr_cliente_normalizar_placa
    before insert or update of placa on cliente
    for each row execute function fn_normalizar_placa();


-- Congela en el lavado el porcentaje de destajo del día, tomado de la
-- asistencia del lavador. De paso impide asignar un auto a alguien que
-- todavía no marcó ingreso.
create or replace function fn_fijar_porcentaje_destajo()
returns trigger
language plpgsql
as $$
declare
    v_modalidad modalidad_pago;
    v_porcentaje numeric(5,2);
    v_fecha date;
begin
    select modalidad into v_modalidad
    from trabajador where id = new.trabajador_id;

    if v_modalidad = 'fijo' then
        new.porcentaje_destajo := null;
        return new;
    end if;

    v_fecha := (new.fecha_hora_ingreso at time zone 'America/Lima')::date;

    select a.porcentaje_destajo into v_porcentaje
    from asistencia a
    where a.trabajador_id = new.trabajador_id
      and a.fecha = v_fecha;

    if v_porcentaje is null then
        raise exception
            'El lavador % no tiene asistencia registrada para el %. Registre su ingreso antes de asignarle un auto.',
            new.trabajador_id, v_fecha;
    end if;

    new.porcentaje_destajo := v_porcentaje;
    return new;
end;
$$;

create trigger tr_lavado_fijar_porcentaje
    before insert on lavado
    for each row execute function fn_fijar_porcentaje_destajo();


-- Al entregar: exige que el lavado tenga servicios y que no se cobre
-- más de lo facturado. El total vive en el detalle, así que no puede
-- validarse con un CHECK.
create or replace function fn_validar_cobro()
returns trigger
language plpgsql
as $$
declare
    v_total numeric(10,2);
begin
    if new.estado <> 'entregado' then
        return new;
    end if;

    select coalesce(sum(precio_cobrado), 0) into v_total
    from detalle_lavado
    where lavado_id = new.id;

    if v_total = 0 then
        raise exception 'No se puede entregar un lavado sin servicios registrados.';
    end if;

    if new.monto_cobrado > v_total then
        raise exception
            'El monto cobrado (S/ %) supera el total del servicio (S/ %).',
            new.monto_cobrado, v_total;
    end if;

    return new;
end;
$$;

create trigger tr_lavado_validar_cobro
    before update on lavado
    for each row execute function fn_validar_cobro();


-- Una liquidación cerrada es inmutable en sus montos. Solo puede
-- marcarse como entregada.
create or replace function fn_proteger_liquidacion_cerrada()
returns trigger
language plpgsql
as $$
begin
    if old.cerrada
       and (old.monto_cobrado_base is distinct from new.monto_cobrado_base
            or old.monto_destajo   is distinct from new.monto_destajo
            or old.fecha           is distinct from new.fecha) then
        raise exception 'Una liquidación cerrada no puede modificar sus montos ni su fecha.';
    end if;
    return new;
end;
$$;

create trigger tr_liquidacion_proteger_cerrada
    before update on liquidacion
    for each row execute function fn_proteger_liquidacion_cerrada();


-- =====================================================================
--  BLOQUE 8 — ÍNDICES
--  Las llaves primarias, únicas y foráneas ya generan los suyos. Estos
--  son los que piden las consultas reales del sistema.
-- =====================================================================

create index idx_lavado_ingreso      on lavado (fecha_hora_ingreso);
create index idx_lavado_trabajador   on lavado (trabajador_id, fecha_hora_ingreso);
create index idx_lavado_cliente      on lavado (cliente_id);
create index idx_lavado_entrega      on lavado (fecha_hora_entrega) where estado = 'entregado';
create index idx_lavado_en_piso      on lavado (fecha_hora_ingreso) where estado = 'en_proceso';

create index idx_detalle_lavado      on detalle_lavado (lavado_id);

create index idx_incidencia_cliente  on incidencia (cliente_id);
create index idx_incidencia_abiertas on incidencia (fecha_reporte) where estado <> 'resuelta';

create index idx_asistencia_fecha    on asistencia (fecha);

create index idx_liquidacion_entrega on liquidacion (fecha_entrega) where entregada;
create index idx_liquidacion_por_pagar on liquidacion (trabajador_id, fecha) where not entregada;

create index idx_segmento_cliente    on cliente_segmento (cliente_id);
create index idx_prediccion_fecha    on prediccion_demanda (fecha_objetivo);


-- =====================================================================
--  BLOQUE 9 — SEGURIDAD A NIVEL DE FILA (RLS)
--  Se activa ANTES de insertar el primer dato. Los permisos del dueño
--  son un superconjunto de los del operador, no un conjunto distinto.
-- =====================================================================

create or replace function fn_es_dueno()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from perfil
        where id = auth.uid() and rol = 'dueno'
    );
$$;

create or replace function fn_es_personal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from perfil where id = auth.uid());
$$;


alter table tipo_vehiculo      enable row level security;
alter table tipo_lavado        enable row level security;
alter table tarifa             enable row level security;
alter table configuracion      enable row level security;
alter table trabajador         enable row level security;
alter table cliente            enable row level security;
alter table perfil             enable row level security;
alter table lavado             enable row level security;
alter table detalle_lavado     enable row level security;
alter table incidencia         enable row level security;
alter table asistencia         enable row level security;
alter table liquidacion        enable row level security;
alter table prediccion_demanda enable row level security;
alter table cliente_segmento   enable row level security;
alter table modelo_metrica     enable row level security;


-- Catálogos: los lee todo el personal, los modifica solo el dueño.
create policy cat_lectura_personal on tipo_vehiculo for select to authenticated using (fn_es_personal());
create policy cat_escritura_dueno  on tipo_vehiculo for all    to authenticated using (fn_es_dueno()) with check (fn_es_dueno());

create policy lav_lectura_personal on tipo_lavado   for select to authenticated using (fn_es_personal());
create policy lav_escritura_dueno  on tipo_lavado   for all    to authenticated using (fn_es_dueno()) with check (fn_es_dueno());

create policy tar_lectura_personal on tarifa        for select to authenticated using (fn_es_personal());
create policy tar_escritura_dueno  on tarifa        for all    to authenticated using (fn_es_dueno()) with check (fn_es_dueno());

create policy cfg_lectura_personal on configuracion for select to authenticated using (fn_es_personal());
create policy cfg_escritura_dueno  on configuracion for all    to authenticated using (fn_es_dueno()) with check (fn_es_dueno());

create policy trb_lectura_personal on trabajador    for select to authenticated using (fn_es_personal());
create policy trb_escritura_dueno  on trabajador    for all    to authenticated using (fn_es_dueno()) with check (fn_es_dueno());


-- Perfil: cada uno ve el suyo; el dueño los ve todos y es el único que los administra.
create policy prf_lectura_propia on perfil for select to authenticated
    using (id = auth.uid() or fn_es_dueno());
create policy prf_escritura_dueno on perfil for all to authenticated
    using (fn_es_dueno()) with check (fn_es_dueno());


-- Operación: la escribe todo el personal. Nadie borra.
create policy cli_personal on cliente        for select to authenticated using (fn_es_personal());
create policy cli_alta     on cliente        for insert to authenticated with check (fn_es_personal());
create policy cli_edicion  on cliente        for update to authenticated using (fn_es_personal()) with check (fn_es_personal());

create policy lvd_personal on lavado         for select to authenticated using (fn_es_personal());
create policy lvd_alta     on lavado         for insert to authenticated with check (fn_es_personal());
create policy lvd_edicion  on lavado         for update to authenticated using (fn_es_personal()) with check (fn_es_personal());

create policy det_personal on detalle_lavado for select to authenticated using (fn_es_personal());
create policy det_alta     on detalle_lavado for insert to authenticated with check (fn_es_personal());
create policy det_edicion  on detalle_lavado for update to authenticated using (fn_es_personal()) with check (fn_es_personal());

create policy inc_personal on incidencia     for select to authenticated using (fn_es_personal());
create policy inc_alta     on incidencia     for insert to authenticated with check (fn_es_personal());
create policy inc_edicion  on incidencia     for update to authenticated using (fn_es_personal()) with check (fn_es_personal());

create policy asi_personal on asistencia     for select to authenticated using (fn_es_personal());
create policy asi_alta     on asistencia     for insert to authenticated with check (fn_es_personal());
create policy asi_edicion  on asistencia     for update to authenticated using (fn_es_personal()) with check (fn_es_personal());


-- Liquidación: solo el dueño. Es dinero del personal.
create policy liq_dueno on liquidacion for all to authenticated
    using (fn_es_dueno()) with check (fn_es_dueno());


-- Salidas de los modelos: el personal solo lee. Escribe únicamente el
-- proceso de entrenamiento, que usa la clave de servicio y no pasa por RLS.
create policy pre_lectura on prediccion_demanda for select to authenticated using (fn_es_personal());
create policy seg_lectura on cliente_segmento   for select to authenticated using (fn_es_personal());
create policy met_lectura on modelo_metrica     for select to authenticated using (fn_es_personal());


-- =====================================================================
--  BLOQUE 10 — DATOS SEMILLA
--  Los catálogos mínimos para que el sistema arranque.
--  IMPORTANTE: las tarifas de abajo son de ejemplo. Reemplácelas por
--  las tarifas reales de AquaBrillo antes de usar el sistema.
-- =====================================================================

insert into tipo_vehiculo (nombre) values
    ('Sedán'), ('Station wagon'), ('SUV'), ('Camioneta');

insert into tipo_lavado (nombre, descripcion) values
    ('Lavado completo',  'Exterior e interior, incluye aspirado'),
    ('Lavado por fuera', 'Carrocería, llantas y vidrios exteriores'),
    ('Lavado por dentro','Aspirado, tablero y tapizado'),
    ('Encerado',         'Aplicación de cera y pulido de carrocería'),
    ('Lavado de motor',  'Limpieza del compartimiento del motor');

insert into tarifa (tipo_vehiculo_id, tipo_lavado_id, precio)
select v.id, s.id, t.precio
from (values
    ('Sedán',        'Lavado completo',   20.00),
    ('Sedán',        'Lavado por fuera',  15.00),
    ('Sedán',        'Lavado por dentro', 15.00),
    ('Sedán',        'Encerado',          15.00),
    ('Sedán',        'Lavado de motor',   10.00),
    ('Station wagon','Lavado completo',   22.00),
    ('Station wagon','Lavado por fuera',  16.00),
    ('Station wagon','Lavado por dentro', 16.00),
    ('Station wagon','Encerado',          17.00),
    ('Station wagon','Lavado de motor',   11.00),
    ('SUV',          'Lavado completo',   24.00),
    ('SUV',          'Lavado por fuera',  17.00),
    ('SUV',          'Lavado por dentro', 17.00),
    ('SUV',          'Encerado',          19.00),
    ('SUV',          'Lavado de motor',   12.00),
    ('Camioneta',    'Lavado completo',   25.00),
    ('Camioneta',    'Lavado por fuera',  18.00),
    ('Camioneta',    'Lavado por dentro', 18.00),
    ('Camioneta',    'Encerado',          20.00),
    ('Camioneta',    'Lavado de motor',   12.00)
) as t (vehiculo, servicio, precio)
join tipo_vehiculo v on v.nombre = t.vehiculo
join tipo_lavado   s on s.nombre = t.servicio;

insert into configuracion (clave, valor, descripcion) values
    ('hora_entrada',           '08:00', 'Hora de referencia para evaluar la puntualidad del personal'),
    ('tolerancia_minutos',     '5',     'Minutos de tolerancia después de la hora de entrada'),
    ('pct_destajo_puntual',    '50',    'Porcentaje de lo cobrado que recibe el lavador puntual'),
    ('pct_destajo_tardanza',   '40',    'Porcentaje de lo cobrado que recibe el lavador que llegó tarde'),
    ('moneda',                 'PEN',   'Moneda de operación del negocio'),
    ('zona_horaria',           'America/Lima', 'Zona horaria para el cierre de los días');

-- =====================================================================
--  FIN DEL ESQUEMA
-- =====================================================================
