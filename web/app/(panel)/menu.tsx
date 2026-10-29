"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Seccion } from "@/lib/navegacion";
import { ICONOS } from "./iconos";

// Client Component solo por usePathname: resalta la sección en la que está
// el usuario. Qué secciones mostrar ya lo decidió el servidor.
export function Menu({ secciones }: { secciones: Seccion[] }) {
  const rutaActual = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {secciones.map((s) => {
        const Icono = ICONOS[s.icono];
        return (
          <Link
            key={s.ruta}
            href={s.ruta}
            aria-current={rutaActual === s.ruta ? "page" : undefined}
            className="flex items-center gap-3 rounded-lg border-l-4 border-transparent px-3 py-2 whitespace-nowrap text-slate-300 hover:bg-white/10 hover:text-white aria-[current=page]:border-celeste aria-[current=page]:bg-celeste/20 aria-[current=page]:font-semibold aria-[current=page]:text-white"
          >
            <Icono aria-hidden className="size-4 shrink-0" />
            {s.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
