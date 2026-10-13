'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, useAction } from '@/components/kit';
import { api } from '@/lib/admin/api';
import { suggestPartnerCode } from '@/lib/discounts';

const EMPTY = { partner_name: '', discount_code: '', discount_percentage: '15', notes: '' };
type FormState = typeof EMPTY;
type Errors = Partial<Record<'partner_name' | 'discount_code' | 'discount_percentage', string>>;

export function AddPartnerForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [added, setAdded] = useState<string | null>(null);

  const add = useAction((body: Record<string, unknown>) => api.post('/api/admin/referral-partners', body), {
    onSuccess: () => {
      setAdded(form.discount_code.trim().toUpperCase());
      setForm(EMPTY);
    },
  });

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  // Typing a name proposes a code ("Biclicketa" → BIC-FMBGT-001) until the code is edited by hand.
  const onName = (name: string) =>
    setForm((prev) => ({
      ...prev,
      partner_name: name,
      discount_code: prev.discount_code && prev.discount_code !== suggestPartnerCode(prev.partner_name) ? prev.discount_code : name.trim() ? suggestPartnerCode(name) : '',
    }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setAdded(null);
    const pct = Number(form.discount_percentage);
    const next: Errors = {};
    if (!form.partner_name.trim()) next.partner_name = 'Enter the partner’s name.';
    if (!form.discount_code.trim()) next.discount_code = 'Enter a code.';
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) next.discount_percentage = 'A whole number from 1 to 100.';
    setErrors(next);
    if (Object.keys(next).length) return;
    await add.run({
      partner_name: form.partner_name.trim(),
      discount_code: form.discount_code.trim().toUpperCase(),
      discount_percentage: pct,
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Partner name"
          placeholder="Biclicketa Bike Store"
          autoComplete="off"
          error={errors.partner_name}
          value={form.partner_name}
          onChange={(e) => onName(e.target.value)}
        />
        <Input
          label="Discount code"
          placeholder="BIC-FMBGT-001"
          maxLength={30}
          autoComplete="off"
          hint="Letters, numbers and hyphens. Proposed from the name; edit it if you like."
          error={errors.discount_code}
          value={form.discount_code}
          onChange={(e) => set('discount_code', e.target.value.toUpperCase())}
        />
        <Input
          label="Discount %"
          type="number"
          inputMode="numeric"
          min="1"
          max="100"
          error={errors.discount_percentage}
          value={form.discount_percentage}
          onChange={(e) => set('discount_percentage', e.target.value)}
        />
        <Input
          label="Notes (optional)"
          placeholder="Contact, agreement details…"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" loading={add.pending}>
          {add.pending ? 'Adding…' : 'Add partner'}
        </Button>
        {add.error ? (
          <p role="alert" className="text-xs text-tone-red">
            {add.error}
          </p>
        ) : null}
        {added ? (
          <p role="status" className="text-xs text-fg-muted">
            Added. {added} works at checkout now.
          </p>
        ) : null}
      </div>
    </form>
  );
}
