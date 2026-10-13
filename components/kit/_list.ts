// Lógica pura de ResponsiveList, aparte para poder probarla con Node (sin JSX).
// Interno: no sale por el barrel.
//
// 🪤 Sin imports relativos: los tests lo cargan con Node tal cual (`.ts`).

/**
 * ¿La celda está vacía? `null`, `undefined`, `false` y `""` sí; `0` no: un cero
 * es un dato ("0 usos"), no la ausencia de uno.
 */
export function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || value === false || value === "";
}
