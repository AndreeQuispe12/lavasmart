import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  Car,
  ChartColumn,
  CircleCheck,
  Clock,
  Plus,
  Smartphone,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { soles } from "@/lib/dinero";
import { hoyEnLima, horaDeLima } from "@/lib/fecha";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { TARJETA, TituloSeccion } from "./tablero/piezas";

// "Hoy": lo primero que ve quien abre el sistema en la mañana. Responde
// "¿qué hay que hacer ahora?" y lleva a la pantalla donde se hace. La ven
// los dos roles; el dueño tiene además el acceso al tablero, que es "cómo
// va el negocio". Solo lee: cuenta filas y muestra la caja que suma la base.
export default async function Inicio() {
  // Misma llamada que hace el layout: cache() la resuelve sin repetirla.
  const { rol } = await obtenerSesion();
  const hoy = hoyEnLima();

  const supabase = await crearClienteServidor();
  // count con head: true cuenta en la base sin traer las filas.
  const contar = { count: "exact" as const, head: true };
  const [activos, marcados, enPiso, incidencias, caja, demanda] =
    await Promise.all([
      // Los activos con su nombre, para decir quién falta marcar y quién
      // lava cada auto. Son pocas filas: el lavadero tiene un puñado.
      supabase
        .from("trabajador")
        .select("id, nombres, apellidos")
        .eq("activo", true)
        .order("nombres"),
      supabase.from("asistencia").select("trabajador_id").eq("fecha", hoy),
      supabase
        .from("v_lavado")
        .select("id, placa, trabajador_id, fecha_hora_ingreso")
        .eq("estado", "en_proceso")
        .order("fecha_hora_ingreso"),
      supabase
        .from("incidencia")
        .select("id", contar)
        .neq("estado", "resuelta"),
      supabase
        .from("v_caja_dia")
        .select(
          "cobrado_total, cobrado_efectivo, cobrado_yape, autos_entregados",
        )
        .eq("fecha", hoy)
        .maybeSingle(),
      // Lo que el modelo espera para hoy, si ya hay modelo (sql/15). No tiene
      // datos de personas: la ven los dos roles.
      supabase
        .from("v_demanda_vigente")
        .select("vehiculos_estimados, intervalo_inferior, intervalo_superior")
        .eq("fecha_objetivo", hoy)
        .maybeSingle(),
    ]);

  const error =
    activos.error ??
    marcados.error ??
    enPiso.error ??
    incidencias.error ??
    caja.error ??
    demanda.error;
  if (error) {
    return <p className="font-mono text-sm text-red-600">{error.message}</p>;
  }

  const trabajadores = activos.data ?? [];
  const conAsistencia = new Set(
    (marcados.data ?? []).map((a) => a.trabajador_id),
  );
  const faltan = trabajadores.filter((t) => !conAsistencia.has(t.id));
  const nombreDe = new Map(
    trabajadores.map((t) => [
      t.id,
      `${t.nombres} ${t.apellidos.split(" ")[0]}`,
    ]),
  );

  const autos = enPiso.data ?? [];
  const entregados = caja.data?.autos_entregados ?? 0;
  const atendidos = entregados + autos.length;
  const sinResolver = incidencias.count ?? 0;

  // Sin modelo entrenado no se dice nada: mejor nada que un número
  // inventado.
  const esperados =
    demanda.data?.vehiculos_estimados != null
      ? Math.round(demanda.data.vehiculos_estimados)
      : null;
  const avance =
    esperados && esperados > 0 ? Math.min(atendidos / esperados, 1) : null;

  return (
    <>
      {/* El día de un vistazo: cuántos autos van y cuántos se esperan, y el
          botón de lo que más se hace en el mostrador. */}
      <section
        className={`${TARJETA} flex flex-col gap-4 sm:flex-row sm:items-center`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-500">Autos atendidos hoy</p>
          <p className="text-3xl font-bold">
            {atendidos}
            {esperados != null && (
              <span className="text-lg font-medium text-zinc-500">
                {" "}
                de unos {esperados} esperados
              </span>
            )}
          </p>
          {avance != null && (
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-500/10"
              role="progressbar"
              aria-valuenow={atendidos}
              aria-valuemin={0}
              aria-valuemax={esperados ?? undefined}
              aria-label="Autos atendidos frente a los esperados"
            >
              <div
                className="h-full rounded-full bg-acento"
                style={{ width: `${Math.round(avance * 100)}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-sm text-zinc-500">
            {entregados} entregado(s) · {autos.length} en piso
            {demanda.data?.intervalo_inferior != null &&
              demanda.data.intervalo_superior != null &&
              ` · el modelo espera entre ${Math.round(demanda.data.intervalo_inferior)} y ${Math.round(demanda.data.intervalo_superior)}`}
          </p>
        </div>
        <Link
          href="/lavados"
          className="flex items-center justify-center gap-2 rounded-lg bg-acento px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-acento-oscuro"
        >
          <Plus aria-hidden className="size-5" />
          Ingresar un auto
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta
          href="/asistencia"
          icono={CalendarCheck}
          titulo="Asistencia"
          valor={
            trabajadores.length === 0
              ? "Sin personal"
              : faltan.length === 0
                ? "Todos marcados"
                : `Faltan ${faltan.length} de ${trabajadores.length}`
          }
          detalle={
            faltan.length > 0
              ? faltan.map((t) => nombreDe.get(t.id)).join(", ")
              : trabajadores.length === 0
                ? "Registra al personal primero"
                : "Ya se les pueden asignar autos"
          }
          // Sin asistencia no se le asignan autos: es lo primero del día.
          estado={faltan.length > 0 ? "aviso" : "bien"}
        />
        <Tarjeta
          href="/lavados"
          icono={Car}
          titulo="En piso"
          valor={`${autos.length} auto(s)`}
          detalle={
            autos.length === 0 ? "Nadie esperando" : "Lavándose ahora mismo"
          }
        />
        <Tarjeta
          href="/lavados"
          icono={Wallet}
          titulo="Cobrado hoy"
          valor={soles(caja.data?.cobrado_total ?? 0)}
          detalle={`${entregados} auto(s) entregado(s)`}
        />
        <Tarjeta
          href="/incidencias"
          icono={TriangleAlert}
          titulo="Incidencias"
          valor={sinResolver === 0 ? "Ninguna" : `${sinResolver} sin resolver`}
          detalle={
            sinResolver === 0
              ? "Todo en orden"
              : rol === "dueno"
                ? "Esperan tu decisión"
                : "El dueño las resuelve"
          }
          estado={sinResolver > 0 ? "aviso" : "bien"}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className={`${TARJETA} flex flex-col gap-3 lg:col-span-2`}>
          <TituloSeccion icono={Car} titulo="Autos en piso" />
          {autos.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No hay autos lavándose. Los que ingreses aparecen aquí hasta que
              se entreguen.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-500/10">
              {autos.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span className="rounded-md border border-zinc-500/20 bg-zinc-50 px-2 py-0.5 font-mono text-sm font-semibold">
                    {a.placa}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {nombreDe.get(a.trabajador_id!) ?? "—"}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-zinc-500">
                    <Clock aria-hidden className="size-3.5" />
                    {horaDeLima(a.fecha_hora_ingreso!)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {autos.length > 0 && (
            <Link
              href="/lavados"
              className="flex items-center gap-1 self-start text-sm font-medium text-acento hover:text-acento-oscuro"
            >
              Entregar y cobrar
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>

        <div className={`${TARJETA} flex flex-col gap-3`}>
          <TituloSeccion icono={Wallet} titulo="Caja de hoy" />
          {/* Los montos los suma la base en v_caja_dia; aquí solo se
              muestran. */}
          <dl className="flex flex-col gap-2 text-sm">
            <Medio
              icono={Banknote}
              medio="Efectivo"
              monto={caja.data?.cobrado_efectivo ?? 0}
            />
            <Medio
              icono={Smartphone}
              medio="Yape"
              monto={caja.data?.cobrado_yape ?? 0}
            />
            <div className="flex justify-between border-t border-zinc-500/10 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{soles(caja.data?.cobrado_total ?? 0)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {rol === "dueno" && (
        <Link
          href="/tablero"
          className={`${TARJETA} flex items-center gap-3 hover:border-acento/40`}
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-acento/10 text-acento-oscuro">
            <ChartColumn aria-hidden className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Cómo va el negocio</span>
            <span className="block text-sm text-zinc-500">
              Ingresos de la semana, demanda, segmentos y a quién llamar
            </span>
          </span>
          <ArrowRight aria-hidden className="size-5 text-acento" />
        </Link>
      )}
    </>
  );
}

function Tarjeta({
  href,
  icono: Icono,
  titulo,
  valor,
  detalle,
  estado = "neutro",
}: {
  href: string;
  icono: LucideIcon;
  titulo: string;
  valor: string;
  detalle: string;
  estado?: "neutro" | "aviso" | "bien";
}) {
  const borde =
    estado === "aviso"
      ? "border-amber-400 bg-amber-50/60"
      : "border-zinc-500/10 bg-white";
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-2 rounded-xl border p-4 shadow-sm hover:shadow-md ${borde}`}
    >
      <span className="flex items-center justify-between text-sm text-zinc-500">
        <span className="flex items-center gap-2">
          <span
            className={`flex size-7 items-center justify-center rounded-lg ${
              estado === "aviso"
                ? "bg-amber-100 text-amber-700"
                : "bg-acento/10 text-acento-oscuro"
            }`}
          >
            <Icono aria-hidden className="size-4" />
          </span>
          {titulo}
        </span>
        {estado === "bien" && (
          <CircleCheck
            aria-label="Al día"
            className="size-4 text-emerald-600"
          />
        )}
      </span>
      <span className="text-xl font-semibold">{valor}</span>
      <span className="truncate text-sm text-zinc-500">{detalle}</span>
    </Link>
  );
}

function Medio({
  icono: Icono,
  medio,
  monto,
}: {
  icono: LucideIcon;
  medio: string;
  monto: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-zinc-600">
        <Icono aria-hidden className="size-4 text-zinc-400" />
        {medio}
      </dt>
      <dd className="font-medium">{soles(monto)}</dd>
    </div>
  );
}
