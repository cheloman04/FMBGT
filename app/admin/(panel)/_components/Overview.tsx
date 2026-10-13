import Link from 'next/link';
import { EmptyState, MetricStrip, Section, StatusBadge, buttonClasses } from '@/components/kit';
import {
  overviewMetrics,
  toNextBooking,
  type NextBookingRecord,
  type OverviewStats,
} from '@/lib/admin/overview';
import { FAILED_CHARGE } from '@/lib/admin/status-meta';

/**
 * The top of /admin: the business pulse, what needs the operator, and the next
 * tour. Server-rendered. Each list has its own route (bookings, leads, trash).
 */
export function AdminOverview({
  stats,
  next,
}: {
  stats: OverviewStats;
  next: { booking: NextBookingRecord; today: string } | null;
}) {
  const booking = next ? toNextBooking(next.booking, next.today) : null;

  return (
    <>
      <MetricStrip metrics={overviewMetrics(stats)} />

      <div className="mt-10 space-y-10">
        {stats.failedCharges > 0 ? (
          <Section
            title="Needs attention"
            action={
              <Link href="/admin/bookings?status=failed" className={buttonClasses('secondary', 'sm')}>
                Show {stats.failedCharges === 1 ? 'it' : 'them'}
              </Link>
            }
          >
            <div role="status" className="flex flex-wrap items-center gap-3">
              <StatusBadge meta={FAILED_CHARGE} size="sm" />
              <p className="text-sm text-fg-2">
                {stats.failedCharges === 1
                  ? 'The balance charge of 1 booking failed.'
                  : `The balance charges of ${stats.failedCharges} bookings failed.`}{' '}
                Open {stats.failedCharges === 1 ? 'it' : 'each one'} in Bookings and retry the charge.
              </p>
            </div>
          </Section>
        ) : null}

        <Section
          title="Next booking"
          action={
            booking ? (
              <Link href={`/admin/bookings/${booking.id}`} className={buttonClasses('secondary', 'sm')}>
                Open booking
              </Link>
            ) : null
          }
        >
          {booking ? (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <p className="text-lg font-semibold text-fg">{booking.customer}</p>
                <StatusBadge meta={booking.status} size="sm" />
              </div>
              <MetricStrip metrics={booking.facts} scale="fact" rule={false} />
            </>
          ) : (
            <EmptyState title="No upcoming tours. Confirmed bookings show up here until they start." />
          )}
        </Section>
      </div>
    </>
  );
}
