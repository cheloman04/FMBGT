// Which customer emails go through Kigaru, and the guards around sending them.
//
// Phase 6 of the Kigaru plan moves FMBGT's eight customer emails off n8n and onto
// the Kigaru hub (contract §5). Each email type moves on its own day, and its n8n
// workflow is switched off that same day, so the move is a switch per type:
//
//   KIGARU_EMAIL_TYPES=booking_confirmed,remaining_balance_paid,...   (or `*` for all)
//
// A type that isn't listed keeps going to n8n exactly as before. Changing the list
// needs a redeploy (Vercel bakes env vars into each deployment).
//
// No imports on purpose: the tests load this as is.

/** The `email_type` the hub counts and filters by (contract §5.1), with its category. */
export const EMAIL_TYPES = {
  booking_confirmed: 'transactional',
  remaining_balance_paid: 'transactional',
  remaining_balance_failed: 'transactional',
  lead_follow_up: 'marketing',
  review_request: 'marketing',
} as const;

export type EmailType = keyof typeof EMAIL_TYPES;
export type EmailCategory = (typeof EMAIL_TYPES)[EmailType];

/** How /admin/emails names each type. */
export const EMAIL_TYPE_NAMES: Record<EmailType, string> = {
  booking_confirmed: 'Booking confirmation',
  remaining_balance_paid: 'Balance paid',
  remaining_balance_failed: 'Balance charge failed',
  lead_follow_up: 'Lead follow-up',
  review_request: 'Review request',
};

/** The types switched over to Kigaru, from `KIGARU_EMAIL_TYPES`. Unknown names are ignored. */
export function kigaruEmailTypes(raw: string | undefined = process.env.KIGARU_EMAIL_TYPES): Set<EmailType> {
  const names = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.includes('*')) return new Set(Object.keys(EMAIL_TYPES) as EmailType[]);
  return new Set(names.filter((n): n is EmailType => n in EMAIL_TYPES));
}

/** Whether this email type goes through Kigaru (true) or still through n8n (false). */
export function sendsViaKigaru(type: EmailType, raw?: string): boolean {
  return kigaruEmailTypes(raw).has(type);
}

/**
 * Outside production (previews, `next dev`) the app shares the production database.
 * There, only `*@resend.dev` addresses may ever reach the hub: everything else is
 * recorded as `skipped` and never sent.
 */
export function onlyTestRecipients(vercelEnv: string | undefined = process.env.VERCEL_ENV): boolean {
  return vercelEnv !== 'production';
}

export function isTestRecipient(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@resend.dev');
}
