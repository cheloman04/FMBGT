import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AdminTopBar } from '../AdminTopBar';

type FinancialEventRow = {
  id: string;
  event_name: string;
  event_category: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  entity_type: string;
  entity_id: string;
  booking_id: string | null;
  lead_id: string | null;
  stripe_session_id: string | null;
  payment_intent_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  requires_attention: boolean;
  message: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
};

function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency?.toUpperCase() || 'USD',
  }).format(amount / 100);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function severityBadgeClassName(severity: FinancialEventRow['severity']) {
  if (severity === 'critical') return 'border-red-500/30 bg-red-500/15 text-red-200';
  if (severity === 'error') return 'border-amber-500/30 bg-amber-500/15 text-amber-200';
  if (severity === 'warning') return 'border-yellow-500/30 bg-yellow-500/15 text-yellow-200';
  return 'border-green-500/25 bg-green-500/10 text-green-200';
}

async function getFinancialEvents() {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('financial_event_logs')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[admin/fin-log] Failed to fetch financial events:', error.message);
    return [] as FinancialEventRow[];
  }

  return (data ?? []) as FinancialEventRow[];
}

export default async function AdminFinLogPage() {
  await requireAdminUser();
  const events = await getFinancialEvents();

  const attentionCount = events.filter((event) => event.requires_attention).length;
  const criticalCount = events.filter((event) => event.severity === 'critical').length;
  const reconciliationCount = events.filter((event) => event.event_category === 'reconciliation').length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.06),transparent_28%),linear-gradient(to_bottom,#f4efe4_0%,#efe9dd_100%)] text-foreground dark:bg-[#0b0c0b]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <AdminTopBar
          activePage="fin-log"
          title="Financial Log"
          subtitle="Append-only payment, reconciliation, and support event ledger"
        />

        <div className="mb-4 rounded-2xl border border-border/70 bg-card/65 p-3 shadow-[0_0_0_1px_rgba(34,197,94,0.05),0_12px_30px_rgba(51,44,30,0.12)] sm:mb-5 sm:p-4 dark:shadow-[0_0_0_1px_rgba(34,197,94,0.05),0_12px_30px_rgba(0,0,0,0.16)]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Events', value: events.length },
            { label: 'Needs Attention', value: attentionCount },
            { label: 'Critical', value: criticalCount },
            { label: 'Reconciliation', value: reconciliationCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[0_10px_28px_rgba(51,44,30,0.10)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.12)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_40%)] opacity-80 dark:opacity-80" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="relative mt-4 text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/92 shadow-[0_16px_36px_rgba(51,44,30,0.12)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.14)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_32%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_32%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_26%)]" />
          <div className="relative border-b border-border/70 px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-foreground">Event Stream</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Immutable finance and ops events, newest first.
            </p>
          </div>

          <div className="relative hidden overflow-x-auto lg:block">
            <table className="min-w-full divide-y divide-border/70 text-sm">
              <thead className="bg-background/40 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {events.map((event) => (
                  <tr key={event.id} className="align-top transition-colors hover:bg-background/35">
                    <td className="px-4 py-4 text-muted-foreground">{formatTime(event.occurred_at)}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-foreground">{event.event_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{event.event_category}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${severityBadgeClassName(event.severity)}`}>
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {event.booking_id ? (
                        <Link href={`/admin?bookingId=${event.booking_id}`} className="text-green-300 hover:text-green-200">
                          {event.booking_id.slice(0, 8)}...
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-foreground">{formatMoney(event.amount, event.currency)}</td>
                    <td className="px-4 py-4 text-muted-foreground">{event.status ?? '—'}</td>
                    <td className="px-4 py-4">
                      <p className="max-w-md text-sm text-foreground">{event.message ?? '—'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="relative grid gap-3 p-4 lg:hidden">
            {events.map((event) => (
              <div
                key={event.id}
                className="relative overflow-hidden rounded-2xl border border-border/70 bg-background/55 p-4 shadow-[0_10px_22px_rgba(0,0,0,0.12)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_40%)]" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{event.event_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTime(event.occurred_at)}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${severityBadgeClassName(event.severity)}`}>
                    {event.severity}
                  </span>
                </div>
                <div className="relative mt-3 grid gap-2 text-sm">
                  <p className="text-muted-foreground">Amount: <span className="text-foreground">{formatMoney(event.amount, event.currency)}</span></p>
                  <p className="text-muted-foreground">Status: <span className="text-foreground">{event.status ?? '—'}</span></p>
                  <p className="text-muted-foreground">Booking: <span className="text-foreground">{event.booking_id ?? '—'}</span></p>
                  <p className="text-foreground">{event.message ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
