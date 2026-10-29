"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoLogin = { error: string | null };

// Se ejecuta en el servidor cuando se envía el formulario de /login.
// Si Supabase acepta las credenciales, deja la sesión en cookies y
// redirige al inicio; si no, devuelve el mensaje que muestra el formulario.
export async function iniciarSesion(
  _anterior: EstadoLogin,
  formulario: FormData,
): Promise<EstadoLogin> {
  const correo = String(formulario.get("correo") ?? "").trim();
  const clave = String(formulario.get("clave") ?? "");

  if (!correo || !clave) {
    return { error: "Escribe tu correo y tu contraseña." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: clave,
  });

  if (error) {
    // No se distingue "correo no existe" de "contraseña mala": decir cuál
    // falló le confirmaría a un extraño qué correos tienen cuenta.
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
