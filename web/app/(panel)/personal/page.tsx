import type { Metadata } from "next";
import Link from "next/link";
import { fechaCorta, hoyEnLima } from "@/lib/fecha";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cambiarActivo } from "./acciones";
import { FormularioTrabajador } from "./formulario";

export const metadata: Metadata = { title: "Personal · LavaSmart" };

// ?editar=<id> abre el formulario con los datos de ese trabajador; tras
// guardar, la acción vuelve con ?editado=1.
export default async function PaginaPersonal({
  searchParams,
}: PageProps<"/personal">) {
  await exigirDueno();
  const parametros = await searchParams;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("trabajador")
    .select(
      "id, nombres, apellidos, documento, modalidad, frecuencia, sueldo_dia, fecha_ingreso, activo",
    )
    // Activos primero; los dados de baja quedan al final, no desaparecen.
    .order("activo", { ascending: false })
    .order("apellidos");
  // El tipo de cada fila lo deduce el cliente a partir del select y de los
  // tipos generados: no hace falta escribirlo.
  const trabajadores = data ?? [];
  const enEdicion = trabajadores.find(
    (t) => String(t.id) === parametros.editar,
  );

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Personal</h1>
        <p className="text-zinc-500">
          Los lavadores no usan el sistema: aquí se registran para marcar su
          asistencia y asignarles autos.
        </p>
      </div>

      {parametros.editado === "1" && !enEdicion && (
        <p role="status" className="text-sm text-green-600">
          Cambios guardados.
        </p>
      )}

      {/* key: al pasar de un trabajador a otro, el formulario arranca de
          cero con los datos del nuevo. */}
      {enEdicion ? (
        <FormularioTrabajador
          key={enEdicion.id}
          hoy={hoyEnLima()}
          editar={{
            id: enEdicion.id,
            valores: {
              nombres: enEdicion.nombres,
              apellidos: enEdicion.apellidos,
              documento: enEdicion.documento,
              modalidad: enEdicion.modalidad,
              frecuencia: enEdicion.frecuencia,
              sueldo: enEdicion.sueldo_dia?.toFixed(2) ?? "",
              fechaIngreso: enEdicion.fecha_ingreso,
            },
          }}
        />
      ) : (
        <FormularioTrabajador hoy={hoyEnLima()} />
      )}

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
                  <td className="flex justify-end gap-2 py-2">
                    <Link
                      href={`/personal?editar=${t.id}`}
                      className="rounded-lg border border-zinc-500/30 px-3 py-1 hover:bg-zinc-500/10"
                    >
                      Editar
                    </Link>
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
