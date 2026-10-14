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
 * Desde qué ancho DE LA LISTA se pinta la tabla; por debajo, filas. Es un
 * container query sobre la propia lista (`@container`), no un breakpoint de la
 * pantalla.
 *
 * 🪤 Con `md:` (768px de pantalla) la tabla salía con el menú lateral abierto en
 * 545px de lista: seis columnas apretadas y cada fila partida en cinco líneas. Lo
 * que manda es el sitio que le queda a la lista (menú abierto o plegado, una
 * columna de dos…), no el ancho de la ventana.
 *
 *   · `sm`: 32rem (512px) · `md`: 42rem (672px) · `lg`: 56rem (896px)
 */
export const TABLE_FROM = {
  sm: { table: "hidden @lg:block", rows: "@lg:hidden" },
  md: { table: "hidden @2xl:block", rows: "@2xl:hidden" },
  lg: { table: "hidden @4xl:block", rows: "@4xl:hidden" },
} as const;

export type TableFrom = keyof typeof TABLE_FROM;

/**
 * Sin `tableFrom`, el umbral sale de cuántas columnas tiene la tabla: hasta 3,
 * `sm`; 4 o 5, `md`; 6 o más, `lg`. Unos 110–130px por columna antes de pasar a
 * tabla: por debajo, los textos se parten en tres o más líneas.
 */
export function defaultTableFrom(columnCount: number): TableFrom {
  if (columnCount <= 3) return "sm";
  if (columnCount <= 5) return "md";
  return "lg";
}

/**
 * La línea de acciones de las FILAS: la línea entera (`line`) y cada celda
 * `actions` dentro de ella (`cell`).
 *
 *   · `start` (el defecto): cada control a su ancho, a la izquierda.
 *   · `fill`: la línea ocupa la fila entera y cada celda se lleva una parte
 *     igual, con lo que pinta estirado a ella. Dos celdas, dos mitades. Una celda
 *     con varios botones (un componente) ocupa su parte y los reparte ella.
 *
 * `grow basis-24`: partes iguales mientras quepan a 6rem cada una; si no, la
 * última baja a su línea y la llena, en vez de aplastar los textos. Las filas
 * también salen en una lista ancha (por debajo de su `tableFrom`): ahí la línea no
 * pasa de 24rem, para que dos botones no midan 350px cada uno.
 */
export const MOBILE_ACTIONS = {
  start: { line: "flex flex-wrap gap-2", cell: undefined },
  fill: { line: "flex flex-wrap gap-2 @lg:max-w-sm", cell: "min-w-0 grow basis-24 *:w-full" },
} as const;

/**
 * La línea de metadatos de las FILAS (`meta · meta · meta`): la línea (`line`),
 * el punto que separa dos celdas (`separator`) y lo que pinta cada celda
 * (`content`).
 *
 * El punto no va dentro de la celda sino en el hueco entre dos (`gap-x-4` y un
 * margen negativo del mismo ancho), y la línea recorta lo que sale por su borde
 * izquierdo (`overflow-x-clip`). Así, cuando la línea se parte, la celda que abre
 * el renglón nuevo deja su punto fuera, recortado.
 *
 * 🪤 Con el punto dentro de la celda, un renglón partido empezaba por "·"
 * ("· Archived Oct 11, 2026"), en la papelera de FMBGT a 375px.
 *
 * Sin `position` en nada de esto: las filas con `rowHref` estiran su enlace por
 * encima (`after:absolute after:inset-0`), y un `relative` aquí taparía el enlace
 * justo donde está el texto.
 */
export const META_LINE = {
  line: "flex flex-wrap gap-x-4 overflow-x-clip",
  separator: "-ml-4 w-4 shrink-0 text-center",
  content: "inline-flex items-center gap-1.5",
} as const;
