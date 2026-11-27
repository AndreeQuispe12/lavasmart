import type { LucideIcon } from "lucide-react";

// Piezas visuales que comparten los bloques del tablero, para que todos se
// vean iguales: la tarjeta blanca y el título con su icono.

export const TARJETA =
  "rounded-xl border border-zinc-500/10 bg-white p-4 shadow-sm";

export function TituloSeccion({
  icono: Icono,
  titulo,
  nivel = 2,
}: {
  icono: LucideIcon;
  titulo: string;
  nivel?: 2 | 3;
}) {
  const Etiqueta = nivel === 2 ? "h2" : "h3";
  return (
    <Etiqueta
      className={`flex items-center gap-2 font-semibold ${nivel === 2 ? "text-lg" : "text-base"}`}
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-acento/10 text-acento-oscuro">
        <Icono aria-hidden className="size-4" />
      </span>
      {titulo}
    </Etiqueta>
  );
}
