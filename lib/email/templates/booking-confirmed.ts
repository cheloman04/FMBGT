// booking_confirmed — "Your Adventure Starts Here" / "Your booking was updated".
//
// Ported from the n8n workflow "Booking Confirmation Email" (V3xvcaghauXufOix). It
// renders from the SAME payload the app has always sent to n8n (see
// N8N_CONFIRMATION_EMAIL_PAYLOAD.md), so every caller — the Stripe checkout, a free
// booking, a manual booking, an admin edit, a resend — builds one object and the
// switch in lib/email/send.ts decides who sends it.
//
// Deliberate differences from the n8n copy:
//   · "Deposito Paid" reads "Deposit paid".
//   · The "remaining balance will be charged to the card on file" note only shows
//     when there is a balance AND a scheduled card charge (n8n showed it on free
//     and cash bookings too, with "$0.00" or a card that doesn't exist).
//   · One recipient: the hub sends to the guest only (contract §5.1). The owner's
//     copies (bizdev4uai@, floridamountainbikeguides@) are replaced by /admin/emails.
//
// No imports but the shell: the tests load this as is.

import { BRAND, darkCta, darkDetails, darkHero, darkNote, darkShell, esc, href } from '../layout';

/** The n8n `booking_confirmed` payload (money in cents, date `YYYY-MM-DD`, time `HH:MM` Eastern). */
export type BookingConfirmedPayload = {
  booking_id: string;
  customer_email: string | null;
  customer_name?: string | null;
  deposit_amount?: number | null;
  remaining_balance?: number | null;
  remaining_balance_due_at?: string | null;
  total_amount?: number | null;
  location?: string | null;
  date?: string | null;
  time?: string | null;
  duration_hours?: number | null;
  participant_count?: number | null;
  trail_type?: string | null;
  skill_level?: string | null;
  meeting_location_name?: string | null;
  meeting_location_address?: string | null;
  meeting_location_url?: string | null;
  calendar_url?: string | null;
  // Manual bookings
  manual_booking?: boolean;
  payment_method?: string | null;
  waiver_required?: boolean;
  waiver_signed?: boolean;
  waiver_url?: string | null;
  // Free (gift card) bookings
  gift_card_covered?: boolean;
  // An admin edit: the email goes again with the changes on top
  updated?: boolean;
  changes_summary?: string[];
  [key: string]: unknown;
};

export function formatUsd(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) return null;
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

/** `2026-10-18` → "Saturday October 18th 2026", as the n8n template wrote it. */
export function formatLongDate(date: string | null | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? null;
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const month = d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${weekday} ${month} ${day}${suffix} ${d.getUTCFullYear()}`;
}

/** `13:30` (Eastern wall clock) → "1:30 PM ET". */
export function formatTourTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return `${time} ET`;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period} ET`;
}

export function firstName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? '').trim().split(/\s+/)[0];
  return first || null;
}

function trailLabel(trail: string | null | undefined): string | null {
  if (!trail) return null;
  if (trail === 'mtb') return 'Mountain Bike';
  if (trail === 'paved') return 'Paved Trail';
  return trail.charAt(0).toUpperCase() + trail.slice(1);
}

