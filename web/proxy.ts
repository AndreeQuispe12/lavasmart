import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseClave, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/tipos";

// Corre antes de cada página. Hace dos cosas:
// 1. Renueva la sesión de Supabase si el token venció, y deja las cookies
//    nuevas tanto en la petición (para la página) como en la respuesta
//    (para el navegador).
// 2. Manda a /login a quien no tiene sesión, y fuera de /login a quien sí.
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseClave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesPorGuardar, cabeceras) {
        cookiesPorGuardar.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        respuesta = NextResponse.next({ request });
        cookiesPorGuardar.forEach(({ name, value, options }) =>
          respuesta.cookies.set(name, value, options),
        );
        // Evita que un CDN guarde en caché la sesión de un usuario y se la
        // sirva a otro.
        Object.entries(cabeceras).forEach(([clave, valor]) =>
          respuesta.headers.set(clave, valor),
        );
      },
    },
  });

  // getClaims valida el token (y lo renueva si hace falta). No usar
  // getSession aquí: lee la cookie sin verificarla.
  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims);
  const enLogin = request.nextUrl.pathname === "/login";

  if (!conSesion && !enLogin) {
    return redirigir(request, "/login", respuesta);
  }
  if (conSesion && enLogin) {
    return redirigir(request, "/", respuesta);
  }
  return respuesta;
}

// Una redirección tiene que llevar las cookies que Supabase acaba de
// renovar; si no, el navegador se queda con la sesión vieja.
function redirigir(request: NextRequest, ruta: string, base: NextResponse) {
  const destino = NextResponse.redirect(new URL(ruta, request.url));
  base.cookies.getAll().forEach((cookie) => destino.cookies.set(cookie));
  return destino;
}

export const config = {
  // Todo menos los archivos estáticos: si el proxy los bloqueara, la
  // página de login se vería sin estilos ni imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
