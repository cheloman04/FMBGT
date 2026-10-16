// The shells every customer email is built on, ported from the n8n templates they
// replace: a dark one for booking emails (confirmation, balance) and a light one
// for marketing (lead follow-ups, review requests).
//
// The hub has no templates and never touches the HTML, except to replace
// `{{unsubscribe_url}}` with the one-click unsubscribe link (contract §5.3). A
// marketing email MUST carry that marker in its HTML and its text, plus the
// business's postal address (CAN-SPAM): `marketingShell` and `marketingText` put
// both in the footer, so no template can forget them.
//
// No imports on purpose: the tests load this as is.

export const BRAND = {
  name: 'Florida Mountain Bike Guides',
  tagline: 'Guided Trail Experiences',
  logoUrl: 'https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png',
  // The address the n8n confirmation footer has always used (the Sanford meeting
  // point). CAN-SPAM needs the sender's valid postal address in every marketing
  // email: the owner confirms it before the marketing emails move to Kigaru.
  postalAddress: ['229 Magnolia Ave', 'Sanford, FL 32771'],
} as const;

/** The marker the hub swaps for the one-click unsubscribe link (contract §5.3). */
export const UNSUBSCRIBE_MARKER = '{{unsubscribe_url}}';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text that goes inside HTML. Everything from a booking or a lead goes through this. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** A URL for an `href`: only http(s), escaped. Anything else becomes `#`. */
export function href(url: string | null | undefined): string {
  if (!url) return '#';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? esc(parsed.toString()) : '#';
  } catch {
    return '#';
  }
}

/** A hidden line some inboxes show next to the subject. */
function preheader(text: string | undefined): string {
  if (!text) return '';
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(text)}</div>`;
}

function documentOpen(title: string, background: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${background};font-family:Arial,Helvetica,sans-serif;color:#eaf3ee;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">`;
}

const DOCUMENT_CLOSE = `</body>
</html>`;

// -----------------------------------------------------------------------------
// The dark shell: booking emails (transactional)
// -----------------------------------------------------------------------------

export type DarkShellInput = {
  title: string;
  preheader?: string;
  banner?: { src: string; alt: string };
  /** The rows between the banner and the footer, already HTML (`<tr>…</tr>`). */
  rows: string;
};

export function darkShell({ title, preheader: pre, banner, rows }: DarkShellInput): string {
  return `${documentOpen(title, '#07110d')}
${preheader(pre)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07110d;margin:0;padding:0;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#0b1712;border:1px solid #173126;border-radius:20px;overflow:hidden;">
<tr><td style="padding:18px 24px;background:linear-gradient(180deg,#101d17 0%,#0b1712 100%);border-bottom:1px solid #173126;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="72" valign="middle"><img src="${BRAND.logoUrl}" width="58" alt="${esc(BRAND.name)}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:50%;" /></td>
<td valign="middle"><div style="font-size:28px;line-height:32px;font-weight:700;color:#f4fbf7;">${esc(BRAND.name)}</div>
<div style="font-size:12px;line-height:18px;color:#89a296;letter-spacing:2px;text-transform:uppercase;">${esc(BRAND.tagline)}</div></td>
</tr></table>
</td></tr>
${banner ? `<tr><td style="background:#0b1712;padding:0;"><img src="${href(banner.src)}" width="640" alt="${esc(banner.alt)}" style="display:block;width:100%;max-width:640px;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>` : ''}
${rows}
<tr><td style="padding:26px 24px;background:#08120e;border-top:1px solid #173126;text-align:center;">
<div style="font-size:15px;line-height:22px;font-weight:700;color:#f4fbf7;">${esc(BRAND.name)}</div>
<div style="font-size:13px;line-height:22px;color:#8ca499;padding-top:6px;">${BRAND.postalAddress.map(esc).join('<br />')}</div>
<div style="font-size:13px;line-height:22px;color:#8ca499;padding-top:14px;">Need help? Reply to this email and we'll point you in the right direction.</div>
</td></tr>
</table>
</td></tr>
</table>
${DOCUMENT_CLOSE}`;
}

/** The intro block of the dark shell: eyebrow, headline, paragraph. */
export function darkHero(eyebrow: string, headline: string, intro: string): string {
  return `<tr><td style="padding:32px 28px 12px 28px;background:#0b1712;">
<div style="font-size:14px;line-height:20px;font-weight:700;letter-spacing:2px;color:#f0b06a;text-transform:uppercase;">${esc(eyebrow)}</div>
<div style="font-size:34px;line-height:40px;font-weight:700;color:#f4fbf7;padding-top:8px;">${esc(headline)}</div>
<div style="font-size:16px;line-height:28px;color:#a9beb3;padding-top:14px;">${esc(intro)}</div>
</td></tr>`;
}

/** A panel of label/value rows (Booking Details). Values are escaped here. */
export function darkDetails(title: string, rows: Array<[string, string | null | undefined]>, highlight?: [string, string]): string {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
  const cells = shown
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #183126;font-size:14px;line-height:22px;color:#89a296;width:42%;">${esc(label)}</td>` +
        `<td style="padding:10px 0;border-bottom:1px solid #183126;font-size:15px;line-height:22px;color:#f4fbf7;font-weight:600;">${esc(value)}</td></tr>`,
    )
    .join('\n');
  const last = highlight
    ? `<tr><td style="padding:10px 0 0 0;font-size:14px;line-height:22px;color:#89a296;">${esc(highlight[0])}</td>` +
      `<td style="padding:10px 0 0 0;font-size:18px;line-height:24px;color:#7fe0b0;font-weight:700;">${esc(highlight[1])}</td></tr>`
    : '';
  return `<tr><td style="padding:18px 28px;background:#0b1712;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f1b16;border:1px solid #1b3529;border-radius:18px;">
<tr><td style="padding:24px;">
<div style="font-size:24px;line-height:30px;font-weight:700;color:#f4fbf7;padding-bottom:20px;">${esc(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${cells}
${last}
</table>
</td></tr>
</table>
</td></tr>`;
}

