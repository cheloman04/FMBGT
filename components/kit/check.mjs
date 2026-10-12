#!/usr/bin/env node
// =============================================================================
// kit:check — ¿la copia del kit sigue idéntica a lo que se sincronizó?
// =============================================================================
// Viaja DENTRO de la copia (`components/kit/check.mjs`), así que el CI del
// proyecto lo corre sin tener senzai-skills:
//
//   node components/kit/check.mjs
//
// Compara cada fichero con el hash de `kit.manifest.json`. Una edición a mano, un
// fichero borrado o uno añadido es deriva: sale con código 1 y dice cuál.
// La copia no se edita; el arreglo es un PR a senzai-skills y `kit:sync`.
// =============================================================================

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST = "kit.manifest.json";

function hashContent(buf) {
  return createHash("sha256").update(buf.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out.sort();
}

/** Devuelve la lista de problemas; vacía si la copia está intacta. */
export function check(dir) {
  const manifestPath = join(dir, MANIFEST);
  if (!existsSync(manifestPath)) return [`falta ${MANIFEST}: la carpeta no viene de kit:sync`];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const problems = [];
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const file = join(dir, rel);
    if (!existsSync(file)) problems.push(`borrado: ${rel}`);
    else if (hashContent(readFileSync(file)) !== hash) problems.push(`editado: ${rel}`);
  }
  for (const rel of listFiles(dir)) {
    if (rel !== MANIFEST && !(rel in manifest.files)) problems.push(`añadido: ${rel}`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = dirname(fileURLToPath(import.meta.url));
  const problems = check(dir);
  if (problems.length) {
    console.error(
      `kit:check — la copia del kit no coincide con su manifiesto:\n  ${problems.join("\n  ")}\n` +
        "La copia no se edita: cambia el kit en senzai-skills (PR) y vuelve a correr kit:sync.",
    );
    process.exit(1);
  }
  const { version, source } = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
  console.log(`kit:check — kit/dashboard ${version} (${source.commit?.slice(0, 7) ?? "sin git"}) intacto.`);
}
