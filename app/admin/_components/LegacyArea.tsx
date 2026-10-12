import type { ReactNode } from 'react';

/**
 * TEMPORARY wrapper for /admin pages not yet migrated to the dashboard kit
 * (phase 2 of the pilot). Migrating a page means deleting its <LegacyArea> and
 * adding its folder to `kitLint` in eslint.config.mjs; when no page uses this
 * any more, delete it together with the bridge block in `app/admin/theme.css`.
 *
 * `dark` turns on the `dark:` variants those pages were written with (the
 * admin is dark-only now, D2); `admin-legacy` points their shadcn variables
 * (`--card`, `--muted`, `--border`…) at the admin theme.
 */
export function LegacyArea({ children }: { children: ReactNode }) {
  return <div className="dark admin-legacy">{children}</div>;
}
