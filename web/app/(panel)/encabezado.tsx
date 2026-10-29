"use client";

import { usePathname } from "next/navigation";
import type { Seccion } from "@/lib/navegacion";
import { ICONOS } from "./iconos";

// La franja azul de arriba: el módulo en el que estás, qué se hace ahí y la
// fecha de Lima. Client Component por usePathname, igual que el menú.
export function Encabezado({
  secciones,
  dia,
  fecha,
}: {
  secciones: Seccion[];
  dia: string;
  fecha: string;
}) {
  const rutaActual = usePathname();
  const seccion = secciones.find((s) => s.ruta === rutaActual);
  const Icono = seccion ? ICONOS[seccion.icono] : null;

  return (
    <header className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-marca via-marca-2 to-acento p-5 text-white shadow-lg">
      {Icono && (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Icono aria-hidden className="size-6" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xl font-bold">{seccion?.etiqueta ?? "LavaSmart"}</p>
        {seccion && (
          <p className="text-sm text-sky-100/80">{seccion.descripcion}</p>
        )}
      </div>
      <p className="ml-auto hidden text-right text-sm font-semibold sm:block">
        <span className="capitalize">{dia}</span>
        <span className="block text-xs font-normal text-sky-100/70">
          {fecha}
        </span>
      </p>
    </header>
  );
}
