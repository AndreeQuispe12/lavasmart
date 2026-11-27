import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  CarFront,
  ChevronRight,
  Coins,
  Droplets,
  HandCoins,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { soles, sumarSoles } from "@/lib/dinero";
import { fechaCorta, hoyEnLima, sumarDias } from "@/lib/fecha";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { TIPOS } from "../incidencias/textos";
import { Analitica } from "./analitica";
import { TARJETA, TituloSeccion } from "./piezas";

export const metadata: Metadata = { title: "Tablero · LavaSmart" };

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Solo el dueño. Solo lee: todas las sumas las hace la base (v_caja_dia y
// las funciones de sql/14); aquí solo se dibujan.
// ?segmento=<nombre> abre la lista de clientes de ese segmento.
export default async function PaginaTablero({
  searchParams,
}: PageProps<"/tablero">) {
  await exigirDueno();
  const pedido = (await searchParams).segmento;
  const segmento = typeof pedido === "string" ? pedido : null;

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
  const efectivo = deHoy?.cobrado_efectivo ?? 0;
  const yape = deHoy?.cobrado_yape ?? 0;
  const cobradoHoy = deHoy?.cobrado_total ?? 0;
  // Solo para mostrar el total de la semana: en céntimos (lib/dinero.ts).
  const cobradoSemana = sumarSoles(dias.map((d) => d.cobrado));
  const autosSemana = dias.reduce((suma, d) => suma + d.autos, 0);
  // Solo para el alto de las columnas: una proporción, no una suma de dinero.
  const maxCobrado = Math.max(...dias.map((d) => d.cobrado), 1);
  const maxServicio = Math.max(...ranking.map((s) => s.cantidad), 1);

  const abiertasPorTipo = new Map<string, number>();
  for (const i of abiertas) {
    abiertasPorTipo.set(i.tipo, (abiertasPorTipo.get(i.tipo) ?? 0) + 1);
  }

  return (
    <>
      {/* La franja azul de arriba ya dice "Tablero": el h1 queda para los
          lectores de pantalla. */}
      <h1 className="sr-only">Tablero</h1>
      <p className="-mt-2 text-sm text-zinc-500">
        Hoy {fechaCorta(hoy)} y los últimos 7 días. Todo sale de lo registrado
        en el sistema.
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra
          icono={Wallet}
          titulo="Cobrado hoy"
          valor={soles(cobradoHoy)}
          detalle={`${deHoy?.autos_entregados ?? 0} autos entregados`}
          destacada
        />
        <Cifra
          icono={Banknote}
          titulo="Efectivo"
          valor={soles(efectivo)}
          detalle="lo que debe haber en el cajón"
        />
        <Cifra
          icono={Smartphone}
          titulo="Yape"
          valor={soles(yape)}
          detalle={
            cobradoHoy > 0
              ? `${Math.round((yape / cobradoHoy) * 100)} % de lo cobrado`
              : "sin cobros todavía"
          }
        />
        <Cifra
          icono={CarFront}
          titulo="En piso ahora"
          valor={String(enPiso.count ?? 0)}
          detalle="ver autos en Lavados"
          enlace="/lavados"
        />
      </section>

      <section className={`${TARJETA} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <TituloSeccion
            icono={Coins}
            titulo="Cobranza de los últimos 7 días"
          />
          <p className="text-sm text-zinc-500">
            Semana:{" "}
            <strong className="text-foreground">{soles(cobradoSemana)}</strong>{" "}
            · {autosSemana} autos
          </p>
        </div>
        {/* Columnas: el alto es proporcional a lo cobrado ese día. */}
        <ul className="grid h-56 grid-cols-7 items-end gap-2 sm:gap-4">
          {dias.map((d) => {
            const [anio, mes, dia] = d.fecha.split("-").map(Number);
            const nombre =
              DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
            const esHoy = d.fecha === hoy;
            return (
              <li
                key={d.fecha}
                className="flex h-full flex-col items-center justify-end gap-1"
              >
                <span className="text-[11px] font-semibold text-acento-oscuro sm:text-xs">
                  {soles(d.cobrado).replace(".00", "")}
                </span>
                <div
                  className={`w-full max-w-14 rounded-t-lg ${
                    esHoy ? "bg-acento" : "bg-acento/35"
                  }`}
                  style={{
                    height: `${Math.max((d.cobrado / maxCobrado) * 100, 2)}%`,
                  }}
                  title={`${soles(d.cobrado)} · ${d.autos} autos`}
                />
                <span
                  className={`text-xs ${esHoy ? "font-semibold text-acento-oscuro" : "text-zinc-500"}`}
                >
                  {esHoy ? "hoy" : nombre}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {d.autos} autos
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={`${TARJETA} flex flex-col gap-3`}>
          <TituloSeccion icono={Droplets} titulo="Servicios más pedidos" />
          {ranking.length === 0 ? (
            <p className="text-zinc-500">Sin servicios en estos 7 días.</p>
          ) : (
            <ol className="flex flex-col gap-3 text-sm">
              {ranking.map((s) => (
                <li key={s.servicio} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3">
                    <span>
                      {s.servicio}{" "}
                      <span className="text-zinc-500">× {s.cantidad}</span>
                    </span>
                    <span className="font-medium">{soles(s.monto)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-500/10">
                    <div
                      className="h-2 rounded-full bg-acento"
                      style={{ width: `${(s.cantidad / maxServicio) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={`${TARJETA} flex flex-col gap-3`}>
          <TituloSeccion icono={Sparkles} titulo="Para atender" />
          <div className="flex flex-col divide-y divide-zinc-500/10 text-sm">
            <Pendiente
              icono={Coins}
              titulo="Pagos incompletos (7 días)"
              nota="Solo autos entregados. No se vuelve a cobrar."
              valor={soles(totales.saldo_no_cobrado)}
              detalle={`${totales.autos_con_saldo} auto(s)`}
            />
            <Pendiente
              icono={HandCoins}
              titulo="Por pagar al personal"
              valor={soles(totales.por_pagar)}
              detalle={`${totales.trabajadores_por_pagar} trabajador(es)`}
              enlace="/liquidacion"
            />
            <Pendiente
              icono={TriangleAlert}
              titulo="Incidencias sin resolver"
              valor={String(abiertas.length)}
              detalle={[...abiertasPorTipo]
                .map(
                  ([tipo, n]) => `${TIPOS[tipo as keyof typeof TIPOS]}: ${n}`,
                )
                .join(" · ")}
              enlace="/incidencias"
              alerta={abiertas.length > 0}
            />
          </div>
        </section>
      </div>

      <Analitica hoy={hoy} segmento={segmento} />
    </>
  );
}

function Cifra({
  icono: Icono,
  titulo,
  valor,
  detalle,
  enlace,
  destacada = false,
}: {
  icono: LucideIcon;
  titulo: string;
  valor: string;
  detalle: string;
  enlace?: string;
  destacada?: boolean;
}) {
  const clase = destacada
    ? "bg-gradient-to-br from-acento to-acento-oscuro text-white shadow-md"
    : `${TARJETA} hover:border-acento/40`;
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p
          className={`text-sm font-medium ${destacada ? "text-white/85" : "text-zinc-500"}`}
        >
          {titulo}
        </p>
        <span
          className={`flex size-8 items-center justify-center rounded-lg ${
            destacada ? "bg-white/20" : "bg-acento/10 text-acento-oscuro"
          }`}
        >
          <Icono aria-hidden className="size-4" />
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{valor}</p>
      <p
        className={`flex items-center gap-1 text-xs ${destacada ? "text-white/80" : "text-zinc-500"}`}
      >
        {detalle}
        {enlace && <ChevronRight aria-hidden className="size-3" />}
      </p>
    </>
  );
  const base = `flex flex-col gap-1 rounded-xl p-4 transition ${clase}`;
  return enlace ? (
    <Link href={enlace} className={base}>
      {contenido}
    </Link>
  ) : (
    <div className={base}>{contenido}</div>
  );
}

function Pendiente({
  icono: Icono,
  titulo,
  nota,
  valor,
  detalle,
  enlace,
  alerta = false,
}: {
  icono: LucideIcon;
  titulo: string;
  nota?: string;
  valor: string;
  detalle: string;
  enlace?: string;
  alerta?: boolean;
}) {
  const contenido = (
    <>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          alerta
            ? "bg-amber-500/15 text-amber-700"
            : "bg-acento/10 text-acento-oscuro"
        }`}
      >
        <Icono aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-medium">
          {titulo}
          {enlace && (
            <ChevronRight aria-hidden className="size-3 text-zinc-400" />
          )}
        </p>
        {(nota || detalle) && (
          <p className="text-xs text-zinc-500">{nota ?? detalle}</p>
        )}
      </div>
      <div className="text-right">
        <p className={`font-semibold ${alerta ? "text-amber-700" : ""}`}>
          {valor}
        </p>
        {nota && <p className="text-xs text-zinc-500">{detalle}</p>}
      </div>
    </>
  );
  const base = "flex items-center gap-3 py-3";
  return enlace ? (
    <Link
      href={enlace}
      className={`${base} -mx-2 rounded-lg px-2 hover:bg-acento/5`}
    >
      {contenido}
    </Link>
  ) : (
    <div className={base}>{contenido}</div>
  );
}
