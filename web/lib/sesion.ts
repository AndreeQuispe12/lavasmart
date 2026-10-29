import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type Rol = "operador" | "dueno";

export type Sesion = {
  correo: string;
  // null: el usuario inició sesión pero no tiene fila en perfil, así que
  // RLS le oculta todo. No es un error de la app; falta que el dueño le
  // asigne un rol.
  rol: Rol | null;
};

// Quién está usando la app y con qué rol. Con cache(), el layout y la
// página que se pinta dentro comparten una sola consulta por petición.
export const obtenerSesion = cache(async (): Promise<Sesion> => {
  const supabase = await crearClienteServidor();

  const { data } = await supabase.auth.getClaims();
  const correo = data?.claims.email ?? "";

  // RLS (prf_lectura_propia) solo deja ver la fila propia, así que no hace
  // falta filtrar por id.
  const { data: perfil } = await supabase
    .from("perfil")
    .select("rol")
    .maybeSingle();

  return { correo, rol: perfil?.rol ?? null };
});
