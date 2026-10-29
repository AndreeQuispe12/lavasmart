"use client";

import { useActionState } from "react";
import { registrarIncidencia, type EstadoIncidencia } from "./acciones";
import { TIPOS } from "./textos";

const estadoInicial: EstadoIncidencia = {
  error: null,
  mensaje: null,
  version: 0,
};

const campo = "rounded-lg border border-zinc-500/30 bg-transparent px-3 py-2";

// Segundo paso: la placa ya se buscó y se conocen sus visitas recientes.
export function FormularioIncidencia({
  placa,
  visitas,
}: {
  placa: string;
  visitas: { id: number; texto: string }[];
}) {
  const [estado, enviar, enviando] = useActionState(
    registrarIncidencia,
    estadoInicial,
  );

  return (
    <form
      key={estado.version}
      action={enviar}
      className="flex flex-col gap-4 rounded-lg border border-zinc-500/20 p-4"
    >
      <input type="hidden" name="placa" value={placa} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          ¿En qué visita pasó?
        </legend>
        {visitas.map((v) => (
          <label key={v.id} className="flex items-center gap-2">
            <input type="radio" name="lavado" value={v.id} required />
            {v.texto}
          </label>
        ))}
        {/* Un reclamo que llega días después y no se puede atribuir. */}
        <label className="flex items-center gap-2">
          <input type="radio" name="lavado" value="ninguno" required />
          Sin visita asociada (reclamo tardío)
        </label>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Tipo</span>
        <select name="tipo" required defaultValue="" className={campo}>
          <option value="" disabled>
            Elige…
          </option>
          {Object.entries(TIPOS).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Qué pasó</span>
        <textarea
          name="descripcion"
          required
          rows={3}
          placeholder="Rayón de 5 cm en la puerta del conductor, el cliente lo notó al recoger."
          className={campo}
        />
      </label>

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

      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded-lg bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {enviando ? "Registrando..." : "Registrar incidencia"}
      </button>
    </form>
  );
}
