"use client";

import { useActionState, useState } from "react";
import { soles, sumarSoles } from "@/lib/dinero";
import { entregarAuto, type EstadoEntrega } from "./entrega";

const sinError: EstadoEntrega = { error: null };

// El botón "Entregar" de un auto en piso. Al abrirlo propone cobrar el
// total; si el cliente paga menos, se baja el monto y se ve el saldo.
export function EntregarAuto({
  lavadoId,
  total,
}: {
  lavadoId: number;
  total: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(total.toFixed(2));
  const [estado, entregar, entregando] = useActionState(
    entregarAuto.bind(null, lavadoId),
    sinError,
  );

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800"
      >
        Entregar
      </button>
    );
  }

  // El saldo se muestra mientras se escribe; el que se guarda lo calcula
  // la base en v_lavado.
  const cobrado = Number(monto);
  const montoValido = monto !== "" && !Number.isNaN(cobrado);
  const saldo = montoValido ? sumarSoles([total, -cobrado]) : null;

  return (
    <form
      action={entregar}
      className="flex w-full flex-col gap-2 rounded-lg border border-green-300/60 p-3 sm:w-80"
    >
      <p className="text-sm">
        Total del servicio: <strong>{soles(total)}</strong>
      </p>
      <label className="flex items-center gap-2 text-sm">
        Cobrado S/
        <input
          name="monto"
          inputMode="decimal"
          required
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="w-28 rounded-lg border border-zinc-500/30 bg-transparent px-2 py-1 text-base"
        />
      </label>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input type="radio" name="metodo" value="efectivo" required />
          Efectivo
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name="metodo" value="yape" />
          Yape
        </label>
      </div>

      {saldo !== null && saldo > 0 && (
        <p className="text-sm text-amber-700">
          Queda un saldo de {soles(saldo)}. El cliente no vuelve a pagar: se
          anota solo para el destajo.
        </p>
      )}
      {saldo !== null && saldo < 0 && (
        <p className="text-sm text-red-600">
          Es más que el total del servicio.
        </p>
      )}
      {montoValido && cobrado === 0 && (
        <label className="flex items-center gap-2 text-sm text-red-700">
          <input type="checkbox" name="sinPago" value="si" />
          El cliente se fue sin pagar
        </label>
      )}

      {estado.error && (
        <p role="alert" className="text-sm text-red-600">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={entregando}
          className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {entregando ? "Entregando..." : "Confirmar entrega"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          disabled={entregando}
          className="rounded-lg border border-zinc-500/30 px-3 py-2 text-sm hover:bg-zinc-500/10"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
