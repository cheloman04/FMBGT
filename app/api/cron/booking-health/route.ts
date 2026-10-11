/**
 * /api/cron/booking-health
 *
 * Daily Vercel Cron (8 AM Florida). Looks at upcoming confirmed tours and sends
 * ONE ops digest listing the ones that need attention:
 *   - no calendar event (slot still open online → double-booking risk) — any date
 *   - confirmation email never sent — any date
 *   - waiver not signed and the tour starts within WAIVER_WARNING_HOURS
 *   - manual (off-platform) balance still pending, tour within PAYMENT_WINDOW_DAYS
 *
 * Read-only on bookings; sends nothing when everything is fine. Catches what the
 * real-time failure alerts miss (n8n down, alert lost, issue fixed half-way).
 *
 * Authorization (mirrors /api/cron/auto-complete):
 *   Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
 *   Admin / n8n:       x-admin-secret: <ADMIN_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { easternLocalToUtcIso } from '@/lib/booking-datetime';
import { notifySupportAlert } from '@/lib/n8n';

const PAYMENT_WINDOW_DAYS = 7;
const WAIVER_WARNING_HOURS = 48;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const adminSecret = process.env.ADMIN_SECRET;
  const adminHeader = req.headers.get('x-admin-secret');
  if (adminSecret && adminHeader === adminSecret) return true;

  return false;
}

/** Today's date as YYYY-MM-DD in the tour timezone (America/New_York). */
function easternDateString(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

/** Pure calendar arithmetic on a YYYY-MM-DD string (no timezone involved). */
function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

type HealthRow = {
  id: string;
  date: string;
  time_slot: string | null;
  booking_source: string | null;
  cal_booking_status: string | null;
  webhook_sent: boolean | null;
  waiver_accepted: boolean | null;
  remaining_balance_amount: number | null;
  remaining_balance_status: string | null;
  customers: { name?: string } | null;
  locations: { name?: string } | null;
};

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runBookingHealthCheck();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runBookingHealthCheck();
}

async function runBookingHealthCheck(): Promise<NextResponse> {
  const now = new Date();
  const today = easternDateString(now);
  const paymentWindowEnd = addDaysToDateString(today, PAYMENT_WINDOW_DAYS);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseAdmin() as any)
    .from('bookings')
    .select(
      'id, date, time_slot, booking_source, cal_booking_status, webhook_sent, waiver_accepted, ' +
        'remaining_balance_amount, remaining_balance_status, customers(name), locations(name)'
    )
    .eq('status', 'confirmed')
    .is('deleted_at', null)
    .gte('date', today)
    .order('date', { ascending: true });

  if (error) {
    console.error('[cron/booking-health] DB fetch error:', error);
    return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
  }

  const bookings = (data ?? []) as HealthRow[];
  const flagged = bookings
    .map((b) => {
      const issues: string[] = [];
      if (b.cal_booking_status !== 'created') issues.push('No calendar event — slot still open online');
      if (b.webhook_sent === false) issues.push('Confirmation email not sent');
      if (!b.waiver_accepted && b.time_slot) {
        const hoursUntil = (Date.parse(easternLocalToUtcIso(b.date, b.time_slot)) - now.getTime()) / 3_600_000;
        if (hoursUntil <= WAIVER_WARNING_HOURS) issues.push('Waiver not signed');
      }
      if (
        b.booking_source === 'manual' &&
        b.remaining_balance_status === 'pending' &&
        b.date <= paymentWindowEnd
      ) {
        issues.push(`Payment pending ($${((b.remaining_balance_amount ?? 0) / 100).toFixed(2)} due)`);
      }
      return {
        booking_id: b.id,
        customer: b.customers?.name ?? 'Unknown',
        date: b.date,
        time: b.time_slot,
        location: b.locations?.name ?? null,
        issues,
      };
    })
    .filter((b) => b.issues.length > 0);

  console.log(
    `[cron/booking-health] from ${today}: ${bookings.length} upcoming confirmed tour(s), ${flagged.length} need attention.`
  );

  if (flagged.length > 0) {
    await notifySupportAlert({
      source: '/api/cron/booking-health',
      severity: 'warning',
      summary:
        `${flagged.length} upcoming tour(s) need attention: ` +
        flagged.map((b) => `${b.customer} ${b.date} ${b.time ?? ''} — ${b.issues.join('; ')}`).join(' | '),
      details: { from: today, bookings: flagged },
    });
  }

  return NextResponse.json({ checked: bookings.length, flagged });
}
