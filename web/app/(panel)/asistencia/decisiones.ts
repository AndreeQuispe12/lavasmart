"use server";

import { revalidatePath } from "next/cache";
import { hoyEnLima } from "@/lib/fecha";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoDecision = { error: string | null };

// Hasta 6 enteros y 2 decimales: lo que cabe en numeric(8,2).
const MONTO = /^\d{1,6}(\.\d{1,2})?$/;

// Lo que el dueño decide sobre un trabajador de sueldo fijo que llegó
// tarde HOY. La base lo vuelve a exigir con tr_asistencia_decision_dueno
// (sql/06): solo el dueño, el descuento solo al fijo, y anota quién
// decidió en autorizado_por.

export async function aplicarDescuento(
  trabajadorId: number,
  _anterior: EstadoDecision,
  formulario: FormData,
): Promise<EstadoDecision> {
  await exigirDueno();

  const monto = String(formulario.get("monto") ?? "").trim();
  const motivo = String(formulario.get("motivo") ?? "").trim();
  if (!MONTO.test(monto) || Number(monto) === 0) {
    return { error: "Escribe el descuento en soles, mayor que 0." };
  }
  if (!motivo) {
    return { error: "Escribe el motivo: queda anotado junto al descuento." };
  }

  const fila = await asistenciaDeHoy(trabajadorId);
  if ("error" in fila) return fila;

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("asistencia")
    .update({
      // Seguro como número: MONTO ya limitó los dígitos (ver personal).
      descuento_monto: Number(monto),
      descuento_motivo: motivo,
    })
    .eq("id", fila.id);

  return terminar(error);
}

// No lo deja trabajar: ese día no recibe autos (sql/05) y el descuento
// pierde sentido, así que se borra si lo había.
export async function marcarNoLaboro(
  trabajadorId: number,
): Promise<EstadoDecision> {
  await exigirDueno();

  const fila = await asistenciaDeHoy(trabajadorId);
  if ("error" in fila) return fila;

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("asistencia")
    .update({
      estado: "no_laboro",
      descuento_monto: 0,
      descuento_motivo: null,
    })
    .eq("id", fila.id);

  return terminar(error);
}

// Solo se decide sobre una tardanza de hoy. Los días pasados ya pueden
// estar en una liquidación.
async function asistenciaDeHoy(
  trabajadorId: number,
): Promise<{ id: number } | { error: string }> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("asistencia")
    .select("id, estado, trabajador(modalidad)")
    .eq("trabajador_id", trabajadorId)
    .eq("fecha", hoyEnLima())
    .maybeSingle();

  if (!data) {
    return { error: "No tiene asistencia marcada hoy." };
  }
  if (data.trabajador?.modalidad !== "fijo") {
    return { error: "Solo se decide sobre los de sueldo fijo." };
  }
  if (data.estado !== "tardanza") {
    return { error: "Solo se decide cuando llegó tarde." };
  }
  return { id: data.id };
}

function terminar(error: { message: string } | null): EstadoDecision {
  if (error) {
    // El disparador de sql/06 nombra la regla al inicio del mensaje.
    if (error.message.includes("asistencia_decision_dueno")) {
      return { error: "Solo el dueño puede tomar esta decisión." };
    }
    if (error.message.includes("asistencia_descuento_solo_fijo")) {
      return { error: "El trabajador a destajo no lleva descuento." };
    }
    return { error: `No se pudo guardar: ${error.message}` };
  }
  revalidatePath("/asistencia");
  return { error: null };
}
