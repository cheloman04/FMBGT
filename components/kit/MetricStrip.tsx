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
 */

/** En el teléfono el contenido va centrado en su celda de la rejilla de dos. */
const CENTERED_TILE = {
  root: "max-md:text-center",
  label: "max-md:justify-center",
} as const;

/**
 * La cruz del teléfono: los filetes que en escritorio dibuja `divide-x`, pero en
 * la rejilla de dos columnas.
 *
 * 🪤 `divide-*` no sirve aquí: pinta en orden del DOM y en una rejilla que
 * envuelve deja una regla suelta al principio de cada fila. Hay que saber en qué
 * celda cae cada tile, y eso se calcula (`cells`).
 */
const CROSS = "max-md:border-hairline";

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
 * El tile ancho (recuento impar): baja al final del teléfono y ocupa la fila
 * entera, con etiqueta y sub a la izquierda y la cifra a la derecha. Todo acotado
 * a `max-md`: el escritorio no se entera.
 */
const WIDE_TILE_CELL = "max-md:order-last max-md:col-span-2";
const WIDE_TILE_BODY = "max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-x-4";
const WIDE_TILE = {
  root: `${WIDE_TILE_CELL} ${WIDE_TILE_BODY}`,
  label: "max-md:col-start-1 max-md:row-start-1",
  value: "max-md:col-start-2 max-md:row-start-1 max-md:row-span-2 max-md:mt-0 max-md:self-center max-md:text-right",
  sub: "max-md:col-start-1 max-md:row-start-2",
} as const;

const FOCUS_INSET = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ac-500/60";
const ACTIVE = "ring-1 ring-inset ring-ac-500/50";

export type Metric = {
  key: string;
  label: string;
  /**
   * Etiqueta corta para el teléfono. Una etiqueta cortada a mitad de palabra no
   * dice nada: la cura de una etiqueta que no cabe es OTRA etiqueta.
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
  /** Es el filtro aplicado ahora. Se marca con un filete de acento, nunca con el color de la cifra. */
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
   * en el teléfono. 🪤 Se resuelve con CSS, sin reordenar el array: el escritorio
   * mira la posición en el marcado (`md:first:pl-0`).
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
  return (
    <div
      className={cx(
        "grid grid-cols-2 max-md:gap-0 md:flex md:gap-0 md:divide-x md:divide-hairline",
        rule && "border-b border-hairline pb-5",
      )}
    >
      {metrics.map((m) => {
        const wide = m.key === wideKey;
        const at = cell.get(m.key);
        // Con `onSelect` la celda CONTIENE el botón: lo que coloca las tres líneas
        // va en el botón y en la celda solo lo que la coloca a ella.
        const rootLayout = m.onSelect ? (wide ? WIDE_TILE_CELL : "") : wide ? WIDE_TILE.root : CENTERED_TILE.root;
        const tileClass = cx(
          "group relative min-w-0 max-md:px-3 max-md:py-4 md:flex-1 md:px-5 md:py-0 md:first:pl-0 md:last:pr-0",
          CROSS,
          at && at.col === 0 && !wide && "max-md:border-r",
          at && at.row > 0 && "max-md:border-t",
          rootLayout,
          m.detail ? "cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/50" : null,
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
                  <span className="truncate md:hidden">{m.labelShort}</span>
                  <span className="truncate max-md:hidden">{m.label}</span>
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
                  m.active && ACTIVE,
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
            className={cx(tileClass, "rounded-lg transition-colors duration-150", FOCUS_INSET, m.active && ACTIVE)}
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
  );
}
