#!/usr/bin/env node
// Lints the code that is under the dashboard standard — and only that.
//
// The full `npm run lint` still carries errors that predate the kit (landing,
// booking steps, the /admin pages not migrated yet), so CI can't gate on it.
// This gates on the part that must stay clean: every file where
// eslint.config.mjs turns the kit rules on (the kit copy and the `kitLint`
// ratchet), with ALL rules, not just the kit's.
//
// Which files those are is asked from ESLint itself, so this never drifts from
// the ratchet list in eslint.config.mjs.
import { ESLint } from "eslint";

const MARKER = "kigaru/no-raw-palette-color";

const eslint = new ESLint();
const results = await eslint.lintFiles(["."]);

const covered = [];
for (const result of results) {
  const config = await eslint.calculateConfigForFile(result.filePath);
  const level = config?.rules?.[MARKER];
  if ((Array.isArray(level) ? level[0] : level) === 2) covered.push(result);
}

if (covered.length === 0) {
  console.error(`lint:dashboard — no file has ${MARKER} on. Is kitLint() still in eslint.config.mjs?`);
  process.exit(1);
}

const failing = covered.filter((r) => r.errorCount + r.warningCount > 0);
if (failing.length) {
  const formatter = await eslint.loadFormatter("stylish");
  console.error(await formatter.format(failing));
  process.exit(1);
}
console.log(`lint:dashboard — ${covered.length} files under the dashboard standard, all clean.`);
