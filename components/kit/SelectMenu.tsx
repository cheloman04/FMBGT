"use client";

import { Fragment, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IconCheck, IconChevronDown } from "./_icons";
import { cx } from "./cx";
import { FIELD_LABEL_CLASSES } from "./Field";

/** Aire mínimo entre el menú y el borde por el que se le acaba el sitio. */
const GUTTER = 8;

export type SelectMenuOption = {
  value: string;
  label: string;
  /**
   * Categoría opcional. Las opciones que la comparten van SEGUIDAS: la cabecera se
   * pinta cuando el grupo cambia respecto a la opción anterior.
   */
  group?: string;
  /**
   * Clase de fondo de un punto de color antes de la etiqueta: `TONE_CLASSES[tono].dot`,
   * nunca un color suelto. Para listas cuyas opciones SON un estado o un tono.
   */
  dot?: string;
};

/**
 * El select con marca: el sustituto del `<select>` nativo cuando su desplegable
 * del sistema desentona. Teclado completo (flechas, Home/End, Enter, Escape).
 *
 * El menú se pinta EN SU SITIO (sin portal), así que lee los tokens de `[data-kit]`.
 */
export function SelectMenu({
  value,
  onChange,
  options,
  ariaLabel,
  label,
  icon,
  disabled = false,
  layout,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  /** Nombre accesible del control y de su lista. */
  ariaLabel: string;
  /** Etiqueta visible encima, como la de un campo de formulario. */
  label?: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Solo maquetación del contenedor (`w-48`, `sm:w-auto`). */
  layout?: string;
}) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  /**
   * Dónde se despliega. Abajo salvo que no quepa, y entonces sube; y se empuja en
   * horizontal si se saldría de la pantalla.
   *
   * 🪤 Se decide MIDIENDO, no por la posición del control en el formulario: dentro
   * de una hoja con scroll propio los últimos selects abrían por debajo del borde.
   */
  const [placement, setPlacement] = useState<{ dropUp: boolean; shiftX: number }>({ dropUp: false, shiftX: 0 });
  const [highlighted, setHighlighted] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  /**
   * Se mide en el ref callback del menú, no en un efecto: corre al montar y antes
   * de pintar, así que el menú nunca se ve abajo para saltar arriba un frame
   * después. Y un `setState` dentro de un efecto encadena renders.
   */
  const measureMenu = useCallback((menu: HTMLDivElement | null) => {
    if (!menu || !triggerRef.current) return;
    let boundary = { top: 0, bottom: window.innerHeight };
    for (let node = menu.parentElement; node; node = node.parentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        const box = node.getBoundingClientRect();
        boundary = { top: box.top, bottom: box.bottom };
        break;
      }
    }
    const box = triggerRef.current.getBoundingClientRect();
    const needed = menu.offsetHeight + GUTTER;
    const dropUp = boundary.bottom - box.bottom < needed && box.top - boundary.top >= needed;
    // Anclado a la derecha del disparador: crece hacia la izquierda y, cerca del
    // borde izquierdo (el teléfono), se saldría. Se empuja lo justo.
    const overflowLeft = GUTTER - (box.right - menu.offsetWidth);
    const overflowRight = box.right - (window.innerWidth - GUTTER);
    const shiftX = overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0;
    setPlacement({ dropUp, shiftX });
  }, []);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, []);

  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openMenu() {
    setHighlighted(selectedIndex);
    setOpen(true);
    requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    let next = highlighted;
    if (event.key === "ArrowDown") next = (highlighted + 1) % options.length;
    else if (event.key === "ArrowUp") next = (highlighted - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(highlighted);
      return;
    } else return;
    event.preventDefault();
    setHighlighted(next);
    optionRefs.current[next]?.focus();
  }

  return (
    <div className={layout}>
      {label ? (
        <span id={labelId} className={FIELD_LABEL_CLASSES}>
          {label}
        </span>
      ) : null}
      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel}
          aria-labelledby={label ? labelId : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onTriggerKeyDown}
          className={cx(
            "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm outline-none transition-colors max-sm:min-h-11 focus-visible:ring-2 focus-visible:ring-ac-400/40",
            disabled && "cursor-not-allowed opacity-50",
            open ? "border-ac-400/40 bg-ac-400/5 text-fg" : "border-hairline bg-surface-muted text-fg-2 hover:text-fg",
          )}
        >
          {icon ? <span className="text-fg-muted">{icon}</span> : null}
          {selected?.dot ? <span className={cx("h-2 w-2 shrink-0 rounded-full", selected.dot)} aria-hidden="true" /> : null}
          <span className="min-w-0 flex-1 truncate text-left">{selected?.label}</span>
          <IconChevronDown className={cx("h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform", open && "rotate-180")} />
        </button>

        {open ? (
          <div
            role="listbox"
            aria-label={ariaLabel}
            onKeyDown={onMenuKeyDown}
            ref={measureMenu}
            style={placement.shiftX ? { transform: `translateX(${placement.shiftX}px)` } : undefined}
            className={cx(
              "kit-elevated absolute right-0 z-40 w-max min-w-full max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl p-1.5",
              placement.dropUp ? "bottom-full mb-2" : "top-full mt-2",
            )}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const startsGroup = Boolean(option.group) && option.group !== options[index - 1]?.group;
              return (
                <Fragment key={option.value}>
                  {startsGroup ? (
                    // Solo visual: un nodo que no es `option` dentro de un `listbox`
                    // desordena el recuento de la lista en los lectores de pantalla.
                    <p
                      aria-hidden="true"
                      className="px-3 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-fg-muted first:pt-1"
                    >
                      {option.group}
                    </p>
                  ) : null}
                  <button
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={highlighted === index ? 0 : -1}
                    onMouseEnter={() => setHighlighted(index)}
                    onFocus={() => setHighlighted(index)}
                    onClick={() => choose(index)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none max-sm:min-h-11",
                      highlighted === index ? "bg-ac-400/10 text-fg" : "text-fg-2",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
                      {option.dot ? <span className={cx("h-2 w-2 shrink-0 rounded-full", option.dot)} aria-hidden="true" /> : null}
                      {option.label}
                    </span>
                    {isSelected ? <IconCheck className="h-3.5 w-3.5 shrink-0 text-ac-400" /> : null}
                  </button>
                </Fragment>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
