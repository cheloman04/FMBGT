import Link from 'next/link';
import {
  EmptyState,
  MetricStrip,
  PageHeader,
  PageShell,
  ResponsiveList,
  Section,
  StatusBadge,
  type Column,
  type Metric,
} from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import {
  FIN_LOG_EMPTY,
  parseFinLogView,
  toFinancialEventRow,
  type FinLogCounts,
  type FinLogView,
  type FinancialEventRow,
} from '@/lib/admin/fin-log';
import { loadFinancialLog } from '@/lib/admin/loaders';
import { NEEDS_ATTENTION } from '@/lib/admin/status-meta';

export const metadata = { title: 'Financial log | Admin' };
export const dynamic = 'force-dynamic';

const COLUMNS: Column<FinancialEventRow>[] = [
  {
    key: 'event',
    header: 'Event',
    cell: (r) => (
      <>
        <span className="block">{r.name}</span>
        <span className="block text-xs font-normal text-fg-muted">{r.category}</span>
      </>
    ),
  },
  { key: 'when', header: 'When', cell: (r) => r.when, width: 'w-44' },
  {
    key: 'severity',
    header: 'Severity',
    cell: (r) => (
      <span className="inline-flex flex-wrap gap-1.5">
        <StatusBadge meta={r.severity} size="sm" />
        {r.attention ? <StatusBadge meta={NEEDS_ATTENTION} size="sm" /> : null}
      </span>
    ),
    mobile: 'status',
  },
  {
    key: 'booking',
    header: 'Booking',
    cell: (r) =>
      r.bookingId ? (
        <Link
          href={`/admin/bookings/${r.bookingId}`}
          className="font-mono text-xs text-fg underline decoration-hairline underline-offset-4 hover:decoration-fg-muted"
        >
          {r.bookingId.slice(0, 8)}
        </Link>
      ) : (
        '—'
      ),
    interactive: true,
    width: 'w-28',
  },
  { key: 'amount', header: 'Amount', cell: (r) => r.amount, align: 'right', width: 'w-28' },
  { key: 'status', header: 'Status', cell: (r) => r.status, width: 'w-28' },
  { key: 'details', header: 'Details', cell: (r) => <span className="line-clamp-3 max-w-md">{r.message}</span>, mobile: 'secondary' },
];

/** The strip doubles as the filter: each figure links to its view (§4.7). */
function viewMetrics(counts: FinLogCounts, active: FinLogView): Metric[] {
  const tile = (view: FinLogView, label: string, sub: string): Metric => ({
    key: view,
    label,
    value: String(counts[view]),
    sub,
    href: view === 'all' ? '/admin/fin-log' : `/admin/fin-log?view=${view}`,
    active: view === active,
  });
  return [
    tile('all', 'All events', 'Payments, refunds, ops'),
    tile('attention', 'Needs attention', 'Flagged for a person'),
    tile('critical', 'Critical', 'Highest severity'),
    tile('reconciliation', 'Reconciliation', 'Matches and corrections'),
  ];
}

const SECTION_TITLE: Record<FinLogView, string> = {
  all: 'Event stream',
  attention: 'Needs attention',
  critical: 'Critical events',
  reconciliation: 'Reconciliation events',
};

export default async function FinLogPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  await requireOperator();
  const view = parseFinLogView((await searchParams).view);
  const { events, counts, limit } = await loadFinancialLog(view);
  const rows = events.map(toFinancialEventRow);
  const total = counts[view];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Money"
        title="Financial log"
        subtitle="Append-only ledger of payments, reconciliations and support events. Times in Eastern."
      />
      <MetricStrip metrics={viewMetrics(counts, view)} />

      <div className="mt-10">
        <Section
          title={SECTION_TITLE[view]}
          subtitle={total > limit ? `The newest ${limit} of ${total}, newest first.` : 'Newest first.'}
        >
          <ResponsiveList
            rows={rows}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            caption={SECTION_TITLE[view]}
            empty={<EmptyState title={FIN_LOG_EMPTY[view]} />}
          />
        </Section>
      </div>
    </PageShell>
  );
}
