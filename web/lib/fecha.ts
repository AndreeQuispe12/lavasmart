// El día del negocio es el de Lima, no el del servidor (Vercel y Supabase
// corren en UTC). A partir de las 7 p. m. en Lima, en UTC ya es mañana.
const ZONA = "America/Lima";

// Fecha de hoy en Lima como "AAAA-MM-DD", el formato de las columnas date
// y de <input type="date">. en-CA es el idioma que escribe la fecha así.
export function hoyEnLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(
    new Date(),
  );
}

// Hora actual en Lima como "HH:MM", en 24 horas. Sin segundos: el cuaderno
// anota minutos, y así "8:05 o antes" incluye todo el minuto 8:05.
export function horaEnLima(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

// "2026-10-29" más n días (n puede ser negativo) -> "AAAA-MM-DD". Se
// calcula en UTC sobre la fecha sola, sin hora, para no correrse de día.
export function sumarDias(fecha: string, n: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + n)).toISOString().slice(0, 10);
}

// El día "AAAA-MM-DD" de Lima como rango de instantes, para filtrar una
// columna timestamptz: [00:00 de ese día, 00:00 del siguiente). Perú no
// cambia de hora en el año, así que el desfase es siempre -05:00.
export function rangoDelDiaEnLima(fecha: string): [string, string] {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1))
    .toISOString()
    .slice(0, 10);
  return [`${fecha}T00:00:00-05:00`, `${siguiente}T00:00:00-05:00`];
}

// Un timestamptz de la base ("2026-10-29T13:05:00+00:00") -> "08:05" en
// Lima. Para mostrar la hora de ingreso o de entrega de un auto.
export function horaDeLima(instante: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instante));
}

// Un timestamptz de la base -> "29/10 08:05" en Lima. Para listas donde
// las filas pueden ser de días distintos.
export function fechaHoraDeLima(instante: string): string {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instante));
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value;
  return `${p("day")}/${p("month")} ${p("hour")}:${p("minute")}`;
}

// "08:05" o "08:05:00" -> minutos desde la medianoche (485). Para comparar
// horas sin pasar por Date.
export function minutosDelDia(hora: string): number {
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m);
}

// "2026-10-28" -> "28/10/2026", para mostrar. Se arma a mano para no pasar
// por Date, que interpretaría la fecha en UTC y podría restarle un día.
export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}
