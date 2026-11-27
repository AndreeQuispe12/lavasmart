import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { soles } from "@/lib/dinero";
import { TituloSeccion } from "./piezas";

// La segmentación convertida en decisiones: cuánto vale cada grupo y qué
// hacer con él, y a quién llamar esta semana. Las sumas de dinero y los
// porcentajes los calcula la base (sql/19); aquí solo se muestran.

export type ResumenSegmento = {
  segmento: string;
  clientes: number;
  pct_clientes: number;
  ingreso: number;
  pct_ingreso: number;
  recencia_prom: number;
  visitas_prom: number;
  gasto_prom: number;
  recuperar_decimo: number;
};

export type ClienteAlejandose = {
  placa: string;
  nombre: string | null;
  telefono: string | null;
  visitas: number;
  cada_dias: number;
  dias_sin_venir: number;
  gastado: number;
};

// Qué significa cada segmento y qué puede hacer el dueño. Los nombres son
// los que pone ml/segmentacion.py.
const GUIA: Record<string, { significa: string; accion: string }> = {
  Frecuentes: {
    significa: "Tu base: vienen seguido y dejan la mayor parte del ingreso.",
    accion:
      "Cuídalos: trato preferente o una tarjeta de fidelidad. Perder uno cuesta caro.",
  },
  Ocasionales: {
    significa: "Vienen de vez en cuando.",
    accion: "Recuérdales volver a las 2 o 3 semanas de su último lavado.",
  },
  Nuevos: {
    significa: "Vinieron una vez, hace poco.",
    accion: "Que vuelvan una segunda vez: un descuento en la próxima visita.",
  },
  Inactivos: {
    significa: "Hace más de dos meses que no vienen.",
    accion: "Una oferta para que vuelvan.",
  },
};

export function TarjetasSegmento({
  resumen,
  elegido,
}: {
  resumen: ResumenSegmento[];
  elegido: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resumen.map((s) => {
        const guia = GUIA[s.segmento] ?? {
          significa: "Grupo encontrado por el modelo.",
          accion: "Revisa la lista para decidir qué hacer.",
        };
        const activo = elegido === s.segmento;
        return (
          <article
            key={s.segmento}
            className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${
              activo ? "border-acento" : "border-zinc-500/20"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-base font-semibold">{s.segmento}</h4>
              <span className="text-zinc-500">
                {s.clientes} clientes · {Math.round(s.pct_clientes)} %
              </span>
            </div>
            <p>
              Dejan el{" "}
              <strong className="text-acento-oscuro">
                {Math.round(s.pct_ingreso)} % del ingreso
              </strong>{" "}
              ({soles(s.ingreso)})
            </p>
            <p className="text-zinc-500">
              {guia.significa} Última visita hace unos {s.recencia_prom} días,{" "}
              {s.visitas_prom} visitas y {soles(s.gasto_prom)} en promedio.
            </p>
            <p className="font-medium">
              → {guia.accion}
              {s.segmento === "Inactivos" && (
                <>
                  {" "}
                  Si vuelve 1 de cada 10: unos{" "}
                  <strong>{soles(s.recuperar_decimo)}</strong>.
                </>
              )}
            </p>
            {/* GET: elegir un segmento solo cambia la URL. */}
            <Link
              href={
                activo
                  ? "/tablero"
                  : `/tablero?segmento=${encodeURIComponent(s.segmento)}`
              }
              className="self-start text-acento underline"
            >
              {activo ? "Ocultar la lista" : "Ver la lista"}
            </Link>
          </article>
        );
      })}
    </div>
  );
}

// "987654321" -> "987 654 321", para leerlo al marcar.
function celular(telefono: string) {
  return telefono.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
}

export function ParaLlamar({ clientes }: { clientes: ClienteAlejandose[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <TituloSeccion
          icono={PhoneCall}
          titulo="A quién llamar esta semana"
          nivel={3}
        />
        <p className="mt-1 text-sm text-zinc-500">
          Clientes con costumbre que dejaron de venir: ya pasó más del doble de
          lo que solían tardar en volver. Todavía se pueden recuperar. Ordenados
          por lo que han pagado.
        </p>
      </div>
      {clientes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-500/40 p-3 text-sm text-zinc-500">
          Nadie se está alejando: los clientes con costumbre han vuelto a
          tiempo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-500/30 text-zinc-500">
              <tr>
                <th className="py-1 pr-4 font-medium">Placa</th>
                <th className="py-1 pr-4 font-medium">Cliente</th>
                <th className="py-1 pr-4 font-medium">Celular</th>
                <th className="py-1 pr-4 text-right font-medium">Venía cada</th>
                <th className="py-1 pr-4 text-right font-medium">Sin venir</th>
                <th className="py-1 text-right font-medium">Pagó en total</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.placa} className="border-b border-zinc-500/15">
                  <td className="py-1 pr-4 font-mono">{c.placa}</td>
                  <td className="py-1 pr-4">{c.nombre ?? "—"}</td>
                  <td className="py-1 pr-4 whitespace-nowrap">
                    {c.telefono ? celular(c.telefono) : "—"}
                  </td>
                  <td className="py-1 pr-4 text-right">{c.cada_dias} días</td>
                  <td className="py-1 pr-4 text-right font-semibold text-acento-oscuro">
                    {c.dias_sin_venir} días
                  </td>
                  <td className="py-1 text-right">{soles(c.gastado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-zinc-500">
            Nombre y celular son datos personales: esta lista es solo para el
            dueño. Para enviar promociones hace falta que el cliente lo haya
            aceptado (Ley 29733).
          </p>
        </div>
      )}
    </div>
  );
}
