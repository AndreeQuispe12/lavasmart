import type { Metadata } from "next";
import { soles } from "@/lib/dinero";
import { horaDeLima, hoyEnLima } from "@/lib/fecha";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = { title: "Lavados · LavaSmart" };

// La ven los dos roles: recibir autos es tarea del operador.
export default async function PaginaLavados() {
  const supabase = await crearClienteServidor();

  const [tipos, servicios, tarifas, presentes, enPiso] = await Promise.all([
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
      .eq("fecha", hoyEnLima())
      .in("estado", ["puntual", "tardanza"]),
    // Los totales salen de la vista: lavado no tiene columna de total.
    supabase
      .from("v_lavado")
      .select(
        "id, placa, tipo_vehiculo_id, trabajador_id, fecha_hora_ingreso, monto_total, observacion",
      )
      .eq("estado", "en_proceso")
      .order("fecha_hora_ingreso"),
  ]);

  const error =
    tipos.error ??
    servicios.error ??
    tarifas.error ??
    presentes.error ??
    enPiso.error;

  const lavadores = (presentes.data ?? [])
    .map((a) => a.trabajador)
    .filter((t) => t !== null && t.activo)
    .map((t) => ({ id: t!.id, nombre: `${t!.apellidos}, ${t!.nombres}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const autos = enPiso.data ?? [];
  const idsLavado = autos.map((a) => a.id!);

  // Para la lista: qué servicios lleva cada auto y quién lo lava. El
  // lavador puede ser de otro día si el auto quedó en piso de ayer.
  const [detalles, encargados] = await Promise.all([
    supabase
      .from("detalle_lavado")
      .select("lavado_id, tipo_lavado(nombre)")
      .in("lavado_id", idsLavado),
    supabase
      .from("trabajador")
      .select("id, nombres, apellidos")
      .in(
        "id",
        autos.map((a) => a.trabajador_id!),
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
                      {a.observacion && (
                        <p className="text-sm text-amber-700">
                          {a.observacion}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-base font-semibold">
                        {soles(a.monto_total ?? 0)}
                      </p>
                      <p className="text-zinc-500">
                        {nombreLavador.get(a.trabajador_id!)} · ingresó{" "}
                        {horaDeLima(a.fecha_hora_ingreso!)}
                      </p>
                      {/* sin_cobrar: está en proceso, no es una deuda. */}
                      <span className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                        En proceso · sin cobrar
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
