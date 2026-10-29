"use server";

import { revalidatePath } from "next/cache";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoGuardado = { error: string | null; mensaje: string | null };

// Hasta 6 enteros y 2 decimales: lo que cabe en numeric(8,2).
const MONTO = /^\d{1,6}(\.\d{1,2})?$/;

// Guarda los precios que cambiaron. Cambiar una tarifa no toca el pasado:
// cada lavado guardó el precio de su día en detalle_lavado.precio_cobrado.
export async function guardarTarifas(
  _anterior: EstadoGuardado,
  formulario: FormData,
): Promise<EstadoGuardado> {
  await exigirDueno();

  const supabase = await crearClienteServidor();
  const { data: actuales, error: errorLectura } = await supabase
    .from("tarifa")
    .select("tipo_vehiculo_id, tipo_lavado_id, precio");
  if (errorLectura) return fallar(errorLectura.message);

  const precioActual = new Map(
    actuales.map((t) => [
      `${t.tipo_vehiculo_id}_${t.tipo_lavado_id}`,
      t.precio.toFixed(2),
    ]),
  );

  // Cada campo se llama "precio_<vehículo>_<servicio>".
  const cambios = [];
  for (const [campo, valor] of formulario.entries()) {
    if (!campo.startsWith("precio_")) continue;
    const [vehiculo, servicio] = campo.slice("precio_".length).split("_");
    const precio = String(valor).trim();
    if (!MONTO.test(precio)) {
      return {
        error:
          "Cada precio va en soles, con hasta dos decimales (por ejemplo 20 o 22.50).",
        mensaje: null,
      };
    }
    if (
      precioActual.get(`${vehiculo}_${servicio}`) === Number(precio).toFixed(2)
    ) {
      continue; // No cambió: no se toca, así su fecha de actualización sigue siendo la real.
    }
    cambios.push({
      tipo_vehiculo_id: Number(vehiculo),
      tipo_lavado_id: Number(servicio),
      // Seguro como número: MONTO ya limitó los dígitos (ver personal).
      precio: Number(precio),
    });
  }

  if (cambios.length === 0) {
    return { error: null, mensaje: "No cambiaste ningún precio." };
  }

  // Un solo upsert: se guardan todos los cambios juntos o ninguno.
  const { error } = await supabase
    .from("tarifa")
    .upsert(cambios, { onConflict: "tipo_vehiculo_id,tipo_lavado_id" });
  if (error) return fallar(error.message);

  revalidatePath("/configuracion");
  revalidatePath("/lavados");
  return {
    error: null,
    mensaje: `Se actualizaron ${cambios.length} precio(s). Los lavados ya registrados conservan su precio.`,
  };
}

// Guarda las reglas de asistencia y destajo. La base valida cada valor
// (sql/12). Como cada asistencia copia la regla de su día, cambiarla no
// vuelve puntual a nadie que ya llegó tarde.
export async function guardarReglas(
  _anterior: EstadoGuardado,
  formulario: FormData,
): Promise<EstadoGuardado> {
  await exigirDueno();

  const valor = (campo: string) => String(formulario.get(campo) ?? "").trim();
  const reglas = {
    hora_entrada: valor("hora_entrada"),
    tolerancia_minutos: valor("tolerancia_minutos"),
    pct_destajo_puntual: valor("pct_destajo_puntual"),
    pct_destajo_tardanza: valor("pct_destajo_tardanza"),
  };

  // Regla del negocio que mira dos valores a la vez; la base revisa cada
  // uno por separado.
  if (
    Number(reglas.pct_destajo_tardanza) > Number(reglas.pct_destajo_puntual)
  ) {
    return {
      error: "El porcentaje con tardanza no puede ser mayor que el puntual.",
      mensaje: null,
    };
  }

  const supabase = await crearClienteServidor();
  // Un solo upsert: las cuatro reglas cambian juntas o ninguna.
  const { error } = await supabase.from("configuracion").upsert(
    Object.entries(reglas).map(([clave, v]) => ({ clave, valor: v })),
    { onConflict: "clave" },
  );
  if (error) return fallar(error.message);

  revalidatePath("/configuracion");
  revalidatePath("/asistencia");
  return {
    error: null,
    mensaje:
      "Reglas guardadas. Se aplican desde la próxima asistencia que se marque.",
  };
}

function fallar(mensaje: string): EstadoGuardado {
  // Las reglas de sql/12 empiezan con su nombre y siguen en español.
  const regla = /^[a-z_]+: (.+)$/.exec(mensaje);
  return {
    error: regla ? regla[1] : `No se pudo guardar: ${mensaje}`,
    mensaje: null,
  };
}
