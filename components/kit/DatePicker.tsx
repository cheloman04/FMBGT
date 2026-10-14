"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "./_icons";
import {
  DEFAULT_TIME,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  WEEKDAYS_EN,
  buildMonthGrid,
  displayDate,
  displayDateTime,
  joinDateTime,
  parseDate,
  sameDay,
  splitDateTime,
  toISODate,
} from "./calendar";
import { cx } from "./cx";
import { FIELD_LABEL_CLASSES, SELECT_OPTION_CLASSES } from "./Field";

const POPUP_WIDTH = 288;
/**
 * En el teléfono el popup se ensancha: son 7 columnas y el suelo táctil es 44px,
 * así que necesita 7 × 44 = 308 más el relleno. Con 288 cada día medía 37px y es
 * el objetivo que más se toca del control.
 */
const POPUP_WIDTH_MOBILE = 332;
const MOBILE_MAX = 639;
const POPUP_HEIGHT = 340;
/** La fila de la hora añade una franja: tiene que caber cuando el popup sube. */
const POPUP_HEIGHT_WITH_TIME = 404;

function popupWidth(): number {
  if (window.innerWidth > MOBILE_MAX) return POPUP_WIDTH;
  return Math.min(POPUP_WIDTH_MOBILE, window.innerWidth - 16);
}

export type DatePickerLabels = {
  placeholder: string;
  previousMonth: string;
  nextMonth: string;
  clear: string;
  today: string;
  /** Solo en `mode="datetime"`. */
  time: string;
  hour: string;
  minute: string;
  done: string;
  /** Cabeceras de la rejilla, de domingo a sábado. */
  weekdays: readonly string[];
};

const LABELS_EN: DatePickerLabels = {
  placeholder: "Select date",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  clear: "Clear",
  today: "Today",
  time: "Time",
  hour: "Hour",
  minute: "Minute",
  done: "Done",
  weekdays: WEEKDAYS_EN,
};

/**
 * El calendario con marca: el sustituto de `<input type="date">` (y de
 * `datetime-local` con `mode="datetime"`), cuyo popup no se puede tematizar.
 *
 * Dos formas de usarlo:
 *   · Sin controlar + FormData: `name` (y `defaultValue`). Pinta un input oculto,
 *     así que `new FormData(form)` lo recoge como al nativo.
 *   · Controlado: `value` + `onChange`.
 *
 * El popup va en un portal con posición fija para que el `overflow-hidden` de un
 * panel no lo recorte; sube encima del campo si abajo no cabe.
 *
 * 🪤 El portal va al `[data-kit]` más cercano, NO a `document.body`: fuera de él
 * el popup se quedaría sin los tokens del dashboard (§7.3).
 *
 * 🪤 Ahí comparte capa con los diálogos (`Modal` z-[70], `Drawer` z-[60]), así que
 * va POR ENCIMA de ellos (z-[80]): se abre desde dentro de uno. Con z-50 el
 * calendario de un campo de un `Modal` salía debajo de su veladura.
 */
