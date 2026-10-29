"use server";

import { revalidatePath } from "next/cache";
import { soles } from "@/lib/dinero";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoCierre = { error: string | null; mensaje: string | null };

// Cierra el día: la base calcula y congela lo devengado por cada
// trabajador (fn_cerrar_dia, sql/10). Desde ahí esos montos no cambian.
export async function cerrarDia(fecha: string): Promise<EstadoCierre> {
  await exigirDueno();

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("fn_cerrar_dia", {
    p_fecha: fecha,
  });

  if (error) {
    const regla = /^[a-z_]+: (.+)$/.exec(error.message);
    return {
      error: regla ? regla[1] : `No se pudo cerrar: ${error.message}`,
      mensaje: null,
    };
  }

  const cuenta = (r: string) => data.filter((f) => f.resultado === r).length;
  const cerradas = cuenta("cerrada");
  const conAutos = cuenta("autos_en_piso");

  revalidatePath("/liquidacion");
  return {
    error: null,
    mensaje:
      `Se cerraron ${cerradas} liquidaciones.` +
      (conAutos > 0
        ? ` ${conAutos} quedan abiertas porque su lavador tiene autos en piso: entrégalos y vuelve a cerrar.`
        : ""),
  };
}

// Registra que el dinero salió del cajón: paga todos los días cerrados y
// pendientes del trabajador hasta "hasta", el último día que el dueño vio
// en pantalla (fn_entregar_pago, sql/11). La fecha de pago la pone la base.
export async function pagarTrabajador(
  trabajadorId: number,
  hasta: string,
): Promise<EstadoCierre> {
  await exigirDueno();

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("fn_entregar_pago", {
    p_trabajador_id: trabajadorId,
    p_hasta: hasta,
  });

  if (error) {
    const regla = /^[a-z_]+: (.+)$/.exec(error.message);
    return {
      error: regla
        ? regla[1]
        : `No se pudo registrar el pago: ${error.message}`,
      mensaje: null,
    };
  }

  const [pago] = data;
  revalidatePath("/liquidacion");
  return {
    error: null,
    mensaje: `Pago registrado: ${soles(pago.monto)} por ${pago.dias} día(s).`,
  };
}
