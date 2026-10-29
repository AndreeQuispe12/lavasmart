"use server";

import { revalidatePath } from "next/cache";
import { horaEnLima, hoyEnLima, minutosDelDia } from "@/lib/fecha";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { leerReglasAsistencia } from "./reglas";

export type EstadoMarca = { error: string | null };

// Marca la asistencia de hoy de un trabajador. La usan el operador y el
// dueño; RLS (asi_alta, asi_edicion) exige que quien marca tenga perfil.
//   "entrada": llegó ahora. Se compara la hora con la referencia más la
//              tolerancia y se congela el porcentaje del destajo del día.
//   "falta":   no vino. Sin hora y sin porcentaje: ese día no recibe autos.
// useActionState le pasa además el estado anterior y el FormData; no se
// usan, así que no se declaran.
export async function marcarAsistencia(
  trabajadorId: number,
  tipo: "entrada" | "falta",
): Promise<EstadoMarca> {
  const supabase = await crearClienteServidor();
  const fecha = hoyEnLima();

  const { data: trabajador } = await supabase
    .from("trabajador")
    .select("modalidad, activo")
    .eq("id", trabajadorId)
    .maybeSingle();
  if (!trabajador?.activo) {
    return { error: "El trabajador no existe o está dado de baja." };
  }

  const { data: existente } = await supabase
    .from("asistencia")
    .select("id, estado")
    .eq("trabajador_id", trabajadorId)
    .eq("fecha", fecha)
    .maybeSingle();

  // Única corrección permitida aquí: se marcó falta y después llegó.
  // Cualquier otra ya registrada se queda como está.
  if (existente && !(existente.estado === "falta" && tipo === "entrada")) {
    return { error: "Ya tiene asistencia registrada hoy." };
  }

  let reglas;
  try {
    reglas = await leerReglasAsistencia(supabase);
  } catch (e) {
    return { error: (e as Error).message };
  }

  let fila;
  if (tipo === "falta") {
    fila = {
      hora_ingreso: null,
      estado: "falta" as const,
      porcentaje_destajo: null,
    };
  } else {
    const hora = horaEnLima();
    // "8:05 o antes" es puntual: se compara por minutos, con <=.
    const puntual =
      minutosDelDia(hora) <=
      minutosDelDia(reglas.horaReferencia) + reglas.tolerancia;
    fila = {
      hora_ingreso: hora,
      estado: puntual ? ("puntual" as const) : ("tardanza" as const),
      // El de sueldo fijo no cobra porcentaje: su tardanza la resuelve el
      // dueño con un descuento a mano.
      porcentaje_destajo:
        trabajador.modalidad === "fijo"
          ? null
          : puntual
            ? reglas.pctPuntual
            : reglas.pctTardanza,
    };
  }

  // Las reglas del día se copian en la fila: son el dato congelado.
  const congelado = {
    hora_referencia: reglas.horaReferencia,
    tolerancia_minutos: reglas.tolerancia,
  };

  const { error } = existente
    ? await supabase
        .from("asistencia")
        .update({ ...fila, ...congelado })
        .eq("id", existente.id)
    : await supabase.from("asistencia").insert({
        trabajador_id: trabajadorId,
        fecha,
        ...fila,
        ...congelado,
      });

  if (error) {
    // Dos personas marcando al mismo trabajador a la vez: la segunda choca
    // con asistencia_unica.
    if (error.message.includes("asistencia_unica")) {
      return { error: "Ya tiene asistencia registrada hoy." };
    }
    return { error: `No se pudo registrar: ${error.message}` };
  }

  revalidatePath("/asistencia");
  return { error: null };
}
