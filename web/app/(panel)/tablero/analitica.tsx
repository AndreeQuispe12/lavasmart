import Link from "next/link";
import { soles } from "@/lib/dinero";
import { fechaCorta, fechaHoraDeLima, sumarDias } from "@/lib/fecha";
import { crearClienteServidor } from "@/lib/supabase/servidor";

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
  const [demanda, segmentos, metricas] = await Promise.all([
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
  ]);

  const error = demanda.error ?? segmentos.error ?? metricas.error;
  if (error) {
    return <p className="font-mono text-sm text-red-600">{error.message}</p>;
  }

  const dias = demanda.data ?? [];
  const clientes = segmentos.data ?? [];
  // Solo para el largo de las barras: una proporción.
  const maxEstimado = Math.max(
    ...dias.map((d) => d.intervalo_superior ?? d.vehiculos_estimados ?? 0),
    1,
  );

  // Cuántos clientes hay en cada segmento: contar filas, no sumar dinero.
  const porSegmento = new Map<string, number>();
  for (const c of clientes) {
    porSegmento.set(c.segmento!, (porSegmento.get(c.segmento!) ?? 0) + 1);
  }

  // De cada modelo, las métricas de su último entrenamiento.
  const ultimo = new Map<string, NonNullable<typeof metricas.data>>();
  for (const m of metricas.data ?? []) {
    const filas = ultimo.get(m.modelo) ?? [];
    if (filas.length === 0 || filas[0].version === m.version) {
      ultimo.set(m.modelo, [...filas, m]);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-500/20 p-4">
      <h2 className="text-lg font-semibold">
        Predicción de demanda y segmentación de clientes
      </h2>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Demanda de los próximos 7 días</h3>
        {dias.length === 0 ? (
          <Pendiente />
        ) : (
          <ul className="flex flex-col gap-2">
            {dias.map((d) => {
              const [anio, mes, dia] = d.fecha_objetivo!.split("-").map(Number);
              const nombre =
                DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
              return (
                <li
                  key={d.fecha_objetivo}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-20 shrink-0 text-zinc-500">
                    {nombre} {fechaCorta(d.fecha_objetivo!).slice(0, 5)}
                  </span>
                  <div className="h-5 flex-1 rounded bg-zinc-500/10">
                    <div
                      className="h-5 rounded bg-violet-600"
                      style={{
                        width: `${((d.vehiculos_estimados ?? 0) / maxEstimado) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right">
                    {Math.round(d.vehiculos_estimados ?? 0)} autos
                    {d.intervalo_inferior !== null &&
                      d.intervalo_superior !== null && (
                        <span className="text-zinc-500">
                          {" "}
                          ({Math.round(d.intervalo_inferior)}–
                          {Math.round(d.intervalo_superior)})
                        </span>
                      )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Clientes por segmento</h3>
        {clientes.length === 0 ? (
          <Pendiente />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {[...porSegmento].map(([nombre, n]) => (
                // GET: elegir un segmento solo cambia la URL.
                <Link
                  key={nombre}
                  href={`/tablero?segmento=${encodeURIComponent(nombre)}`}
                  className={`rounded-lg border px-3 py-2 text-sm hover:bg-zinc-500/5 ${
                    segmento === nombre
                      ? "border-violet-500"
                      : "border-zinc-500/20"
                  }`}
                >
                  <span className="capitalize">{nombre}</span>{" "}
                  <strong>{n}</strong>
                </Link>
              ))}
            </div>
            {segmento && (
              <ListaSegmento
                nombre={segmento}
                clientes={clientes.filter((c) => c.segmento === segmento)}
              />
            )}
          </>
        )}
      </div>

      {ultimo.size > 0 && (
        <p className="text-xs text-zinc-500">
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
