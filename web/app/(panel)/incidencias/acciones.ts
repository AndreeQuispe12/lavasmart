"use server";

import { revalidatePath } from "next/cache";
import { normalizarPlaca } from "@/lib/placa";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { Constants, type Enums } from "@/lib/supabase/tipos";

export type EstadoIncidencia = {
  error: string | null;
  mensaje: string | null;
  version: number;
};

// Registra un reclamo. Lo hacen los dos roles. La base (sql/09) exige que
// la visita sea de ese auto y pone la fecha, el estado y quién registró.
export async function registrarIncidencia(
  anterior: EstadoIncidencia,
  formulario: FormData,
): Promise<EstadoIncidencia> {
  const fallar = (error: string): EstadoIncidencia => ({
    ...anterior,
    error,
    mensaje: null,
  });

  const placa = normalizarPlaca(String(formulario.get("placa") ?? ""));
  const lavado = String(formulario.get("lavado") ?? "");
  const tipo = String(formulario.get("tipo") ?? "");
  const descripcion = String(formulario.get("descripcion") ?? "").trim();

  if (!esTipo(tipo)) return fallar("Elige el tipo de incidencia.");
  if (!descripcion) return fallar("Describe qué pasó.");
  if (lavado !== "ninguno" && !/^\d+$/.test(lavado)) {
    return fallar("Elige la visita o «Sin visita asociada».");
  }

  const supabase = await crearClienteServidor();
  const { data: cliente } = await supabase
    .from("cliente")
    .select("id")
    .eq("placa", placa)
    .maybeSingle();
  if (!cliente) return fallar(`No hay visitas de la placa ${placa}.`);

  const { error } = await supabase.from("incidencia").insert({
    cliente_id: cliente.id,
    lavado_id: lavado === "ninguno" ? null : Number(lavado),
    tipo,
    descripcion,
  });

  if (error) {
    if (error.message.includes("incidencia_lavado_de_otro_auto")) {
      return fallar("Esa visita no es de este auto.");
    }
    return fallar(`No se pudo registrar: ${error.message}`);
  }

  revalidatePath("/incidencias");
  return {
    error: null,
    mensaje: `Incidencia de ${placa} registrada.`,
    version: anterior.version + 1,
  };
}

// De "abierta" a "en proceso": alguien ya se está ocupando. Los dos roles.
export async function pasarAEnProceso(id: number) {
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("incidencia")
    .update({ estado: "en_proceso" })
    .eq("id", id)
    .eq("estado", "abierta");
  if (error) throw new Error(`No se pudo actualizar: ${error.message}`);
  revalidatePath("/incidencias");
}

// Cerrarla es del dueño: la resolución puede implicar plata. La base lo
// vuelve a exigir (incidencia_resuelve_dueno) y pone la fecha.
export async function resolverIncidencia(
  id: number,
  _anterior: { error: string | null },
  formulario: FormData,
): Promise<{ error: string | null }> {
  await exigirDueno();

  const resolucion = String(formulario.get("resolucion") ?? "").trim();
  if (!resolucion) return { error: "Escribe cómo se resolvió." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("incidencia")
    .update({ estado: "resuelta", resolucion })
    .eq("id", id);

  if (error) {
    if (error.message.includes("incidencia_resuelve_dueno")) {
      return { error: "Solo el dueño puede resolver una incidencia." };
    }
    if (error.message.includes("incidencia_cerrada")) {
      return { error: "Esta incidencia ya estaba resuelta." };
    }
    return { error: `No se pudo resolver: ${error.message}` };
  }
  revalidatePath("/incidencias");
  return { error: null };
}

function esTipo(valor: string): valor is Enums<"tipo_incidencia"> {
  return (Constants.public.Enums.tipo_incidencia as readonly string[]).includes(
    valor,
  );
}
