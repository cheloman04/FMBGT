// =============================================================================
// kigaru/no-solid-status-fill — un tono de estado no es una superficie.
// Portada de `no-solid-green-fill` del hub, generalizada a los seis tonos.
// =============================================================================
// §7.5: los tonos de estado van en badges, deltas y la cifra de un KPI; nunca
// como superficie, botón o bloque. El verde dice "sano" en un punto o un badge,
// nunca en un relleno sólido.
//
// En el hub nació de un barrido del portal: discos verdes a plena saturación
// para los pasos HECHOS de un asistente mientras el paso activo —el único que
// pedía acción— iba en acento tenue. Ninguno daba error, porque `green` era un
// color válido: el defecto no era el color, era el color con el SIGNIFICADO
// equivocado. Una regla no lee significados; persigue el rastro mecánico que
// ese defecto deja siempre, un relleno de tono SIN alfa.
//
// 🪤 LA ALFA ES LA MITAD DE LA REGLA. `bg-tone-green/10` y `bg-tone-green` son
// el mismo tono y significan cosas opuestas: el relleno del badge contra un
// bloque. Un patrón que no distinga la alfa o no caza nada o lo caza todo.
//
// 🪤 SEIS TONOS, NO SOLO EL VERDE. En el hub `red` y `amber` quedaban fuera
// porque las insignias de recuento del menú eran bloques rojos legítimos. En el
// kit esas insignias las dibuja `AppShell` (pastilla `/20` y punto), así que en
// el código de un proyecto un tono sólido no tiene uso propio.
//
// EL PUNTO ES VOCABULARIO, NO EXCEPCIÓN. El único relleno sólido legítimo de un
// tono es el punto de estado, y el kit lo nombra: una propiedad `dot` cuyo valor
// es UNA sola clase `bg-tone-*` (`TONE_CLASSES[tone].dot`). Fuera de esa forma
// exacta, una serie de datos o una excepción real se marca a mano con
// `eslint-disable-next-line` y su razón, que se vea en el diff.
// =============================================================================

import { FILL_PROPS, TONES, findAll, rule, scanStrings } from "./_shared.mjs";

/** `(?![\w/-])`: sin alfa detrás. Con ella es el relleno de un badge, no un bloque. */
const SOLID_TONE = new RegExp(String.raw`(?<![\w-])(?:${FILL_PROPS})-tone-(?:${TONES})(?![\w/-])`);
const DOT = new RegExp(String.raw`^bg-tone-(?:${TONES})$`);

/** ¿Es el valor de una propiedad `dot` que es exactamente un punto de estado? */
function isStatusDot(node) {
  const parent = node.parent;
  if (node.type !== "Literal" || parent?.type !== "Property" || parent.value !== node) return false;
  const key = parent.key.type === "Identifier" ? parent.key.name : parent.key.value;
  return key === "dot" && DOT.test(node.value.trim());
}

export const noSolidStatusFill = rule({
  description:
    "Un tono de estado no es una superficie: va en badges (`bg-tone-*/10`), deltas y la cifra de un KPI, nunca como relleno sólido.",
  messages: {
    solid:
      "`{{util}}`: un tono de estado como relleno SÓLIDO. Los tonos dicen el estado de algo en un badge, " +
      "un delta o la cifra de un KPI, nunca como superficie, botón o bloque (§7.5). El badge es " +
      "`bg-tone-*/10` + `border-tone-*/20` y el punto lo dibuja `<StatusBadge>`; el progreso o lo " +
      "\"hecho\" lo dice el acento (`ac-*`). Si es una serie de datos o una excepción real, márcala con " +
      "`eslint-disable-next-line` y su razón.",
  },
  create: (context) =>
    scanStrings(context, (raw, node) => (isStatusDot(node) ? [] : findAll(raw, [{ re: SOLID_TONE, messageId: "solid" }]))),
});
