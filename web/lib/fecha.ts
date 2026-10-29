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

// "2026-10-28" -> "28/10/2026", para mostrar. Se arma a mano para no pasar
// por Date, que interpretaría la fecha en UTC y podría restarle un día.
export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}
