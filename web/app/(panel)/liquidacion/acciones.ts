"use server";

import { revalidatePath } from "next/cache";
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
