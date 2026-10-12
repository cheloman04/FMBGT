"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export type TabItem = {
  key: string;
  label: string;
  /** Contenido al final de la pestaña: una cifra, un punto de estado. */
  badge?: ReactNode;
};

/**
 * Pestañas DENTRO de una vista (patrón WAI-ARIA tabs). Controladas: el padre lleva
 * `value` y pinta los `<TabPanel>` con el mismo `idBase`.
 *
 * 🪤 Si cambiar de pestaña cambia de DATOS, no son pestañas: es una ruta (§3, "una
 * vista, una ruta"). Esto es para partir una vista que ya está en pantalla.
 *
 * El subrayado activo es un borde del acento (el ítem activo es uno de los cuatro
 * sitios del acento, §7.5). Sin GSAP: el kit no depende de librerías de animación.
 */
export function Tabs({
  items,
  value,
  onChange,
  idBase,
  ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  /** El mismo en las pestañas y en sus `TabPanel`: une cada una con su panel. */
  idBase: string;
  ariaLabel: string;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const idx = items.findIndex((it) => it.key === value);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    const nextKey = items[next].key;
    onChange(nextKey);
    // Foco itinerante: el foco va a la pestaña recién elegida.
    document.getElementById(`${idBase}-tab-${nextKey}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto border-b border-hairline [scrollbar-width:none]"
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            id={`${idBase}-tab-${it.key}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${idBase}-panel-${it.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.key)}
            onKeyDown={onKeyDown}
            className={cx(
              "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 max-sm:min-h-11",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ac-500/60",
              active ? "border-ac-500 text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {it.label}
            {it.badge}
          </button>
        );
      })}
    </div>
  );
}

/**
 * El panel de una pestaña. SIGUE MONTADO (`hidden`), así que el estado de dentro
 * —un formulario a medias, una subida, el scroll— sobrevive al cambio de pestaña.
 * Al mostrarse sube 12px con un fundido de 240ms, salvo con `prefers-reduced-motion`.
 */
export function TabPanel({
  idBase,
  tabKey,
  active,
  children,
}: {
  idBase: string;
  tabKey: string;
  active: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Activo al montar: la entrada de la página es de la página, no se anima dos veces.
  const mounted = useRef(false);

  useEffect(() => {
    if (active && mounted.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ref.current?.animate(
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 240, easing: "cubic-bezier(.4,0,.2,1)" },
      );
    }
    mounted.current = true;
  }, [active]);

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${idBase}-panel-${tabKey}`}
      aria-labelledby={`${idBase}-tab-${tabKey}`}
      hidden={!active}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
