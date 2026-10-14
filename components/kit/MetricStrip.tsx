import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * La fila de métricas de arriba de una página: la tira de `/portal/impact`.
 *
 * Icono + etiqueta en micro-mayúsculas, cifra grande, sub-línea apagada. **Sin
 * cajas**: las métricas se apoyan en el lienzo y las separan filetes verticales.
 *
 * Todas las cifras van del mismo color. Que cada una lo elija según su estado
 * convierte la fila en un semáforo y el ojo va al color en vez de a la cifra. El
 * color es del DELTA, nunca del valor (§8.1).
 *
 * FILA (con filetes verticales) cuando la tira mide 42rem (672px) o más; por
 * debajo, REJILLA de dos. Lo decide el ancho de la TIRA (`@container`), no el de
 * la pantalla. 🪤 Con `md:` (768px de pantalla), con el menú lateral abierto la
 * fila salía en 545px: cinco tiles de 109px con las etiquetas cortadas.
 */

/** En la rejilla el contenido va centrado en su celda. */
const CENTERED_TILE = {
  root: "@max-2xl:text-center",
  label: "@max-2xl:justify-center",
} as const;

/**
 * La cruz de la rejilla: los filetes que en la fila dibuja `divide-x`, pero en
 * dos columnas.
 *
 * 🪤 `divide-*` no sirve aquí: pinta en orden del DOM y en una rejilla que
 * envuelve deja una regla suelta al principio de cada fila. Hay que saber en qué
 * celda cae cada tile, y eso se calcula (`cells`).
 */
const CROSS = "@max-2xl:border-hairline";

function cells(metrics: Metric[], wideKey: string | undefined) {
  const map = new Map<string, { col: number; row: number }>();
  let i = 0;
  for (const m of metrics) {
    if (m.key === wideKey) continue; // va al final y ocupa la fila entera
    map.set(m.key, { col: i % 2, row: Math.floor(i / 2) });
    i += 1;
  }
  if (wideKey) map.set(wideKey, { col: 0, row: Math.ceil(i / 2) });
  return map;
}

/**
 * El tile ancho (recuento impar): baja al final de la rejilla y ocupa la fila
 * entera, con etiqueta y sub a la izquierda y la cifra a la derecha. Todo acotado
 * a `@max-2xl`: la fila no se entera.
 */
const WIDE_TILE_CELL = "@max-2xl:order-last @max-2xl:col-span-2";
const WIDE_TILE_BODY = "@max-2xl:grid @max-2xl:grid-cols-[1fr_auto] @max-2xl:gap-x-4";
const WIDE_TILE = {
  root: `${WIDE_TILE_CELL} ${WIDE_TILE_BODY}`,
  label: "@max-2xl:col-start-1 @max-2xl:row-start-1",
  value: "@max-2xl:col-start-2 @max-2xl:row-start-1 @max-2xl:row-span-2 @max-2xl:mt-0 @max-2xl:self-center @max-2xl:text-right",
  sub: "@max-2xl:col-start-1 @max-2xl:row-start-2",
} as const;

const FOCUS_INSET = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ac-500/60";

/**
 * El filtro aplicado: una línea de acento de 2px DEBAJO del tile, como la pestaña
 * activa de `Tabs`, del ancho del contenido (sin el relleno del tile). La misma con
 * `href` que con `onSelect`: va en la celda, no en el botón.
 *
 * 🪤 Antes era un recuadro (`ring-1`) en el propio tile: con `href` el tile no tiene
 * relleno vertical (`@2xl:py-0`, y el primero tampoco a la izquierda) y el recuadro
 * quedaba pegado a la etiqueta, la cifra y el sub.
 */
const ACTIVE_LINE =
  "after:absolute after:h-0.5 after:bg-ac-500 @max-2xl:after:left-3 @max-2xl:after:right-3 @2xl:after:left-5 @2xl:after:right-5 @2xl:first:after:left-0 @2xl:last:after:right-0";

/**
 * Dónde se apoya la línea. Con `rule`, sobre el filete que cierra la tira: los 20px
 * de `pb-5` más el píxel del filete, como el `-mb-px` de una pestaña. En la rejilla
 * una celda que no está en la última fila se apoya en el filete de la de abajo (su
 * `border-t`). Sin `rule` no hay filete: al pie de la celda en la rejilla y, en la
 * fila, en el borde de abajo de la tira, que reserva esos 12px (`pb-3`) si filtra. 🪤 Fuera de la caja, la línea pisaba lo que viniera debajo.
 */
const ACTIVE_AT = {
  rule: "after:-bottom-[21px]",
  ruleUpperRow: "@max-2xl:after:-bottom-px @2xl:after:-bottom-[21px]",
  noRule: "@max-2xl:after:-bottom-px @2xl:after:-bottom-3",
} as const;

export type Metric = {
  key: string;
  label: string;
  /**
   * Etiqueta corta: la que sale mientras la tira mide menos de 56rem (896px), en
   * la rejilla y en una fila estrecha (cinco tiles en 700px dejan ~100px por
   * etiqueta). Una etiqueta cortada a mitad de palabra no dice nada: la cura de una
   * etiqueta que no cabe es OTRA etiqueta.
   */
  labelShort?: string;
  value: ReactNode;
  /** Comparación o contexto: el periodo anterior, el delta, "de 12". */
  sub?: ReactNode;
  /** Glifo de Lucide ya renderizado, p. ej. `<Clock className="h-3.5 w-3.5" />`. */
  icon?: ReactNode;
  /**
   * Desglose flotante que se abre al pasar por encima o al enfocar. El nodo se
   * posiciona a sí mismo (`absolute`); el tile le pone el `group relative`.
   */
  detail?: ReactNode;
  /** Glifo que anuncia que hay desglose. Se pinta solo si `detail` existe. */
  detailHint?: ReactNode;
  /** El tile es un enlace (filtra navegando). */
  href?: string;
  /** El tile es un botón (filtra sin navegar). Solo desde un componente cliente. */
  onSelect?: () => void;
  /**
   * Es el filtro aplicado ahora. Se marca con una línea de acento debajo, como una
   * pestaña; nunca con el color de la cifra ni con un recuadro.
   */
  active?: boolean;
};

