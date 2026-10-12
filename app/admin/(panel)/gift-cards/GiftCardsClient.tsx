'use client';

import { useState } from 'react';
import { formatPrice } from '@/lib/pricing';

interface GiftCard {
  id: string;
  code: string;
  amount_cents: number;
  status: 'active' | 'reserved' | 'redeemed' | 'void';
  recipient_name: string | null;
  recipient_email: string | null;
  purchaser_name: string | null;
  notes: string | null;
  reserved_booking_id: string | null;
  redeemed_booking_id: string | null;
  redeemed_amount_cents: number | null;
  redeemed_at: string | null;
  created_by: string | null;
  created_at: string;
}

interface Props {
  initialGiftCards: GiftCard[];
}

const STATUS_STYLES: Record<GiftCard['status'], string> = {
  active: 'border border-green-500/35 bg-green-500/12 text-green-400',
  reserved: 'border border-amber-500/35 bg-amber-500/12 text-amber-400',
  redeemed: 'border border-blue-500/35 bg-blue-500/12 text-blue-400',
  void: 'border border-border bg-muted text-muted-foreground',
};

export function GiftCardsClient({ initialGiftCards }: Props) {
  const [cards, setCards] = useState<GiftCard[]>(initialGiftCards);
  const [form, setForm] = useState({ amount: '', recipient_name: '', recipient_email: '', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const handleMint = async () => {
    setFormError(null);
    const dollars = Number(form.amount);
    if (!dollars || dollars <= 0) {
      setFormError('Enter a gift card amount greater than $0.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: Math.round(dollars * 100),
          recipient_name: form.recipient_name.trim() || undefined,
          recipient_email: form.recipient_email.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Failed to mint gift card.'); return; }
      setCards((prev) => [data.gift_card, ...prev]);
      setForm({ amount: '', recipient_name: '', recipient_email: '', notes: '' });
    } catch {
      setFormError('Could not mint gift card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/gift-cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'void' }),
      });
      if (res.ok) {
        const data = await res.json();
        setCards((prev) => prev.map((c) => (c.id === id ? data.gift_card : c)));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/gift-cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setCards((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setBusy(null);
      setConfirmingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mint form */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
        <h2 className="mb-1 text-base font-semibold text-foreground">Mint Gift Card</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Fixed amount, single-use, never expires. A unique code is generated automatically — share it with the recipient.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Amount (USD) *</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="100.00"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Recipient Name (optional)</label>
            <input
              type="text"
              value={form.recipient_name}
              onChange={(e) => setForm((p) => ({ ...p, recipient_name: e.target.value }))}
              placeholder="Jane Smith"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Recipient Email (optional)</label>
            <input
              type="email"
              value={form.recipient_email}
              onChange={(e) => setForm((p) => ({ ...p, recipient_email: e.target.value }))}
              placeholder="jane@example.com"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Purchaser, occasion, etc."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-xs text-destructive">{formError}</p>}
        <button
          onClick={handleMint}
          disabled={saving}
          className="mt-4 rounded-xl border border-green-500/35 bg-green-500/12 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-green-500/20 disabled:opacity-50"
        >
          {saving ? 'Minting...' : 'Mint Gift Card'}
        </button>
      </div>

      {/* Gift cards table */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
        <div className="border-b border-border/50 px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">Issued Gift Cards</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recipient</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Redeemed</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {cards.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No gift cards yet. Mint one above.
                  </td>
                </tr>
              )}
              {cards.map((card) => (
                <tr key={card.id} className={`transition-colors hover:bg-muted/20 ${card.status === 'void' ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleCopy(card.code)}
                      title="Copy code"
                      className="font-mono text-sm text-foreground transition-colors hover:text-green-400"
                    >
                      {card.code}
                    </button>
                    {copied === card.code && <span className="ml-2 text-xs text-green-400">Copied</span>}
                  </td>
                  <td className="px-5 py-3 font-semibold text-foreground">{formatPrice(card.amount_cents)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[card.status]}`}>
                      {card.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {card.recipient_name || card.recipient_email || '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {card.status === 'redeemed' && card.redeemed_amount_cents != null
                      ? formatPrice(card.redeemed_amount_cents)
                      : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {card.status === 'active' && (
                        <button
                          onClick={() => handleVoid(card.id)}
                          disabled={busy === card.id}
                          className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                        >
                          {busy === card.id ? '...' : 'Void'}
                        </button>
                      )}
                      {card.status === 'void' && (
                        confirmingDelete === card.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(card.id)}
                              disabled={busy === card.id}
                              className="rounded-xl border border-red-500/40 bg-red-500/12 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                            >
                              {busy === card.id ? '...' : 'Confirm delete'}
                            </button>
                            <button
                              onClick={() => setConfirmingDelete(null)}
                              disabled={busy === card.id}
                              className="rounded-xl border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmingDelete(card.id)}
                            className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-400"
                          >
                            Delete
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
