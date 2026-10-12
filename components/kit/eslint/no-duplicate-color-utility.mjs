// =============================================================================
// kigaru/no-duplicate-color-utility — dos valores para el mismo color, y gana
// el orden del CSS. Portada del hub (senzai-v1).
// =============================================================================
// El kit no usa tailwind-merge (§6.3): cuando una lista de clases lleva dos
// utilidades para la misma propiedad de color, cuál gana no lo decide la que
// se escribió última sino el orden en que Tailwind emite el CSS. En el hub el
// peor caso fue un `bg-white` junto a `bg-[var(--surface)]` en las clases de
// los campos: TODOS los inputs de la app se pintaron blancos sobre fondo
// oscuro. Compilaba, pasaba el lint y los tests; se vio en un teléfono.
//
// 🪤 SOLO EMPAREJA COLORES. Un primer intento en el hub metía también las
// utilidades no cromáticas, y `text-center` chocaba con `text-xs`, `ring-1` con
// `ring-inset`: 200 falsos positivos. Si el valor no es demostrablemente un
// color, no se empareja.
//
// 🪤 Y LA ALFA SE ESCRIBE DE VARIAS MANERAS: `/70`, `/[0.04]`, `/(--a)`. El
// barrido original del hub solo entendía la primera, y por eso 47 valores
// siguieron en pie en 25 ficheros.
//
// En el kit, además de la paleta de Tailwind, son color los tokens del kit
// (`fg`, `fg-2`, `surface`, `hairline`, `ac-*`, `tone-*`, `nav-*`…) y los de
// shadcn: `text-fg text-fg-2` es exactamente el mismo defecto.
// =============================================================================

import { GREYS, HUES, TONES, rule } from "./_shared.mjs";

/** Quita la alfa final en cualquiera de sus formas. */
const stripAlpha = (v) => v.replace(/\/(?:\[[^\]]*\]|\([^)]*\)|[\d.]+%?)$/, "");

const KIT_COLOR = new RegExp(
  String.raw`^(?:canvas|fg|fg-2|fg-muted|fg-disabled|surface|surface-muted|hairline|ac-\d{2,3}|ac-contrast|tone-(?:${TONES})|nav-(?:bg|border|text|hi|hover))$`,
);
const SHADCN_COLOR =
  /^(?:background|foreground|(?:card|popover|primary|secondary|muted|accent|destructive)(?:-foreground)?|border|input|ring|chart-[1-5]|sidebar(?:-[a-z]+)*|accent-\d{2,3})$/;
const PALETTE = new RegExp(String.raw`^(?:${GREYS}|${HUES})-\d{2,3}$`);

function isColorValue(v) {
  if (!v) return false;
  const bare = stripAlpha(v);
  if (bare.startsWith("[") && bare.endsWith("]")) {
    return /^(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|var\(|color-mix\()/.test(bare.slice(1, -1));
  }
  if (/^(?:inherit|current|transparent|white|black)$/.test(bare)) return true;
  return PALETTE.test(bare) || KIT_COLOR.test(bare) || SHADCN_COLOR.test(bare);
}

// Prefijos que a veces llevan color y a veces no (`text-sm`, `border-2`), y
// prefijos que siempre lo llevan.
const MAYBE_COLOR = ["text", "border", "divide", "ring", "ring-offset", "outline", "shadow", "inset-shadow", "inset-ring", "bg"];
const ALWAYS_COLOR = ["fill", "stroke", "placeholder", "caret", "accent", "decoration", "from", "via", "to"];
const SIDE = "(?:-(?:t|r|b|l|x|y|s|e|tl|tr|br|bl|ss|se|ee|es))?";

/** La propiedad de color sobre la que actúa una utilidad, o null si no es color. */
function colorProperty(token) {
  const u = token.replace(/^!|!$/g, "");
  for (const prefix of ALWAYS_COLOR) {
    if (u.startsWith(prefix + "-") && isColorValue(u.slice(prefix.length + 1))) return prefix;
  }
  for (const prefix of MAYBE_COLOR) {
    const m = u.match(new RegExp(`^${prefix}${SIDE}-(.+)$`));
    if (!m || !isColorValue(m[1])) continue;
    return u.slice(0, u.length - m[1].length - 1);
  }
  return null;
}

/**
 * ¿Lista de clases o prosa? Toda cadena del fichero llega aquí; sin esta criba
 * "copied from the brief to the plan" se analizaría en busca de utilidades.
 */
function looksLikeClassList(tokens) {
  if (tokens.length < 2) return false;
  return tokens.filter((t) => /[-:/[]/.test(t)).length / tokens.length >= 0.6;
}

/** Colisiones dentro de UNA lista: misma cadena de variantes, misma propiedad. */
function collisionsIn(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!looksLikeClassList(tokens)) return [];
  const seen = new Map();
  const hits = [];
  for (const token of tokens) {
    // Las variantes se separan por `:` fuera de corchetes (`[&:hover]:bg-x`).
    const parts = token.split(/:(?![^[]*\])/);
    const property = colorProperty(parts[parts.length - 1]);
    if (!property) continue;
    const key = parts.slice(0, -1).join(":") + "|" + property;
    if (seen.has(key)) hits.push({ first: seen.get(key), second: token });
    seen.set(key, token);
  }
  return hits;
}

/** Las hojas de una cadena `"a" + "b" + "c"`, o null si alguna no es literal. */
function stringLeaves(node) {
  if (node.type === "Literal" && typeof node.value === "string") return [node.value];
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = stringLeaves(node.left);
    const right = stringLeaves(node.right);
    return left && right ? [...left, ...right] : null;
  }
  return null;
}

const isConcat = (node) => node?.type === "BinaryExpression" && node.operator === "+";

export const noDuplicateColorUtility = rule({
  description:
    "Una sola utilidad por propiedad de color en cada lista de clases: sin tailwind-merge, la segunda la resuelve el orden del CSS.",
  messages: {
    duplicate:
      "`{{ first }}` y `{{ second }}` pintan la MISMA propiedad de color. Sin tailwind-merge (§6.3), cuál " +
      "gana lo decide el orden en que Tailwind emite el CSS, no el orden en que se escribieron. Deja una " +
      "sola; si depende de un estado, escribe una constante COMPLETA por estado en vez de encadenar overrides.",
  },
  create(context) {
    const check = (node, text) => {
      for (const hit of collisionsIn(text)) context.report({ node, messageId: "duplicate", data: hit });
    };
    return {
      // Una cadena de `+` se analiza ENTERA y solo desde su raíz: en el hub el
      // claro y el oscuro de las clases de campo vivían en literales distintos
      // de la misma concatenación, y mirarlos por separado dejó pasar el fallo.
      BinaryExpression(node) {
        if (!isConcat(node) || isConcat(node.parent)) return;
        const leaves = stringLeaves(node);
        if (leaves) check(node, leaves.join(" "));
      },
      Literal(node) {
        if (typeof node.value !== "string" || isConcat(node.parent)) return;
        check(node, node.value);
      },
      // Las partes ESTÁTICAS de una plantilla se aplican todas a la vez, así
      // que van juntas. Lo interpolado no: las ramas de un ternario se excluyen
      // entre sí y compararlas daría falsos positivos.
      TemplateLiteral(node) {
        check(node, node.quasis.map((q) => q.value.cooked ?? "").join(" "));
      },
    };
  },
});
