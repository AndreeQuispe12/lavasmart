"use server";

import { revalidatePath } from "next/cache";
import { hoyEnLima } from "@/lib/fecha";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type ValoresTrabajador = {
  nombres: string;
  apellidos: string;
  documento: string;
  modalidad: string;
  frecuencia: string;
  sueldo: string;
  fechaIngreso: string;
};

export type EstadoTrabajador = {
  error: string | null;
  mensaje: string | null;
  // Lo que se escribió, para no perderlo si hay error.
  valores: ValoresTrabajador | null;
  // Sube con cada alta exitosa; el formulario lo usa para vaciarse.
  version: number;
};

// Hasta 6 enteros y 2 decimales: lo que cabe en numeric(8,2). El monto
// viaja como texto hasta la base; nunca pasa por un número de punto
// flotante.
const MONTO = /^\d{1,6}(\.\d{1,2})?$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function crearTrabajador(
  anterior: EstadoTrabajador,
  formulario: FormData,
): Promise<EstadoTrabajador> {
  // Una Server Action se puede llamar sin pasar por la página, así que la
  // guardia va aquí también.
  await exigirDueno();

  const texto = (campo: string) => String(formulario.get(campo) ?? "").trim();
  const valores: ValoresTrabajador = {
    nombres: texto("nombres"),
    apellidos: texto("apellidos"),
    documento: texto("documento"),
    modalidad: texto("modalidad"),
    frecuencia: texto("frecuencia"),
    sueldo: texto("sueldo"),
    fechaIngreso: texto("fechaIngreso") || hoyEnLima(),
  };
  const fallar = (error: string): EstadoTrabajador => ({
    ...anterior,
    error,
    mensaje: null,
    valores,
  });

  if (!valores.nombres || !valores.apellidos || !valores.documento) {
    return fallar("Completa nombres, apellidos y documento.");
  }
  if (valores.modalidad !== "destajo" && valores.modalidad !== "fijo") {
    return fallar("Elige la modalidad: destajo o sueldo fijo.");
  }
  if (!FECHA.test(valores.fechaIngreso)) {
    return fallar("La fecha de ingreso no es válida.");
  }

  // Las reglas de la modalidad. La base las vuelve a exigir con
  // trabajador_sueldo_coherente y trabajador_fijo_es_semanal; aquí se
  // revisan antes para dar un mensaje claro.
  let frecuencia: string;
  let sueldoDia: string | null;
  if (valores.modalidad === "fijo") {
    if (!MONTO.test(valores.sueldo) || Number(valores.sueldo) === 0) {
      return fallar(
        "Escribe el sueldo diario en soles, mayor que 0 (por ejemplo 40 o 42.50).",
      );
    }
    frecuencia = "semanal"; // Regla del negocio: el fijo cobra semanal.
    sueldoDia = valores.sueldo;
  } else {
    if (valores.frecuencia !== "diario" && valores.frecuencia !== "semanal") {
      return fallar("Elige si cobra diario o semanal.");
    }
    frecuencia = valores.frecuencia;
    sueldoDia = null; // Destajo: cobra un porcentaje, no un sueldo.
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("trabajador").insert({
    nombres: valores.nombres,
    apellidos: valores.apellidos,
    documento: valores.documento,
    modalidad: valores.modalidad,
    frecuencia,
    sueldo_dia: sueldoDia,
    fecha_ingreso: valores.fechaIngreso,
  });

  if (error) {
    return fallar(traducirError(error.code, error.message, valores.documento));
  }

  revalidatePath("/personal");
  return {
    error: null,
    mensaje: `Se registró a ${valores.nombres} ${valores.apellidos}.`,
    valores: null,
    version: anterior.version + 1,
  };
}

// Baja o reactivación. Nunca DELETE: el trabajador tiene lavados,
// asistencias y liquidaciones que deben seguir apuntando a él.
export async function cambiarActivo(id: number, activo: boolean) {
  await exigirDueno();

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("trabajador")
    .update({ activo })
    .eq("id", id);

  if (error) {
    throw new Error(`No se pudo actualizar al trabajador: ${error.message}`);
  }
  revalidatePath("/personal");
}

// Los errores del motor llegan con el nombre de la restricción, que empieza
// por el nombre de la tabla (convención del esquema). Eso permite decir qué
// regla se incumplió.
function traducirError(codigo: string, mensaje: string, documento: string) {
  if (mensaje.includes("trabajador_documento_unico")) {
    return `Ya hay un trabajador registrado con el documento ${documento}.`;
  }
  if (mensaje.includes("trabajador_sueldo_coherente")) {
    return "El sueldo fijo debe ser mayor que 0, y un trabajador a destajo no lleva sueldo.";
  }
  if (mensaje.includes("trabajador_fijo_es_semanal")) {
    return "Un trabajador de sueldo fijo siempre cobra semanal.";
  }
  if (codigo === "42501") {
    return "No tienes permiso para registrar personal.";
  }
  return `No se pudo registrar: ${mensaje}`;
}
