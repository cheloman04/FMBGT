import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackCtaClick } from './analytics';

describe('CTA tracking', () => {
  beforeEach(() => {
    const gtag = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '' },
      gtag,
    });
  });

  it('emits exactly one CTA event per handler call', () => {
    trackCtaClick('Book a Guide', 'hero');

    const gtag = window.gtag as ReturnType<typeof vi.fn>;
    const eventNames = gtag.mock.calls.map((call) => call[1]);
    expect(eventNames.filter((name) => name === 'cta_clicked')).toHaveLength(1);
  });
});
