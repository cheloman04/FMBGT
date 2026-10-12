import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — the barrel resolves to the module nav.ts uses.
vi.mock('@/components/kit', () => import('../../../../components/kit/nav'));

const { ADMIN_NAV } = await import('./nav');

describe('ADMIN_NAV', () => {
  it('keeps the menu order', () => {
    expect(ADMIN_NAV.map((item) => item.label)).toEqual([
      'Dashboard',
      'Manual booking',
      'Financial log',
      'Referrals',
      'Gift cards',
    ]);
  });

  it('only the area root matches exactly', () => {
    expect(ADMIN_NAV.filter((item) => 'exact' in item && item.exact).map((item) => item.href)).toEqual(['/admin']);
  });

  it('every entry is a real page of the panel', () => {
    const panel = join(process.cwd(), 'app/admin/(panel)');
    const missing = ADMIN_NAV.map((item) => item.href).filter(
      (href) => !existsSync(join(panel, href.replace(/^\/admin/, ''), 'page.tsx')),
    );
    expect(missing).toEqual([]);
  });
});
