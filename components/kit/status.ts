/**
 * El vocabulario de estados (§6.2).
 *
 * Cada dominio declara UN mapa `estado → StatusMeta` en `lib/<area>/status-meta.ts`
 * y todas las pantallas que pintan ese estado lo importan. Dos pantallas que
 * pintan `completed` de colores distintos son un bug.
 */

export type StatusTone = "gray" | "blue" | "green" | "amber" | "yellow" | "red" | "accent";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

export interface ToneClasses {
  dot: string;
  text: string;
  /** Relleno al 10% y borde al 20% del mismo tono: el badge. */
  bg: string;
}

/**
 * 🪤 Clases escritas ENTERAS, nunca compuestas (`bg-tone-${t}`): Tailwind solo
 * genera las que encuentra literales en el código.
 */
export const TONE_CLASSES: Record<StatusTone, ToneClasses> = {
  gray: { dot: "bg-tone-gray", text: "text-tone-gray", bg: "bg-tone-gray/10 border-tone-gray/20" },
  blue: { dot: "bg-tone-blue", text: "text-tone-blue", bg: "bg-tone-blue/10 border-tone-blue/20" },
  green: { dot: "bg-tone-green", text: "text-tone-green", bg: "bg-tone-green/10 border-tone-green/20" },
  amber: { dot: "bg-tone-amber", text: "text-tone-amber", bg: "bg-tone-amber/10 border-tone-amber/20" },
  yellow: { dot: "bg-tone-yellow", text: "text-tone-yellow", bg: "bg-tone-yellow/10 border-tone-yellow/20" },
  red: { dot: "bg-tone-red", text: "text-tone-red", bg: "bg-tone-red/10 border-tone-red/20" },
  accent: { dot: "bg-ac-400", text: "text-ac-300", bg: "bg-ac-500/10 border-ac-500/20" },
};

/**
 * El tono como valor CSS, para atributos de SVG (`stroke`, `fill`) en gráficos.
 * Lee el token del tema, así que respeta la piel del cliente.
 */
export const TONE_CSS: Record<StatusTone, string> = {
  gray: "rgb(var(--tone-gray))",
  blue: "rgb(var(--tone-blue))",
  green: "rgb(var(--tone-green))",
  amber: "rgb(var(--tone-amber))",
  yellow: "rgb(var(--tone-yellow))",
  red: "rgb(var(--tone-red))",
  accent: "rgb(var(--a500))",
};

/**
 * Busca un estado en su mapa. Uno sin mapear cae a un badge gris con la clave
 * cruda: se ve raro, pero no rompe la página.
 */
export function resolveStatus(map: Record<string, StatusMeta>, status: string | null | undefined): StatusMeta {
  if (status && Object.prototype.hasOwnProperty.call(map, status)) return map[status];
  return { label: status ?? "—", tone: "gray" };
}
