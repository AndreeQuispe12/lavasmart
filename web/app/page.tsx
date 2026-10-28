import { crearClienteServidor } from "@/lib/supabase/servidor";

// Página provisional: solo comprueba que la app llega a Supabase.
// La reemplaza el login en el siguiente cambio.
export default async function Inicio() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("tipo_vehiculo")
    .select("nombre");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">LavaSmart</h1>

      {error ? (
        <section className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
          <p className="font-medium">No se pudo conectar con Supabase.</p>
          <p className="mt-1 font-mono text-sm">{error.message}</p>
        </section>
      ) : (
        <section className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900">
          <p className="font-medium">Conexión con Supabase correcta.</p>
          <p className="mt-1 text-sm">
            Tipos de vehículo visibles: {data.length}.{" "}
            {data.length === 0 &&
              "Es lo esperado sin sesión iniciada: RLS no deja leer los catálogos a un usuario anónimo."}
          </p>
        </section>
      )}
    </main>
  );
}
