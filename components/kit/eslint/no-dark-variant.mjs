// =============================================================================
// kigaru/no-dark-variant — un esquema por dashboard, sin toggle (D2, §7.2).
// =============================================================================
// Ni variantes `dark:`, ni selector `.dark`, ni `prefers-color-scheme` en el
// área de dashboard. Es la lección del hub: con dos temas cada decisión de
// color se tomaba dos veces (3.338 variantes `dark:`) y cada error también. El
// esquema lo fija el tema del área con sus valores de token (y `--scheme` para
// los controles nativos); las primitivas no se enteran.
//
// Qué caza, en cualquier cadena:
//   · la variante `dark:`, también encadenada (`md:dark:`, `hover:dark:`);
//   · una variante arbitraria que nombra el modo oscuro: `[.dark_&]:`,
//     `data-[theme=dark]:`, `[@media(prefers-color-scheme:dark)]:`;
//   · `prefers-color-scheme` suelto, que es el `matchMedia` con el que una isla
//     lee el esquema del sistema para pintarse distinta.
//
// La landing y el flujo de reserva de un cliente pueden seguir con su toggle:
// son registro de marca y quedan fuera del área (y fuera de `files`).
// =============================================================================

import { findAll, rule, scanStrings } from "./_shared.mjs";

const ARMS = [
  // 🪤 Delante de `dark:` se admite `:` (variantes encadenadas); detrás tiene
  // que empezar una utilidad. Así "Mode dark: on" en un texto no dispara.
  { re: /(?<![\w-])dark:(?=[!\w[-])/, messageId: "variant" },
  // 🪤 Sin `\b` alrededor de `dark`: dentro de un corchete los espacios son `_`,
  // que es carácter de palabra, así que en `[.dark_&]` no hay frontera detrás.
  { re: /(?<![\w-])(?:[a-z][\w-]*-)?\[[^\]\s]*(?<![a-zA-Z0-9-])dark(?![a-zA-Z0-9-])[^\]\s]*\]:/, messageId: "variant" },
  { re: /prefers-color-scheme/, messageId: "scheme" },
];

export const noDarkVariant = rule({
  description: "Un esquema de color por dashboard, sin toggle (D2): sin variantes `dark:` ni `prefers-color-scheme`.",
  messages: {
    variant:
      "`{{util}}`: una variante de modo oscuro. Cada dashboard tiene UN esquema y no lleva toggle (D2, " +
      "§7.2): el color sale del token, y el token ya vale lo que tiene que valer en el tema del área.",
    scheme:
      "`prefers-color-scheme` en el área de dashboard: el esquema lo fija el tema del área (`--scheme`), " +
      "no el sistema de quien lo mira (D2, §7.2).",
  },
  create: (context) => scanStrings(context, (raw) => findAll(raw, ARMS)),
});
