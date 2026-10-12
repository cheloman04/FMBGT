import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The /admin theme (app/admin/theme.css) against the kit contract
// (KIGARU_DASHBOARD_STANDARD_V1.md §7.1) and WCAG AA. Changing a value that
// drops a pair below 4.5:1 fails here, not on someone's phone.

const root = process.cwd();
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const themeCss = strip(readFileSync(join(root, 'app/admin/theme.css'), 'utf8'));
const kitCss = strip(readFileSync(join(root, 'components/kit/kit.css'), 'utf8'));

/** The declarations of the first `[data-kit] {` block: the theme itself, not the bridge. */
function themeTokens(): Record<string, string> {
  const block = themeCss.match(/\[data-kit\]\s*\{([^}]*)\}/)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

type Rgb = [number, number, number];

/** `#rrggbb`, `rgb(r g b / a)` or an `r g b` triplet. Alpha comes back apart. */
function parse(value: string): { rgb: Rgb; alpha: number } {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb, alpha: 1 };
  const nums = value.replace(/^rgb\(|\)$/g, '').split(/[\s/]+/).filter(Boolean).map(Number);
  return { rgb: nums.slice(0, 3) as Rgb, alpha: nums[3] ?? 1 };
}

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: Rgb, alpha: number, bg: Rgb) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;

const t = themeTokens();
const color = (name: string) => {
  const raw = t[name];
  if (!raw) throw new Error(`${name} is not defined in app/admin/theme.css`);
  return parse(raw);
};
const canvas = color('--background').rgb;
const surface = over(color('--surface').rgb, color('--surface').alpha, canvas);

describe('app/admin/theme.css', () => {
  it('defines every token the kit reads without a fallback', () => {
    const own = new Set([...kitCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
    const required = [...kitCss.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)]
      .filter((m) => !m[2])
      .map((m) => m[1])
      .filter((name) => !own.has(name));
    // The shell reads the sidebar tokens through its own utilities.
    required.push('--s-bg', '--s-bdr', '--s-text', '--s-hi', '--s-hov');
    expect([...new Set(required)].filter((name) => !(name in t))).toEqual([]);
  });

  it('is dark, with no toggle (D2)', () => {
    expect(t['--scheme']).toBe('dark');
  });

  it.each([
    ['--foreground'],
    ['--fg-secondary'],
    ['--fg-muted'],
    ['--fg-eyebrow'],
  ])('%s reads at AA on the canvas and on a surface', (name) => {
    const fg = color(name).rgb;
    expect(ratio(fg, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(fg, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['gray', 'blue', 'green', 'amber', 'yellow', 'red'])('tone-%s reads at AA on its own badge', (tone) => {
    const fg = color(`--tone-${tone}`).rgb;
    // The badge is the tone at 10% over whatever is behind it.
    expect(ratio(fg, over(fg, 0.1, canvas))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(fg, over(fg, 0.1, surface))).toBeGreaterThanOrEqual(4.5);
  });

  it('accent: ink on the primary fill, active text, and the focus ring are visible', () => {
    expect(ratio(color('--a-contrast').rgb, color('--a500').rgb)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(color('--a300').rgb, canvas)).toBeGreaterThanOrEqual(4.5);
    // Non-text (focus ring): WCAG 1.4.11 asks for 3:1.
    expect(ratio(color('--a500').rgb, canvas)).toBeGreaterThanOrEqual(3);
  });

  it('sidebar: idle and active entries read at AA', () => {
    expect(ratio(color('--s-text').rgb, color('--s-bg').rgb)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(color('--s-hi').rgb, color('--s-hov').rgb)).toBeGreaterThanOrEqual(4.5);
  });
});
