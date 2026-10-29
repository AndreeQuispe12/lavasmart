"use client";

import { useActionState, useState } from "react";
import { soles } from "@/lib/dinero";
import { pagarTrabajador, type EstadoCierre } from "./acciones";

const inicial: EstadoCierre = { error: null, mensaje: null };

// Pagar es sacar dinero del cajón y no se deshace: se pide confirmar.
export function PagarTrabajador({
  trabajadorId,
  hasta,
  monto,
}: {
  trabajadorId: number;
  hasta: string;
  monto: number;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, pagar, pagando] = useActionState(
    pagarTrabajador.bind(null, trabajadorId, hasta),
    inicial,
  );

  if (estado.mensaje) {
    return (
      <p role="status" className="text-sm text-green-600">
        {estado.mensaje}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirmando ? (
        <form action={pagar} className="flex gap-2">
          <button
            type="submit"
            disabled={pagando}
            className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            {pagando ? "Registrando..." : `Sí, entregué ${soles(monto)}`}
          </button>
          <button
            type="button"
            disabled={pagando}
            onClick={() => setConfirmando(false)}
            className="rounded-lg border border-zinc-500/30 px-3 py-2 text-sm hover:bg-zinc-500/10"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800"
        >
          Pagar {soles(monto)}
        </button>
      )}
      {estado.error && (
        <p role="alert" className="text-sm text-red-600">
          {estado.error}
        </p>
      )}
    </div>
  );
}
