import { cerrarSesion } from "@/app/login/acciones";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Página provisional: muestra quién inició sesión, su rol y el catálogo de
// vehículos. Sirve para comprobar que RLS reconoce al usuario. La reemplaza
// el panel del día cuando existan las pantallas de operación.
export default async function Inicio() {
  const supabase = await crearClienteServidor();

  // El proxy ya garantizó que hay sesión; aquí solo se leen sus datos.
  const { data: sesion } = await supabase.auth.getClaims();
  const correo = sesion?.claims.email ?? "";

  // RLS (prf_lectura_propia) solo deja ver la fila propia, así que no hace
  // falta filtrar por id. maybeSingle: null si el usuario no tiene perfil.
  const { data: perfil } = await supabase
    .from("perfil")
    .select("rol")
    .maybeSingle();

  const { data: vehiculos, error } = await supabase
    .from("tipo_vehiculo")
    .select("nombre")
    .eq("activo", true)
    .order("nombre");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">LavaSmart</h1>
          <p className="mt-1 text-zinc-500">{correo}</p>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      {perfil ? (
        <section className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900">
          <p className="font-medium">
            Rol: {perfil.rol === "dueno" ? "Dueño" : "Operador"}
          </p>
        </section>
      ) : (
        // Es el error más común con este modelo: el usuario existe en
        // Supabase Auth pero no en el negocio, y RLS le oculta todo.
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">Tu usuario todavía no tiene perfil.</p>
          <p className="mt-1 text-sm">
            Iniciaste sesión, pero el dueño aún no te asignó un rol. Hasta
            entonces no vas a ver ningún dato.
          </p>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Tipos de vehículo</h2>
        {error ? (
          <p className="mt-2 font-mono text-sm text-red-700">{error.message}</p>
        ) : vehiculos.length === 0 ? (
          <p className="mt-2 text-zinc-500">Ninguno visible.</p>
        ) : (
          <ul className="mt-2 list-inside list-disc">
            {vehiculos.map((v) => (
              <li key={v.nombre}>{v.nombre}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
