import type { crearClienteServidor } from "@/lib/supabase/servidor";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export type ReglasAsistencia = {
  horaReferencia: string; // "08:00"
  tolerancia: number; // minutos
  pctPuntual: number; // 50
  pctTardanza: number; // 40
};

const CLAVES = [
  "hora_entrada",
  "tolerancia_minutos",
  "pct_destajo_puntual",
  "pct_destajo_tardanza",
];

// Las reglas vigentes HOY, leídas de configuracion. Al marcar asistencia
// se copian en la fila (dato congelado): si mañana el dueño mueve la hora
// a las 7:30, la asistencia de hoy sigue diciendo 8:00.
export async function leerReglasAsistencia(
  supabase: Cliente,
): Promise<ReglasAsistencia> {
  const { data, error } = await supabase
    .from("configuracion")
    .select("clave, valor")
    .in("clave", CLAVES);
  if (error) {
    throw new Error(`No se pudo leer la configuración: ${error.message}`);
  }

  const valor = new Map(data.map((f) => [f.clave, f.valor]));
  const reglas = {
    horaReferencia: valor.get("hora_entrada") ?? "",
    tolerancia: Number(valor.get("tolerancia_minutos")),
    pctPuntual: Number(valor.get("pct_destajo_puntual")),
    pctTardanza: Number(valor.get("pct_destajo_tardanza")),
  };

  // Mejor detenerse que marcar asistencias con reglas incompletas: el
  // porcentaje queda congelado y después no se corrige.
  if (
    !/^\d{2}:\d{2}$/.test(reglas.horaReferencia) ||
    !Number.isInteger(reglas.tolerancia) ||
    Number.isNaN(reglas.pctPuntual) ||
    Number.isNaN(reglas.pctTardanza)
  ) {
    throw new Error(
      "La configuración de asistencia está incompleta: revisa hora_entrada, tolerancia_minutos y los porcentajes de destajo.",
    );
  }
  return reglas;
}
