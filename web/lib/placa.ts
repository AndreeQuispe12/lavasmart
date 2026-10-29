// La misma limpieza que hace fn_normalizar_placa en la base: mayúsculas,
// sin nada que no sea letra o número, y el guion en su sitio. Sirve para
// BUSCAR una placa; al guardar, la base la normaliza por su cuenta.
// "abc 123", "ABC123" y "abc-123" -> "ABC-123".
export function normalizarPlaca(placa: string): string {
  const limpia = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return limpia.length === 6
    ? `${limpia.slice(0, 3)}-${limpia.slice(3)}`
    : limpia;
}
