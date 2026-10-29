import Link from "next/link";
import { soles } from "@/lib/dinero";
import { fechaCorta, hoyEnLima } from "@/lib/fecha";
import { obtenerSesion } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// "Hoy": lo primero que ve quien abre el sistema en la mañana. Responde
// "¿qué hay que hacer ahora?" y lleva a la pantalla donde se hace. La ven
// los dos roles; el dueño tiene además el acceso al tablero, que es "cómo
// va el negocio". Solo lee: cuenta filas y muestra la caja que suma la base.
export default async function Inicio() {
  // Misma llamada que hace el layout: cache() la resuelve sin repetirla.
  const { rol } = await obtenerSesion();
  const hoy = hoyEnLima();

  const supabase = await crearClienteServidor();
  // count con head: true cuenta en la base sin traer las filas.
  const contar = { count: "exact" as const, head: true };
  const [activos, marcados, enPiso, incidencias, caja, demanda] =
    await Promise.all([
      supabase.from("trabajador").select("id", contar).eq("activo", true),
      supabase.from("asistencia").select("id", contar).eq("fecha", hoy),
      supabase.from("lavado").select("id", contar).eq("estado", "en_proceso"),
      supabase
        .from("incidencia")
        .select("id", contar)
        .neq("estado", "resuelta"),
      supabase
        .from("v_caja_dia")
        .select("cobrado_total, autos_entregados")
        .eq("fecha", hoy)
        .maybeSingle(),
      // Lo que el modelo espera para hoy, si ya hay modelo (sql/15). No tiene
      // datos de personas: la ven los dos roles.
      supabase
        .from("v_demanda_vigente")
        .select("vehiculos_estimados, intervalo_inferior, intervalo_superior")
        .eq("fecha_objetivo", hoy)
        .maybeSingle(),
    ]);

  const error =
    activos.error ??
    marcados.error ??
    enPiso.error ??
    incidencias.error ??
    caja.error ??
    demanda.error;
  if (error) {
    return <p className="font-mono text-sm text-red-600">{error.message}</p>;
  }

  const totalActivos = activos.count ?? 0;
  const pendientes = Math.max(totalActivos - (marcados.count ?? 0), 0);

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">Hoy</h1>
        <p className="text-zinc-500">{fechaCorta(hoy)}</p>
        {/* Sin modelo entrenado no se dice nada: mejor nada que un número
            inventado. */}
        {demanda.data?.vehiculos_estimados != null && (
          <p className="mt-1">
            Hoy se esperan unos{" "}
            <strong>
              {Math.round(demanda.data.vehiculos_estimados)} autos
            </strong>
            {demanda.data.intervalo_inferior != null &&
              demanda.data.intervalo_superior != null &&
              ` (entre ${Math.round(demanda.data.intervalo_inferior)} y ${Math.round(demanda.data.intervalo_superior)})`}
            .
          </p>
        )}
      </div>

      <Link
        href="/lavados"
        className="self-start rounded-lg bg-sky-700 px-6 py-4 text-lg font-semibold text-white hover:bg-sky-800"
      >
        Ingresar un auto
      </Link>

      <section className="grid gap-3 sm:grid-cols-2">
        <Tarjeta
          href="/asistencia"
          titulo="Asistencia"
          valor={
            totalActivos === 0
              ? "Sin personal registrado"
              : pendientes === 0
                ? "Todos marcados"
                : `Faltan marcar ${pendientes} de ${totalActivos}`
          }
          // Sin asistencia no se le asignan autos: es lo primero del día.
          aviso={pendientes > 0}
        />
        <Tarjeta
          href="/lavados"
          titulo="En piso"
          valor={`${enPiso.count ?? 0} auto(s) en proceso`}
        />
        <Tarjeta
          href="/lavados"
          titulo="Entregados hoy"
          valor={`${caja.data?.autos_entregados ?? 0} · ${soles(caja.data?.cobrado_total ?? 0)}`}
        />
        <Tarjeta
          href="/incidencias"
          titulo="Incidencias"
          valor={
            (incidencias.count ?? 0) === 0
              ? "Ninguna sin resolver"
              : `${incidencias.count} sin resolver`
          }
          aviso={(incidencias.count ?? 0) > 0}
        />
      </section>

      {rol === "dueno" && (
        <Link
          href="/tablero"
          className="self-start text-sm text-sky-700 underline hover:text-sky-800"
        >
          Ver cómo va el negocio en el tablero →
        </Link>
      )}
    </>
  );
}

function Tarjeta({
  href,
  titulo,
  valor,
  aviso = false,
}: {
  href: string;
  titulo: string;
  valor: string;
  aviso?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-4 hover:bg-zinc-500/5 ${
        aviso ? "border-amber-400" : "border-zinc-500/20"
      }`}
    >
      <p className="text-sm text-zinc-500">{titulo}</p>
      <p className="text-xl font-semibold">{valor}</p>
    </Link>
  );
}