export function renderBookingConfirmed(data: BookingConfirmedPayload): { subject: string; html: string; text: string } {
  const name = firstName(data.customer_name);
  const updated = data.updated === true;
  const subject = updated
    ? `✏️ Your booking was updated${name ? `, ${name}` : ''}`
    : `🚴 Your Adventure Starts Here${name ? ` ${name}` : ''} — Let’s Ride!`;

  const dateLong = formatLongDate(data.date);
  const time = formatTourTime(data.time);
  const deposit = formatUsd(data.deposit_amount);
  const balanceCents = Number(data.remaining_balance ?? 0);
  const balance = formatUsd(balanceCents);
  const changes = (data.changes_summary ?? []).filter((c) => typeof c === 'string' && c.trim());
  const showBalanceNote = balanceCents > 0 && Boolean(data.remaining_balance_due_at) && !data.manual_booking;
  const waiverUrl = data.waiver_url && data.waiver_signed !== true ? data.waiver_url : null;

  const updatedBlock = updated
    ? `<tr><td style="padding:0 28px 18px 28px;background:#0b1712;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2a2410;border:1px solid #6b5a1f;border-radius:18px;">
<tr><td style="padding:20px 22px;">
<div style="font-size:19px;line-height:26px;font-weight:700;color:#f4fbf7;">Your booking was updated</div>
<div style="font-size:14px;line-height:22px;color:#d8c99a;padding-top:6px;">Here's what changed. Everything below shows your booking as it is now.</div>
${changes.length ? `<ul style="margin:10px 0 0 18px;padding:0;color:#f4fbf7;font-size:14px;line-height:22px;">${changes.map((c) => `<li style="padding:2px 0;">${esc(c)}</li>`).join('')}</ul>` : ''}
</td></tr>
</table>
</td></tr>`
    : '';

  const whenBlock = `<tr><td style="padding:20px 28px 10px 28px;background:#0b1712;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:8px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#102019;border:1px solid #1d3d30;border-radius:16px;"><tr><td style="padding:18px;">
<div style="font-size:11px;line-height:16px;color:#88a195;letter-spacing:1.5px;text-transform:uppercase;">Date</div>
<div style="font-size:18px;line-height:24px;font-weight:700;color:#f4fbf7;padding-top:6px;">${esc(dateLong ?? 'To be confirmed')}</div>
</td></tr></table></td>
<td style="padding-left:8px;" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#102019;border:1px solid #1d3d30;border-radius:16px;"><tr><td style="padding:18px;">
<div style="font-size:11px;line-height:16px;color:#88a195;letter-spacing:1.5px;text-transform:uppercase;">Time</div>
<div style="font-size:18px;line-height:24px;font-weight:700;color:#f4fbf7;padding-top:6px;">${esc(time ?? 'To be confirmed')}</div>
</td></tr></table></td>
</tr></table>
</td></tr>`;

  const details = darkDetails(
    'Booking Details',
    [
      ['Guest Name', data.customer_name ?? null],
      ['Trail Type', trailLabel(data.trail_type)],
      ['Skill Level', data.skill_level || 'Skill level not needed on this experience'],
      ['Location', data.location ?? null],
      ['Duration', data.duration_hours ? `${data.duration_hours} hours` : null],
      ['Riders', data.participant_count ? String(data.participant_count) : null],
    ],
    data.gift_card_covered ? ['Paid with', 'Gift card'] : deposit ? ['Deposit paid', deposit] : undefined,
  );

  const balanceNote = showBalanceNote
    ? darkNote(
        `<strong style="color:#f0b06a;">Important:</strong> The remaining balance of <strong style="color:#f4fbf7;">${esc(balance)}</strong> will be automatically charged to the card on file <strong style="color:#f4fbf7;">one day before your scheduled experience</strong>.`,
      )
    : data.manual_booking && balanceCents > 0
      ? darkNote(`<strong style="color:#f0b06a;">Balance due:</strong> <strong style="color:#f4fbf7;">${esc(balance)}</strong>, payable on the day of your ride.`)
      : '';

  const meeting = data.meeting_location_url
    ? darkCta('Know where to meet', 'View your meeting location and arrive ready to ride.', 'View Meeting Location', data.meeting_location_url)
    : '';
  const waiver = waiverUrl
    ? darkCta(
        'Sign your waiver',
        'Every rider must sign the liability waiver before the tour. It only takes a minute on your phone.',
        'Sign the Waiver',
        waiverUrl,
      )
    : '';

  const bring = `<tr><td style="padding:0 28px 18px 28px;background:#0b1712;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f1b16;border:1px solid #1b3529;border-radius:18px;"><tr><td style="padding:28px;text-align:center;">
<div style="font-size:22px;line-height:28px;font-weight:700;color:#f4fbf7;padding-bottom:10px;">What to Bring</div>
<div style="font-size:14px;line-height:22px;color:#a9beb3;padding-bottom:16px;">Everything you need for a smooth ride:</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
${['Comfortable clothes', 'Closed-toe shoes', 'Water bottle', 'Sunscreen'].map((i) => `<tr><td style="padding:6px 0;font-size:15px;color:#dce9e2;">${i}</td></tr>`).join('\n')}
<tr><td style="padding:6px 0;font-size:15px;color:#7fe0b0;font-weight:600;">Good vibes required</td></tr>
</table>
</td></tr></table>
</td></tr>`;

  const calendar = data.calendar_url
    ? `<tr><td style="padding:0 28px 28px 28px;background:#0b1712;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f1b16;border:1px solid #1b3529;border-radius:18px;"><tr><td style="padding:20px;text-align:center;">
<div style="font-size:13px;line-height:18px;letter-spacing:1.2px;color:#89a296;text-transform:uppercase;">Calendar</div>
<div style="font-size:15px;line-height:24px;color:#a9beb3;padding-top:10px;padding-bottom:14px;">Add your ride to your calendar so you're ready on time.</div>
<a href="${href(data.calendar_url)}" style="display:inline-block;background:#f4fbf7;color:#0b1712;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:999px;">Add to Calendar</a>
</td></tr></table>
</td></tr>`
    : '';

  const html = darkShell({
    title: updated ? 'Your Booking Was Updated' : 'Your Ride Confirmation',
    preheader: updated ? 'Your booking details changed. Here is your ride as it is now.' : `Your ride is confirmed${dateLong ? ` for ${dateLong}` : ''}.`,
    banner: {
      src: 'https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/other_images/banner-confirmation.png',
      alt: 'Your ride is confirmed',
    },
    rows: [
      darkHero(
        'Ride Confirmed',
        "You're all set for the trail.",
        "We're excited to ride with you. Below you'll find your booking details, what to bring, and everything you need before your experience begins.",
      ),
      updatedBlock,
      whenBlock,
      details,
      balanceNote,
      meeting,
      waiver,
      bring,
      calendar,
    ].join('\n'),
  });

  const text = [
    updated ? 'Your booking was updated.' : "Ride confirmed: you're all set for the trail.",
    ...(updated && changes.length ? ['', "What changed:", ...changes.map((c) => `- ${c}`)] : []),
    '',
    `Date: ${dateLong ?? 'To be confirmed'}`,
    `Time: ${time ?? 'To be confirmed'}`,
    ...(data.customer_name ? [`Guest: ${data.customer_name}`] : []),
    ...(trailLabel(data.trail_type) ? [`Trail type: ${trailLabel(data.trail_type)}`] : []),
    ...(data.location ? [`Location: ${data.location}`] : []),
    ...(data.duration_hours ? [`Duration: ${data.duration_hours} hours`] : []),
    ...(data.gift_card_covered ? ['Paid with: Gift card'] : deposit ? [`Deposit paid: ${deposit}`] : []),
    ...(showBalanceNote ? ['', `The remaining balance of ${balance} will be charged to the card on file one day before your experience.`] : []),
    ...(data.manual_booking && balanceCents > 0 ? ['', `Balance due on the day of your ride: ${balance}`] : []),
    ...(data.meeting_location_url ? ['', `Meeting point: ${[data.meeting_location_name, data.meeting_location_address].filter(Boolean).join(', ')}`, data.meeting_location_url] : []),
    ...(waiverUrl ? ['', `Sign your waiver (every rider, before the tour): ${waiverUrl}`] : []),
    ...(data.calendar_url ? ['', `Add to your calendar: ${data.calendar_url}`] : []),
    '',
    'What to bring: comfortable clothes, closed-toe shoes, water bottle, sunscreen, and good vibes.',
    '',
    '--',
    BRAND.name,
    BRAND.postalAddress.join(', '),
    "Need help? Reply to this email and we'll point you in the right direction.",
  ].join('\n');

  return { subject, html, text };
}