/** A call to action on the dark shell: title, line, green button. */
export function darkCta(title: string, body: string, label: string, url: string): string {
  return `<tr><td style="padding:6px 28px 18px 28px;background:#0b1712;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#10241c 0%,#0e1d18 50%,#173326 100%);border:1px solid #244937;border-radius:18px;">
<tr><td style="padding:24px;text-align:center;">
<div style="font-size:22px;line-height:28px;font-weight:700;color:#f4fbf7;">${esc(title)}</div>
<div style="font-size:15px;line-height:24px;color:#a8beb2;padding-top:8px;padding-bottom:18px;">${esc(body)}</div>
<a href="${href(url)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:999px;">${esc(label)}</a>
</td></tr>
</table>
</td></tr>`;
}

/** A short note line on the dark shell. `html` is trusted markup built by the caller. */
export function darkNote(html: string): string {
  return `<tr><td style="padding:0 28px 18px 28px;background:#0b1712;"><div style="font-size:13px;line-height:20px;color:#a9beb3;">${html}</div></td></tr>`;
}

// -----------------------------------------------------------------------------
// The light shell: marketing (lead follow-ups, review requests)
// -----------------------------------------------------------------------------

export type MarketingEmail = {
  title: string;
  preheader?: string;
  /** The line under the brand name in the header ("MTB Guided Experiences"). */
  tagline: string;
  banner: { src: string; alt: string };
  eyebrow: string;
  headline: string;
  intro: string;
  details?: Array<[string, string]>;
  value: { title: string; paragraphs: string[] };
  /** A light card before the call to action. */
  confidence?: { title: string; body: string };
  cta: { title: string; body: string; label: string; url: string };
  /** A light card after the call to action. */
  closing?: { title: string; body: string };
  footer: { line1: string; line2: string };
};

