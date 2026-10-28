import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseClave, supabaseUrl } from "./env";

// Cliente para Server Components, Server Functions y Route Handlers.
// Hay que crear uno nuevo en cada petición: lleva dentro las cookies (la
// sesión) de quien está pidiendo la página, y no se puede compartir.
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient(supabaseUrl, supabaseClave, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesPorGuardar) {
        try {
          cookiesPorGuardar.forEach(({ name, value, options }) =>
            almacen.set(name, value, options),
          );
        } catch {
          // Un Server Component no puede escribir cookies. Si Supabase
          // intenta renovar la sesión desde uno, se ignora aquí; la
          // renovación la hará el proxy cuando exista el login.
        }
      },
    },
  });
}
