'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, Input, useAction } from '@/components/kit';
import { api } from '@/lib/admin/api';
import { CopyCode } from '../../_components/CopyCode';

const EMPTY = { amount: '', recipient_name: '', recipient_email: '', notes: '' };
type FormState = typeof EMPTY;

// Minting refreshes the page, so the new card shows up in the list from the
// server; the code also stays here, ready to copy, until the next mint.
export function MintGiftCardForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [amountError, setAmountError] = useState<string>();
  const [minted, setMinted] = useState<string | null>(null);

  const mint = useAction((body: Record<string, unknown>) => api.post<{ gift_card: { code: string } }>('/api/admin/gift-cards', body), {
    onSuccess: (data) => {
      setMinted(data.gift_card.code);
      setForm(EMPTY);
    },
  });

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMinted(null);
    const dollars = Number(form.amount);
    if (!dollars || dollars <= 0) {
      setAmountError('Enter an amount greater than $0.');
      return;
    }
    setAmountError(undefined);
    await mint.run({
      amount_cents: Math.round(dollars * 100),
      recipient_name: form.recipient_name.trim() || undefined,
      recipient_email: form.recipient_email.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Amount (USD)"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          placeholder="100.00"
          error={amountError}
          {...field('amount')}
        />
        <Input label="Recipient name (optional)" placeholder="Jane Smith" autoComplete="off" {...field('recipient_name')} />
        <Input label="Recipient email (optional)" type="email" placeholder="jane@example.com" autoComplete="off" {...field('recipient_email')} />
        <Input label="Notes (optional)" placeholder="Purchaser, occasion…" {...field('notes')} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" loading={mint.pending}>
          {mint.pending ? 'Minting…' : 'Mint gift card'}
        </Button>
        {mint.error ? (
          <p role="alert" className="text-xs text-tone-red">
            {mint.error}
          </p>
        ) : null}
        {minted ? (
          <p role="status" className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            Minted <CopyCode code={minted} /> — copy it and share it with the recipient.
          </p>
        ) : null}
      </div>
    </form>
  );
}
