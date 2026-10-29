"use client";

import { useActionState } from "react";
import {
  aplicarDescuento,
  marcarNoLaboro,
  type EstadoDecision,
} from "./decisiones";

const sinError: EstadoDecision = { error: null };

const campo =
  "rounded-lg border border-zinc-500/30 bg-transparent px-2 py-1 text-sm";

// Lo que decide el dueño cuando un trabajador de sueldo fijo llega tarde:
// lo deja trabajar con un descuento a mano, o no lo deja trabajar.
export function DecisionDueno({ trabajadorId }: { trabajadorId: number }) {
  const [descuento, descontar, descontando] = useActionState(
    aplicarDescuento.bind(null, trabajadorId),
    sinError,
  );
  const [noLaboro, mandarACasa, mandando] = useActionState(
    marcarNoLaboro.bind(null, trabajadorId),
    sinError,
  );
  const ocupado = descontando || mandando;
  const error = descuento.error ?? noLaboro.error;

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-amber-300/60 p-3 sm:w-auto">
      <p className="text-sm font-medium">Llegó tarde: ¿qué decides?</p>
      <form action={descontar} className="flex flex-wrap items-center gap-2">
        <input
          name="monto"
          inputMode="decimal"
          required
          placeholder="S/ 10.00"
          aria-label="Monto del descuento en soles"
          className={`${campo} w-24`}
        />
        <input
          name="motivo"
          required
          placeholder="Motivo"
          aria-label="Motivo del descuento"
          className={`${campo} flex-1`}
        />
        <button
          type="submit"
          disabled={ocupado}
          className="rounded-lg bg-amber-600 px-3 py-1 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {descontando ? "Guardando..." : "Trabaja con descuento"}
        </button>
      </form>
      <form action={mandarACasa}>
        <button
          type="submit"
          disabled={ocupado}
          className="rounded-lg border border-zinc-500/30 px-3 py-1 text-sm hover:bg-zinc-500/10 disabled:opacity-60"
        >
          {mandando ? "Guardando..." : "No trabaja hoy"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
