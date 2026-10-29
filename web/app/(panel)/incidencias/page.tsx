import type { Metadata } from "next";
import { fechaHoraDeLima } from "@/lib/fecha";
import { normalizarPlaca } from "@/lib/placa";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { pasarAEnProceso } from "./acciones";
import { FormularioIncidencia } from "./formulario";
import { ResolverIncidencia } from "./resolver";
import { ESTADOS, TIPOS } from "./textos";

export const metadata: Metadata = { title: "Incidencias · LavaSmart" };

// La ven los dos roles. Registrar es del operador; resolver, del dueño.
// La placa buscada viaja en la URL (?placa=ABC-123): buscar no escribe nada.
export default async function PaginaIncidencias({
  searchParams,
}: PageProps<"/incidencias">) {
  const buscada = (await searchParams).placa;
  const placa = typeof buscada === "string" ? normalizarPlaca(buscada) : "";

  const supabase = await crearClienteServidor();
  const { rol } = await obtenerSesion();

  // Todas las que no están resueltas, y las últimas resueltas.
  const [pendientes, resueltas, visitas] = await Promise.all([
    consultarIncidencias(supabase)
      .neq("estado", "resuelta")
      .order("fecha_reporte"),
    consultarIncidencias(supabase)
      .eq("estado", "resuelta")
      .order("fecha_resolucion", { ascending: false })
      .limit(10),
    placa ? visitasDe(placa) : Promise.resolve(null),
  ]);

  const error = pendientes.error ?? resueltas.error;

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Incidencias</h1>
        <p className="text-zinc-500">
          Rayones al secar, un aspirado que no se hizo, un objeto que falta. Se
          anclan a la placa y, si se identifica, a la visita.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-500/20 p-4">
        <h2 className="text-lg font-semibold">Registrar un reclamo</h2>
        {/* GET: la búsqueda queda en la URL y no cambia nada en la base. */}
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Placa</span>
            <input
              name="placa"
              required
              defaultValue={placa}
              placeholder="ABC-123"
              className="rounded-lg border border-zinc-500/30 bg-transparent px-3 py-2 text-lg uppercase"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-zinc-500/30 px-4 py-2 hover:bg-zinc-500/10"
          >
            Buscar visitas
          </button>
        </form>

        {placa &&
          (visitas === null ? (
            <p className="text-amber-700">
              No hay visitas de la placa {placa}. Un reclamo se registra sobre
              un auto que ya pasó por el lavadero.
            </p>
          ) : (
            <FormularioIncidencia placa={placa} visitas={visitas} />
          ))}
      </section>

      {error ? (
        <p className="font-mono text-sm text-red-600">{error.message}</p>
      ) : (
        <>
          <Lista
            titulo="Pendientes"
            vacio="No hay incidencias pendientes."
            filas={pendientes.data ?? []}
            acciones={(i) => (
              <div className="flex flex-col items-end gap-2">
                {i.estado === "abierta" && (
                  <form action={pasarAEnProceso.bind(null, i.id)}>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-500/30 px-3 py-1 text-sm hover:bg-zinc-500/10"
                    >
                      Pasar a en proceso
                    </button>
                  </form>
                )}
                {rol === "dueno" && <ResolverIncidencia id={i.id} />}
              </div>
            )}
          />
          <Lista
            titulo="Resueltas recientes"
            vacio="Todavía no se resolvió ninguna."
            filas={resueltas.data ?? []}
          />
        </>
      )}
    </>
  );
}

// Las últimas visitas de una placa, para elegir a cuál pertenece el
// reclamo. null si la placa nunca pasó por el lavadero.
async function visitasDe(placa: string) {
  const supabase = await crearClienteServidor();
  const { data: cliente } = await supabase
    .from("cliente")
    .select("id")
    .eq("placa", placa)
    .maybeSingle();
  if (!cliente) return null;

  const { data } = await supabase
    .from("lavado")
    .select("id, fecha_hora_ingreso, estado, trabajador(nombres, apellidos)")
    .eq("cliente_id", cliente.id)
    .order("fecha_hora_ingreso", { ascending: false })
    .limit(10);

  return (data ?? []).map((l) => ({
    id: l.id,
    texto: `${fechaHoraDeLima(l.fecha_hora_ingreso)} · ${l.trabajador?.nombres} ${l.trabajador?.apellidos}${
      l.estado === "en_proceso" ? " · en piso" : ""
    }`,
  }));
}

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

// La visita trae el lavador: de ahí se sabe a quién se le atribuye el
// reclamo. Una sola consulta base para las dos listas, y el tipo de cada
// fila se deduce de ella en lugar de escribirlo a mano.
function consultarIncidencias(supabase: Cliente) {
  return supabase
    .from("incidencia")
    .select(
      "id, tipo, descripcion, estado, fecha_reporte, resolucion, cliente(placa), lavado(fecha_hora_ingreso, trabajador(nombres, apellidos))",
    );
}

type Fila = NonNullable<
  Awaited<ReturnType<typeof consultarIncidencias>>["data"]
>[number];

function Lista({
  titulo,
  vacio,
  filas,
  acciones,
}: {
  titulo: string;
  vacio: string;
  filas: Fila[];
  acciones?: (fila: Fila) => React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {titulo} <span className="text-zinc-500">({filas.length})</span>
      </h2>
      {filas.length === 0 ? (
        <p className="text-zinc-500">{vacio}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-500/15">
          {filas.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3"
            >
              <div className="max-w-xl">
                <p>
                  <span className="font-mono font-semibold">
                    {i.cliente?.placa}
                  </span>{" "}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADOS[i.estado].clase}`}
                  >
                    {ESTADOS[i.estado].texto}
                  </span>
                </p>
                <p className="text-sm font-medium">{TIPOS[i.tipo]}</p>
                <p className="text-sm">{i.descripcion}</p>
                <p className="text-sm text-zinc-500">
                  Reportada {fechaHoraDeLima(i.fecha_reporte)} ·{" "}
                  {i.lavado
                    ? `visita del ${fechaHoraDeLima(i.lavado.fecha_hora_ingreso)}, lavador ${i.lavado.trabajador?.nombres} ${i.lavado.trabajador?.apellidos}`
                    : "sin visita asociada"}
                </p>
                {i.resolucion && (
                  <p className="text-sm text-green-700">
                    Resolución: {i.resolucion}
                  </p>
                )}
              </div>
              {acciones?.(i)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
