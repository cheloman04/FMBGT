// =============================================================================
// kigaru/no-raw-palette-color — el color de TEXTO sale de un token, no de la
// paleta de Tailwind. Portada de `no-legacy-text-color` del hub.
// =============================================================================
// La escalera de texto son tres grises (§7.5): `text-fg` (lo principal),
// `text-fg-2` (apoyo que se lee) y `text-fg-muted` (metadatos, etiquetas,
// fechas), más `text-fg-disabled`. Un estado es `text-tone-*`; el acento,
// `text-ac-*`; sobre un relleno de acento, `text-ac-contrast`.
//
// Qué caza, en `text-*`:
//   · los grises de Tailwind (`text-gray-400`, `text-slate-300`…). Un gris
//     frío no lleva el tinte de la piel del cliente;
//   · `text-white` y `text-black`, con o sin alfa. 🪤 En el hub `text-black`
//     no lo cazaba NADIE: la regla preguntaba por el blanco y por los grises con
//     nombre, y el negro no era ninguno de los dos;
//   · cualquier OTRA familia (`text-green-400`, `text-emerald-300`). Esto es
//     más estricto que el hub, a propósito: allí los tonos de estado son clases
//     de Tailwind; en el kit son tokens (`--tone-*`, §7.1), así que un
//     `text-green-400` es un color que la piel del cliente no puede recalibrar.
//
// 🪤 SOLO `text-*`. El resto de propiedades (relleno, filete, divisor, anillo)
// es de `no-off-palette-fill`, igual que el hex dentro de un valor arbitrario:
// dos reglas señalando el mismo carácter hacen que se ignoren las dos.
// =============================================================================

import { ALPHA, GREYS, HUES, findAll, rule, scanStrings, util } from "./_shared.mjs";

const ARMS = [
  { re: new RegExp(util(`text-(?:white|black)${ALPHA}`)), messageId: "pure" },
  { re: new RegExp(util(`text-(?:${GREYS})-\\d{2,3}${ALPHA}`)), messageId: "grey" },
  { re: new RegExp(util(`text-(?:${HUES})-\\d{2,3}${ALPHA}`)), messageId: "hue" },
];

const LADDER =
  "La escalera son tres: `text-fg` (lo principal), `text-fg-2` (apoyo que se lee) y `text-fg-muted` " +
  "(metadatos, etiquetas, fechas); `text-fg-disabled` solo para deshabilitado.";

export const noRawPaletteColor = rule({
  description:
    "El color de texto sale de los tokens del kit (`text-fg*`, `text-tone-*`, `text-ac-*`), no de la paleta de Tailwind ni de blanco o negro puros.",
  messages: {
    grey: "`{{util}}` es un gris de Tailwind, fuera de la escalera de texto (§7.5). " + LADDER,
    pure:
      "`{{util}}` es blanco o negro puro: no es un token, así que no cambia con la piel del cliente. " +
      "Sobre un relleno de acento va `text-ac-contrast` (un blanco a mano suele fallar WCAG AA). " +
      LADDER,
    hue:
      "`{{util}}` es un color de la paleta de Tailwind, no un token (§7.5). Un estado se pinta con su " +
      "tono —`<StatusBadge>` o `TONE_CLASSES` (`text-tone-*`)— y el acento con `text-ac-*`: así la piel " +
      "de cada cliente los recalibra.",
  },
  create: (context) => scanStrings(context, (raw) => findAll(raw, ARMS)),
});
