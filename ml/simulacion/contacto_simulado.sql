-- =====================================================================
--  LavaSmart — ml/simulacion/contacto_simulado.sql
--  Les pone nombre y celular INVENTADOS a los clientes simulados que no
--  los tienen, para que la demo muestre listas como «A quién llamar esta
--  semana» completas en vez de llenas de guiones.
--
--  SOLO PARA LavaSmart-dev. Igual que historico_simulado.sql, se niega a
--  correr si no encuentra los datos de 03_datos_prueba (placa ABC-123).
--
--  Qué hace:
--    - Toca solo placas que empiezan por Z (las del histórico simulado y
--      del relleno). Los autos cargados a mano en la demo no se tocan.
--    - Solo llena lo que está vacío: quien ya tenía nombre o celular lo
--      conserva, y así siguen juntas las placas que comparten dueño.
--    - El celular es 9001 seguido del id del cliente con ceros: cumple el
--      formato de sql/16 (9 dígitos que empiezan por 9) y no se repite.
--      La simulación usa 9000xxxxx al azar; con 9001 no choca con esos,
--      que sí comparten celular a propósito (un dueño con dos autos).
--    - Nombres con la misma lista de historico_simulado.sql, elegidos por
--      el id para que volver a correrlo dé lo mismo.
--
--  Se puede volver a correr: lo que ya está lleno se salta. No borra nada.
-- =====================================================================

do $$
declare
    nombres   text[] := array['Luis','Carlos','José','Jorge','Miguel','Juan','Ricardo','César','Víctor','Óscar',
                              'Rosa','María','Ana','Carmen','Patricia','Lucía','Jessica','Milagros','Gloria','Elena'];
    apellidos text[] := array['Quispe','Flores','Rodríguez','García','Huamán','Mendoza','Torres','Rojas','Vargas','Castillo',
                              'Chávez','Ramírez','Sánchez','Díaz','Paredes','Gutiérrez','Ríos','Salazar','Cárdenas','Espinoza'];
    n_nombre  int;
    n_tel     int;
begin
    if not exists (select 1 from cliente where placa = 'ABC-123') then
        raise exception 'No parece LavaSmart-dev: falta la placa ABC-123 de 03_datos_prueba. No se toca nada.';
    end if;

    update cliente
    set nombre = nombres[1 + (id * 7) % 20] || ' ' || apellidos[1 + (id * 13) % 20]
    where placa like 'Z%' and nombre is null;
    get diagnostics n_nombre = row_count;

    update cliente
    set telefono = '9001' || lpad((id % 100000)::text, 5, '0')
    where placa like 'Z%' and telefono is null;
    get diagnostics n_tel = row_count;

    raise notice 'Nombres puestos: %. Celulares puestos: %.', n_nombre, n_tel;
end $$;
