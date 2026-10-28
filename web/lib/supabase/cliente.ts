import { createBrowserClient } from "@supabase/ssr";
import { supabaseClave, supabaseUrl } from "./env";

// Cliente para Client Components ("use client"). Corre en el navegador y
// guarda la sesión en cookies, así el servidor también puede leerla.
export function crearClienteNavegador() {
  return createBrowserClient(supabaseUrl, supabaseClave);
}
