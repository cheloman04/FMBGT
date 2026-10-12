// =============================================================================
// kigaru/no-foreign-theme-utility — en el área de dashboard, solo los nombres
// del kit (D3, §7.4).
// =============================================================================
// shadcn define `muted`, `secondary`, `accent`, `border`, `card`, `primary`…
// con OTRO significado que el hub: en shadcn `bg-muted` es un fondo, en el hub
// `text-muted` es un gris de texto. Con los dos en el mismo proyecto el `@theme`
// de uno rompe al otro, y por eso las utilidades del kit tienen nombres propios
// (`text-fg`, `bg-surface`, `border-hairline`, `ac-*`, `tone-*`, `nav-*`).
//
// Qué caza, en el área de dashboard:
//   · las utilidades de shadcn (`bg-background`, `text-muted-foreground`,
//     `bg-card`, `border-border`, `ring-ring`, `bg-sidebar`…). Fuera del área
//     siguen siendo las del sitio; dentro leerían la paleta de la landing, no
//     la del dashboard;
//   · las del hub que el kit renombra (`text-secondary`, `text-muted`,
//     `text-disabled`, `text-accent-contrast`, `bg-accent-500`). En un spoke no
//     existen: compilan a nada y nadie lo nota;
//   · las variables de shadcn dentro de un valor arbitrario
//     (`bg-[var(--card)]`, `text-[hsl(var(--muted-foreground))]`).
//
// 🪤 `--background` y `--foreground` son de los dos sistemas con el mismo
// significado (§7.4), así que `var(--background)` NO se caza; la UTILIDAD
// `bg-background` sí, porque la del kit es `bg-canvas`.
// =============================================================================

import { ALPHA, FILL_PROPS, findAll, rule, scanStrings, util } from "./_shared.mjs";

const SHADCN =
  "background|foreground|(?:card|popover|primary|secondary|muted|accent|destructive)(?:-foreground)?|border|input|ring|chart-[1-5]|sidebar(?:-(?:foreground|primary-foreground|primary|accent-foreground|accent|border|ring))?";
const HUB = String.raw`disabled|accent-contrast|accent-\d{2,3}`;
const SHADCN_VARS =
  "(?:card|popover|primary|secondary|muted|accent|destructive)(?:-foreground)?|border|input|ring|chart-[1-5]|sidebar(?:-[a-z]+)*";

const ARMS = [
  { re: new RegExp(util(`(?:text|${FILL_PROPS})-(${SHADCN}|${HUB})${ALPHA}`)), messageId: "utility", data: (m) => ({ hint: hintFor(m[1]) }) },
  {
    re: new RegExp(String.raw`(?<![\w-])[a-z][a-z0-9-]*-\[[^\]\s]*var\(--(${SHADCN_VARS})(?![\w-])[^\]\s]*\]${ALPHA}`),
    messageId: "variable",
    data: (m) => ({ hint: hintFor(m[1]) }),
  },
];

/** El equivalente del kit, para que el mensaje diga qué escribir. */
function hintFor(name) {
  const n = name.replace(/^sidebar.*/, "sidebar").replace(/^chart-\d$/, "chart").replace(/^accent-\d+$/, "accent-n");
  const HINTS = {
    background: "`bg-canvas`",
    foreground: "`text-fg`",
    "card-foreground": "`text-fg`",
    "popover-foreground": "`text-fg`",
    "secondary-foreground": "`text-fg`",
    "muted-foreground": "`text-fg-muted`",
    card: "`bg-surface` (o `.kit-elevated` si flota)",
    popover: "`.kit-elevated`",
    muted: "`bg-surface-muted` si es un fondo, `text-fg-muted` si es texto",
    secondary: "`bg-surface-muted` si es un fondo, `text-fg-2` si es texto",
    border: "`border-hairline` / `divide-hairline`",
    input: "`border-hairline` (un campo es `<Input>` del kit)",
    ring: "`ring-ac-500/60`",
    primary: "`bg-ac-500` (y `text-ac-contrast` encima); la acción primaria es `<Button>`",
    accent: "`ac-*` (`bg-ac-500`, `text-ac-300`…)",
    "primary-foreground": "`text-ac-contrast`",
    "accent-foreground": "`text-ac-contrast`",
    "accent-contrast": "`text-ac-contrast`",
    "accent-n": "`ac-*` con el mismo paso (`bg-accent-500` → `bg-ac-500`)",
    destructive: "`tone-red` (`<Button variant=\"danger\">`)",
    "destructive-foreground": "`text-tone-red`",
    disabled: "`text-fg-disabled`",
    sidebar: "`nav-*` (el menú lo dibuja `AppShell`)",
    chart: "`TONE_CSS` o `ac-*` (los gráficos del kit ya los usan)",
  };
  return HINTS[n] ?? "la utilidad del kit (§7.4)";
}

export const noForeignThemeUtility = rule({
  description:
    "En el área de dashboard, solo utilidades del kit: nada de nombres de shadcn ni de los que el hub renombra (D3).",
  messages: {
    utility:
      "`{{util}}` es una utilidad de shadcn o del hub, no del kit (D3, §7.4). Aquí es {{hint}}. Dentro del " +
      "área de dashboard los nombres de shadcn leen la paleta del sitio, no la del dashboard.",
    variable:
      "`{{util}}` lee una variable de shadcn, no un token del kit (D3, §7.4). Aquí es {{hint}}.",
  },
  create: (context) => scanStrings(context, (raw) => findAll(raw, ARMS)),
});