export function MetricStrip({
  metrics,
  heaviest,
  rule = true,
  scale = "figure",
}: {
  metrics: Metric[];
  /**
   * Con recuento IMPAR, la clave de la métrica de más peso: ocupa la fila entera
   * de la rejilla. 🪤 Se resuelve con CSS, sin reordenar el array: la fila mira la
   * posición en el marcado (`@2xl:first:pl-0`).
   */
  heaviest?: string;
  /** Filete de cierre bajo la tira. Apágalo si ya hay una regla debajo. */
  rule?: boolean;
  /**
   * `figure` es la cifra de §8.1. `fact` es para cuatro datos de UN registro
   * (una fecha, un hito) donde el valor es una frase: a 26px se cortaría.
   */
  scale?: "figure" | "fact";
}) {
  const wideKey = metrics.length % 2 === 1 ? heaviest : undefined;
  const cell = cells(metrics, wideKey);
  const lastRow = Math.max(0, ...Array.from(cell.values(), (c) => c.row));
  // Una tira que filtra puede marcar un tile activo: sin filete, le deja sitio a la línea.
  const filters = metrics.some((m) => m.href || m.onSelect);
  return (
    // El contenedor que miden los `@2xl:` / `@max-2xl:` de dentro.
    <div className="@container">
      <div
        className={cx(
          "grid grid-cols-2 @max-2xl:gap-0 @2xl:flex @2xl:gap-0 @2xl:divide-x @2xl:divide-hairline",
          rule ? "border-b border-hairline pb-5" : filters && "pb-3",
        )}
      >
        {metrics.map((m) => {
          const wide = m.key === wideKey;
          const at = cell.get(m.key);
          // Con `onSelect` la celda CONTIENE el botón: lo que coloca las tres líneas
          // va en el botón y en la celda solo lo que la coloca a ella.
          const rootLayout = m.onSelect ? (wide ? WIDE_TILE_CELL : "") : wide ? WIDE_TILE.root : CENTERED_TILE.root;
          const tileClass = cx(
            "group relative min-w-0 @max-2xl:px-3 @max-2xl:py-4 @2xl:flex-1 @2xl:px-5 @2xl:py-0 @2xl:first:pl-0 @2xl:last:pr-0",
            CROSS,
            at && at.col === 0 && !wide && "@max-2xl:border-r",
            at && at.row > 0 && "@max-2xl:border-t",
            rootLayout,
            m.detail ? "cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/50" : null,
            m.active && ACTIVE_LINE,
            m.active && (rule ? (at && at.row < lastRow ? ACTIVE_AT.ruleUpperRow : ACTIVE_AT.rule) : ACTIVE_AT.noRule),
          );
          // Dentro de un <button> solo cabe contenido de frase: con `onSelect` las
          // tres líneas son <span> en bloque, con las mismas clases.
          const Line = m.onSelect ? "span" : "p";
          const body = (
            <>
              <Line
                className={cx(
                  "flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-muted",
                  wide ? WIDE_TILE.label : CENTERED_TILE.label,
                )}
              >
                {m.icon ? <span className="flex-none text-fg-muted">{m.icon}</span> : null}
                {m.labelShort ? (
                  <>
                    <span className="truncate @4xl:hidden">{m.labelShort}</span>
                    <span className="truncate @max-4xl:hidden">{m.label}</span>
                  </>
                ) : (
                  <span className="truncate">{m.label}</span>
                )}
                {m.detail && m.detailHint ? <span className="flex-none opacity-50">{m.detailHint}</span> : null}
              </Line>
              <Line
                className={cx(
                  "mt-1.5 block text-fg",
                  scale === "fact" ? "text-sm font-semibold leading-snug" : "text-[26px] font-bold leading-none",
                  wide && WIDE_TILE.value,
                )}
              >
                {m.value}
              </Line>
              {m.sub ? (
                <Line className={cx("mt-1.5 block text-[10.5px] text-fg-muted", wide && WIDE_TILE.sub)}>{m.sub}</Line>
              ) : null}
              {m.detail}
            </>
          );
          if (m.onSelect) {
            return (
              <div key={m.key} className={tileClass}>
                <button
                  type="button"
                  onClick={m.onSelect}
                  aria-pressed={m.active ?? false}
                  className={cx(
                    // El realce sangra 8px hacia fuera: la cifra queda alineada con la
                    // de un tile que no se pulsa.
                    "-mx-2 -my-1.5 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-muted",
                    FOCUS_INSET,
                    wide ? WIDE_TILE_BODY : CENTERED_TILE.root,
                  )}
                >
                  {body}
                </button>
              </div>
            );
          }
          return m.href ? (
            <Link
              key={m.key}
              href={m.href}
              aria-current={m.active ? "true" : undefined}
              className={cx(tileClass, "rounded-lg transition-colors duration-150", FOCUS_INSET)}
            >
              {body}
            </Link>
          ) : (
            <div key={m.key} tabIndex={m.detail ? 0 : undefined} className={tileClass}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
