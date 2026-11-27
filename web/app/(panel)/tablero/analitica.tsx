import Link from "next/link";
import { soles } from "@/lib/dinero";
import {
  diaDeLaSemana,
  fechaCorta,
  fechaHoraDeLima,
  sumarDias,
} from "@/lib/fecha";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { BrainCircuit, CalendarDays, Users } from "lucide-react";
import { TARJETA, TituloSeccion } from "./piezas";
import { ParaLlamar, TarjetasSegmento } from "./segmentos";

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Los resultados de los modelos, tal como los dejó el proceso de ml/. Esta
// pantalla solo los lee (las vistas de sql/15 eligen la versión vigente).
// Mientras no haya histórico para entrenar, las tablas están vacías y cada
// bloque lo dice: nunca se muestran datos simulados como si fueran reales.
export async function Analitica({
  hoy,
  segmento,
}: {
  hoy: string;
  segmento: string | null;
}) {
  const supabase = await crearClienteServidor();
  const [
    demanda,
    segmentos,
    metricas,
    parametro,
    activos,
    resumen,
    alejandose,
  ] = await Promise.all([
    supabase
      .from("v_demanda_vigente")
      .select("*")
      .gte("fecha_objetivo", hoy)
      .lte("fecha_objetivo", sumarDias(hoy, 6))
      .order("fecha_objetivo"),
    // Solo el dueño la ve (RLS de cliente_segmento).
    supabase
      .from("v_segmento_vigente")
      .select("placa, segmento, recencia_dias, frecuencia, monetario")
      .order("recencia_dias"),
    supabase
      .from("modelo_metrica")
      .select(
        "modelo, version, metrica, valor, filas_entrenamiento, entrenado_en",
      )
      .order("entrenado_en", { ascending: false }),
    // Cuántos autos atiende un lavador en un día: lo pone el dueño (sql/18).
    supabase
      .from("configuracion")
      .select("valor")
      .eq("clave", "autos_por_lavador")
      .maybeSingle(),
    // Solo cuántos: count sin traer las filas.
    supabase
      .from("trabajador")
      .select("id", { count: "exact", head: true })
      .eq("activo", true),
    // Cuánto vale cada segmento y a quién llamar (sql/19, solo el dueño).
    supabase.rpc("fn_segmentos_resumen"),
    supabase.rpc("fn_clientes_alejandose", { p_limite: 15 }),
  ]);

  const error =
    demanda.error ??
    segmentos.error ??
    metricas.error ??
    parametro.error ??
    activos.error ??
    resumen.error ??
    alejandose.error;
  if (error) {
    return <p className="font-mono text-sm text-red-600">{error.message}</p>;
  }

  const clientes = segmentos.data ?? [];
  const plan = armarPlan(
    demanda.data ?? [],
    Number(parametro.data?.valor ?? 5),
    activos.count ?? 0,
  );

  // De cada modelo, las métricas de su último entrenamiento.
  const ultimo = new Map<string, NonNullable<typeof metricas.data>>();
  for (const m of metricas.data ?? []) {
    const filas = ultimo.get(m.modelo) ?? [];
    if (filas.length === 0 || filas[0].version === m.version) {
      ultimo.set(m.modelo, [...filas, m]);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 pt-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-marca to-acento text-white shadow-sm">
          <BrainCircuit aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold">Lo que dicen los modelos</h2>
          <p className="text-sm text-zinc-500">
            Predicción de demanda y segmentación de clientes, convertidas en
            decisiones.
          </p>
        </div>
      </div>

      <div className={TARJETA}>
        <PlanDeLaSemana plan={plan} />
      </div>

      <div className={`${TARJETA} flex flex-col gap-3`}>
        <div>
          <TituloSeccion
            icono={Users}
            titulo="Tus clientes por segmento"
            nivel={3}
          />
          <p className="mt-1 text-sm text-zinc-500">
            Cuánto deja cada grupo y qué hacer con él.
          </p>
        </div>
        {clientes.length === 0 ? (
          <Pendiente />
        ) : (
          <>
            <TarjetasSegmento resumen={resumen.data ?? []} elegido={segmento} />
            {segmento && (
              <ListaSegmento
                nombre={segmento}
                clientes={clientes.filter((c) => c.segmento === segmento)}
              />
            )}
          </>
        )}
      </div>

      <div className={TARJETA}>
        <ParaLlamar clientes={alejandose.data ?? []} />
      </div>

      {ultimo.size > 0 && (
        <p className="rounded-lg bg-zinc-500/5 px-3 py-2 text-xs text-zinc-500">
          {[...ultimo].map(([modelo, filas]) => (
            <span key={modelo} className="block">
              {modelo === "regresion" ? "Demanda" : "Segmentación"}: versión{" "}
              {filas[0].version}, entrenada el{" "}
              {fechaHoraDeLima(filas[0].entrenado_en)} con{" "}
              {filas[0].filas_entrenamiento} filas ·{" "}
              {filas.map((f) => `${f.metrica} ${f.valor}`).join(" · ")}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
//  Plan de la semana: de autos esperados a lavadores que convocar.
// ---------------------------------------------------------------------

type DiaPredicho = {
  fecha_objetivo: string | null;
  vehiculos_estimados: number | null;
  intervalo_inferior: number | null;
  intervalo_superior: number | null;
};

type TipoDeDia = "cargado" | "normal" | "flojo";

type DiaDelPlan = {
  fecha: string;
  autos: number;
  minimo: number | null;
  maximo: number | null;
  lavadores: number;
  lavadoresAlMaximo: number;
  tipo: TipoDeDia;
};

type Plan = {
  dias: DiaDelPlan[];
  autosPorLavador: number;
  activos: number;
  totalAutos: number;
  masCargado: DiaDelPlan | null;
};

// Un día es cargado o flojo comparado con el resto de la semana, no con un
// número fijo: así la etiqueta sigue sirviendo si el negocio crece.
const CARGADO = 1.3;
const FLOJO = 0.8;

// Siempre al menos uno: el local abre aunque se esperen pocos autos.
function lavadoresPara(autos: number, autosPorLavador: number) {
  return Math.max(1, Math.ceil(autos / autosPorLavador));
}

function armarPlan(
  predicciones: DiaPredicho[],
  autosPorLavador: number,
  activos: number,
): Plan {
  const base = predicciones.map((d) => ({
    fecha: d.fecha_objetivo!,
    // Autos enteros: nadie convoca para 9,5 autos.
    autos: Math.round(d.vehiculos_estimados ?? 0),
    minimo:
      d.intervalo_inferior === null ? null : Math.round(d.intervalo_inferior),
    maximo:
      d.intervalo_superior === null ? null : Math.round(d.intervalo_superior),
  }));
  const totalAutos = base.reduce((suma, d) => suma + d.autos, 0);
  const promedio = base.length > 0 ? totalAutos / base.length : 0;

  const dias = base.map((d) => ({
    ...d,
    lavadores: lavadoresPara(d.autos, autosPorLavador),
    lavadoresAlMaximo: lavadoresPara(d.maximo ?? d.autos, autosPorLavador),
    tipo: (d.autos >= promedio * CARGADO
      ? "cargado"
      : d.autos <= promedio * FLOJO
        ? "flojo"
        : "normal") as TipoDeDia,
  }));
  const masCargado = dias.reduce<DiaDelPlan | null>(
    (mayor, d) => (mayor === null || d.autos > mayor.autos ? d : mayor),
    null,
  );
  return { dias, autosPorLavador, activos, totalAutos, masCargado };
}

const ETIQUETA: Record<
  TipoDeDia,
  { texto: string; consejo: string; clase: string }
> = {
  cargado: {
    texto: "Día cargado",
    consejo: "Convoca a todos y ten insumos de sobra.",
    clase: "bg-acento text-white",
  },
  normal: { texto: "Normal", consejo: "", clase: "border border-zinc-500/30" },
  flojo: {
    texto: "Día flojo",
    consejo: "Buen día para una promoción.",
    clase: "bg-celeste/20 text-acento-oscuro",
  },
};

function nombreCorto(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
}

function PlanDeLaSemana({ plan }: { plan: Plan }) {
  if (plan.dias.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <TituloSeccion
          icono={CalendarDays}
          titulo="Plan de la semana"
          nivel={3}
        />
        <Pendiente />
      </div>
    );
  }
  // Solo para el largo de las barras: una proporción.
  const maxBarra = Math.max(...plan.dias.map((d) => d.maximo ?? d.autos), 1);
  const faltan = plan.dias.filter((d) => d.lavadores > plan.activos);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <TituloSeccion
          icono={CalendarDays}
          titulo="Plan de la semana"
          nivel={3}
        />
        <p className="mt-1 text-sm text-zinc-500">
          Se esperan unos <strong>{plan.totalAutos} autos</strong> en los
          próximos {plan.dias.length} días.
          {plan.masCargado && (
            <>
              {" "}
              El más cargado es el{" "}
              <strong>
                {diaDeLaSemana(plan.masCargado.fecha)}{" "}
                {fechaCorta(plan.masCargado.fecha).slice(0, 5)}
              </strong>
              : {plan.masCargado.autos} autos, {plan.masCargado.lavadores}{" "}
              lavadores.
            </>
          )}
        </p>
      </div>

      {faltan.length > 0 && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          Tienes {plan.activos} lavadores activos y{" "}
          {faltan
            .map(
              (d) => `el ${diaDeLaSemana(d.fecha)} harían falta ${d.lavadores}`,
            )
            .join("; ")}
          . Conviene reforzar con alguien de apoyo.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-zinc-500/15">
        {plan.dias.map((d) => {
          const etiqueta = ETIQUETA[d.tipo];
          return (
            <li
              key={d.fecha}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
            >
              <span className="w-20 shrink-0 text-zinc-500">
                {nombreCorto(d.fecha)} {fechaCorta(d.fecha).slice(0, 5)}
              </span>
              <div className="h-5 min-w-24 flex-1 rounded bg-zinc-500/10">
                <div
                  className="h-5 rounded bg-acento"
                  style={{ width: `${(d.autos / maxBarra) * 100}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right">
                <strong>{d.autos} autos</strong>
                {d.minimo !== null && d.maximo !== null && (
                  <span className="text-zinc-500">
                    {" "}
                    ({d.minimo}–{d.maximo})
                  </span>
                )}
              </span>
              <span className="w-32 shrink-0 font-semibold text-acento-oscuro">
                → {d.lavadores} {d.lavadores === 1 ? "lavador" : "lavadores"}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${etiqueta.clase}`}
              >
                {etiqueta.texto}
              </span>
              {etiqueta.consejo && (
                <span className="text-zinc-500">{etiqueta.consejo}</span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-zinc-500">
        Lavadores = autos esperados ÷ {plan.autosPorLavador} autos por lavador,
        redondeado hacia arriba (se cambia en{" "}
        <Link href="/configuracion" className="text-acento underline">
          Tarifas y configuración
        </Link>
        ). Entre paréntesis, el rango probable: si llega al máximo, harían falta
        hasta {Math.max(...plan.dias.map((d) => d.lavadoresAlMaximo))} lavadores
        el día más cargado.
      </p>
    </div>
  );
}

function ListaSegmento({
  nombre,
  clientes,
}: {
  nombre: string;
  clientes: {
    placa: string | null;
    recencia_dias: number | null;
    frecuencia: number | null;
    monetario: number | null;
  }[];
}) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-1 text-sm text-zinc-500">
        <span className="capitalize">{nombre}</span>: por qué cada uno está
        aquí. La placa es dato personal; esta lista es solo para el dueño.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-500/30 text-zinc-500">
          <tr>
            <th className="py-1 pr-4 font-medium">Placa</th>
            <th className="py-1 pr-4 text-right font-medium">Última visita</th>
            <th className="py-1 pr-4 text-right font-medium">Visitas</th>
            <th className="py-1 text-right font-medium">Gastado</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.placa} className="border-b border-zinc-500/15">
              <td className="py-1 pr-4 font-mono">{c.placa}</td>
              <td className="py-1 pr-4 text-right">
                hace {c.recencia_dias} días
              </td>
              <td className="py-1 pr-4 text-right">{c.frecuencia}</td>
              <td className="py-1 text-right">{soles(c.monetario ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Los modelos no se entrenan sin histórico (docs/analitica.md).
function Pendiente() {
  return (
    <p className="rounded-lg border border-dashed border-zinc-500/40 p-3 text-sm text-zinc-500">
      Pendiente. Aparece cuando el proceso de analítica tenga varias semanas de
      lavados para aprender; hasta entonces no hay nada confiable que mostrar.
    </p>
  );
}
