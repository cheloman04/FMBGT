// =============================================================================
// La config ESLint del kit (KIGARU_DASHBOARD_STANDARD_V1.md §10.1)
// =============================================================================
// Viaja con la copia del kit (`components/kit/eslint/`) y el proyecto la monta
// en su `eslint.config.mjs`:
//
//   import { kitLint } from "./components/kit/eslint/index.mjs";
//
//   export default defineConfig([
//     ...nextVitals,
//     ...nextTs,
//     ...kitLint({
//       // El trinquete: las carpetas YA migradas. Ampliar esta lista ES la migración.
//       files: ["app/admin/gift-cards/**/*.tsx"],
//     }),
//   ]);
//
// Devuelve tres bloques:
//   1. `kigaru/plugin` — registra el plugin en TODOS los ficheros, sin encender
//      nada. 🪤 En el hub el plugin vivía en un bloque que ignoraba los tests, y
//      un test alcanzado solo por otro bloque se quedaba sin plugin: eslint
//      abortaba el fichero entero con un error de CONFIG. Registrado en global,
//      un `eslint-disable-next-line kigaru/…` resuelve en cualquier fichero.
//   2. `kigaru/kit` — las reglas sobre la propia copia del kit. Pasa en
//      senzai-skills; aquí demuestra que la copia sigue pasando.
//   3. `kigaru/ratchet` — las reglas sobre `files`, menos los tests (sus
//      fixtures son A PROPÓSITO las cadenas prohibidas).
//
// Sin dependencias fuera de este directorio: es una copia, no un paquete.
// =============================================================================

import { noDarkVariant } from "./no-dark-variant.mjs";
import { noDuplicateColorUtility } from "./no-duplicate-color-utility.mjs";
import { noEmojiInUi } from "./no-emoji-in-ui.mjs";
import { noForeignThemeUtility } from "./no-foreign-theme-utility.mjs";
import { noOffPaletteFill } from "./no-off-palette-fill.mjs";
import { noRawPaletteColor } from "./no-raw-palette-color.mjs";
import { noSolidStatusFill } from "./no-solid-status-fill.mjs";

/** La versión del kit. Un test la ata a `package.json`. */
export const KIT_VERSION = "0.15.0";

export const plugin = {
  meta: { name: "kigaru", version: KIT_VERSION },
  rules: {
    "no-emoji-in-ui": noEmojiInUi,
    "no-raw-palette-color": noRawPaletteColor,
    "no-off-palette-fill": noOffPaletteFill,
    "no-solid-status-fill": noSolidStatusFill,
    "no-duplicate-color-utility": noDuplicateColorUtility,
    "no-dark-variant": noDarkVariant,
    "no-foreign-theme-utility": noForeignThemeUtility,
  },
};

const DIALOG =
  "Diálogo nativo en el área de dashboard: bloquea la página, no lleva la piel y no se puede probar. " +
  "Para confirmar, `useConfirm()` del kit (`danger: true` si destruye); para avisar, un aviso inline (D5, §8.5).";
const DIALOGS = ["confirm", "alert", "prompt"];

/**
 * Las reglas del estándar, todas en `error`.
 *
 * 🪤 `no-restricted-globals` y `no-restricted-properties` son reglas del núcleo
 * de ESLint: si el proyecto las configura también para los mismos ficheros, en
 * flat config gana el ÚLTIMO bloque y sus opciones SUSTITUYEN a estas, no se
 * suman. Monta `kitLint()` después y repite ahí lo que necesites.
 */
export const KIT_RULES = {
  "kigaru/no-emoji-in-ui": "error",
  "kigaru/no-raw-palette-color": "error",
  "kigaru/no-off-palette-fill": "error",
  "kigaru/no-solid-status-fill": "error",
  "kigaru/no-duplicate-color-utility": "error",
  "kigaru/no-dark-variant": "error",
  "kigaru/no-foreign-theme-utility": "error",
  // `confirm()` a secas…
  "no-restricted-globals": ["error", ...DIALOGS.map((name) => ({ name, message: DIALOG }))],
  // …y `window.confirm()`, que `no-restricted-globals` no ve.
  "no-restricted-properties": [
    "error",
    ...["window", "globalThis", "self"].flatMap((object) => DIALOGS.map((property) => ({ object, property, message: DIALOG }))),
  ],
};

/** Los tests quedan fuera del trinquete: sus fixtures son lo prohibido, a propósito. */
const TEST_FILES = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"];

/**
 * 🪤 Un patrón con corchetes cubre CERO ficheros: minimatch lee `[id]` como
 * CLASE DE CARACTERES (una `i` o una `d`), así que `app/admin/bookings/[id]/**`
 * no casa con la carpeta `[id]` y el lint dice "0 errores", igual que si todo
 * estuviera limpio. Se rechaza al cargar la config en vez de descubrirlo tarde.
 */
function assertPattern(pattern) {
  if (typeof pattern !== "string") {
    throw new TypeError(`kitLint: cada entrada de files/ignores es un patrón (cadena); llegó ${JSON.stringify(pattern)}.`);
  }
  if (/(?<!\\)\[/.test(pattern)) {
    throw new Error(
      `kitLint: "${pattern}" lleva corchetes. minimatch los lee como CLASE DE CARACTERES ("[id]" casa con UNA ` +
        `"i" o una "d"), así que el patrón cubriría cero ficheros y el lint diría "0 errores". Escribe "*" en ese ` +
        `tramo: "${pattern.replace(/\[[^\]]*\]/g, "*")}".`,
    );
  }
}

/**
 * La config del kit para el `eslint.config.mjs` de un proyecto.
 *
 * @param {object} [options]
 * @param {string[]} [options.files] El terreno ya migrado (el trinquete). Sin corchetes.
 * @param {string[]} [options.ignores] Lo que se excluye dentro de `files`, además de los tests.
 * @param {string} [options.kitDir] Dónde está la copia del kit (la de `kit:sync --to`).
 */
export function kitLint({ files = [], ignores = [], kitDir = "components/kit" } = {}) {
  [...files, ...ignores].forEach(assertPattern);
  const dir = kitDir.replace(/^\.\//, "").replace(/\/+$/, "");
  const configs = [
    { name: "kigaru/plugin", plugins: { kigaru: plugin } },
    { name: "kigaru/kit", files: [`${dir}/**/*.ts`, `${dir}/**/*.tsx`], rules: KIT_RULES },
  ];
  if (files.length) {
    configs.push({ name: "kigaru/ratchet", files, ignores: [...TEST_FILES, ...ignores], rules: KIT_RULES });
  }
  return configs;
}
