import type { Metadata } from "next";
import { soles, sumarSoles } from "@/lib/dinero";
import { fechaCorta, hoyEnLima } from "@/lib/fecha";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CerrarDia } from "./cerrar";
import { PagarTrabajador } from "./pagar";

export const metadata: Metadata = { title: "Liquidación · LavaSmart" };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Solo el dueño: es el dinero del personal (RLS liq_dueno, y aquí la
// guardia para no mostrar la pantalla a un operador).
export default async function PaginaLiquidacion({
  searchParams,
}: PageProps<"/liquidacion">) {
  await exigirDueno();

  const hoy = hoyEnLima();
  const pedida = (await searchParams).fecha;
  const fecha =
    typeof pedida === "string" && FECHA.test(pedida) && pedida <= hoy
      ? pedida
      : hoy;

  const supabase = await crearClienteServidor();
  const [calculo, guardadas, porPagar] = await Promise.all([
    // Lo que se devengaría si se cerrara ahora. No escribe nada.
    supabase.rpc("fn_calcular_liquidacion", { p_fecha: fecha }),
    // Lo ya cerrado, con el total que calcula la vista.
    supabase.from("v_liquidacion").select("*").eq("fecha", fecha),
    // Lo cerrado que todavía no se pagó, sumado por la base.
    supabase.from("v_por_pagar").select("*"),
  ]);

  const error = calculo.error ?? guardadas.error ?? porPagar.error;
  const deudas = porPagar.data ?? [];
  const cerradas = new Map(
    (guardadas.data ?? []).map((l) => [l.trabajador_id!, l]),
  );
  const ids = [
    ...new Set([
      ...(calculo.data ?? []).map((c) => c.trabajador_id),
      ...cerradas.keys(),
    ]),
  ];

  const { data: personas } = await supabase
    .from("trabajador")
    .select("id, nombres, apellidos, modalidad, frecuencia")
    .in("id", [...ids, ...deudas.map((d) => d.trabajador_id!)]);
  const persona = new Map((personas ?? []).map((p) => [p.id, p]));

  // Una fila por trabajador: si su día está cerrado, los montos congelados;
  // si no, el cálculo de ahora.
  const filas = ids
    .map((id) => {
      const cerrada = cerradas.get(id);
      const c = (calculo.data ?? []).find((x) => x.trabajador_id === id);
      const montos = cerrada?.cerrada
        ? {
            base: cerrada.monto_cobrado_base ?? 0,
            destajo: cerrada.monto_destajo ?? 0,
            sueldo: cerrada.monto_sueldo ?? 0,
            descuento: cerrada.monto_descuento ?? 0,
            total: cerrada.monto_a_pagar ?? 0,
          }
        : {
            base: c?.monto_cobrado_base ?? 0,
            destajo: c?.monto_destajo ?? 0,
            sueldo: c?.monto_sueldo ?? 0,
            descuento: c?.monto_descuento ?? 0,
            // Solo para mostrar antes de cerrar, en céntimos. El total que
            // vale es el de v_liquidacion, una vez cerrado.
            total: sumarSoles([
              c?.monto_destajo ?? 0,
              c?.monto_sueldo ?? 0,
              -(c?.monto_descuento ?? 0),
            ]),
          };
      return {
        id,
        nombre: `${persona.get(id)?.apellidos}, ${persona.get(id)?.nombres}`,
        modalidad: persona.get(id)?.modalidad,
        cerrada: Boolean(cerrada?.cerrada),
        entregada: Boolean(cerrada?.entregada),
        autosEnPiso: c?.autos_en_piso ?? 0,
        ...montos,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const pendientes = filas.filter((f) => !f.cerrada).length;

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Liquidación</h1>
        <p className="text-zinc-500">
          Lo devengado por cada trabajador en el día. Devengar no es pagar: el
          dinero sale cuando se entrega.
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border border-zinc-500/20 p-4">
        <h2 className="text-lg font-semibold">Por pagar</h2>
        {deudas.length === 0 ? (
          <p className="text-zinc-500">
            No hay días cerrados pendientes de pago.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-500/15">
            {deudas.map((d) => {
              const p = persona.get(d.trabajador_id!);
              return (
                <li
                  key={d.trabajador_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <div>
                    <p className="font-medium">
                      {p?.apellidos}, {p?.nombres}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Cobra {p?.frecuencia === "diario" ? "diario" : "semanal"}{" "}
                      · {d.dias} día(s) del {fechaCorta(d.desde!)} al{" "}
                      {fechaCorta(d.hasta!)}
                    </p>
                  </div>
                  <PagarTrabajador
                    trabajadorId={d.trabajador_id!}
                    hasta={d.hasta!}
                    monto={d.monto ?? 0}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-sm text-zinc-500">
          Al pagar se marcan como entregados todos sus días cerrados hasta el
          último que ves aquí. Queda registrado el día en que salió el dinero, y
          no se deshace.
        </p>
      </section>

      {/* GET: elegir el día no escribe nada. */}
      <form className="flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Día</span>
          <input
            type="date"
            name="fecha"
            defaultValue={fecha}
            max={hoy}
            className="rounded-lg border border-zinc-500/30 bg-transparent px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-500/30 px-4 py-2 hover:bg-zinc-500/10"
        >
          Ver
        </button>
      </form>

      {error ? (
        <p className="font-mono text-sm text-red-600">{error.message}</p>
      ) : filas.length === 0 ? (
        <p className="text-zinc-500">
          El {fechaCorta(fecha)} nadie marcó asistencia ni se entregó ningún
          auto.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-500/30 text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Trabajador</th>
                  <th className="py-2 pr-4 text-right font-medium">Cobrado</th>
                  <th className="py-2 pr-4 text-right font-medium">Destajo</th>
                  <th className="py-2 pr-4 text-right font-medium">Sueldo</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Descuento
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">A pagar</th>
                  <th className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-zinc-500/15">
                    <td className="py-2 pr-4">
                      <p>{f.nombre}</p>
                      <p className="text-xs text-zinc-500">
                        {f.modalidad === "fijo" ? "Sueldo fijo" : "Destajo"}
                      </p>
                    </td>
                    <td className="py-2 pr-4 text-right">{soles(f.base)}</td>
                    <td className="py-2 pr-4 text-right">{soles(f.destajo)}</td>
                    <td className="py-2 pr-4 text-right">{soles(f.sueldo)}</td>
                    <td className="py-2 pr-4 text-right">
                      {f.descuento > 0 ? `− ${soles(f.descuento)}` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold">
                      {soles(f.total)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.entregada
                            ? "bg-green-100 text-green-800"
                            : f.cerrada
                              ? "bg-sky-100 text-sky-800"
                              : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {f.entregada
                          ? "Pagada"
                          : f.cerrada
                            ? "Cerrada"
                            : "Abierta"}
                      </span>
                      {!f.cerrada && f.autosEnPiso > 0 && fecha === hoy && (
                        <p className="mt-1 text-xs text-amber-700">
                          {f.autosEnPiso} auto(s) en piso
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-zinc-500">
            Un auto cuenta para el día en que se entrega, porque el destajo es
            sobre lo cobrado. El de destajo usa el porcentaje que quedó fijo en
            cada lavado; el de sueldo fijo cobra su sueldo si trabajó, menos el
            descuento que pusiste en Asistencia.
          </p>

          <CerrarDia fecha={fecha} pendientes={pendientes} />
        </>
      )}
    </>
  );
}
