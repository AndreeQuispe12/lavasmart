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
const CELULAR = /^9\d{8}$/;

// Igual que fn_limpiar_telefono (sql/16): solo dígitos y sin el 51 del
// país, para validar aquí con el mismo criterio que la base.
function limpiarTelefono(texto: string): string {
  const digitos = texto.replace(/\D/g, "");
  return digitos.length === 11 && digitos.startsWith("51")
    ? digitos.slice(2)
    : digitos;
}

export type ClienteConocido = {
  tipoVehiculoId: number;
  nombre: string | null;
  telefono: string | null;
};

// Lo que se sabe de una placa, para rellenar el formulario cuando el auto
// vuelve. null si nunca vino. Lee con la sesión: RLS decide.
export async function buscarCliente(
  placa: string,
): Promise<ClienteConocido | null> {
  if (placa.replace(/[^A-Za-z0-9]/g, "").length !== 6) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .rpc("fn_buscar_cliente", { p_placa: placa })
    .maybeSingle();
  if (!data) return null;
  return {
    tipoVehiculoId: data.tipo_vehiculo_id,
    nombre: data.nombre,
    telefono: data.telefono,
  };
}

// Otras placas con el mismo celular: así se reconoce a un cliente con
// varios autos.
export async function placasDelTelefono(
  telefono: string,
  placaActual: string,
): Promise<{ placa: string; nombre: string | null }[]> {
  const limpio = limpiarTelefono(telefono);
  if (!CELULAR.test(limpio)) return [];
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("fn_placas_del_telefono", {
    p_telefono: limpio,
    p_excepto: placaActual,
  });
  return data ?? [];
}

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
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const telefono = limpiarTelefono(String(formulario.get("telefono") ?? ""));

  if (!placa) return fallar("Escribe la placa.");
  if (!ENTERO.test(tipo)) return fallar("Elige el tipo de vehículo.");
  if (!ENTERO.test(lavador)) return fallar("Elige el lavador.");
  if (servicios.length === 0 || !servicios.every((s) => ENTERO.test(s))) {
    return fallar("Marca al menos un servicio.");
  }
  if (nombre.length > 80)
    return fallar("El nombre no puede pasar de 80 letras.");
  if (telefono && !CELULAR.test(telefono)) {
    return fallar("El celular debe tener 9 dígitos y empezar por 9.");
  }

  // Solo viajan ids: el precio lo copia la base desde tarifa.
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("fn_registrar_ingreso", {
    p_placa: placa,
    p_tipo_vehiculo_id: Number(tipo),
    p_trabajador_id: Number(lavador),
    p_servicios: servicios.map(Number),
    p_observacion: observacion || undefined,
    // Opcionales: vacíos no viajan y no borran lo que ya se sabía.
    p_nombre: nombre || undefined,
    p_telefono: telefono || undefined,
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