export function DatePicker({
  name,
  value,
  defaultValue = "",
  onChange,
  ariaLabel,
  label,
  mode = "date",
  locale = "en-US",
  labels: labelsProp,
  layout,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  ariaLabel: string;
  /** Etiqueta visible encima, como la de un campo de formulario. */
  label?: string;
  /** `date` → `YYYY-MM-DD` · `datetime` → `YYYY-MM-DDTHH:mm` (añade la fila de la hora). */
  mode?: "date" | "datetime";
  /** Idioma de las fechas (`Intl`). Los textos de los botones van en `labels`. */
  locale?: string;
  labels?: Partial<DatePickerLabels>;
  /** Solo maquetación del contenedor. */
  layout?: string;
}) {
  const labels = { ...LABELS_EN, ...labelsProp };
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const current = isControlled ? value : internal;

  const withTime = mode === "datetime";
  const popupHeight = withTime ? POPUP_HEIGHT_WITH_TIME : POPUP_HEIGHT;
  const datePart = withTime ? splitDateTime(current).date : current;
  const timePart = withTime ? splitDateTime(current).time : "";

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const [layer, setLayer] = useState<Element | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = parseDate(datePart) ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1, 12);
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseDate(datePart);

  useEffect(() => {
    if (!open) return;
    // Las coordenadas se calculan al abrir; este efecto solo engancha el cierre.
    function close() {
      setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function commit(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  function openCalendar() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < popupHeight + 12 && rect.top > popupHeight + 12 ? rect.top - popupHeight - 6 : rect.bottom + 6;
    const width = popupWidth();
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setCoords({ top, left, width });
    setLayer(trigger.closest("[data-kit]") ?? document.body);
    const base = parseDate(datePart) ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1, 12));
    setOpen(true);
  }

  function focusTrigger() {
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  /** Elegir un día. Con hora, el popup SE QUEDA abierto para que siga la hora. */
  function select(day: Date) {
    if (withTime) {
      commit(joinDateTime(toISODate(day), timePart));
      return;
    }
    commit(toISODate(day));
    setOpen(false);
    focusTrigger();
  }

  function setTime(next: string) {
    commit(joinDateTime(datePart || toISODate(new Date()), next));
  }

  function moveMonth(amount: number) {
    setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1, 12));
  }

  const days = buildMonthGrid(viewMonth);
  const time = timePart || DEFAULT_TIME;

  return (
    <div className={layout}>
      {label ? <span className={FIELD_LABEL_CLASSES}>{label}</span> : null}
      <div className="relative">
        {name ? <input type="hidden" name={name} value={current} readOnly /> : null}
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openCalendar())}
          onKeyDown={(event) => {
            // Cerrar el calendario es SU Escape: `preventDefault` evita que cierre
            // también el diálogo que lo contiene (`useDialogBehavior`). Cerrado, el
            // Escape sigue siendo del diálogo.
            if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
            }
            if ((event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") && !open) {
              event.preventDefault();
              openCalendar();
            }
          }}
          className={cx(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm outline-none transition-colors max-sm:min-h-11 focus-visible:ring-2 focus-visible:ring-ac-400/40",
            open ? "border-ac-400/40 bg-ac-400/5 text-fg" : "border-hairline bg-surface-muted text-fg-2 hover:text-fg",
          )}
        >
          <span className={current ? "font-medium" : "text-fg-muted"}>
            {withTime
              ? displayDateTime(current, labels.placeholder, locale)
              : displayDate(current, labels.placeholder, locale)}
          </span>
          <IconCalendar className={cx("h-3.5 w-3.5 shrink-0", open ? "text-ac-400" : "text-fg-muted")} />
        </button>
      </div>

      {open && coords && layer
        ? createPortal(
            <div
              ref={popupRef}
              role="dialog"
              aria-label={ariaLabel}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  focusTrigger();
                }
              }}
              style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
              className="kit-elevated z-[80] overflow-hidden rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                <p className="text-sm font-semibold text-fg">
                  {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(viewMonth)}
                </p>
                <div className="flex gap-1">
                  <NavButton label={labels.previousMonth} onClick={() => moveMonth(-1)}>
                    <IconChevronLeft className="h-4 w-4" />
                  </NavButton>
                  <NavButton label={labels.nextMonth} onClick={() => moveMonth(1)}>
                    <IconChevronRight className="h-4 w-4" />
                  </NavButton>
                </div>
              </div>

              <div className="px-3 pb-3 pt-2">
                <div className="grid grid-cols-7">
                  {labels.weekdays.map((weekday) => (
                    <span
                      key={weekday}
                      className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-fg-muted"
                    >
                      {weekday}
                    </span>
                  ))}
                  {days.map((day) => {
                    const isSelected = sameDay(selectedDate, day);
                    const outside = day.getMonth() !== viewMonth.getMonth();
                    const isToday = sameDay(new Date(), day);
                    return (
                      <button
                        key={toISODate(day)}
                        type="button"
                        onClick={() => select(day)}
                        aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(day)}
                        aria-pressed={isSelected}
                        className={cx(
                          "relative mx-auto my-0.5 flex h-9 w-full max-w-11 items-center justify-center rounded-lg text-xs font-medium transition-colors max-sm:min-h-11 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-400",
                          isSelected
                            ? "bg-ac-500 text-ac-contrast"
                            : outside
                              ? "text-fg-muted hover:bg-surface-muted"
                              : "text-fg-2 hover:bg-surface-muted hover:text-fg",
                        )}
                      >
                        {day.getDate()}
                        {isToday && !isSelected ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-ac-400" /> : null}
                      </button>
                    );
                  })}
                </div>

                {withTime ? (
                  <div className="mt-2 flex items-center gap-2 border-t border-hairline px-1 pt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{labels.time}</span>
                    <div className="flex items-center gap-1">
                      <TimeUnit
                        label={labels.hour}
                        value={time.slice(0, 2)}
                        options={HOUR_OPTIONS}
                        onChange={(h) => setTime(`${h}:${time.slice(3, 5)}`)}
                      />
                      <span className="text-xs text-fg-muted">:</span>
                      <TimeUnit
                        label={labels.minute}
                        value={time.slice(3, 5)}
                        options={MINUTE_OPTIONS}
                        onChange={(m) => setTime(`${time.slice(0, 2)}:${m}`)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        focusTrigger();
                      }}
                      className="ml-auto inline-flex items-center rounded-lg bg-ac-500 px-2.5 py-1 text-[11px] font-semibold text-ac-contrast transition-[filter] hover:brightness-107 max-sm:min-h-11 max-sm:px-4"
                    >
                      {labels.done}
                    </button>
                  </div>
                ) : null}

                <div className="mt-2 flex items-center justify-between border-t border-hairline px-1 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      commit("");
                      setOpen(false);
                      focusTrigger();
                    }}
                    className="inline-flex items-center text-[11px] font-semibold text-fg-muted transition-colors hover:text-fg max-sm:min-h-11 max-sm:pr-4"
                  >
                    {labels.clear}
                  </button>
                  <button
                    type="button"
                    onClick={() => select(new Date())}
                    className="inline-flex items-center text-[11px] font-semibold text-ac-400 transition-colors hover:text-ac-300 max-sm:min-h-11 max-sm:pl-4"
                  >
                    {labels.today}
                  </button>
                </div>
              </div>
            </div>,
            layer,
          )
        : null}
    </div>
  );
}

function TimeUnit({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cx(
        "appearance-none rounded-lg border border-hairline bg-surface-muted px-2 py-1 text-xs font-medium text-fg-2 outline-none transition-colors hover:border-ac-400/35 focus-visible:ring-2 focus-visible:ring-ac-400/40",
        SELECT_OPTION_CLASSES,
      )}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

// 🪤 El suelo táctil va en `min-h`, no en `h`: sin tailwind-merge, `max-sm:h-11`
// junto a `h-8` lo decide el orden del CSS. `min-height` gana a `height` por las
// reglas de CSS, no por el orden.
function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-fg-muted transition-colors hover:border-ac-400/30 hover:bg-ac-400/10 hover:text-ac-300 max-sm:min-h-11 max-sm:min-w-11"
    >
      {children}
    </button>
  );
}
