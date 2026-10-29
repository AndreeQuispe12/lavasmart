"use client";

import { useActionState } from "react";
import { cerrarDia, type EstadoCierre } from "./acciones";

const inicial: EstadoCierre = { error: null, mensaje: null };

export function CerrarDia({
  fecha,
  pendientes,
}: {
  fecha: string;
  pendientes: number;
}) {
  const [estado, cerrar, cerrando] = useActionState(
    cerrarDia.bind(null, fecha),
    inicial,
  );

  return (
    <form action={cerrar} className="flex flex-col gap-2">
      <p className="text-sm text-zinc-500">
        Al cerrar, los montos de este día quedan fijos y ya no cambian, aunque
        después cambien las tarifas, los porcentajes o los sueldos.
      </p>
      <button
        type="submit"
        disabled={cerrando || pendientes === 0}
        className="self-start rounded-lg bg-acento px-5 py-3 font-semibold text-white hover:bg-acento-oscuro disabled:opacity-60"
      >
        {cerrando
          ? "Cerrando..."
          : pendientes === 0
            ? "Todo cerrado"
            : `Cerrar el día (${pendientes} pendientes)`}
      </button>
      {estado.error && (
        <p role="alert" className="text-sm text-red-600">
          {estado.error}
        </p>
      )}
      {estado.mensaje && (
        <p role="status" className="text-sm text-green-600">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
