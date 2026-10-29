"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hoyEnLima } from "@/lib/fecha";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Enums, TablesInsert } from "@/lib/supabase/tipos";

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

// Hasta 6 enteros y 2 decimales: lo que cabe en numeric(8,2).
const MONTO = /^\d{1,6}(\.\d{1,2})?$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Las columnas que escribe el formulario, tomadas del tipo generado.
type Fila = Pick<
  TablesInsert<"trabajador">,
  | "nombres"
  | "apellidos"
  | "documento"
  | "modalidad"
  | "frecuencia"
  | "sueldo_dia"
  | "fecha_ingreso"
>;

// Lee y valida el formulario. La usan el alta y la edición: las reglas de
// la modalidad son las mismas en los dos casos.
function leerFormulario(formulario: FormData): {
  valores: ValoresTrabajador;
  fila?: Fila;
  error?: string;
} {
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
  const fallar = (error: string) => ({ valores, error });

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
  let frecuencia: Enums<"frecuencia_pago">;
  let sueldoDia: number | null;
  if (valores.modalidad === "fijo") {
    if (!MONTO.test(valores.sueldo) || Number(valores.sueldo) === 0) {
      return fallar(
        "Escribe el sueldo diario en soles, mayor que 0 (por ejemplo 40 o 42.50).",
      );
    }
    frecuencia = "semanal"; // Regla del negocio: el fijo cobra semanal.
    // El tipo generado pide number. Es seguro aquí: MONTO ya limitó el
    // valor a 2 decimales y 8 dígitos, y un número así se envía en el JSON
    // con los mismos dígitos que se escribieron; la base lo guarda como
    // numeric exacto. Lo que no se debe hacer es SUMAR dinero en JS: los
    // totales salen de las vistas de la base.
    sueldoDia = Number(valores.sueldo);
  } else {
    if (valores.frecuencia !== "diario" && valores.frecuencia !== "semanal") {
      return fallar("Elige si cobra diario o semanal.");
    }
    frecuencia = valores.frecuencia;
    sueldoDia = null; // Destajo: cobra un porcentaje, no un sueldo.
  }

  return {
    valores,
    fila: {
      nombres: valores.nombres,
      apellidos: valores.apellidos,
      documento: valores.documento,
      modalidad: valores.modalidad,
      frecuencia,
      sueldo_dia: sueldoDia,
      fecha_ingreso: valores.fechaIngreso,
    },
  };
}

export async function crearTrabajador(
  anterior: EstadoTrabajador,
  formulario: FormData,
): Promise<EstadoTrabajador> {
  // Una Server Action se puede llamar sin pasar por la página, así que la
  // guardia va aquí también.
  await exigirDueno();

  const { valores, fila, error: invalido } = leerFormulario(formulario);
  const fallar = (error: string): EstadoTrabajador => ({
    ...anterior,
    error,
    mensaje: null,
    valores,
  });
  if (!fila) return fallar(invalido!);

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("trabajador").insert(fila);

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

// Corrige los datos de un trabajador. Nombre, documento y frecuencia
// cambian siempre; la modalidad y el sueldo, solo con sus días cerrados
// (sql/13), para que ningún día se pague con dos reglas.
export async function editarTrabajador(
  id: number,
  anterior: EstadoTrabajador,
  formulario: FormData,
): Promise<EstadoTrabajador> {
  await exigirDueno();

  const { valores, fila, error: invalido } = leerFormulario(formulario);
  const fallar = (error: string): EstadoTrabajador => ({
    ...anterior,
    error,
    mensaje: null,
    valores,
  });
  if (!fila) return fallar(invalido!);

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("trabajador").update(fila).eq("id", id);

  if (error) {
    return fallar(traducirError(error.code, error.message, valores.documento));
  }

  revalidatePath("/personal");
  redirect("/personal?editado=1");
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
  // Las reglas de sql/13 empiezan con su nombre y siguen en español.
  const regla = /^trabajador_[a-z_]+: (.+)$/.exec(mensaje);
  if (regla) {
    return regla[1].charAt(0).toUpperCase() + regla[1].slice(1);
  }
  if (codigo === "42501") {
    return "No tienes permiso para registrar personal.";
  }
  return `No se pudo registrar: ${mensaje}`;
}
