// =============================================================================
// kigaru/no-emoji-in-ui — sin emojis en la UI. Portada del hub (senzai-v1).
// =============================================================================
// Iconos SVG (lucide-react en el proyecto; el kit dibuja los suyos), nunca
// emojis: un emoji se pinta como imagen a color, ajena al tema y a la piel.
//
// 🪤 EL CRITERIO NO ES UNA LISTA DE RANGOS, ES UNA PROPIEDAD DE UNICODE.
// `✓ ✕ ⚠`, las flechas (→ ↩ ↗) y las formas geométricas (▲ ▼ ▶ ○) tienen
// Emoji_Presentation=No: por defecto se pintan como TEXTO, con la tipografía y
// el color del sitio donde caen. Un 📊 tiene Emoji_Presentation=Yes. Preguntar
// por la propiedad deja pasar solos los indicadores planos y caza los emoji
// que caen fuera de los rangos "obvios" (el ⏳ de Miscellaneous Technical que
// ningún barrido por rangos vio en el hub).
//
// Y aparte U+FE0F (variation selector-16) siempre: es lo que convierte el ⚠
// plano que se permite en el ⚠ a color que no.
// =============================================================================

import { rule, scanStrings } from "./_shared.mjs";

// ️ va ESCAPADO: en el fuente sería invisible, y una regla que se defiende
// de caracteres invisibles no puede depender de uno.
const EMOJI = /\p{Emoji_Presentation}|️/u;

/**
 * El PRIMER carácter infractor de `raw`, en unidades UTF-16 (como cuenta
 * `range`). Uno por cadena: una familia 👨‍👩‍👧 son cinco codepoints y un solo
 * dibujo, y cinco errores para un dibujo son ruido.
 */
function findEmoji(raw) {
  for (let i = 0; i < raw.length; ) {
    const ch = String.fromCodePoint(raw.codePointAt(i));
    if (EMOJI.test(ch)) return [{ start: i, end: i + ch.length, messageId: "emoji", data: { char: describe(ch) } }];
    i += ch.length;
  }
  return [];
}

/** Nombra el carácter: un mensaje con el codepoint ahorra el "¿cuál?". */
function describe(ch) {
  const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
  return cp === "FE0F" ? "U+FE0F (variation selector-16: fuerza presentación a color)" : `${ch} (U+${cp})`;
}

export const noEmojiInUi = rule({
  description: "Sin emojis en la UI: iconos SVG. Los indicadores planos (✓ ✕ ⚠) sí se permiten.",
  messages: {
    emoji:
      "Emoji en la UI: {{ char }}. Usa un icono SVG (lucide-react en el proyecto). Los indicadores " +
      "planos (✓ ✕ ⚠) y las formas geométricas (▲ ▼ ▶ ○) sí se permiten; lo que no se permite es " +
      "la presentación a color.",
  },
  // Solo nodos que se RENDERIZAN; los comentarios no se visitan.
  create: (context) => scanStrings(context, findEmoji, { jsxText: true }),
});
