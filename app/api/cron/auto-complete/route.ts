/**
 * /api/cron/auto-complete
 *
 * Daily Vercel Cron. Marks CONFIRMED bookings whose tour day has passed as
 * `completed`, firing the same side effects as a manual admin completion
 * (n8n completed-service alert, review-request enrollment, and the Senzai
 * `service.completed` event carrying refs.lead_id).
 *
 * Why this exists: `service.completed` is otherwise emitted ONLY when an admin
 * manually flips a booking to "completed" in the dashboard — which rarely
 * happens, so Senzai's Lead→Service time-to-close stays blind. This closes that
 * gap by completing past tours automatically.
 *
 * Safety rails (auto-complete is high-impact — it triggers customer-facing
 * review requests and ops alerts):
 *   - OFF unless AUTO_COMPLETE_ENABLED === 'true'. Deploying the code does
 *     nothing until the operator explicitly opts in.
 *   - Only tours whose date falls within the last AUTO_COMPLETE_LOOKBACK_DAYS
 *     (default 7) are completed. Bounds the first-run/backlog blast radius so we
 *     never retro-fire review requests + alerts for long-abandoned bookings.
 *   - Atomic confirmed→completed claim per booking (no double processing across
 *     overlapping runs); the Senzai emit is also idempotent by key.
 *   - MAX_PER_RUN backstop; remainder rolls to the next run.
 *   - Reports staleBeyondLookback (confirmed tours older than the window) for
 *     visibility without acting on them.
 *
 * Authorization (mirrors /api/cron/charge-remaining):
 *   Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
 *   Admin / n8n:       x-admin-secret: <ADMIN_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { runServiceCompletionEffects, type CompletableBooking } from '@/lib/complete-booking';

const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_PER_RUN = 100;

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

const BOOKING_COLUMNS =
  'id, customer_id, lead_id, location_id, trail_type, skill_level, date, time_slot, duration_hours, bike_rental, participant_count, total_price, status';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runAutoCompleteJob();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runAutoCompleteJob();
}

async function runAutoCompleteJob(): Promise<NextResponse> {
  const now = new Date();
  const nowIso = now.toISOString();

  if (process.env.AUTO_COMPLETE_ENABLED !== 'true') {
    console.log(`[cron/auto-complete] Skipped at ${nowIso}: AUTO_COMPLETE_ENABLED is not 'true'.`);
    return NextResponse.json({
      enabled: false,
      completed: 0,
      skipped: 0,
      failed: 0,
      note: "Set AUTO_COMPLETE_ENABLED='true' to activate auto-completion.",
    });
  }

  const parsedLookback = Number(process.env.AUTO_COMPLETE_LOOKBACK_DAYS ?? DEFAULT_LOOKBACK_DAYS);
  const lookbackDays =
    Number.isFinite(parsedLookback) && parsedLookback > 0 ? Math.floor(parsedLookback) : DEFAULT_LOOKBACK_DAYS;

  const today = easternDateString(now); // tours strictly before today have fully ended
  const lookbackDate = addDaysToDateString(today, -lookbackDays);

  const supabase = getSupabaseAdmin();
  console.log(
    `[cron/auto-complete] Run ${nowIso}: completing confirmed tours dated [${lookbackDate}, ${today}) (lookback ${lookbackDays}d).`
  );

  const { data: dueBookings, error: fetchError } = await supabase
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('status', 'confirmed')
    .gte('date', lookbackDate)
    .lt('date', today)
    .order('date', { ascending: true })
    .limit(MAX_PER_RUN + 1);

  if (fetchError) {
    console.error('[cron/auto-complete] DB fetch error:', fetchError);
    return NextResponse.json({ error: 'DB error', details: fetchError.message }, { status: 500 });
  }

  // Visibility only: confirmed tours older than the window that we intentionally
  // leave alone (auto-completing them would retro-blast review requests/alerts).
  const { count: staleBeyondLookback } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed')
    .lt('date', lookbackDate);

  const candidates = (dueBookings ?? []) as unknown as CompletableBooking[];
  const capped = candidates.length > MAX_PER_RUN;
  const batch = capped ? candidates.slice(0, MAX_PER_RUN) : candidates;
  if (capped) {
    console.warn(
      `[cron/auto-complete] ${candidates.length}+ candidates exceed MAX_PER_RUN=${MAX_PER_RUN}; processing ${MAX_PER_RUN} now, remainder next run.`
    );
  }

  const results = {
    enabled: true,
    window: { from: lookbackDate, to: today, lookbackDays },
    completed: 0,
    skipped: 0,
    failed: 0,
    capped,
    staleBeyondLookback: staleBeyondLookback ?? null,
  };

  for (const booking of batch) {
    // Atomic claim: only the run that flips confirmed→completed fires the effects.
    const { data: claimed, error: claimError } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', booking.id)
      .eq('status', 'confirmed')
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error(`[cron/auto-complete] Claim failed for booking ${booking.id}:`, claimError);
      results.failed++;
      continue;
    }
    if (!claimed) {
      // Already moved out of 'confirmed' by a concurrent run / manual action.
      results.skipped++;
      continue;
    }

    try {
      await runServiceCompletionEffects(booking, {
        previousStatus: 'confirmed',
        sourceRoute: '/api/cron/auto-complete',
      });
      results.completed++;
      console.log(`[cron/auto-complete] Completed booking ${booking.id} (tour date ${booking.date}).`);
    } catch (effectsError) {
      // Booking is already 'completed'; effects can be re-run safely (idempotent
      // Senzai key, review enrollment de-dupes) by re-completing manually.
      console.error(
        `[cron/auto-complete] Side effects failed for booking ${booking.id} (already marked completed):`,
        effectsError
      );
      results.failed++;
    }
  }

  console.log(`[cron/auto-complete] Done: ${JSON.stringify(results)}`);
  return NextResponse.json(results);
}
