'use client';

import { Button, useAction, useConfirm } from '@/components/kit';
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
  const body = { [BODY_KEY[kind]]: id };
  // The menu's counters: a restored lead can be a hot one again, and deleting a
  // booking for good can leave its lead without a paid booking, back among the
  // open leads. A restored booking comes back Cancelled (never a failed charge)
  // and an archived lead isn't counted anywhere: those two leave them as they are.
  const restoreAction = useAction(() => api.post(`/api/admin/restore-${kind}`, body), { badges: kind === 'lead' });
  const purgeAction = useAction(() => api.post(`/api/admin/purge-${kind}`, body), { badges: kind === 'booking' });
  const busy = restoreAction.pending || purgeAction.pending;

  async function onRestore() {
    purgeAction.clearError();
    if (await confirm(restore)) await restoreAction.run();
  }

  async function onPurge() {
    restoreAction.clearError();
    if (await confirm(purge)) await purgeAction.run();
  }

  const error = restoreAction.error ?? purgeAction.error;

  // `@2xl:` is the list's width, where it turns into a table (`tableFrom="md"` on
  // the Trash page). In the rows the list gives this a whole line
  // (`mobileActions="fill"`): two halves. In the table, side by side on the right.
  return (
    <div className="flex flex-col gap-1.5 @2xl:items-end">
      <div className="grid grid-cols-2 gap-2 whitespace-nowrap @2xl:flex @2xl:justify-end">
        <Button size="sm" variant="secondary" loading={restoreAction.pending} disabled={busy} onClick={onRestore}>
          Restore
        </Button>
        <Button size="sm" variant="danger" loading={purgeAction.pending} disabled={busy} onClick={onPurge}>
          Delete forever
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-tone-red @2xl:max-w-64 @2xl:text-right">
          {error}
        </p>
      ) : null}
      {dialog}
    </div>
  );
}
