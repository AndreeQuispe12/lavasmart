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
