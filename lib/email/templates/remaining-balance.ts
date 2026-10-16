// remaining_balance_paid and remaining_balance_failed — the two emails about the
// balance charged the day before the ride (cron/charge-remaining, or an admin retry).
//
// NEW copy. Neither email reached guests through n8n: the "Remaining balance
// Confirmation Email" workflow (TMj9Yvfr26u2gYuC) has been switched off since
// 2026-04-23 and was a copy of the booking confirmation, and `remaining_balance_failed`
// went to the confirmation workflow with no customer email in its payload. The
// owner reviews this copy before these two types move to Kigaru.
//
// No imports but the shell and the booking helpers: the tests load this as is.

import { BRAND, darkCta, darkDetails, darkHero, darkShell } from '../layout';
import { firstName, formatLongDate, formatTourTime, formatUsd } from './booking-confirmed';

export type RemainingBalancePayload = {
  booking_id: string;
  payment_intent_id: string;
  /** What was charged (or attempted), in cents. */
  amount: number | null;
  customer_email: string | null;
  customer_name?: string | null;
  location?: string | null;
  date?: string | null;
  time?: string | null;
  duration_hours?: number | null;
  participant_count?: number | null;
  meeting_location_name?: string | null;
  meeting_location_address?: string | null;
  meeting_location_url?: string | null;
  calendar_url?: string | null;
  [key: string]: unknown;
};

function rideRows(data: RemainingBalancePayload): Array<[string, string | null]> {
  return [
    ['Date', formatLongDate(data.date)],
    ['Time', formatTourTime(data.time)],
    ['Location', data.location ?? null],
    ['Riders', data.participant_count ? String(data.participant_count) : null],
  ];
}

function rideText(data: RemainingBalancePayload): string[] {
  return rideRows(data)
    .filter(([, v]) => v)
    .map(([l, v]) => `${l}: ${v}`);
}

const FOOTER_TEXT = ['', '--', BRAND.name, BRAND.postalAddress.join(', '), "Need help? Reply to this email and we'll point you in the right direction."];

export function renderRemainingBalancePaid(data: RemainingBalancePayload): { subject: string; html: string; text: string } {
  const name = firstName(data.customer_name);
  const amount = formatUsd(data.amount);
  const dateLong = formatLongDate(data.date);
  const subject = `You're all paid up${name ? `, ${name}` : ''}: see you on the trail`;

  const html = darkShell({
    title: 'Your Balance Is Paid',
    preheader: `We charged the remaining balance${amount ? ` of ${amount}` : ''} for your ride${dateLong ? ` on ${dateLong}` : ''}.`,
    rows: [
      darkHero(
        'Balance paid',
        "You're all paid up.",
        `We charged the remaining balance${amount ? ` of ${amount}` : ''} to the card on file. Nothing else to pay: just show up ready to ride.`,
      ),
      darkDetails('Your Ride', rideRows(data), amount ? ['Balance paid', amount] : undefined),
      data.meeting_location_url
        ? darkCta('Know where to meet', 'View your meeting location and arrive ready to ride.', 'View Meeting Location', data.meeting_location_url)
        : '',
      data.calendar_url
        ? darkCta('Add it to your calendar', "So you're ready on time.", 'Add to Calendar', data.calendar_url)
        : '',
    ].join('\n'),
  });

  const text = [
    "You're all paid up.",
    '',
    `We charged the remaining balance${amount ? ` of ${amount}` : ''} to the card on file. Nothing else to pay.`,
    '',
    ...rideText(data),
    ...(data.meeting_location_url ? ['', `Meeting point: ${data.meeting_location_url}`] : []),
    ...(data.calendar_url ? [`Add to your calendar: ${data.calendar_url}`] : []),
    ...FOOTER_TEXT,
  ].join('\n');

  return { subject, html, text };
}

export function renderRemainingBalanceFailed(data: RemainingBalancePayload): { subject: string; html: string; text: string } {
  const name = firstName(data.customer_name);
  const amount = formatUsd(data.amount);
  const dateLong = formatLongDate(data.date);
  const subject = `${name ? `${name}, w` : 'W'}e couldn't charge your remaining balance`;

  const html = darkShell({
    title: 'Payment Needed For Your Ride',
    preheader: `Your spot is still held. Reply to this email and we'll sort out the payment${dateLong ? ` before ${dateLong}` : ''}.`,
    rows: [
      darkHero(
        'Payment needed',
        "We couldn't charge your card.",
        `We tried to charge the remaining balance${amount ? ` of ${amount}` : ''} for your ride to the card on file, and the payment didn't go through. Your spot is still held.`,
      ),
      darkDetails('Your Ride', rideRows(data), amount ? ['Balance due', amount] : undefined),
      `<tr><td style="padding:0 28px 28px 28px;background:#0b1712;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2a2410;border:1px solid #6b5a1f;border-radius:18px;">
<tr><td style="padding:20px 22px;">
<div style="font-size:19px;line-height:26px;font-weight:700;color:#f4fbf7;">What to do</div>
<div style="font-size:15px;line-height:24px;color:#d8c99a;padding-top:6px;">Just reply to this email and we'll help you sort out the payment before your ride. Your bank may also have flagged the charge: if you approve it with them, let us know and we'll try again.</div>
</td></tr>
</table>
</td></tr>`,
    ].join('\n'),
  });

  const text = [
    "We couldn't charge your card.",
    '',
    `We tried to charge the remaining balance${amount ? ` of ${amount}` : ''} for your ride to the card on file, and the payment didn't go through. Your spot is still held.`,
    '',
    ...rideText(data),
    '',
    "What to do: reply to this email and we'll help you sort out the payment before your ride. If your bank flagged the charge and you approve it, let us know and we'll try again.",
    ...FOOTER_TEXT,
  ].join('\n');

  return { subject, html, text };
}
