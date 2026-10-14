import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { kitLint } from "./components/kit/eslint/index.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The dashboard standard's lint (KIGARU_DASHBOARD_STANDARD_V1.md §10.1),
  // shipped with the kit copy. It is a RATCHET: `files` lists only what is
  // already migrated to the kit, and widening it IS the migration. Every /admin
  // page still inside <LegacyArea> stays out until its own PR.
  //
  // No brackets in these patterns: minimatch reads `[id]` as a character class
  // and the entry would cover zero files (kitLint refuses them). Write `*`.
  ...kitLint({
    files: [
      "app/admin/layout.tsx",
      "app/admin/_components/**/*.tsx",
      "app/admin/(panel)/layout.tsx",
      "app/admin/(panel)/loading.tsx",
      "app/admin/(panel)/error.tsx",
      "app/admin/(panel)/_components/**/*.ts",
      "app/admin/(panel)/_components/**/*.tsx",
      // Phase 2, step 2: the three small pages.
      "app/admin/(panel)/gift-cards/**/*.tsx",
      "app/admin/(panel)/referrals/**/*.tsx",
      "app/admin/(panel)/fin-log/**/*.tsx",
      // Phase 2, step 3a: the dashboard page and its overview (AdminClient,
      // with the lists, stays out until 3b/3c).
      "app/admin/(panel)/page.tsx",
      "lib/admin/**/*.ts",
      // Phase 2, step 3b-1: the bookings list; step 4a: the booking page and
      // its edit page (bookings/[id]/…, written with `*` below), so all of it.
      "app/admin/(panel)/bookings/**/*.tsx",
      "app/api/admin/badges/*.ts",
      // Phase 2, step 3c-1: the leads list. Step 3c-2: the Trash.
      "app/admin/(panel)/leads/**/*.tsx",
      "app/admin/(panel)/trash/**/*.tsx",
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
