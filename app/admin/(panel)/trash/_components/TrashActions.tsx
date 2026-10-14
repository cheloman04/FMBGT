'use client';

import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, useAction, useConfirm, type ConfirmRequest } from '@/components/kit';
import { api } from '@/lib/admin/api';
import type { TrashActionsCopy } from '@/lib/admin/trash';

// The two actions of a row in the Trash, each with its own pending state and
// its error next to the buttons (§8.5). Through lib/admin/api.ts (a stale
// session goes to the login page) and useAction: router.refresh() repaints the
// list, and the row leaving it is the success message.
//
// What each one does is in the confirmation, written from the route in
// lib/admin/trash.ts.

const BODY_KEY = { booking: 'booking_id', lead: 'lead_id' } as const;

export function TrashActions({ kind, id, restore, purge }: TrashActionsCopy & { kind: 'booking' | 'lead'; id: string }) {
  const { confirm, dialog } = useConfirm();
  // 🪤 The confirmation can't render in place: these buttons sit in a list cell
  // lifted over the row (`relative z-[1]`, a stacking context), and every later
  // row would paint over its veil — and stay clickable. It goes to the nearest
  // [data-kit], where the theme's tokens still apply (as the kit's DatePicker).
  const [layer, setLayer] = useState<Element | null>(null);
  const body = { [BODY_KEY[kind]]: id };
  // The menu's counters: a restored lead can be a hot one again, and deleting a
  // booking for good can leave its lead without a paid booking, back among the
  // open leads. A restored booking comes back Cancelled (never a failed charge)
  // and an archived lead isn't counted anywhere: those two leave them as they are.
  const restoreAction = useAction(() => api.post(`/api/admin/restore-${kind}`, body), { badges: kind === 'lead' });
  const purgeAction = useAction(() => api.post(`/api/admin/purge-${kind}`, body), { badges: kind === 'booking' });
  const busy = restoreAction.pending || purgeAction.pending;

  async function ask(event: MouseEvent<HTMLButtonElement>, request: ConfirmRequest): Promise<boolean> {
    setLayer(event.currentTarget.closest('[data-kit]') ?? document.body);
    return confirm(request);
  }

  async function onRestore(event: MouseEvent<HTMLButtonElement>) {
    purgeAction.clearError();
    if (await ask(event, restore)) await restoreAction.run();
  }

  async function onPurge(event: MouseEvent<HTMLButtonElement>) {
    restoreAction.clearError();
    if (await ask(event, purge)) await purgeAction.run();
  }

  const error = restoreAction.error ?? purgeAction.error;

  return (
    <div className="flex flex-col gap-1.5 max-md:mt-2 md:items-end">
      {/* On the phone, the row's last line: two halves. In the table, right
          aligned; a narrow one stacks them, never breaking "Delete forever" in two. */}
      <div className="grid grid-cols-2 gap-2 whitespace-nowrap md:flex md:flex-wrap md:justify-end">
        <Button size="sm" variant="secondary" loading={restoreAction.pending} disabled={busy} onClick={onRestore}>
          Restore
        </Button>
        <Button size="sm" variant="danger" loading={purgeAction.pending} disabled={busy} onClick={onPurge}>
          Delete forever
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-tone-red md:max-w-64 md:text-right">
          {error}
        </p>
      ) : null}
      {dialog && layer ? createPortal(dialog, layer) : null}
    </div>
  );
}
