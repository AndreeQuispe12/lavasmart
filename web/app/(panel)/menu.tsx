"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Seccion } from "@/lib/navegacion";

// Client Component solo por usePathname: resalta la sección en la que está
// el usuario. Qué secciones mostrar ya lo decidió el servidor.
export function Menu({ secciones }: { secciones: Seccion[] }) {
  const rutaActual = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {secciones.map((s) =>
        s.disponible ? (
          <Link
            key={s.ruta}
            href={s.ruta}
            aria-current={rutaActual === s.ruta ? "page" : undefined}
            className="rounded-lg px-3 py-2 whitespace-nowrap hover:bg-zinc-500/10 aria-[current=page]:bg-sky-700 aria-[current=page]:font-semibold aria-[current=page]:text-white"
          >
            {s.etiqueta}
          </Link>
        ) : (
          <span
            key={s.ruta}
            title="Todavía no está construida"
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 whitespace-nowrap text-zinc-500"
          >
            {s.etiqueta}
            <span className="text-xs">pronto</span>
          </span>
        ),
      )}
    </nav>
  );
}
