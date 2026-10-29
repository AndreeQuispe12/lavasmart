import type { Metadata } from "next";
import { fechaCorta, hoyEnLima } from "@/lib/fecha";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cambiarActivo } from "./acciones";
import { FormularioTrabajador } from "./formulario";

export const metadata: Metadata = { title: "Personal · LavaSmart" };

type Trabajador = {
  id: number;
  nombres: string;
  apellidos: string;
  documento: string;
  modalidad: "destajo" | "fijo";
  frecuencia: "diario" | "semanal";
  sueldo_dia: number | null;
  fecha_ingreso: string;
  activo: boolean;
};

export default async function PaginaPersonal() {
  await exigirDueno();

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("trabajador")
    .select(
      "id, nombres, apellidos, documento, modalidad, frecuencia, sueldo_dia, fecha_ingreso, activo",
    )
    // Activos primero; los dados de baja quedan al final, no desaparecen.
    .order("activo", { ascending: false })
    .order("apellidos");
  const trabajadores = (data ?? []) as Trabajador[];

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Personal</h1>
        <p className="text-zinc-500">
          Los lavadores no usan el sistema: aquí se registran para marcar su
          asistencia y asignarles autos.
        </p>
      </div>

      <FormularioTrabajador hoy={hoyEnLima()} />

      {error ? (
        <p className="font-mono text-sm text-red-600">{error.message}</p>
      ) : trabajadores.length === 0 ? (
        <p className="text-zinc-500">Todavía no hay trabajadores.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-500/30 text-zinc-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Documento</th>
                <th className="py-2 pr-4 font-medium">Modalidad</th>
                <th className="py-2 pr-4 font-medium">Cobra</th>
                <th className="py-2 pr-4 font-medium">Ingreso</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {trabajadores.map((t) => (
                <tr
                  key={t.id}
                  className={`border-b border-zinc-500/15 ${t.activo ? "" : "text-zinc-500"}`}
                >
                  <td className="py-2 pr-4">
                    {t.apellidos}, {t.nombres}
                  </td>
                  <td className="py-2 pr-4">{t.documento}</td>
                  <td className="py-2 pr-4">
                    {t.modalidad === "fijo"
                      ? `Fijo · S/ ${Number(t.sueldo_dia).toFixed(2)} al día`
                      : "Destajo"}
                  </td>
                  <td className="py-2 pr-4">
                    {t.frecuencia === "diario" ? "Diario" : "Semanal"}
                  </td>
                  <td className="py-2 pr-4">{fechaCorta(t.fecha_ingreso)}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.activo
                          ? "bg-green-100 text-green-800"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {t.activo ? "Activo" : "De baja"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {/* bind fija el id y el nuevo estado: el botón no
                        necesita campos ocultos. */}
                    <form action={cambiarActivo.bind(null, t.id, !t.activo)}>
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-500/30 px-3 py-1 hover:bg-zinc-500/10"
                      >
                        {t.activo ? "Dar de baja" : "Reactivar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
