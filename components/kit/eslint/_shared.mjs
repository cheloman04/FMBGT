// =============================================================================
// Lo que comparten las reglas del kit (KIGARU_DASHBOARD_STANDARD_V1.md §10.1)
// =============================================================================
// Casi todas hacen lo mismo: buscar un patrón dentro de las cadenas que pueden
// acabar en el DOM y señalar el carácter exacto, no el arranque del nodo. Un
// error que apunta a la línea de arriba se ignora.
//
// Sin dependencias: este fichero viaja con la copia del kit
// (`components/kit/eslint/`) y el proyecto lo importa tal cual.
// =============================================================================

/** La alfa de Tailwind en sus tres formas: `/40`, `/[0.04]` y `/(--alpha)`. */
export const ALPHA = String.raw`(?:\/(?:\[[^\]]*\]|\([^)]*\)|[\d.]+%?))?`;

/**
 * Las propiedades de color que NO son texto. `border` con sus lados
 * (`border-t-white/10` es tan filete como `border-white/10`).
 */
export const FILL_PROPS =
  "bg|border(?:-[xytrblse])?|divide|ring-offset|ring|outline|fill|stroke|inset-shadow|inset-ring|shadow|from|via|to|accent|caret|decoration|placeholder";

/** Las familias neutras de Tailwind 4 (las cuatro últimas llegaron en la 4.2). */
export const GREYS = "slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe";

/** Las familias con tono. En el kit ninguna es un token: los estados son `tone-*`. */
export const HUES = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

/** Los seis tonos de estado del kit (`--tone-*`, §7.1). */
export const TONES = "gray|blue|green|amber|yellow|red";

/**
 * 🪤 Los bordes de una utilidad: `(?<![\w-])` delante y `(?![\w-])` detrás. Con
 * `\b` a secas, `text-white` casaría dentro de `text-white-smoke` (el `-` es
 * frontera de palabra) y `bg-card` dentro de `bg-card-foreground`. Delante sí se
 * admite `:` (variantes), `!` (importante) y espacio.
 */
export const util = (body) => String.raw`(?<![\w-])${body}(?![\w-])`;

/**
 * Recorre `raw` con varios patrones y devuelve los aciertos ordenados y sin
 * solapes: si dos patrones señalan los mismos caracteres, gana el primero de la
 * lista. Dos errores sobre el mismo carácter hacen que se ignoren los dos.
 *
 * @param {string} raw
 * @param {{ re: RegExp, messageId: string, data?: (m: RegExpExecArray) => Record<string, string> }[]} arms
 */
export function findAll(raw, arms) {
  const hits = [];
  for (const arm of arms) {
    const re = new RegExp(arm.re.source, arm.re.flags.includes("g") ? arm.re.flags : arm.re.flags + "g");
    for (const m of raw.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (hits.some((h) => start < h.end && h.start < end)) continue;
      hits.push({ start, end, messageId: arm.messageId, data: { util: m[0], ...(arm.data?.(m) ?? {}) } });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

/**
 * Los visitantes de una regla que busca patrones en las cadenas que se
 * renderizan: literales, partes estáticas de una plantilla y, si se pide, el
 * texto JSX. `find(raw, node)` recibe el TEXTO FUENTE del nodo (comillas
 * incluidas), así el desplazamiento se compara directamente con `range`.
 *
 * Los comentarios no son nodos que se visiten aquí: la prosa que EXPLICA lo
 * prohibido queda fuera por construcción.
 *
 * @param {import("eslint").Rule.RuleContext} context
 * @param {(raw: string, node: any) => ReturnType<typeof findAll>} find
 */
export function scanStrings(context, find, { jsxText = false } = {}) {
  const sourceCode = context.sourceCode;
  const visit = (node) => {
    const raw = sourceCode.getText(node);
    for (const hit of find(raw, node)) {
      context.report({
        loc: {
          start: sourceCode.getLocFromIndex(node.range[0] + hit.start),
          end: sourceCode.getLocFromIndex(node.range[0] + hit.end),
        },
        messageId: hit.messageId,
        data: hit.data,
      });
    }
  };
  const visitors = {
    Literal(node) {
      if (typeof node.value === "string") visit(node);
    },
    TemplateElement: visit,
  };
  if (jsxText) visitors.JSXText = visit;
  return visitors;
}

/** Un objeto-regla con la forma que pide ESLint, para no repetir el andamio. */
export function rule({ description, messages, create }) {
  return {
    meta: { type: "problem", docs: { description }, schema: [], messages },
    create,
  };
}
