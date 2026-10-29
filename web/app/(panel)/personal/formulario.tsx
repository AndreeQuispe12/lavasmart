"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  crearTrabajador,
  editarTrabajador,
  type EstadoTrabajador,
  type ValoresTrabajador,
} from "./acciones";

const estadoInicial: EstadoTrabajador = {
  error: null,
  mensaje: null,
  valores: null,
  version: 0,
};

const campo = "rounded-lg border border-zinc-500/30 bg-transparent px-3 py-2";

// Sirve para las dos cosas: sin "editar" registra a alguien nuevo; con
// "editar" arranca con sus datos y guarda los cambios.
export function FormularioTrabajador({
  hoy,
  editar,
}: {
  hoy: string;
  editar?: { id: number; valores: ValoresTrabajador };
}) {
  const [estado, enviar, enviando] = useActionState(
    editar ? editarTrabajador.bind(null, editar.id) : crearTrabajador,
    { ...estadoInicial, valores: editar?.valores ?? null },
  );

  return (
    // key cambia con cada alta exitosa: el formulario se vuelve a montar
    // vacío. Si hubo error, la key no cambia y lo escrito se conserva.
    <form
      key={estado.version}
      action={enviar}
      className={`flex flex-col gap-4 rounded-lg border p-4 ${
        editar ? "border-sky-400" : "border-zinc-500/20"
      }`}
    >
      <h2 className="text-lg font-semibold">
        {editar ? "Editar trabajador" : "Agregar trabajador"}
      </h2>
      {editar && (
        <p className="text-sm text-zinc-500">
          Nombre, documento y frecuencia de pago se corrigen siempre. La
          modalidad y el sueldo solo cambian con sus días cerrados en
          Liquidación: así ningún día se paga con dos reglas.
        </p>
      )}
      <Campos valores={estado.valores} hoy={hoy} />

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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {enviando ? "Guardando..." : editar ? "Guardar cambios" : "Agregar"}
        </button>
        {editar && (
          <Link
            href="/personal"
            className="rounded-lg border border-zinc-500/30 px-5 py-3 hover:bg-zinc-500/10"
          >
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}

function Campos({
  valores,
  hoy,
}: {
  valores: ValoresTrabajador | null;
  hoy: string;
}) {
  // La modalidad decide qué se pregunta después, por eso es el único campo
  // con estado propio.
  const [modalidad, setModalidad] = useState(valores?.modalidad || "destajo");
  const esFijo = modalidad === "fijo";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Nombres</span>
        <input
          name="nombres"
          required
          defaultValue={valores?.nombres}
          className={campo}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Apellidos</span>
        <input
          name="apellidos"
          required
          defaultValue={valores?.apellidos}
          className={campo}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Documento (DNI o CE)</span>
        <input
          name="documento"
          required
          defaultValue={valores?.documento}
          className={campo}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Fecha de ingreso</span>
        <input
          name="fechaIngreso"
          type="date"
          required
          max={hoy}
          defaultValue={valores?.fechaIngreso || hoy}
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Modalidad</span>
        <select
          name="modalidad"
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value)}
          className={campo}
        >
          <option value="destajo">Destajo (porcentaje de lo cobrado)</option>
          <option value="fijo">Sueldo fijo diario</option>
        </select>
      </label>

      {esFijo ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Sueldo diario (S/)</span>
            <input
              name="sueldo"
              inputMode="decimal"
              required
              placeholder="40.00"
              defaultValue={valores?.sueldo}
              className={campo}
            />
          </label>
          <p className="text-sm text-zinc-500 sm:col-span-2">
            Los de sueldo fijo cobran siempre semanal.
          </p>
        </>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Cobra</span>
          <select
            name="frecuencia"
            defaultValue={valores?.frecuencia || "diario"}
            className={campo}
          >
            <option value="diario">Diario</option>
            <option value="semanal">Semanal</option>
          </select>
        </label>
      )}
    </div>
  );
}
