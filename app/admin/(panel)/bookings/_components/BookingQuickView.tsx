import type { ReactNode } from 'react';
import { EmptyState, Section, StatusBadge, TONE_CLASSES, buttonClasses, type SelectMenuOption } from '@/components/kit';
import { STATUS_CHOICES, type BookingDetailView } from '@/lib/admin/bookings';
import { BOOKING_STATUS, SIZING_STATUS } from '@/lib/admin/status-meta';
import { ArchiveBooking, ChangeStatus, MarkReviewReceived, RetryCalendar, RetryCharge, SendConfirmation } from './BookingActions';

/** The status menu: the four an operator sets, each with its dot. */
const STATUS_OPTIONS: SelectMenuOption[] = STATUS_CHOICES.map((value) => ({
  value,
  label: BOOKING_STATUS[value].label,
  dot: TONE_CLASSES[BOOKING_STATUS[value].tone].dot,
}));

const LINK = 'text-fg underline decoration-hairline underline-offset-4 hover:decoration-fg-muted';

/** Label on the left, value on the right: the facts of one booking. */
function Facts({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
      {facts.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-fg-muted">{f.label}</dt>
          <dd className="break-words text-fg">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The quick view of one booking in the list's drawer (?booking=<id>): what the
 * old phone sheet and table row showed, each action next to what it fixes.
 * Editing the booking and the other money actions live on the booking page
 * (Open / Edit, in the drawer's footer).
 */
export function BookingQuickView({ booking, closeHref }: { booking: BookingDetailView; closeHref: string }) {
  const { actions } = booking;
  /** The button that fixes a line of "Calendar and messages", if there is one. */
  const followUp: Record<string, ReactNode> = {
    calendar: actions.retryCalendar ? <RetryCalendar bookingId={booking.id} /> : null,
    email: actions.confirmationEmail ? (
      <SendConfirmation bookingId={booking.id} mode={actions.confirmationEmail.mode} to={actions.confirmationEmail.to} />
    ) : null,
    review: actions.markReview ? <MarkReviewReceived enrollmentId={actions.markReview.enrollmentId} /> : null,
  };
  const contact: { label: string; value: ReactNode }[] = [
    {
      label: 'Email',
      value: booking.contact.email ? (
        <a href={`mailto:${booking.contact.email}`} className={LINK}>
          {booking.contact.email}
        </a>
      ) : (
        '—'
      ),
    },
    {
      label: 'Phone',
      value: booking.contact.phone ? (
        <a href={`tel:${booking.contact.phone}`} className={LINK}>
          {booking.contact.phone}
        </a>
      ) : (
        '—'
      ),
    },
    ...booking.contact.facts,
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge meta={booking.status} />
        {booking.flags.map((flag) => (
          <StatusBadge key={flag.label} meta={flag} />
        ))}
      </div>

      <Section title="Tour">
        <Facts facts={booking.tour} />
      </Section>

      <Section title="Customer">
        <Facts facts={contact} />
      </Section>

      <Section title="Riders" action={<StatusBadge meta={booking.sizing} size="sm" />} subtitle={booking.bikeMix}>
        <ul className="divide-y divide-hairline">
          {booking.riders.map((rider) => (
            <li key={rider.key} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className="text-xs text-fg-muted">{rider.label}</p>
                <p className="truncate text-sm font-medium text-fg">{rider.name}</p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-fg-2">
                <span>{rider.bike}</span>
                {rider.needsSize ? <StatusBadge meta={SIZING_STATUS.missing} size="sm" /> : <span>Height {rider.height}</span>}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Payment" action={booking.balance ? <StatusBadge meta={booking.balance} size="sm" /> : undefined}>
        <Facts facts={booking.payment} />
        {actions.retryCharge ? (
          <div className="mt-4">
            <RetryCharge bookingId={booking.id} amount={actions.retryCharge.amount} customer={booking.customer} />
          </div>
        ) : null}
      </Section>

      <Section title="Calendar and messages">
        <ul className="divide-y divide-hairline">
          {booking.followThrough.map((item) => (
            <li key={item.key} className="py-2.5 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-fg-2">{item.label}</p>
                <StatusBadge meta={item.meta} size="sm" />
              </div>
              {item.detail ? <p className="mt-1 break-words text-xs text-fg-muted">{item.detail}</p> : null}
              {followUp[item.key] ? <div className="mt-2">{followUp[item.key]}</div> : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Waivers" action={<StatusBadge meta={booking.waiverStatus} size="sm" />}>
        {booking.waivers.length ? (
          <ul className="divide-y divide-hairline">
            {booking.waivers.map((w) => (
              <li key={w.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{w.signer}</p>
                  <p className="text-xs text-fg-2">{w.coverage}</p>
                  <p className="text-xs text-fg-muted">Signed {w.signedAt}</p>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  {w.pdfUrl ? (
                    <a href={w.pdfUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses('ghost', 'sm')}>
                      PDF
                    </a>
                  ) : null}
                  {w.signatureUrl ? (
                    <a href={w.signatureUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses('ghost', 'sm')}>
                      Signature
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No waivers signed yet. Riders sign at checkout, or through the waiver link on the booking page." />
        )}
      </Section>

      <Section title="Manage" subtitle="Each change says what it sets off before it happens.">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <ChangeStatus bookingId={booking.id} status={actions.status} customer={booking.customer} options={STATUS_OPTIONS} />
          <ArchiveBooking bookingId={booking.id} customer={booking.customer} closeHref={closeHref} />
        </div>
      </Section>
    </div>
  );
}
