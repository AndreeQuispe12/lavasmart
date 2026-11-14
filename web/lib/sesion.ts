import { redirect } from "next/navigation";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Enums } from "@/lib/supabase/tipos";

export type Rol = Enums<"rol_usuario">;

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
  const id = data?.claims.sub;
  if (!id) {
    return { correo, rol: null };
  }

  // Hay que filtrar por id aunque haya RLS: la política prf_lectura_propia
  // deja ver la fila propia *o todas si eres dueño*. Sin el filtro, al dueño
  // le llegaban todos los perfiles y maybeSingle() fallaba en cuanto existía
  // un segundo usuario, así que la app lo mostraba "sin rol".
  const { data: perfil } = await supabase
    .from("perfil")
    .select("rol")
    .eq("id", id)
    .maybeSingle();

  return { correo, rol: perfil?.rol ?? null };
});

// Guardia de las pantallas y acciones que son solo del dueño. Ocultarlas
// del menú no basta: un operador puede escribir la URL a mano. Esto lo
// devuelve al inicio. Detrás sigue RLS, que rechazaría la escritura igual;
// la guardia evita que llegue a ver una pantalla que no puede usar.
export async function exigirDueno(): Promise<void> {
  const { rol } = await obtenerSesion();
  if (rol !== "dueno") {
    redirect("/");
  }
}
