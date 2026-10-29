"use client";

import { useActionState } from "react";
import { guardarReglas, guardarTarifas, type EstadoGuardado } from "./acciones";

type Opcion = { id: number; nombre: string };
type Tarifa = {
  tipo_vehiculo_id: number;
  tipo_lavado_id: number;
  precio: number;
};

const inicial: EstadoGuardado = { error: null, mensaje: null };

const campo = "rounded-lg border border-zinc-500/30 bg-transparent px-2 py-1";

// El tarifario: servicios en filas, tipos de vehículo en columnas, igual
// que en el cuaderno.
export function FormularioTarifas({
  tipos,
  servicios,
  tarifas,
}: {
  tipos: Opcion[];
  servicios: Opcion[];
  tarifas: Tarifa[];
}) {
  const [estado, guardar, guardando] = useActionState(guardarTarifas, inicial);
  const precio = (vehiculo: number, servicio: number) =>
    tarifas
      .find(
        (t) => t.tipo_vehiculo_id === vehiculo && t.tipo_lavado_id === servicio,
      )
      ?.precio.toFixed(2) ?? "";

  return (
    <form action={guardar} className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-4 text-left font-medium">Servicio</th>
              {tipos.map((t) => (
                <th key={t.id} className="px-2 py-2 text-left font-medium">
                  {t.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.id} className="border-t border-zinc-500/15">
                <td className="py-2 pr-4">{s.nombre}</td>
                {tipos.map((t) => (
                  <td key={t.id} className="px-2 py-2">
                    <label className="flex items-center gap-1">
                      <span className="text-zinc-500">S/</span>
                      <input
                        name={`precio_${t.id}_${s.id}`}
                        inputMode="decimal"
                        required
                        defaultValue={precio(t.id, s.id)}
                        aria-label={`${s.nombre}, ${t.nombre}`}
                        className={`${campo} w-20 text-right`}
                      />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Resultado estado={estado} />
      <button
        type="submit"
        disabled={guardando}
        className="self-start rounded-lg bg-acento px-5 py-3 font-semibold text-white hover:bg-acento-oscuro disabled:opacity-60"
      >
        {guardando ? "Guardando..." : "Guardar precios"}
      </button>
    </form>
  );
}

export function FormularioReglas({
  reglas,
}: {
  reglas: Record<string, string>;
}) {
  const [estado, guardar, guardando] = useActionState(guardarReglas, inicial);

  return (
    <form action={guardar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Hora de entrada</span>
          <input
            type="time"
            name="hora_entrada"
            required
            defaultValue={reglas.hora_entrada}
            className={`${campo} py-2`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Tolerancia (minutos)</span>
          <input
            type="number"
            name="tolerancia_minutos"
            required
            min={0}
            max={120}
            step={1}
            defaultValue={reglas.tolerancia_minutos}
            className={`${campo} py-2`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Destajo puntual (%)</span>
          <input
            name="pct_destajo_puntual"
            inputMode="decimal"
            required
            defaultValue={reglas.pct_destajo_puntual}
            className={`${campo} py-2`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Destajo con tardanza (%)</span>
          <input
            name="pct_destajo_tardanza"
            inputMode="decimal"
            required
            defaultValue={reglas.pct_destajo_tardanza}
            className={`${campo} py-2`}
          />
        </label>
      </div>
      <Resultado estado={estado} />
      <button
        type="submit"
        disabled={guardando}
        className="self-start rounded-lg bg-acento px-5 py-3 font-semibold text-white hover:bg-acento-oscuro disabled:opacity-60"
      >
        {guardando ? "Guardando..." : "Guardar reglas"}
      </button>
    </form>
  );
}

function Resultado({ estado }: { estado: EstadoGuardado }) {
  if (estado.error) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {estado.error}
      </p>
    );
  }
  if (estado.mensaje) {
    return (
      <p role="status" className="text-sm text-green-600">
        {estado.mensaje}
      </p>
    );
  }
  return null;
}
