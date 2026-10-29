"use client";

import { useActionState } from "react";
import { resolverIncidencia } from "./acciones";

// Solo se muestra al dueño. La base lo vuelve a exigir.
export function ResolverIncidencia({ id }: { id: number }) {
  const [estado, resolver, resolviendo] = useActionState(
    resolverIncidencia.bind(null, id),
    { error: null },
  );

  return (
    <form action={resolver} className="flex flex-col gap-1 sm:w-80">
      <div className="flex gap-2">
        <input
          name="resolucion"
          required
          placeholder="Cómo se resolvió"
          aria-label="Cómo se resolvió"
          className="flex-1 rounded-lg border border-zinc-500/30 bg-transparent px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={resolviendo}
          className="rounded-lg bg-green-700 px-3 py-1 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {resolviendo ? "..." : "Resolver"}
        </button>
      </div>
      {estado.error && (
        <p role="alert" className="text-sm text-red-600">
          {estado.error}
        </p>
      )}
    </form>
  );
}
