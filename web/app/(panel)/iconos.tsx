import {
  CalendarCheck,
  Car,
  ChartColumn,
  House,
  Settings,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Icono } from "@/lib/navegacion";

// El nombre de cada icono (lib/navegacion.ts) y su dibujo.
export const ICONOS: Record<Icono, LucideIcon> = {
  inicio: House,
  asistencia: CalendarCheck,
  lavados: Car,
  incidencias: TriangleAlert,
  liquidacion: Wallet,
  personal: Users,
  configuracion: Settings,
  tablero: ChartColumn,
};
