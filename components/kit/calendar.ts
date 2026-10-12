// Aritmética de calendario, pura, para los controles de fecha del kit.
//
// Una fecha sola es la cadena `YYYY-MM-DD` (el valor de `<input type="date">`);
// al parsearla se fija el MEDIODÍA local, para que ningún desfase de zona horaria
// mueva el día. Fecha y hora es `YYYY-MM-DDTHH:mm` (el de `datetime-local`).
//
// 🪤 Sin imports relativos: los tests lo cargan con Node tal cual (`.ts`).

/** Cabeceras de la rejilla en inglés; empieza en domingo, como `buildMonthGrid`. */
export const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  // `new Date(2026, 1, 31)` no falla: se va al 3 de marzo. Eso no es una fecha válida.
  if (Number.isNaN(parsed.getTime()) || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

export function toISODate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sameDay(left: Date | null, right: Date): boolean {
  return Boolean(left && toISODate(left) === toISODate(right));
}

/** "Oct 12, 2026" en el idioma dado; `empty` si no hay fecha válida. */
export function displayDate(value: string, empty: string, locale = "en-US"): string {
  const parsed = parseDate(value);
  return parsed ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(parsed) : empty;
}

/** Hora que se usa cuando se elige el día antes que la hora. */
export const DEFAULT_TIME = "10:00";
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
/** Pasos de cinco minutos: más fino de lo que un calendario necesita, fácil de recorrer. */
export const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** Parte `YYYY-MM-DD[THH:mm]` en sus dos mitades; una hora mal formada cuenta como ausente. */
export function splitDateTime(value: string): { date: string; time: string } {
  const [date = "", rest = ""] = value.split("T");
  return { date, time: /^\d{2}:\d{2}/.test(rest) ? rest.slice(0, 5) : "" };
}

/** Las vuelve a unir. Sin fecha no hay valor. */
export function joinDateTime(date: string, time: string): string {
  return date ? `${date}T${time || DEFAULT_TIME}` : "";
}

/** "Oct 12, 2026 · 10:00" (o solo la fecha, o `empty`). */
export function displayDateTime(value: string, empty: string, locale = "en-US"): string {
  const { date, time } = splitDateTime(value);
  const shown = displayDate(date, "", locale);
  if (!shown) return empty;
  return time ? `${shown} · ${time}` : shown;
}

/** Las 42 celdas (6 semanas) que contienen `viewMonth`, empezando en domingo. */
export function buildMonthGrid(viewMonth: Date): Date[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1, 12);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}
