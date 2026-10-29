// Los montos llegan de la base como números de JavaScript. Mostrarlos es
// seguro; sumarlos directamente no (0.1 + 0.2 = 0.30000000000000004). Los
// totales que valen son los de la base (v_lavado, v_caja_dia).

// 35 -> "S/ 35.00"
export function soles(monto: number): string {
  return `S/ ${monto.toFixed(2)}`;
}

// Suma para MOSTRAR un total estimado antes de guardar, por ejemplo al
// marcar servicios. Se suma en céntimos, que son enteros y no pierden
// precisión. El total que vale después es el que calcula la base.
export function sumarSoles(montos: number[]): number {
  const centimos = montos.reduce((total, m) => total + Math.round(m * 100), 0);
  return centimos / 100;
}
