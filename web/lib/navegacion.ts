import type { Rol } from "@/lib/sesion";

export type Seccion = {
  ruta: string;
  etiqueta: string;
  // Solo el dueño la ve. Lo demás lo ven los dos roles: los permisos del
  // dueño son un superconjunto de los del operador.
  soloDueno: boolean;
  // false mientras la pantalla no exista: sale en el menú, pero sin enlace.
  disponible: boolean;
};

// El orden sigue el día del lavadero: primero se marca asistencia, después
// se reciben autos, y al cierre se liquida.
const SECCIONES: Seccion[] = [
  { ruta: "/", etiqueta: "Inicio", soloDueno: false, disponible: true },
  {
    ruta: "/asistencia",
    etiqueta: "Asistencia",
    soloDueno: false,
    disponible: true,
  },
  {
    ruta: "/lavados",
    etiqueta: "Lavados",
    soloDueno: false,
    disponible: false,
  },
  {
    ruta: "/incidencias",
    etiqueta: "Incidencias",
    soloDueno: false,
    disponible: false,
  },
  {
    ruta: "/liquidacion",
    etiqueta: "Liquidación",
    soloDueno: true,
    disponible: false,
  },
  {
    ruta: "/personal",
    etiqueta: "Personal",
    soloDueno: true,
    disponible: true,
  },
  {
    ruta: "/configuracion",
    etiqueta: "Tarifas y configuración",
    soloDueno: true,
    disponible: false,
  },
  { ruta: "/tablero", etiqueta: "Tablero", soloDueno: true, disponible: false },
];

export function seccionesPara(rol: Rol): Seccion[] {
  return SECCIONES.filter((s) => rol === "dueno" || !s.soloDueno);
}
