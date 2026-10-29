import type { Metadata } from "next";
import { fechaCorta, hoyEnLima } from "@/lib/fecha";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Enums } from "@/lib/supabase/tipos";
import { BotonesAsistencia } from "./botones";
import { leerReglasAsistencia } from "./reglas";

export const metadata: Metadata = { title: "Asistencia · LavaSmart" };

const ESTADO: Record<
  Enums<"estado_asistencia">,
  { texto: string; clase: string }
> = {
  puntual: { texto: "Puntual", clase: "bg-green-100 text-green-800" },
  tardanza: { texto: "Tardanza", clase: "bg-amber-100 text-amber-800" },
  no_laboro: { texto: "No laboró", clase: "bg-zinc-200 text-zinc-700" },
  falta: { texto: "Falta", clase: "bg-red-100 text-red-800" },
};

// La ven los dos roles: marcar asistencia es tarea del operador.
export default async function PaginaAsistencia() {
  const supabase = await crearClienteServidor();
  const hoy = hoyEnLima();

  const [trabajadores, asistencias, reglas] = await Promise.all([
    supabase
      .from("trabajador")
      .select("id, nombres, apellidos, modalidad")
      .eq("activo", true)
      .order("apellidos"),
    supabase
      .from("asistencia")
      .select(
        "trabajador_id, estado, hora_ingreso, porcentaje_destajo, hora_referencia, tolerancia_minutos",
      )
      .eq("fecha", hoy),
    leerReglasAsistencia(supabase),
  ]);

  const error = trabajadores.error ?? asistencias.error;
  const deHoy = new Map(
    (asistencias.data ?? []).map((a) => [a.trabajador_id, a]),
  );
  const lista = trabajadores.data ?? [];
  const pendientes = lista.filter((t) => !deHoy.has(t.id)).length;

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Asistencia</h1>
        <p className="text-zinc-500">
          Hoy {fechaCorta(hoy)} · Entrada {reglas.horaReferencia} con{" "}
          {reglas.tolerancia} min de tolerancia · Destajo {reglas.pctPuntual} %
          puntual, {reglas.pctTardanza} % con tardanza
        </p>
      </div>

      <p className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
        Primero se marca la entrada, después se le asignan autos. La hora la
        pone el sistema al presionar el botón, y el porcentaje queda fijo para
        todo el día.
      </p>

      {error ? (
        <p className="font-mono text-sm text-red-600">{error.message}</p>
      ) : lista.length === 0 ? (
        <p className="text-zinc-500">
          No hay trabajadores activos. El dueño los registra en Personal.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            {pendientes === 0
              ? "Todos tienen su asistencia marcada."
              : `Faltan marcar: ${pendientes} de ${lista.length}.`}
          </p>
          <ul className="flex flex-col divide-y divide-zinc-500/15">
            {lista.map((t) => {
              const a = deHoy.get(t.id);
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {t.apellidos}, {t.nombres}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {t.modalidad === "fijo" ? "Sueldo fijo" : "Destajo"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {a && (
                      <div className="text-right text-sm">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO[a.estado].clase}`}
                        >
                          {ESTADO[a.estado].texto}
                        </span>
                        {a.hora_ingreso && (
                          <p className="mt-1 text-zinc-500">
                            Llegó {a.hora_ingreso.slice(0, 5)}
                            {a.porcentaje_destajo !== null &&
                              ` · ${a.porcentaje_destajo} %`}
                          </p>
                        )}
                      </div>
                    )}
                    {(!a || a.estado === "falta") && (
                      <BotonesAsistencia
                        trabajadorId={t.id}
                        soloEntrada={a?.estado === "falta"}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