export function marketingShell(e: MarketingEmail): string {
  const details = e.details?.length
    ? `<tr><td style="padding:18px 28px;background:#edf3ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #d6e0d9;border-radius:18px;">
<tr><td style="padding:24px;">
<div style="font-size:26px;font-weight:700;color:#1d221f;padding-bottom:20px;">Your Ride Details</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${e.details
  .map(([label, value], i, all) => {
    const line = i < all.length - 1 ? 'padding:12px 0;border-bottom:1px solid #e4ebe6;' : 'padding:12px 0 0 0;';
    return `<tr><td style="${line}color:#5b6a62;width:42%;">${esc(label)}</td><td style="${line}color:#1c211e;font-weight:700;">${esc(value)}</td></tr>`;
  })
  .join('\n')}
</table>
</td></tr>
</table>
</td></tr>`
    : '';
  const lightCard = (card: { title: string; body: string }, last = false) => `<tr><td style="padding:0 28px ${last ? '28px' : '18px'} 28px;background:#edf3ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7faf8;border:1px solid #d6e0d9;border-radius:18px;">
<tr><td style="padding:22px;text-align:center;">
<div style="font-size:20px;line-height:28px;font-weight:700;color:#1c211e;">${esc(card.title)}</div>
<div style="font-size:15px;line-height:26px;color:#4f5c55;padding-top:8px;">${esc(card.body)}</div>
</td></tr>
</table>
</td></tr>`;

  return `${documentOpen(e.title, '#07110d')}
${preheader(e.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07110d;margin:0;padding:0;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#edf3ef;border:1px solid #cfd9d2;border-radius:20px;overflow:hidden;">
<tr><td style="padding:18px 24px;background:#062117;border-bottom:1px solid #0e3a29;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="72" valign="middle"><img src="${BRAND.logoUrl}" width="58" style="display:block;border-radius:50%;" alt="${esc(BRAND.name)}" /></td>
<td valign="middle"><div style="font-size:30px;line-height:34px;font-weight:700;color:#ffffff;">${esc(BRAND.name)}</div>
<div style="font-size:12px;line-height:18px;color:#c2d6cc;letter-spacing:2px;text-transform:uppercase;">${esc(e.tagline)}</div></td>
</tr></table>
</td></tr>
<tr><td style="background:#062117;padding:0;"><img src="${href(e.banner.src)}" width="640" alt="${esc(e.banner.alt)}" style="display:block;width:100%;max-width:640px;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>
<tr><td style="padding:34px 28px 14px 28px;background:#edf3ef;">
<div style="font-size:14px;line-height:20px;font-weight:700;letter-spacing:2px;color:#9a5d1c;text-transform:uppercase;">${esc(e.eyebrow)}</div>
<div style="font-size:40px;line-height:46px;font-weight:700;color:#1b1f1c;padding-top:10px;">${esc(e.headline)}</div>
<div style="font-size:17px;line-height:30px;color:#46534c;padding-top:16px;">${esc(e.intro)}</div>
</td></tr>
${details}
<tr><td style="padding:0 28px 18px 28px;background:#edf3ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #d6e0d9;border-radius:18px;">
<tr><td style="padding:24px;">
<div style="font-size:24px;font-weight:700;color:#1c211e;padding-bottom:14px;">${esc(e.value.title)}</div>
${e.value.paragraphs.map((p, i) => `<div style="font-size:17px;line-height:30px;color:#2f3934;${i > 0 ? 'padding-top:16px;' : ''}">${esc(p)}</div>`).join('\n')}
</td></tr>
</table>
</td></tr>
${e.confidence ? lightCard(e.confidence) : ''}
<tr><td style="padding:0 28px ${e.closing ? '18px' : '28px'} 28px;background:#edf3ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#062117;border:1px solid #0f3f2c;border-radius:18px;">
<tr><td style="padding:28px;text-align:center;">
<div style="font-size:26px;font-weight:700;color:#ffffff;">${esc(e.cta.title)}</div>
<div style="font-size:16px;line-height:28px;color:#c9d8d1;padding-top:10px;padding-bottom:20px;">${esc(e.cta.body)}</div>
<a href="${href(e.cta.url)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 30px;border-radius:999px;">${esc(e.cta.label)}</a>
</td></tr>
</table>
</td></tr>
${e.closing ? lightCard(e.closing, true) : ''}
<tr><td style="padding:26px 24px;background:#dde7e1;border-top:1px solid #cfd9d2;text-align:center;">
<div style="font-size:15px;font-weight:700;color:#1c211e;">${esc(BRAND.name)}</div>
<div style="font-size:13px;line-height:22px;color:#5f6b65;padding-top:6px;">${esc(e.footer.line1)}</div>
<div style="font-size:13px;line-height:22px;color:#5f6b65;padding-top:12px;">${esc(e.footer.line2)}</div>
<div style="font-size:12px;line-height:20px;color:#5f6b65;padding-top:14px;">${BRAND.postalAddress.map(esc).join(' &middot; ')}</div>
<div style="font-size:12px;line-height:20px;color:#5f6b65;padding-top:6px;">Don't want these emails? <a href="${UNSUBSCRIBE_MARKER}" style="color:#1c211e;text-decoration:underline;">Unsubscribe</a>. Booking emails will still reach you.</div>
</td></tr>
</table>
</td></tr>
</table>
${DOCUMENT_CLOSE}`;
}

/** The plain-text version of a marketing email, with the same footer obligations. */
export function marketingText(e: MarketingEmail): string {
  const lines = [
    e.headline,
    '',
    e.intro,
    ...(e.details?.length ? ['', ...e.details.map(([l, v]) => `${l}: ${v}`)] : []),
    '',
    e.value.title,
    ...e.value.paragraphs,
    ...(e.confidence ? ['', e.confidence.title, e.confidence.body] : []),
    '',
    `${e.cta.title}: ${e.cta.url}`,
    ...(e.closing ? ['', e.closing.title, e.closing.body] : []),
    '',
    '--',
    BRAND.name,
    e.footer.line2,
    BRAND.postalAddress.join(', '),
    `Unsubscribe: ${UNSUBSCRIBE_MARKER}`,
  ];
  return lines.join('\n');
}
