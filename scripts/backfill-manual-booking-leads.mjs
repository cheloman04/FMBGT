// One-off: manual (cash) bookings created before the manual flow linked leads
// never converted the customer's open lead. This lists them and, only for the
// booking ids passed to --apply, links bookings.lead_id and converts the lead
// with the same helper the live paths use (lib/lead-conversion.ts).
//
// Dry run — read-only, the default:
//   node --env-file=.env.local scripts/backfill-manual-booking-leads.mjs
// Apply the bookings approved from that list:
//   node --env-file=.env.local scripts/backfill-manual-booking-leads.mjs --apply=<bookingId>[,<bookingId>…]

import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = fileURLToPath(new URL('../', import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { '@/': root } });
const { getSupabaseAdmin } = await jiti.import('../lib/supabase.ts');
const { convertLead, findOpenLeadsByEmail } = await jiti.import('../lib/lead-conversion.ts');

const SOURCE = 'backfill-manual-booking-leads';
const applyArg = process.argv.find((a) => a.startsWith('--apply='));
const applyIds = new Set((applyArg?.slice('--apply='.length) ?? '').split(',').map((s) => s.trim()).filter(Boolean));

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set — run with node --env-file=<path to .env.local>.');
  process.exit(1);
}

const supabase = getSupabaseAdmin();

// Confirmed or completed only: a cancelled booking is not a conversion.
const { data: bookings, error } = await supabase
  .from('bookings')
  .select('id, created_at, date, time_slot, status, total_price, deposit_paid_cents, customers(name, email)')
  .eq('booking_source', 'manual')
  .is('deleted_at', null)
  .is('lead_id', null)
  .in('status', ['confirmed', 'completed'])
  .order('created_at', { ascending: true });
if (error) {
  console.error('Failed to read manual bookings:', error.message);
  process.exit(1);
}

const usd = (cents) => `$${((cents ?? 0) / 100).toFixed(2)}`;
const candidates = [];
for (const booking of bookings ?? []) {
  const email = booking.customers?.email;
  if (!email) continue;
  const leads = await findOpenLeadsByEmail(email);
  if (leads.length === 0) continue;
  const lead = leads[0];
  const { data: following } = await supabase
    .from('lead_followup_enrollments')
    .select('id')
    .eq('lead_id', lead.id)
    .eq('status', 'active');
  candidates.push({ booking, lead, otherOpenLeads: leads.length - 1, followUpActive: (following ?? []).length > 0 });
}

console.log(`Manual bookings without a lead (confirmed/completed): ${(bookings ?? []).length}`);
console.log(`…whose customer email matches an open lead: ${candidates.length}\n`);
for (const { booking, lead, otherOpenLeads, followUpActive } of candidates) {
  console.log(`booking ${booking.id}`);
  console.log(`  ${booking.customers?.name ?? '—'} <${booking.customers?.email}> · ${booking.date} ${booking.time_slot} · ${booking.status}`);
  console.log(`  total ${usd(booking.total_price)} · collected ${usd(booking.deposit_paid_cents)} · created ${booking.created_at}`);
  console.log(`  lead ${lead.id} · ${lead.full_name ?? '—'} · status ${lead.status} · last active ${lead.last_activity_at}`);
  console.log(`  follow-up running: ${followUpActive ? 'YES' : 'no'}${otherOpenLeads ? ` · ${otherOpenLeads} more open lead(s) with this email stay open` : ''}\n`);
}

if (applyIds.size === 0) {
  console.log('Dry run — nothing changed. Re-run with --apply=<bookingId>[,…] to convert the ones approved.');
  process.exit(0);
}

for (const id of applyIds) {
  const candidate = candidates.find((c) => c.booking.id === id);
  if (!candidate) {
    console.log(`skip ${id}: not a candidate (any more)`);
    continue;
  }
  // Only while the booking still has no lead, so a re-run can't relink it.
  const { data: linked, error: linkError } = await supabase
    .from('bookings')
    .update({ lead_id: candidate.lead.id })
    .eq('id', id)
    .is('lead_id', null)
    .select('id');
  if (linkError || !linked?.length) {
    console.log(`skip ${id}: could not link the lead (${linkError?.message ?? 'already linked'})`);
    continue;
  }
  const converted = await convertLead(candidate.lead.id, id, { source: SOURCE });
  console.log(`${converted ? 'done' : 'LINKED, lead NOT converted'} ${id} → lead ${candidate.lead.id}`);
}
