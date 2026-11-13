"use client";

import { useActionState, useRef, useState } from "react";
import { soles, sumarSoles } from "@/lib/dinero";
import { normalizarPlaca } from "@/lib/placa";
import {
  buscarCliente,
  placasDelTelefono,
  registrarIngreso,
  type EstadoIngreso,
} from "./acciones";

type Opcion = { id: number; nombre: string };
type Tarifa = {
  tipo_vehiculo_id: number;
  tipo_lavado_id: number;
  precio: number;
};

const estadoInicial: EstadoIngreso = { error: null, mensaje: null, version: 0 };

const campo = "rounded-lg border border-zinc-500/30 bg-transparent px-3 py-2";

export function FormularioIngreso(props: {
  tipos: Opcion[];
  servicios: Opcion[];
  tarifas: Tarifa[];
  lavadores: Opcion[];
}) {
  const [estado, enviar, enviando] = useActionState(
    registrarIngreso,
    estadoInicial,
  );

  return (
    // key cambia con cada ingreso guardado: el formulario vuelve a montarse
    // vacío. Si hubo error, se conserva lo escrito.
    <form
      key={estado.version}
      action={enviar}
      className="flex flex-col gap-4 rounded-lg border border-zinc-500/20 p-4"
    >
      <h2 className="text-lg font-semibold">Ingresa un auto</h2>
      <Campos {...props} />

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
        disabled={enviando || props.lavadores.length === 0}
        className="self-start rounded-lg bg-acento px-5 py-3 font-semibold text-white hover:bg-acento-oscuro disabled:opacity-60"
      >
        {enviando ? "Registrando..." : "Registrar ingreso"}
      </button>
    </form>
  );
}

function Campos({
  tipos,
  servicios,
  tarifas,
  lavadores,
}: {
  tipos: Opcion[];
  servicios: Opcion[];
  tarifas: Tarifa[];
  lavadores: Opcion[];
}) {
  // El tipo de vehículo decide los precios, y los servicios marcados el
  // total estimado: por eso los dos tienen estado propio.
  const [tipo, setTipo] = useState("");
  const [marcados, setMarcados] = useState<number[]>([]);

  // Datos opcionales del cliente. Se rellenan solos si la placa ya vino.
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [conocido, setConocido] = useState(false);
  const [otrasPlacas, setOtrasPlacas] = useState<
    { placa: string; nombre: string | null }[]
  >([]);
  // La última placa buscada: si el operador la cambia mientras llega la
  // respuesta, la respuesta vieja se descarta.
  const placaBuscada = useRef("");

  async function alSalirDeLaPlaca(texto: string) {
    const placa = normalizarPlaca(texto);
    if (placa === placaBuscada.current) return;
    placaBuscada.current = placa;
    // Si lo escrito venía de otra placa, no se le pasa al auto nuevo.
    if (conocido) {
      setNombre("");
      setTelefono("");
    }
    setConocido(false);
    setOtrasPlacas([]);

    const cliente = await buscarCliente(placa);
    if (placaBuscada.current !== placa || !cliente) return;
    setConocido(true);
    setTipo(String(cliente.tipoVehiculoId));
    setNombre(cliente.nombre ?? "");
    setTelefono(cliente.telefono ?? "");
  }

  async function alSalirDelTelefono(texto: string) {
    const placa = placaBuscada.current;
    const placas = await placasDelTelefono(texto, placa);
    if (placaBuscada.current !== placa) return;
    setOtrasPlacas(placas);
    // Si es la misma persona con otro auto, se le propone su nombre.
    const conNombre = placas.find((p) => p.nombre);
    if (!nombre.trim() && conNombre?.nombre) setNombre(conNombre.nombre);
  }

  const precioDe = (servicioId: number) =>
    tarifas.find(
      (t) =>
        t.tipo_vehiculo_id === Number(tipo) && t.tipo_lavado_id === servicioId,
    )?.precio;
  const total = sumarSoles(
    marcados.map((id) => precioDe(id)).filter((p) => p !== undefined),
  );

  function alternar(id: number) {
    setMarcados((m) =>
      m.includes(id) ? m.filter((x) => x !== id) : [...m, id],
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Placa</span>
        <input
          name="placa"
          required
          autoComplete="off"
          placeholder="ABC-123"
          onBlur={(e) => alSalirDeLaPlaca(e.target.value)}
          className={`${campo} text-lg uppercase`}
        />
        {conocido && (
          <span role="status" className="text-sm text-acento-oscuro">
            Cliente conocido: datos de su visita anterior.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Tipo de vehículo</span>
        <select
          name="tipoVehiculo"
          required
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className={campo}
        >
          <option value="" disabled>
            Elige…
          </option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Nombre del cliente (opcional)
        </span>
        <input
          name="nombre"
          maxLength={80}
          autoComplete="off"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Solo si el cliente quiere darlo"
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Celular (opcional)</span>
        <input
          name="telefono"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          onBlur={(e) => alSalirDelTelefono(e.target.value)}
          placeholder="987 654 321"
          className={campo}
        />
        <span className="text-xs text-zinc-500">
          Para avisarle cuando su auto esté listo o si surge algún
          inconveniente.
        </span>
        {otrasPlacas.length > 0 && (
          <span role="status" className="text-sm text-acento-oscuro">
            Este celular ya está registrado con{" "}
            {otrasPlacas
              .map((p) => (p.nombre ? `${p.placa} (${p.nombre})` : p.placa))
              .join(", ")}
            .
          </span>
        )}
      </label>

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Servicios</legend>
        {!tipo && (
          <p className="text-sm text-zinc-500">
            Elige el tipo de vehículo para ver los precios.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {servicios.map((s) => {
            const precio = precioDe(s.id);
            const deshabilitado = !tipo || precio === undefined;
            return (
              <label
                key={s.id}
                className={`flex items-center justify-between gap-3 rounded-lg border border-zinc-500/20 px-3 py-2 ${
                  deshabilitado ? "opacity-50" : "cursor-pointer"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="servicio"
                    value={s.id}
                    disabled={deshabilitado}
                    checked={marcados.includes(s.id) && !deshabilitado}
                    onChange={() => alternar(s.id)}
                    className="size-5"
                  />
                  {s.nombre}
                </span>
                {precio !== undefined && (
                  <span className="text-sm text-zinc-500">{soles(precio)}</span>
                )}
              </label>
            );
          })}
        </div>
        {tipo && (
          <p className="text-right font-semibold">
            Total estimado: {soles(total)}
          </p>
        )}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Lavador</span>
        <select name="lavador" required defaultValue="" className={campo}>
          <option value="" disabled>
            {lavadores.length === 0 ? "Nadie con entrada hoy" : "Elige…"}
          </option>
          {lavadores.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Observación (opcional)</span>
        <input
          name="observacion"
          placeholder="Rayón previo en la puerta, objetos en el auto…"
          className={campo}
        />
      </label>
    </div>
  );
}
