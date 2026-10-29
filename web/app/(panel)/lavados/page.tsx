import type { Metadata } from "next";
import { soles } from "@/lib/dinero";
import { horaDeLima, hoyEnLima, rangoDelDiaEnLima } from "@/lib/fecha";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { EntregarAuto } from "./entregar";
import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = { title: "Lavados · LavaSmart" };

// Cómo se ve el estado de pago de un auto ya entregado (v_lavado).
const PAGO: Record<string, { texto: string; clase: string }> = {
  pagado: { texto: "Pagado", clase: "bg-green-100 text-green-800" },
  parcial: { texto: "Pago incompleto", clase: "bg-amber-100 text-amber-800" },
  pendiente: { texto: "Sin pago", clase: "bg-red-100 text-red-800" },
};

// La ven los dos roles: recibir y entregar autos es tarea del operador.
export default async function PaginaLavados() {
  const supabase = await crearClienteServidor();
  const hoy = hoyEnLima();
  const [inicioDia, finDia] = rangoDelDiaEnLima(hoy);

  const [tipos, servicios, tarifas, presentes, enPiso, entregados, caja] =
    await Promise.all([
      supabase
        .from("tipo_vehiculo")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("tipo_lavado")
        .select("id, nombre")
        .eq("activo", true)
        .order("id"),
      supabase
        .from("tarifa")
        .select("tipo_vehiculo_id, tipo_lavado_id, precio")
        .eq("activo", true),
      // Solo puede recibir autos quien marcó entrada hoy y trabaja hoy. La
      // base lo vuelve a exigir (sql/05); esto solo evita ofrecer a quien no.
      supabase
        .from("asistencia")
        .select("trabajador(id, nombres, apellidos, activo)")
        .eq("fecha", hoy)
        .in("estado", ["puntual", "tardanza"]),
      // Los totales salen de la vista: lavado no tiene columna de total.
      supabase
        .from("v_lavado")
        .select(
          "id, placa, tipo_vehiculo_id, trabajador_id, fecha_hora_ingreso, monto_total, observacion",
        )
        .eq("estado", "en_proceso")
        .order("fecha_hora_ingreso"),
      // Entregados hoy en Lima: el saldo solo existe en estos, nunca en un
      // auto en proceso.
      supabase
        .from("v_lavado")
        .select(
          "id, placa, trabajador_id, fecha_hora_entrega, monto_total, monto_cobrado, saldo, metodo_pago, estado_pago",
        )
        .eq("estado", "entregado")
        .gte("fecha_hora_entrega", inicioDia)
        .lt("fecha_hora_entrega", finDia)
        .order("fecha_hora_entrega", { ascending: false }),
      // La caja del día la suma la base, agrupada por fecha de entrega.
      supabase.from("v_caja_dia").select("*").eq("fecha", hoy).maybeSingle(),
    ]);

  const error =
    tipos.error ??
    servicios.error ??
    tarifas.error ??
    presentes.error ??
    enPiso.error ??
    entregados.error ??
    caja.error;

  const lavadores = (presentes.data ?? [])
    .map((a) => a.trabajador)
    .filter((t) => t !== null && t.activo)
    .map((t) => ({ id: t!.id, nombre: `${t!.apellidos}, ${t!.nombres}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const autos = enPiso.data ?? [];
  const listos = entregados.data ?? [];

  // Para las listas: qué servicios lleva cada auto en piso y quién lava
  // cada auto (puede ser de otro día si quedó en piso de ayer).
  const [detalles, encargados] = await Promise.all([
    supabase
      .from("detalle_lavado")
      .select("lavado_id, tipo_lavado(nombre)")
      .in(
        "lavado_id",
        autos.map((a) => a.id!),
      ),
    supabase
      .from("trabajador")
      .select("id, nombres, apellidos")
      .in(
        "id",
        [...autos, ...listos].map((a) => a.trabajador_id!),
      ),
  ]);

  const nombreTipo = new Map((tipos.data ?? []).map((t) => [t.id, t.nombre]));
  const nombreLavador = new Map(
    (encargados.data ?? []).map((t) => [t.id, `${t.nombres} ${t.apellidos}`]),
  );
  const serviciosDe = new Map<number, string[]>();
  for (const d of detalles.data ?? []) {
    const lista = serviciosDe.get(d.lavado_id) ?? [];
    lista.push(d.tipo_lavado?.nombre ?? "");
    serviciosDe.set(d.lavado_id, lista);
  }

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Lavados</h1>
        <p className="text-zinc-500">
          Se registra al recibir el auto, sin cobrar. Se cobra al entregarlo.
        </p>
      </div>

      {error ? (
        <p className="font-mono text-sm text-red-600">{error.message}</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra titulo="Efectivo hoy" valor={caja.data?.cobrado_efectivo} />
            <Cifra titulo="Yape hoy" valor={caja.data?.cobrado_yape} />
            <Cifra titulo="Total cobrado" valor={caja.data?.cobrado_total} />
            <div className="rounded-lg border border-zinc-500/20 p-3">
              <p className="text-sm text-zinc-500">Entregados · en piso</p>
              <p className="text-xl font-semibold">
                {caja.data?.autos_entregados ?? 0} · {autos.length}
              </p>
            </div>
          </section>

          {lavadores.length === 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Nadie tiene la entrada marcada hoy. Primero se marca la
              asistencia, después se reciben autos.
            </p>
          )}

          <FormularioIngreso
            tipos={tipos.data ?? []}
            servicios={servicios.data ?? []}
            tarifas={tarifas.data ?? []}
            lavadores={lavadores}
          />

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">
              En piso <span className="text-zinc-500">({autos.length})</span>
            </h2>
            {autos.length === 0 ? (
              <p className="text-zinc-500">No hay autos en proceso.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-500/15">
                {autos.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-mono text-lg font-semibold">
                        {a.placa}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {nombreTipo.get(a.tipo_vehiculo_id!)} ·{" "}
                        {(serviciosDe.get(a.id!) ?? []).join(" + ")}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {nombreLavador.get(a.trabajador_id!)} · ingresó{" "}
                        {horaDeLima(a.fecha_hora_ingreso!)}
                      </p>
                      {a.observacion && (
                        <p className="text-sm text-amber-700">
                          {a.observacion}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-lg font-semibold">
                        {soles(a.monto_total ?? 0)}
                      </p>
                      {/* sin_cobrar: está en proceso, no es una deuda. */}
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                        En proceso · sin cobrar
                      </span>
                      <EntregarAuto
                        lavadoId={a.id!}
                        total={a.monto_total ?? 0}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">
              Entregados hoy{" "}
              <span className="text-zinc-500">({listos.length})</span>
            </h2>
            {listos.length === 0 ? (
              <p className="text-zinc-500">
                Todavía no se entregó ningún auto.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-500/15">
                {listos.map((a) => {
                  const pago = PAGO[a.estado_pago ?? ""];
                  return (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2"
                    >
                      <div>
                        <p className="font-mono font-semibold">{a.placa}</p>
                        <p className="text-sm text-zinc-500">
                          {nombreLavador.get(a.trabajador_id!)} · entregó{" "}
                          {horaDeLima(a.fecha_hora_entrega!)} ·{" "}
                          {a.metodo_pago === "yape" ? "Yape" : "Efectivo"}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>
                          {soles(a.monto_cobrado ?? 0)} de{" "}
                          {soles(a.monto_total ?? 0)}
                        </p>
                        {pago && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${pago.clase}`}
                          >
                            {pago.texto}
                            {(a.saldo ?? 0) > 0 &&
                              ` · saldo ${soles(a.saldo ?? 0)}`}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor?: number | null }) {
  return (
    <div className="rounded-lg border border-zinc-500/20 p-3">
      <p className="text-sm text-zinc-500">{titulo}</p>
      <p className="text-xl font-semibold">{soles(valor ?? 0)}</p>
    </div>
  );
}
