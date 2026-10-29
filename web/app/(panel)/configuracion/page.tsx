import type { Metadata } from "next";
import { exigirDueno } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioReglas, FormularioTarifas } from "./formularios";

export const metadata: Metadata = {
  title: "Tarifas y configuración · LavaSmart",
};

// Solo el dueño (RLS cat_escritura_dueno, cfg_escritura_dueno; aquí la
// guardia para no mostrarle la pantalla a un operador).
export default async function PaginaConfiguracion() {
  await exigirDueno();

  const supabase = await crearClienteServidor();
  const [tipos, servicios, tarifas, configuracion] = await Promise.all([
    supabase
      .from("tipo_vehiculo")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("tipo_lavado")
      .select("id, nombre")
      .eq("activo", true)
      .order("id"),
    supabase.from("tarifa").select("tipo_vehiculo_id, tipo_lavado_id, precio"),
    supabase.from("configuracion").select("clave, valor"),
  ]);

  const error =
    tipos.error ?? servicios.error ?? tarifas.error ?? configuracion.error;
  const reglas = Object.fromEntries(
    (configuracion.data ?? []).map((c) => [c.clave, c.valor]),
  );

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Tarifas y configuración</h1>
        <p className="text-zinc-500">
          Lo que cambies aquí vale desde ahora. Lo ya registrado no cambia: cada
          lavado guardó el precio de su día, y cada asistencia, la regla de su
          día.
        </p>
      </div>

      {error ? (
        <p className="font-mono text-sm text-red-600">{error.message}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-lg border border-zinc-500/20 p-4">
            <h2 className="text-lg font-semibold">Tarifario</h2>
            <p className="text-sm text-zinc-500">
              El precio sale del cruce entre el tipo de vehículo y el servicio.
            </p>
            <FormularioTarifas
              tipos={tipos.data ?? []}
              servicios={servicios.data ?? []}
              tarifas={tarifas.data ?? []}
            />
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-zinc-500/20 p-4">
            <h2 className="text-lg font-semibold">Asistencia y destajo</h2>
            <p className="text-sm text-zinc-500">
              Puntual es quien marca hasta la hora de entrada más la tolerancia.
              Su porcentaje queda fijo para todo el día.
            </p>
            <FormularioReglas reglas={reglas} />
            <p className="text-sm text-zinc-500">
              Moneda: {reglas.moneda} · Zona horaria: {reglas.zona_horaria}. No
              se cambian desde aquí.
            </p>
          </section>
        </>
      )}
    </>
  );
}
