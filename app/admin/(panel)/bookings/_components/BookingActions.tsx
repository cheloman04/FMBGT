'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, SelectMenu, useAction, useConfirm, type ConfirmRequest, type SelectMenuOption } from '@/components/kit';
import { api } from '@/lib/admin/api';

// The drawer's actions, one island each so every button keeps its own pending
// state and its own error next to it (§8.5). Each goes through lib/admin/api.ts
// (a stale session goes to the login page) and useAction (router.refresh(): the
// drawer and the list repaint with the new state, which is the success message).

function Action({ children, error, note }: { children: ReactNode; error: string | null; note?: string | null }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {children}
      {error ? (
        <p role="alert" className="text-xs text-tone-red">
          {error}
        </p>
      ) : note ? (
        <p role="status" className="text-xs text-fg-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** Charge the saved card again for a balance charge that failed. */
export function RetryCharge({ bookingId, amount, customer }: { bookingId: string; amount: string; customer: string }) {
  const { confirm, dialog } = useConfirm();
  const retry = useAction(() => api.post('/api/admin/retry-charge', { booking_id: bookingId }), { badges: true });

  async function onClick() {
    const ok = await confirm({
      title: `Charge ${amount} to ${customer}'s card again?`,
      description: 'The saved card is charged right now. If it is declined again, the balance stays failed and the reason shows here.',
      confirmLabel: `Charge ${amount}`,
    });
    if (ok) await retry.run();
  }

  return (
    <Action error={retry.error}>
      <Button size="sm" variant="secondary" loading={retry.pending} onClick={onClick}>
        Retry charge
      </Button>
      {dialog}
    </Action>
  );
}

/** Create the Cal.com event that blocks the slot online. */
export function RetryCalendar({ bookingId }: { bookingId: string }) {
  const retry = useAction(() => api.post('/api/admin/retry-cal', { booking_id: bookingId }));
  return (
    <Action error={retry.error}>
      <Button size="sm" variant="secondary" loading={retry.pending} onClick={() => void retry.run()}>
        Retry calendar
      </Button>
    </Action>
  );
}

/** Send the confirmation email (online) or the manual-booking email (waiver link and balance) again. */
export function SendConfirmation({ bookingId, mode, to }: { bookingId: string; mode: 'send' | 'resend'; to: string | null }) {
  const { confirm, dialog } = useConfirm();
  // A resent email changes nothing on screen: say so next to the button (§8.5).
  const [sent, setSent] = useState(false);
  const send = useAction(() => api.post(`/api/admin/retrigger-webhook/${bookingId}`), { onSuccess: () => setSent(true) });

  async function onClick() {
    const ok = await confirm({
      title: mode === 'resend' ? 'Send the confirmation email again?' : 'Send the confirmation email?',
      description: to ? `It goes to ${to}.` : "It goes to the customer's email.",
      confirmLabel: 'Send email',
    });
    if (!ok) return;
    setSent(false);
    await send.run();
  }

  return (
    <Action error={send.error} note={sent && !send.pending ? `Sent${to ? ` to ${to}` : ''}.` : null}>
      <Button size="sm" variant="secondary" loading={send.pending} onClick={onClick}>
        {mode === 'resend' ? 'Resend email' : 'Send email'}
      </Button>
      {dialog}
    </Action>
  );
}

/** The customer left the review: stop the reminder emails. */
export function MarkReviewReceived({ enrollmentId }: { enrollmentId: string }) {
  const mark = useAction(() => api.post('/api/admin/mark-review-received', { enrollment_id: enrollmentId }));
  return (
    <Action error={mark.error}>
      <Button size="sm" variant="secondary" loading={mark.pending} onClick={() => void mark.run()}>
        Mark review received
      </Button>
    </Action>
  );
}

/** What each new status sets off, said before it happens (/api/admin/update-booking). */
const STATUS_CONFIRM: Record<string, (customer: string) => ConfirmRequest> = {
  confirmed: (customer) => ({
    title: `Set ${customer}'s booking back to confirmed?`,
    description: 'Its calendar slot is not taken again by itself: use Retry calendar afterwards.',
    confirmLabel: 'Set confirmed',
  }),
  completed: (customer) => ({
    title: `Mark ${customer}'s tour completed?`,
    description: 'The review request emails start and the tour is reported as done.',
    confirmLabel: 'Mark completed',
  }),
  cancelled: (customer) => ({
    title: `Cancel ${customer}'s booking?`,
    description: "Its calendar slot is freed and the booking is reported as cancelled. No money moves: refund it from the booking page if it's owed.",
    confirmLabel: 'Cancel booking',
    cancelLabel: 'Keep booking',
    danger: true,
  }),
  refunded: (customer) => ({
    title: `Mark ${customer}'s booking refunded?`,
    description: "This only changes the status and frees the calendar slot. It doesn't refund anything: do that from the booking page first.",
    confirmLabel: 'Mark refunded',
    danger: true,
  }),
};

export function ChangeStatus({
  bookingId,
  status,
  customer,
  options,
}: {
  bookingId: string;
  status: string;
  customer: string;
  options: SelectMenuOption[];
}) {
  const { confirm, dialog } = useConfirm();
  const change = useAction((next: string) => api.post('/api/admin/update-booking', { booking_id: bookingId, status: next }), {
    badges: true,
  });

  async function onChange(next: string) {
    if (next === status || !STATUS_CONFIRM[next]) return;
    if (!(await confirm(STATUS_CONFIRM[next](customer)))) return;
    await change.run(next);
  }

  return (
    // The menu keeps showing the saved status until the refresh brings the new one.
    <Action error={change.error} note={change.pending ? 'Saving…' : null}>
      <SelectMenu
        value={status}
        onChange={(next) => void onChange(next)}
        options={options}
        ariaLabel="Booking status"
        disabled={change.pending}
        layout="w-48"
      />
      {dialog}
    </Action>
  );
}

/**
 * /api/admin/delete-booking archives a booking with payment history (Trash, can
 * be restored) and deletes one without any. Either way it leaves this list, so
 * the drawer closes onto it.
 */
export function ArchiveBooking({ bookingId, customer, closeHref }: { bookingId: string; customer: string; closeHref: string }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const archive = useAction(() => api.post('/api/admin/delete-booking', { booking_id: bookingId }), {
    badges: true,
    // The list it lands on is rendered fresh; nothing to refresh here.
    refresh: false,
    onSuccess: () => router.replace(closeHref, { scroll: false }),
  });

  async function onClick() {
    const ok = await confirm({
      title: `Archive ${customer}'s booking?`,
      description:
        'It leaves this list and its calendar slot is freed. With payment history it goes to the Trash, where it can be restored; without any, it is deleted for good.',
      confirmLabel: 'Archive booking',
      danger: true,
    });
    if (ok) await archive.run();
  }

  return (
    <Action error={archive.error}>
      <Button size="sm" variant="danger" loading={archive.pending} onClick={onClick}>
        Archive booking
      </Button>
      {dialog}
    </Action>
  );
}
