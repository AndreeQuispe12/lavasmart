import { LogOut } from "lucide-react";
import Image from "next/image";
import { cerrarSesion } from "@/app/login/acciones";
import { diaDeLaSemana, fechaLarga, hoyEnLima } from "@/lib/fecha";
import { seccionesPara } from "@/lib/navegacion";
import { obtenerSesion } from "@/lib/sesion";
import { Encabezado } from "./encabezado";
import { Menu } from "./menu";

// Marco de todas las pantallas con sesión, con la identidad del prototipo:
// barra lateral azul noche a la izquierda (arriba en el celular) y la
// pantalla a la derecha, bajo un encabezado con el módulo y la fecha.
// /login queda fuera de este grupo.
export default async function LayoutPanel({ children }: LayoutProps<"/">) {
  const { correo, rol } = await obtenerSesion();
  const hoy = hoyEnLima();
  const secciones = rol ? seccionesPara(rol) : [];

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-5 bg-gradient-to-b from-marca to-marca-2 p-4 text-slate-300 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0">
        <div className="flex items-center gap-3">
          <Image
            src="/marca/logo.png"
            alt=""
            width={40}
            height={40}
            className="rounded-lg bg-white"
          />
          <div>
            <p className="font-bold text-white">LavaSmart</p>
            <p className="text-xs text-slate-400">AquaBrillo</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-celeste to-acento font-bold text-white uppercase"
          >
            {correo.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {correo}
            </p>
            <p className="text-xs text-slate-400">
              {rol === "dueno"
                ? "Dueño"
                : rol === "operador"
                  ? "Operador"
                  : "Sin rol"}
            </p>
          </div>
        </div>

        {rol && <Menu secciones={secciones} />}

        <form action={cerrarSesion} className="md:mt-auto">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 hover:text-white"
          >
            <LogOut aria-hidden className="size-4" />
            Cerrar sesión
          </button>
        </form>
      </aside>

      <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
        <Encabezado
          secciones={secciones}
          dia={diaDeLaSemana(hoy)}
          fecha={fechaLarga(hoy)}
        />
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
