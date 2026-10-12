// Tiempo relativo y absoluto, en la zona del NEGOCIO (§8.7), con Intl.
//
// 🪤 Sin imports relativos: los tests lo cargan con Node tal cual (`.ts`).
// 🪤 `now` es un parámetro: el reloj se lee FUERA del render (una función
// impura dentro de un componente es lo que `react-hooks/purity` señala) y los
// tests lo fijan.

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;

/** "Oct 12, 2026, 8:00 AM EDT" en la zona dada: la hora completa, para un `title`. */
export function formatDateTime(iso: string, timeZone?: string, locale = "en-US"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(date);
}

/**
 * "3h ago", "in 2d", "hace 5 min"… y, pasadas cuatro semanas, la fecha: una
 * fecha se lee mejor que "hace 9 semanas".
 */
export function formatRelative(iso: string, { timeZone, locale = "en-US", now = Date.now() }: {
  timeZone?: string;
  locale?: string;
  now?: number;
} = {}): string {
  const date = new Date(iso);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return "—";
  const diff = Math.round((ms - now) / 1000); // negativo = en el pasado
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  if (abs < 45) return rtf.format(0, "second");
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < WEEK) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 4 * WEEK) return rtf.format(Math.round(diff / WEEK), "week");
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone }).format(date);
}
