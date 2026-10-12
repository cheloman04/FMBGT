// =============================================================================
// kigaru/no-off-palette-fill — el color que NO es texto también sale de un
// token. Portada del hub (senzai-v1).
// =============================================================================
// `no-raw-palette-color` mira el texto. Esta mira todo lo demás —relleno,
// filete, divisor, anillo, sombra, degradado— y los colores LITERALES en
// cualquier propiedad. En el hub, entre las reglas de texto, de métrica y de
// superficies dejaban vivos 77 rellenos y filetes fuera de paleta, nueve de
// ellos en la pantalla de referencia: ninguna regla preguntaba.
//
// Qué caza, y por qué cada brazo:
//
//   A. `<prop>-white` / `<prop>-black`, con o sin alfa. Un blanco al 10% no es
//      "casi el filete": es un gris frío, y el filete del tema
//      (`border-hairline`) lleva el tinte del cliente.
//   B. `<prop>-<gris>-<n>`: un gris neutro de Tailwind.
//   C. `<prop>-<familia>-<n>` de cualquier otra familia. 🪤 Más estricto que el
//      hub, donde `green`, `blue`, `amber`, `yellow` y `red` son los tonos de
//      estado y pasan: en el kit los tonos son TOKENS (`bg-tone-green/10`), así
//      que `bg-green-500/10` es un color que la piel no puede recalibrar. Y el
//      hub ya pagó la versión cara de esto: 318 `emerald` conviviendo con su
//      `green`, la misma píldora en dos verdes según quién la pintara.
//   D. Un color LITERAL dentro de un valor o una propiedad arbitrarios, en
//      CUALQUIER propiedad (`text-[#07161d]` incluido): un hex, o `rgb()` /
//      `hsl()` / `oklch()`… con números. 🪤 El hub empezó solo con el hex y
//      siete sombras `rgb(0_0_0/0.4)` pasaron el lint: `bg-black/60` y
//      `shadow-[…rgb(0_0_0/0.4)]` son el MISMO color. 🪤 Y mira DENTRO del
//      corchete: un `bg-[linear-gradient(180deg,#0b0f14,…)]` es la misma
//      deuda que `bg-[#0b0f14]`. Lo que NO caza es `rgb(var(--a500))`: eso es
//      un token.
//
// 🪤 `text-*` NO entra en A, B ni C: es de `no-raw-palette-color`. Dos reglas
// sobre el mismo carácter hacen que se ignoren las dos.
//
// Las excepciones reales (el buzón negro de un `<video>`, el papel blanco de un
// PDF en un `<iframe>`, el botón de una marca ajena) se marcan a mano con
// `eslint-disable-next-line` y su razón: una excepción que se ve en el diff es
// una decisión; una cocida en el patrón es una grieta que nadie vuelve a mirar.
// =============================================================================

import { ALPHA, FILL_PROPS, GREYS, HUES, findAll, rule, scanStrings, util } from "./_shared.mjs";

/**
 * Un color literal: hex (no el `#id` de un `url(#grad)`, que es una referencia
 * de SVG) o notación funcional que empieza por un número. 🪤 Dentro de un valor
 * arbitrario los espacios son `_`, así que `rgb(0_0_0/0.4)` es la forma real.
 * 🪤 Y por eso delante de la función va `(?<![a-zA-Z])` y no `\b`: `_` es un
 * carácter de palabra, así que en `0_8px_rgb(0_0_0)` no hay frontera antes de
 * `rgb` y un `\b` dejaría pasar justo la sombra que el brazo existe para cazar.
 */
const LITERAL = String.raw`(?:(?<!url\()#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z])|(?<![a-zA-Z])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-+.\d])`;

const ARMS = [
  { re: new RegExp(util(`(?:${FILL_PROPS})-(?:white|black)${ALPHA}`)), messageId: "pure" },
  { re: new RegExp(util(`(?:${FILL_PROPS})-(?:${GREYS})-\\d{2,3}${ALPHA}`)), messageId: "grey" },
  { re: new RegExp(util(`(?:${FILL_PROPS})-(?:${HUES})-\\d{2,3}${ALPHA}`)), messageId: "hue" },
  // Valor arbitrario (`bg-[#0b0f14]`, `shadow-[0_8px_rgb(0_0_0/0.4)]`) y
  // propiedad arbitraria (`[color:#fff]`, `[--brand:#0b0]`). El `(?=…)` mira
  // dentro del corchete sin salirse de él: los valores arbitrarios no llevan
  // espacios.
  { re: new RegExp(String.raw`(?<![\w-])[a-z][a-z0-9-]*-\[(?=[^\]\s]*${LITERAL})[^\]\s]*\]${ALPHA}`), messageId: "literal" },
  { re: new RegExp(String.raw`(?<![\w-])\[(?=-{0,2}[a-z][\w-]*:)(?=[^\]\s]*${LITERAL})[^\]\s]*\]`), messageId: "literal" },
];

export const noOffPaletteFill = rule({
  description:
    "Relleno, filete, divisor, anillo y sombra salen de los tokens del kit; nada de blanco o negro puros, paleta de Tailwind ni colores literales.",
  messages: {
    pure:
      "`{{util}}`: blanco o negro puros no son un token del tema. Un filete o un divisor es " +
      "`border-hairline` / `divide-hairline`; el velo de un diálogo, `bg-canvas/70`; lo que flota, " +
      "`.kit-elevated` (§7.5, §7.6).",
    grey:
      "`{{util}}`: un gris frío de Tailwind no es un token. Superficie: `bg-surface` o " +
      "`bg-surface-muted`; filete: `border-hairline`; un estado gris: `bg-tone-gray/10` + " +
      "`border-tone-gray/20`, desde `TONE_CLASSES` o `<StatusBadge>` (§7.5).",
    hue:
      "`{{util}}`: un color de la paleta de Tailwind, no un token. Un estado es `tone-*` " +
      "(`bg-tone-green/10` + `border-tone-green/20`, desde `TONE_CLASSES` o `<StatusBadge>`) y el " +
      "acento `ac-*`. Con los tonos como tokens la piel de cada cliente los recalibra; un " +
      "`bg-green-500/10` no se entera (§7.1, §7.5).",
    literal:
      "`{{util}}`: un color literal. Ni hex ni `rgb()`/`hsl()`/`oklch()` con números en el código " +
      "(§7.5): el color llega por un token del tema. Para un atributo de SVG o una API de JS, " +
      "`TONE_CSS` lee el token.",
  },
  create: (context) => scanStrings(context, (raw) => findAll(raw, ARMS)),
});
