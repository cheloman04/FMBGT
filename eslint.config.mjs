import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { kitLint } from "./components/kit/eslint/index.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The dashboard standard's lint (KIGARU_DASHBOARD_STANDARD_V1.md §10.1),
  // shipped with the kit copy. Phase 2 migrated every /admin page to the kit,
  // so it covers all of the admin: its pages, its pure logic and the admin
  // APIs that render nothing but are part of the kit's flow (badges, the inbox
  // proxy).
  //
  // No brackets in these patterns: minimatch reads `[id]` as a character class
  // and the entry would cover zero files (kitLint refuses them). `**` crosses
  // the [id] folders without naming them.
  ...kitLint({
    files: [
      "app/admin/**/*.ts",
      "app/admin/**/*.tsx",
      "lib/admin/**/*.ts",
      "app/api/admin/badges/*.ts",
      "app/api/admin/conversations/**/*.ts",
      "app/api/admin/notifications/**/*.ts",
    ],
  }),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
