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

/**
 * La línea de acciones del TELÉFONO: la línea entera (`line`) y cada celda
 * `actions` dentro de ella (`cell`).
 *
 *   · `start` (el defecto): cada control a su ancho, a la izquierda.
 *   · `fill`: la línea ocupa la fila entera y cada celda se lleva una parte
 *     igual, con lo que pinta estirado a ella. Dos celdas, dos mitades. Una celda
 *     con varios botones (un componente) ocupa su parte y los reparte ella.
 *
 * `grow basis-24`: partes iguales mientras quepan a 6rem cada una; si no, la
 * última baja a su línea y la llena, en vez de aplastar los textos.
 */
export const MOBILE_ACTIONS = {
  start: { line: "flex flex-wrap gap-2", cell: undefined },
  fill: { line: "flex flex-wrap gap-2", cell: "min-w-0 grow basis-24 *:w-full" },
} as const;
