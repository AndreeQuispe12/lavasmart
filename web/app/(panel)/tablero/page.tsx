import type { Metadata } from "next";
import Link from "next/link";
import { soles } from "@/lib/dinero";
import { fechaCorta, hoyEnLima, sumarDias } from "@/lib/fecha";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { TIPOS } from "../incidencias/textos";

export const metadata: Metadata = { title: "Tablero · LavaSmart" };

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Solo el dueño. Solo lee: todas las sumas las hace la base (v_caja_dia y
// las funciones de sql/14); aquí solo se dibujan.
export default async function PaginaTablero() {
  await exigirDueno();

  const hoy = hoyEnLima();
  const desde = sumarDias(hoy, -6); // los últimos 7 días, hoy incluido

  const supabase = await crearClienteServidor();
  const [caja, resumen, servicios, incidencias, enPiso] = await Promise.all([
    supabase.from("v_caja_dia").select("*").gte("fecha", desde),
    supabase.rpc("fn_tablero_resumen", { p_desde: desde }).single(),
    supabase.rpc("fn_servicios_mas_pedidos", { p_desde: desde }),
    supabase.from("incidencia").select("tipo").neq("estado", "resuelta"),
    // Solo cuántos: count sin traer las filas.
    supabase
      .from("lavado")
      .select("id", { count: "exact", head: true })
      .eq("estado", "en_proceso"),
  ]);

  const error =
    caja.error ??
    resumen.error ??
    servicios.error ??
    incidencias.error ??
    enPiso.error;
  if (error) {
    return <p className="font-mono text-sm text-red-600">{error.message}</p>;
  }
  // Revisar los errores juntos no le dice a TypeScript que cada "data"
  // llegó: se nombran aquí con su valor por defecto.
  const filasCaja = caja.data ?? [];
  const abiertas = incidencias.data ?? [];
  const ranking = servicios.data ?? [];
  const totales = resumen.data ?? {
    saldo_no_cobrado: 0,
    autos_con_saldo: 0,
    por_pagar: 0,
    trabajadores_por_pagar: 0,
  };

  // Los 7 días, también los que no tuvieron entregas (salen en cero).
  const porFecha = new Map(filasCaja.map((c) => [c.fecha, c]));
  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(desde, i);
    const c = porFecha.get(fecha);
    return {
      fecha,
      cobrado: c?.cobrado_total ?? 0,
      autos: c?.autos_entregados ?? 0,
    };
  });
  const deHoy = porFecha.get(hoy);
  // Solo para el largo de las barras: una proporción, no una suma de dinero.
  const maxCobrado = Math.max(...dias.map((d) => d.cobrado), 1);

  const abiertasPorTipo = new Map<string, number>();
  for (const i of abiertas) {
    abiertasPorTipo.set(i.tipo, (abiertasPorTipo.get(i.tipo) ?? 0) + 1);
  }

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Tablero</h1>
        <p className="text-zinc-500">
          Hoy {fechaCorta(hoy)} y los últimos 7 días. Todo sale de lo registrado
          en el sistema.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra titulo="Cobrado hoy" valor={soles(deHoy?.cobrado_total ?? 0)} />
        <Cifra
          titulo="Efectivo · Yape"
          valor={`${soles(deHoy?.cobrado_efectivo ?? 0)} · ${soles(deHoy?.cobrado_yape ?? 0)}`}
        />
        <Cifra
          titulo="Autos entregados hoy"
          valor={String(deHoy?.autos_entregados ?? 0)}
        />
        <Cifra
          titulo="En piso ahora"
          valor={String(enPiso.count ?? 0)}
          enlace="/lavados"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-500/20 p-4">
        <h2 className="text-lg font-semibold">
          Cobranza de los últimos 7 días
        </h2>
        <ul className="flex flex-col gap-2">
          {dias.map((d) => {
            const [anio, mes, dia] = d.fecha.split("-").map(Number);
            const nombre =
              DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
            return (
              <li key={d.fecha} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-zinc-500">
                  {nombre} {fechaCorta(d.fecha).slice(0, 5)}
                </span>
                <div className="h-5 flex-1 rounded bg-zinc-500/10">
                  <div
                    className="h-5 rounded bg-sky-600"
                    style={{ width: `${(d.cobrado / maxCobrado) * 100}%` }}
                  />
                </div>
                <span className="w-36 shrink-0 text-right">
                  {soles(d.cobrado)} · {d.autos} auto(s)
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-lg border border-zinc-500/20 p-4">
          <h2 className="text-lg font-semibold">Servicios más pedidos</h2>
          {ranking.length === 0 ? (
            <p className="text-zinc-500">Sin servicios en estos 7 días.</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm">
              {ranking.map((s) => (
                <li key={s.servicio} className="flex justify-between gap-3">
                  <span>
                    {s.servicio}{" "}
                    <span className="text-zinc-500">× {s.cantidad}</span>
                  </span>
                  <span>{soles(s.monto)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-zinc-500/20 p-4">
          <h2 className="text-lg font-semibold">Para atender</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt>
                Pagos incompletos (7 días)
                <span className="block text-xs text-zinc-500">
                  Solo autos entregados. No se vuelve a cobrar.
                </span>
              </dt>
              <dd className="text-right">
                {soles(totales.saldo_no_cobrado)}
                <span className="block text-xs text-zinc-500">
                  {totales.autos_con_saldo} auto(s)
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>
                <Link href="/liquidacion" className="underline">
                  Por pagar al personal
                </Link>
              </dt>
              <dd className="text-right">
                {soles(totales.por_pagar)}
                <span className="block text-xs text-zinc-500">
                  {totales.trabajadores_por_pagar} trabajador(es)
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>
                <Link href="/incidencias" className="underline">
                  Incidencias sin resolver
                </Link>
              </dt>
              <dd className="text-right">
                {abiertas.length}
                {[...abiertasPorTipo].map(([tipo, n]) => (
                  <span key={tipo} className="block text-xs text-zinc-500">
                    {TIPOS[tipo as keyof typeof TIPOS]}: {n}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Los modelos no se entrenan sin histórico (docs/analitica.md). No se
          muestran datos simulados como si fueran del negocio. */}
      <section className="rounded-lg border border-dashed border-zinc-500/40 p-4 text-sm text-zinc-500">
        <h2 className="text-lg font-semibold text-inherit">
          Predicción de demanda y segmentación de clientes
        </h2>
        <p className="mt-1">
          Pendiente. Se habilita cuando el sistema tenga varias semanas de
          lavados registrados: sin histórico, los modelos no tienen de qué
          aprender.
        </p>
      </section>
    </>
  );
}

function Cifra({
  titulo,
  valor,
  enlace,
}: {
  titulo: string;
  valor: string;
  enlace?: string;
}) {
  const contenido = (
    <>
      <p className="text-sm text-zinc-500">{titulo}</p>
      <p className="text-xl font-semibold">{valor}</p>
    </>
  );
  return enlace ? (
    <Link
      href={enlace}
      className="rounded-lg border border-zinc-500/20 p-3 hover:bg-zinc-500/5"
    >
      {contenido}
    </Link>
  ) : (
    <div className="rounded-lg border border-zinc-500/20 p-3">{contenido}</div>
  );
}
