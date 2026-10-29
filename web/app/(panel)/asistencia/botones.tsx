"use client";

import { useActionState } from "react";
import { marcarAsistencia, type EstadoMarca } from "./acciones";

const sinError: EstadoMarca = { error: null };

// Botones de una fila. Client Component para mostrar "Marcando..." y el
// error de esa fila sin recargar la página.
export function BotonesAsistencia({
  trabajadorId,
  soloEntrada,
}: {
  trabajadorId: number;
  // true si ya tiene falta hoy: solo queda la opción de que llegó.
  soloEntrada: boolean;
}) {
  const [entrada, marcarEntrada, marcandoEntrada] = useActionState(
    marcarAsistencia.bind(null, trabajadorId, "entrada"),
    sinError,
  );
  const [falta, marcarFalta, marcandoFalta] = useActionState(
    marcarAsistencia.bind(null, trabajadorId, "falta"),
    sinError,
  );
  const ocupado = marcandoEntrada || marcandoFalta;
  const error = entrada.error ?? falta.error;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={marcarEntrada}>
          <button
            type="submit"
            disabled={ocupado}
            className="rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {marcandoEntrada
              ? "Marcando..."
              : soloEntrada
                ? "Llegó"
                : "Marcar entrada"}
          </button>
        </form>
        {!soloEntrada && (
          <form action={marcarFalta}>
            <button
              type="submit"
              disabled={ocupado}
              className="rounded-lg border border-zinc-500/30 px-4 py-2 hover:bg-zinc-500/10 disabled:opacity-60"
            >
              {marcandoFalta ? "Marcando..." : "Falta"}
            </button>
          </form>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
