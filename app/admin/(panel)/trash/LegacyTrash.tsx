'use client';

// TEMPORARY: the Trash as it was inside AdminClient, moved unchanged to its own
// route (phase 2, step 3c-1). Step 3c-2 rebuilds /admin/trash with the kit and
// deletes this file.
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatFloridaCalendarDate, formatFloridaDateTime } from '@/lib/display-time';

export interface TrashedBooking {
  id: string;
  status: string;
  date: string;
  location_name: string;
  total_price: number;
  deposit_amount: number | null;
  deposit_payment_status: string | null;
  deleted_at: string;
  deleted_by: string | null;
  created_at: string;
}

export interface TrashedLead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  selected_trail_type: string | null;
  selected_location_name: string | null;
  deleted_at: string;
  deleted_by: string | null;
  created_at: string;
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(d: string) {
  return formatFloridaCalendarDate(d);
}

function formatDateTime(iso: string) {
  return formatFloridaDateTime(iso);
}

export function LegacyTrash({ trashedBookings, trashedLeads }: { trashedBookings: TrashedBooking[]; trashedLeads: TrashedLead[] }) {
  const router = useRouter();
  const handleUnauthorized = useCallback(() => {
    router.push('/admin/login?expired=1&next=%2Fadmin%2Ftrash');
  }, [router]);

  const [localTrashedBookings, setLocalTrashedBookings] = useState<TrashedBooking[]>(trashedBookings);
  const [localTrashedLeads, setLocalTrashedLeads] = useState<TrashedLead[]>(trashedLeads);
  const [trashActionId, setTrashActionId] = useState<string | null>(null);
  const [purgeDialog, setPurgeDialog] = useState<{ type: 'booking' | 'lead'; id: string; label: string; sublabel: string } | null>(null);

  const handleRestoreBooking = async (bookingId: string) => {
    setTrashActionId(bookingId);
    try {
      const res = await fetch('/api/admin/restore-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) {
        setLocalTrashedBookings((prev) => prev.filter((b) => b.id !== bookingId));
        router.refresh(); // a restored booking counts in the stats again
      }
    } finally {
      setTrashActionId(null);
    }
  };

  const handlePurgeBooking = async (bookingId: string) => {
    setTrashActionId(bookingId);
    try {
      const res = await fetch('/api/admin/purge-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setLocalTrashedBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } finally {
      setTrashActionId(null);
    }
  };

  const handleRestoreLead = async (leadId: string) => {
    setTrashActionId(leadId);
    try {
      const res = await fetch('/api/admin/restore-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) {
        setLocalTrashedLeads((prev) => prev.filter((l) => l.id !== leadId));
        router.refresh();
      }
    } finally {
      setTrashActionId(null);
    }
  };

  const handlePurgeLead = async (leadId: string) => {
    setTrashActionId(leadId);
    try {
      const res = await fetch('/api/admin/purge-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setLocalTrashedLeads((prev) => prev.filter((l) => l.id !== leadId));
    } finally {
      setTrashActionId(null);
    }
  };

  return (
    <div className="relative">
        {purgeDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => (trashActionId ? undefined : setPurgeDialog(null))} />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-card text-card-foreground shadow-[0_0_0_1px_rgba(239,68,68,0.08),0_20px_80px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
              <div className="p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Delete {purgeDialog.type === 'booking' ? 'Booking' : 'Lead'} Forever?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This will <span className="font-semibold text-red-600 dark:text-red-300">permanently remove</span> this record from the database. This action cannot be undone.
                </p>
                <div className="mt-4 rounded-xl border border-border bg-background/60 p-4 text-sm">
                  <p className="font-medium text-foreground">{purgeDialog.label}</p>
                  <p className="mt-1 text-muted-foreground">{purgeDialog.sublabel}</p>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setPurgeDialog(null)}
                    disabled={!!trashActionId}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Keep
                  </button>
                  <button
                    onClick={() => {
                      if (purgeDialog.type === 'booking') handlePurgeBooking(purgeDialog.id);
                      else handlePurgeLead(purgeDialog.id);
                      setPurgeDialog(null);
                    }}
                    disabled={!!trashActionId}
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {trashActionId ? 'Deleting...' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

          <div className="space-y-6">
            {/* Trashed Bookings */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Archived Bookings ({localTrashedBookings.length})</h3>
              {localTrashedBookings.length === 0 ? (
                <div className="rounded-xl border border-border bg-card/60 py-10 text-center text-sm text-muted-foreground">No archived bookings.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card/80">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Booking</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Payment</th>
                        <th className="px-4 py-3 text-left font-medium">Archived by</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {localTrashedBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{b.location_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{b.status}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(b.date)}</td>
                          <td className="px-4 py-3">
                            <p className="text-foreground">{formatPrice(b.total_price)}</p>
                            {b.deposit_payment_status === 'paid' && (
                              <p className="text-xs text-green-400">Deposit paid: {formatPrice(b.deposit_amount ?? 0)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">{b.deleted_by ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(b.deleted_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleRestoreBooking(b.id)}
                                disabled={trashActionId === b.id}
                                className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                              >
                                {trashActionId === b.id ? '...' : 'Restore'}
                              </button>
                              <button
                                onClick={() => setPurgeDialog({ type: 'booking', id: b.id, label: b.location_name, sublabel: formatDate(b.date) })}
                                disabled={trashActionId === b.id}
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                              >
                                Delete Forever
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Trashed Leads */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Archived Leads ({localTrashedLeads.length})</h3>
              {localTrashedLeads.length === 0 ? (
                <div className="rounded-xl border border-border bg-card/60 py-10 text-center text-sm text-muted-foreground">No archived leads.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card/80">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Lead</th>
                        <th className="px-4 py-3 text-left font-medium">Trail / Location</th>
                        <th className="px-4 py-3 text-left font-medium">Archived by</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {localTrashedLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{l.full_name}</p>
                            <p className="text-xs text-muted-foreground">{l.email}</p>
                            {l.phone && <p className="text-xs text-muted-foreground">{l.phone}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-muted-foreground capitalize">{l.selected_trail_type ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">{l.selected_location_name ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">{l.deleted_by ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(l.deleted_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleRestoreLead(l.id)}
                                disabled={trashActionId === l.id}
                                className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                              >
                                {trashActionId === l.id ? '...' : 'Restore'}
                              </button>
                              <button
                                onClick={() => setPurgeDialog({ type: 'lead', id: l.id, label: l.full_name, sublabel: l.email })}
                                disabled={trashActionId === l.id}
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                              >
                                Delete Forever
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
    </div>
  );
}
