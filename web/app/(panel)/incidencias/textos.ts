import type { Enums } from "@/lib/supabase/tipos";

// Textos de la interfaz para los enums de incidencia. En un archivo sin
// "use client" para que los usen tanto la página (servidor) como el
// formulario (cliente).

export const TIPOS: Record<Enums<"tipo_incidencia">, string> = {
  dano: "Daño (rayón, golpe al secar)",
  servicio_incompleto: "Servicio incompleto (aspirado no hecho)",
  objeto_faltante: "Objeto faltante",
  otro: "Otro",
};

export const ESTADOS: Record<
  Enums<"estado_incidencia">,
  { texto: string; clase: string }
> = {
  abierta: { texto: "Abierta", clase: "bg-red-100 text-red-800" },
  en_proceso: { texto: "En proceso", clase: "bg-amber-100 text-amber-800" },
  resuelta: { texto: "Resuelta", clase: "bg-green-100 text-green-800" },
};
