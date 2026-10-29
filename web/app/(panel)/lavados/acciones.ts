"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoIngreso = {
  error: string | null;
  mensaje: string | null;
  // Sube con cada ingreso guardado; el formulario lo usa para vaciarse.
  version: number;
};

const ENTERO = /^\d+$/;

// Registra la llegada de un auto: cliente (si la placa es nueva), lavado y
// servicios, todo en una transacción dentro de fn_registrar_ingreso
// (sql/07). Sin cobro: se cobra al entregar. Lo hacen los dos roles.
export async function registrarIngreso(
  anterior: EstadoIngreso,
  formulario: FormData,
): Promise<EstadoIngreso> {
  const fallar = (error: string): EstadoIngreso => ({
    ...anterior,
    error,
    mensaje: null,
  });

  const placa = String(formulario.get("placa") ?? "").trim();
  const tipo = String(formulario.get("tipoVehiculo") ?? "");
  const lavador = String(formulario.get("lavador") ?? "");
  const servicios = formulario.getAll("servicio").map(String);
  const observacion = String(formulario.get("observacion") ?? "").trim();

  if (!placa) return fallar("Escribe la placa.");
  if (!ENTERO.test(tipo)) return fallar("Elige el tipo de vehículo.");
  if (!ENTERO.test(lavador)) return fallar("Elige el lavador.");
  if (servicios.length === 0 || !servicios.every((s) => ENTERO.test(s))) {
    return fallar("Marca al menos un servicio.");
  }

  // Solo viajan ids: el precio lo copia la base desde tarifa.
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("fn_registrar_ingreso", {
    p_placa: placa,
    p_tipo_vehiculo_id: Number(tipo),
    p_trabajador_id: Number(lavador),
    p_servicios: servicios.map(Number),
    p_observacion: observacion || undefined,
  });

  if (error) return fallar(traducirError(error.message));

  revalidatePath("/lavados");
  return {
    error: null,
    mensaje: `Ingresó ${placa.toUpperCase()}. Ya está en piso.`,
    version: anterior.version + 1,
  };
}

function traducirError(mensaje: string): string {
  if (mensaje.includes("cliente_placa_formato")) {
    return "La placa debe tener 6 letras o números, como ABC-123.";
  }
  if (mensaje.includes("no tiene asistencia registrada")) {
    return "Ese lavador no tiene la entrada marcada hoy. Márcala en Asistencia antes de asignarle autos.";
  }
  // Las reglas de fn_registrar_ingreso empiezan con su nombre y siguen con
  // un mensaje en español: "lavado_ya_en_proceso: el auto ABC-123 ya está
  // en piso." Se muestra el mensaje sin el nombre.
  const regla = /^[a-z_]+: (.+)$/.exec(mensaje);
  if (regla) {
    return regla[1].charAt(0).toUpperCase() + regla[1].slice(1);
  }
  return `No se pudo registrar: ${mensaje}`;
}
