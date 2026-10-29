import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Página provisional: el catálogo de vehículos sirve para comprobar que
// RLS reconoce al usuario. La reemplaza el resumen del día cuando existan
// las pantallas de operación.
export default async function Inicio() {
  // Misma llamada que hace el layout: cache() la resuelve sin repetir la
  // consulta.
  const { rol } = await obtenerSesion();

  const supabase = await crearClienteServidor();
  const { data: vehiculos, error } = await supabase
    .from("tipo_vehiculo")
    .select("nombre")
    .eq("activo", true)
    .order("nombre");

  return (
    <>
      <h1 className="text-3xl font-semibold">Inicio</h1>
      <p className="text-zinc-500">
        Ingresaste como {rol === "dueno" ? "dueño" : "operador"}. Las pantallas
        marcadas como «pronto» se van habilitando una por una.
      </p>

      <section>
        <h2 className="text-lg font-semibold">Tipos de vehículo</h2>
        {error ? (
          <p className="mt-2 font-mono text-sm text-red-700">{error.message}</p>
        ) : (
          <ul className="mt-2 list-inside list-disc">
            {vehiculos.map((v) => (
              <li key={v.nombre}>{v.nombre}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
