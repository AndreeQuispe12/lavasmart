"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "./acciones";

const estadoInicial: EstadoLogin = { error: null };

// Es Client Component solo para mostrar el error y el "Ingresando..."
// sin recargar la página. El inicio de sesión en sí ocurre en el servidor.
export function FormularioLogin() {
  const [estado, enviar, enviando] = useActionState(
    iniciarSesion,
    estadoInicial,
  );

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Correo</span>
        <input
          name="correo"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Contraseña</span>
        <input
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base"
        />
      </label>

      {estado.error && (
        <p role="alert" className="text-sm text-red-700">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-acento px-4 py-3 text-base font-semibold text-white hover:bg-acento-oscuro disabled:opacity-60"
      >
        {enviando ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
