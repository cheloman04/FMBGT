'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, Modal, Select, useAction } from '@/components/kit';
import { api } from '@/lib/admin/api';
import { PAYMENT_METHODS, asPaymentMethod, toCents } from '@/lib/admin/booking-form';
import type { MoneyAction } from '@/lib/admin/booking-page';

// The money an operator moves on a booking after an edit (lib/admin/booking-page.ts
// says which, and what each does). One button each; the dialog asks for the
// amount — the confirmation of a money move — and keeps its error inline (§8.5).
// After it, router.refresh() repaints Payment with the new figures, and the
// API's message stays next to the buttons.

/** One id per opened dialog: a double submit can't charge or refund twice (the API keys on it). */
function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16).padStart(8, '0').slice(-8)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
}

export function MoneyActions({
  bookingId,
  actions,
  paymentMethod,
}: {
  bookingId: string;
  actions: MoneyAction[];
  /** How the booking was paid: what "Method" opens with. */
  paymentMethod: string | null;
}) {
  const [open, setOpen] = useState<MoneyAction | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(asPaymentMethod(paymentMethod));
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const move = useAction(
    (action: MoneyAction, cents: number) =>
      action.kind === 'manual_payment'
        ? api.patch('/api/admin/manual-booking', { action: 'record_payment', id: bookingId, amount_cents: cents, payment_method: method })
        : api.post(`/api/admin/bookings/${bookingId}/payments`, {
            action: action.kind,
            amount_cents: cents,
            request_id: requestId,
            ...(action.method ? { method } : {}),
            ...(action.reason ? { reason: reason.trim() || null } : {}),
          }),
    {
      // A payment can settle a failed balance: the menu's red count may drop.
      badges: true,
      onSuccess: (data) => {
        const message = (data as { message?: unknown } | null)?.message;
        setDone(typeof message === 'string' && message ? message : 'Payment recorded.');
        setOpen(null);
      },
    },
  );

  function start(action: MoneyAction) {
    setOpen(action);
    setAmount(action.amount);
    setReason('');
    setProblem(null);
    setDone(null);
    move.clearError();
    setRequestId(newRequestId());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!open) return;
    const cents = toCents(amount);
    if (!cents) return setProblem('Enter an amount above $0.');
    setProblem(null);
    await move.run(open, cents);
  }

  if (!actions.length) return null;
  const error = problem ?? move.error;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action.kind} size="sm" variant="secondary" onClick={() => start(action)}>
            {action.label}
          </Button>
        ))}
      </div>
      {done ? (
        <p role="status" className="text-xs text-fg-2">
          {done}
        </p>
      ) : null}

      <Modal
        open={open !== null}
        onClose={() => (move.pending ? undefined : setOpen(null))}
        title={open?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" disabled={move.pending} onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button type="submit" form="money-action" variant={open?.danger ? 'danger' : 'primary'} loading={move.pending}>
              {open?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {open ? (
          <form id="money-action" onSubmit={submit} className="space-y-4">
            <p className="text-sm text-fg-2">{open.description}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Amount ($)"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
              {open.method ? (
                <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
            {open.reason ? (
              <Input label="Reason (internal)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. tour shortened to 2 h" />
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-tone-red">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
