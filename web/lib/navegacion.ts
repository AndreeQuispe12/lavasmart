import type { Rol } from "@/lib/sesion";

// Nombre del icono de cada sección. Es texto y no el componente: lo que el
// layout (servidor) le pasa al menú (cliente) tiene que poder viajar como
// JSON, y un componente no puede. El menú traduce el nombre en
// app/(panel)/iconos.tsx.
export type Icono =
  | "inicio"
  | "asistencia"
  | "lavados"
  | "incidencias"
  | "liquidacion"
  | "personal"
  | "configuracion"
  | "tablero";

export type Seccion = {
  ruta: string;
  etiqueta: string;
  // La frase bajo el título en el encabezado de cada pantalla.
  descripcion: string;
  icono: Icono;
  // Solo el dueño la ve. Lo demás lo ven los dos roles: los permisos del
  // dueño son un superconjunto de los del operador.
  soloDueno: boolean;
};

// El orden sigue el día del lavadero: primero se marca asistencia, después
// se reciben autos, y al cierre se liquida.
export const SECCIONES: Seccion[] = [
  {
    ruta: "/",
    etiqueta: "Inicio",
    descripcion: "Lo que hay que atender hoy",
    icono: "inicio",
    soloDueno: false,
  },
  {
    ruta: "/asistencia",
    etiqueta: "Asistencia",
    descripcion: "Quién llegó, a qué hora y qué porcentaje le toca",
    icono: "asistencia",
    soloDueno: false,
  },
  {
    ruta: "/lavados",
    etiqueta: "Lavados",
    descripcion: "Recibe el auto al ingresar y cóbralo al entregarlo",
    icono: "lavados",
    soloDueno: false,
  },
  {
    ruta: "/incidencias",
    etiqueta: "Incidencias",
    descripcion: "Reclamos y problemas, siempre ligados a la placa",
    icono: "incidencias",
    soloDueno: false,
  },
  {
    ruta: "/liquidacion",
    etiqueta: "Liquidación",
    descripcion: "Lo que se devenga cada día y lo que ya se pagó",
    icono: "liquidacion",
    soloDueno: true,
  },
  {
    ruta: "/personal",
    etiqueta: "Personal",
    descripcion: "Modalidad de pago y altas del equipo",
    icono: "personal",
    soloDueno: true,
  },
  {
    ruta: "/configuracion",
    etiqueta: "Tarifas y configuración",
    descripcion: "Precios y reglas de puntualidad",
    icono: "configuracion",
    soloDueno: true,
  },
  {
    ruta: "/tablero",
    etiqueta: "Tablero",
    descripcion: "El pulso del negocio de un vistazo",
    icono: "tablero",
    soloDueno: true,
  },
];

export function seccionesPara(rol: Rol): Seccion[] {
  return SECCIONES.filter((s) => rol === "dueno" || !s.soloDueno);
}
