import { cerrarSesion } from "@/app/login/acciones";
import { seccionesPara } from "@/lib/navegacion";
import { obtenerSesion } from "@/lib/sesion";
import { Menu } from "./menu";

// Marco de todas las pantallas con sesión: menú a la izquierda (arriba en
// el celular) y la pantalla a la derecha. /login queda fuera de este grupo.
export default async function LayoutPanel({ children }: LayoutProps<"/">) {
  const { correo, rol } = await obtenerSesion();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b border-zinc-500/20 p-4 md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div>
          <p className="text-xl font-semibold">LavaSmart</p>
          <p className="truncate text-sm text-zinc-500">{correo}</p>
          {rol && (
            <p className="text-sm text-zinc-500">
              {rol === "dueno" ? "Dueño" : "Operador"}
            </p>
          )}
        </div>

        {rol && <Menu secciones={seccionesPara(rol)} />}

        <form action={cerrarSesion} className="md:mt-auto">
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-500/30 px-3 py-2 text-sm font-medium hover:bg-zinc-500/10"
          >
            Cerrar sesión
          </button>
        </form>
      </aside>

      <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
        {rol ? (
          children
        ) : (
          // Es el error más común con este modelo: el usuario existe en
          // Supabase Auth pero no en el negocio, y RLS le oculta todo. No
          // tiene sentido pintar ninguna pantalla: saldría vacía.
          <section className="max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <p className="font-medium">Tu usuario todavía no tiene perfil.</p>
            <p className="mt-1 text-sm">
              Iniciaste sesión, pero el dueño aún no te asignó un rol. Hasta
              entonces no vas a ver ningún dato.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
