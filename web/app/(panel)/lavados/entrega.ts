"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoEntrega = { error: string | null };

// Hasta 6 enteros y 2 decimales: lo que cabe en numeric(8,2).
const MONTO = /^\d{1,6}(\.\d{1,2})?$/;

// Entrega el auto y registra lo cobrado, con fn_registrar_entrega
// (sql/08). La hora la pone la base. Desde aquí el lavado ya no cambia.
// Lo hacen los dos roles.
export async function entregarAuto(
  lavadoId: number,
  _anterior: EstadoEntrega,
  formulario: FormData,
): Promise<EstadoEntrega> {
  const monto = String(formulario.get("monto") ?? "").trim();
  const metodo = String(formulario.get("metodo") ?? "");
  const sinPago = formulario.get("sinPago") === "si";

  if (!MONTO.test(monto)) {
    return { error: "Escribe lo cobrado en soles, por ejemplo 25 o 22.50." };
  }
  if (metodo !== "efectivo" && metodo !== "yape") {
    return { error: "Elige efectivo o Yape." };
  }
  // Cero cobrado se puede anotar (el cliente se fue sin pagar), pero no
  // por un descuido: hay que confirmarlo.
  if (Number(monto) === 0 && !sinPago) {
    return {
      error:
        "Cobrado S/ 0: si el cliente se fue sin pagar, marca la casilla para confirmarlo.",
    };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("fn_registrar_entrega", {
    p_lavado_id: lavadoId,
    // Seguro como número: MONTO ya limitó los dígitos (ver personal).
    p_monto: Number(monto),
    p_metodo: metodo,
  });

  if (error) {
    if (error.message.includes("supera el total")) {
      return { error: "No se puede cobrar más que el total del servicio." };
    }
    if (error.message.includes("lavado_cerrado")) {
      return { error: "Este auto ya fue entregado." };
    }
    return { error: `No se pudo entregar: ${error.message}` };
  }

  revalidatePath("/lavados");
  return { error: null };
}
