'use client';

import { useState } from 'react';

interface ReferralPartner {
  id: string;
  partner_name: string;
  discount_code: string;
  discount_percentage: number;
  active: boolean;
  uses_count: number;
  notes: string | null;
  created_at: string;
}

interface Props {
  initialPartners: ReferralPartner[];
}

function suggestCode(name: string): string {
  const prefix = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
  return `${prefix}-FMBGT-001`;
}

export function ReferralsClient({ initialPartners }: Props) {
  const [partners, setPartners] = useState<ReferralPartner[]>(initialPartners);
  const [form, setForm] = useState({ partner_name: '', discount_code: '', discount_percentage: '15', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      partner_name: name,
      discount_code: prev.discount_code || suggestCode(name),
    }));
  };

  const handleCreate = async () => {
    setFormError(null);
    if (!form.partner_name.trim() || !form.discount_code.trim()) {
      setFormError('Partner name and discount code are required.');
      return;
    }
    const pct = Number(form.discount_percentage);
    if (!pct || pct < 1 || pct > 100) {
      setFormError('Discount percentage must be between 1 and 100.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/referral-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_name: form.partner_name.trim(),
          discount_code: form.discount_code.trim().toUpperCase(),
          discount_percentage: pct,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Failed to create partner.'); return; }
      setPartners((prev) => [data.partner, ...prev]);
      setForm({ partner_name: '', discount_code: '', discount_percentage: '15', notes: '' });
    } catch {
      setFormError('Could not save partner. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    setToggling(id);
    try {
      const res = await fetch('/api/admin/referral-partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !active }),
      });
      if (res.ok) {
        const data = await res.json();
        setPartners((prev) => prev.map((p) => (p.id === id ? data.partner : p)));
      }
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* FAM fixed code */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Friends &amp; Family Code</p>
            <p className="mt-1 font-mono text-2xl font-bold text-foreground">FAM-FMBGT</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Fixed 20% discount — hardcoded, always active</p>
          </div>
          <span className="rounded-full border border-green-500/35 bg-green-500/12 px-3 py-1 text-xs font-semibold text-green-400">Always Active</span>
        </div>
      </div>

      {/* Add partner form */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
        <h2 className="mb-4 text-base font-semibold text-foreground">Add New Partner</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Partner Name *</label>
            <input
              type="text"
              value={form.partner_name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Biclicketa Bike Store"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Discount Code *</label>
            <input
              type="text"
              value={form.discount_code}
              onChange={(e) => setForm((p) => ({ ...p, discount_code: e.target.value.toUpperCase() }))}
              placeholder="BIC-FMBGT-001"
              maxLength={30}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Discount % *</label>
            <input
              type="number"
              min="1"
              max="100"
              value={form.discount_percentage}
              onChange={(e) => setForm((p) => ({ ...p, discount_percentage: e.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Contact info, agreement details..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-xs text-destructive">{formError}</p>}
        <button
          onClick={handleCreate}
          disabled={saving}
          className="mt-4 rounded-xl border border-green-500/35 bg-green-500/12 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-green-500/20 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add Partner'}
        </button>
      </div>

      {/* Partners table */}
      <div className="rounded-2xl border border-border/70 bg-card/80 shadow-[0_10px_24px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="border-b border-border/50 px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">Partner Codes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Partner</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uses</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {partners.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No partner referral codes yet. Add one above.
                  </td>
                </tr>
              )}
              {partners.map((partner) => (
                <tr key={partner.id} className={`transition-colors hover:bg-muted/20 ${!partner.active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-foreground">{partner.partner_name}</td>
                  <td className="px-5 py-3 font-mono text-sm text-foreground">{partner.discount_code}</td>
                  <td className="px-5 py-3 text-foreground">{partner.discount_percentage}%</td>
                  <td className="px-5 py-3">
                    <span className={`font-semibold ${partner.uses_count > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {partner.uses_count}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${partner.active ? 'border border-green-500/35 bg-green-500/12 text-green-400' : 'border border-border bg-muted text-muted-foreground'}`}>
                      {partner.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 max-w-[200px] truncate text-xs text-muted-foreground">{partner.notes ?? '—'}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleToggle(partner.id, partner.active)}
                      disabled={toggling === partner.id}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                        partner.active
                          ? 'border-border text-muted-foreground hover:border-red-500/40 hover:text-red-400'
                          : 'border-border text-muted-foreground hover:border-green-500/40 hover:text-green-400'
                      }`}
                    >
                      {toggling === partner.id ? '...' : partner.active ? 'Deactivate' : 'Activate'}
                    </button>
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
