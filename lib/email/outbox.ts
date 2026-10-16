import 'server-only';

// The email outbox: the app's side of the hand-off to the Kigaru hub (contract §5).
//
// `queueEmail()` writes the composed email to `email_outbox` (migration 035) and
// tries to hand it to the hub right away. If the hub is down, rate-limited or
// paused, the row waits and `drainEmailOutbox()` (the /api/cron/emails tick)
// retries it with backoff and the SAME idempotency key — the hub turns a repeat
// into a `200 duplicate`, so a retry can never send an email twice.
//
// `202` from the hub means "stored", not "delivered": delivery is tracked in the
// hub and shown in /admin/emails.

import { hubFromEnv } from '@/components/kit/conversations/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifySupportAlert } from '@/lib/n8n';
import { EMAIL_TYPES, isTestRecipient, onlyTestRecipients, type EmailType } from './config';
import { postEmailToHub, type HubConnection, type HubEmailBody, type HubSendOutcome } from './hub';

export type EmailEntityType = 'lead' | 'customer' | 'booking' | 'payment' | 'review';

export type EmailIntent = {
  type: EmailType;
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** `<email_type>:<entity id>` (contract §5.1). The same key never sends twice. */
  idempotencyKey: string;
  entityType?: EmailEntityType;
  entityId?: string | null;
};

export type EmailOutboxRow = {
  id: string;
  idempotency_key: string;
  email_type: string;
  category: 'transactional' | 'marketing';
  to_email: string;
  subject: string;
  html: string;
  text_body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: 'pending' | 'processing' | 'sent' | 'rejected' | 'failed' | 'skipped';
  attempt_count: number;
  last_status_code: number | null;
  last_error: string | null;
};

/**
 * What happened to one email, for the caller (a Stripe webhook, an admin action).
 * `ok` = the email is the hub's job now, or will be: sent to the hub, or queued for
 * a retry the tick will make. `ok: false` = it will NOT go out without someone acting.
 */
export type QueueEmailResult = {
  ok: boolean;
  /** `invalid` = no usable recipient address; `error` = the outbox itself failed (worth retrying). */
  state: 'sent' | 'pending' | 'skipped' | 'rejected' | 'failed' | 'invalid' | 'error';
  httpStatus: number | null;
  error: string | null;
};

/** After this many attempts a row stops retrying (about 12 hours with the backoff). */
export const MAX_EMAIL_ATTEMPTS = 12;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/;
const BODY_RETENTION_MS = 30 * 86_400_000;

/** 1 min · 2 · 4 · … capped at 2 hours. */
export function emailRetryDelayMs(attemptCount: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, Math.min(attemptCount - 1, 20)), 2 * 60 * 60 * 1000);
}

// Database typing intentionally lags proposed migrations in this repository.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function hubConnection(): HubConnection | null {
  const config = hubFromEnv();
  return config ? { baseUrl: config.baseUrl, key: config.key, secret: config.secret } : null;
}

export function hubBodyFromRow(row: EmailOutboxRow): HubEmailBody {
  return {
    to: row.to_email,
    subject: row.subject,
    html: row.html,
    ...(row.text_body ? { text: row.text_body } : {}),
    email_type: row.email_type,
    category: row.category,
    idempotency_key: row.idempotency_key,
    ...(row.entity_type && row.entity_id ? { entity_type: row.entity_type, entity_id: row.entity_id } : {}),
  };
}

/** The state a row moves to after one attempt, and what to write. Pure: the tests pin it. */
export function settleAttempt(
  row: Pick<EmailOutboxRow, 'attempt_count'>,
  outcome: HubSendOutcome,
  now: number = Date.now(),
): { status: EmailOutboxRow['status']; patch: Record<string, unknown>; alert: boolean } {
  const stamp = new Date(now).toISOString();
  if (outcome.kind === 'accepted') {
    return {
      status: 'sent',
      alert: false,
      patch: {
        status: 'sent',
        sent_at: stamp,
        hub_email_id: outcome.hubEmailId && UUID_RE.test(outcome.hubEmailId) ? outcome.hubEmailId : null,
        hub_status: outcome.hubStatus,
        last_status_code: outcome.httpStatus,
        last_error: null,
        updated_at: stamp,
      },
    };
  }
  if (outcome.kind === 'rejected') {
    return {
      status: 'rejected',
      // A suppression is the hub doing its job (a bounce, a complaint, an
      // unsubscribe): not something to wake anyone up for. Anything else is.
      alert: outcome.reason !== 'suppressed',
      patch: {
        status: 'rejected',
        last_status_code: outcome.httpStatus,
        last_error: `${outcome.reason}: ${outcome.error}`.slice(0, 500),
        updated_at: stamp,
      },
    };
  }
  if (row.attempt_count >= MAX_EMAIL_ATTEMPTS) {
    return {
      status: 'failed',
      alert: true,
      patch: {
        status: 'failed',
        last_status_code: outcome.httpStatus,
        last_error: `gave_up: ${outcome.error}`.slice(0, 500),
        updated_at: stamp,
      },
    };
  }
  return {
    status: 'pending',
    alert: false,
    patch: {
      status: 'pending',
      next_attempt_at: new Date(now + emailRetryDelayMs(row.attempt_count)).toISOString(),
      last_status_code: outcome.httpStatus,
      last_error: outcome.error.slice(0, 500),
      updated_at: stamp,
    },
  };
}

export type DrainSummary = {
  skipped?: 'not_configured';
  claimed: number;
  sent: number;
  retrying: number;
  rejected: number;
  failed: number;
};

/**
 * Hands due rows to the hub. Without the hub connection configured it claims
 * nothing (the rows wait). Outside production it only ever claims `*@resend.dev`.
 */
export async function drainEmailOutbox(
  options: { limit?: number; keys?: string[] } = {},
  deps: { db?: Db; connection?: HubConnection | null; fetchImpl?: typeof fetch; onlyTest?: boolean } = {},
): Promise<DrainSummary & { outcomes: Record<string, EmailOutboxRow['status']> }> {
  const summary: DrainSummary = { claimed: 0, sent: 0, retrying: 0, rejected: 0, failed: 0 };
  const outcomes: Record<string, EmailOutboxRow['status']> = {};
  const connection = deps.connection === undefined ? hubConnection() : deps.connection;
  if (!connection) return { ...summary, skipped: 'not_configured', outcomes };

  const db: Db = deps.db ?? getSupabaseAdmin();
  const { data, error } = await db.rpc('claim_email_outbox', {
    p_limit: options.limit ?? 20,
    p_keys: options.keys?.length ? options.keys : null,
    p_only_test: deps.onlyTest ?? onlyTestRecipients(),
  });
  if (error) throw new Error(`Failed to claim email outbox: ${error.message}`);
  const rows = (data ?? []) as EmailOutboxRow[];
  summary.claimed = rows.length;

  for (const row of rows) {
    const outcome = await postEmailToHub(connection, hubBodyFromRow(row), deps.fetchImpl);
    const settled = settleAttempt(row, outcome);
    const { error: updateError } = await db
      .from('email_outbox')
      .update(settled.patch)
      .eq('id', row.id)
      .eq('status', 'processing');
    if (updateError) {
      // The row stays `processing` and is claimed again in 15 minutes; the hub's
      // idempotency key turns that second hand-off into a duplicate.
      console.error('[email-outbox] could not save the attempt', { key: row.idempotency_key, error: updateError.message });
    }
    outcomes[row.idempotency_key] = settled.status;
    if (settled.status === 'sent') summary.sent++;
    else if (settled.status === 'pending') summary.retrying++;
    else if (settled.status === 'rejected') summary.rejected++;
    else summary.failed++;

    if (settled.alert) {
      await notifySupportAlert({
        source: 'email-outbox',
        severity: settled.status === 'failed' ? 'error' : 'warning',
        summary: `Customer email ${row.email_type} ${settled.status === 'failed' ? 'gave up after retries' : 'was rejected by Kigaru'}`,
        bookingId: row.entity_type === 'booking' ? row.entity_id : null,
        leadId: row.entity_type === 'lead' ? row.entity_id : null,
        details: {
          idempotency_key: row.idempotency_key,
          http_status: settled.patch.last_status_code ?? null,
          error: settled.patch.last_error ?? null,
        },
      });
    }
  }

  return { ...summary, outcomes };
}

async function readRow(db: Db, key: string): Promise<EmailOutboxRow | null> {
  const { data } = await db
    .from('email_outbox')
    .select('id, idempotency_key, status, last_status_code, last_error')
    .eq('idempotency_key', key)
    .maybeSingle();
  return (data as EmailOutboxRow | null) ?? null;
}

function resultFromRow(row: Pick<EmailOutboxRow, 'status' | 'last_status_code' | 'last_error'>): QueueEmailResult {
  switch (row.status) {
    case 'sent':
      return { ok: true, state: 'sent', httpStatus: row.last_status_code, error: null };
    case 'skipped':
      return { ok: true, state: 'skipped', httpStatus: null, error: row.last_error };
    case 'rejected':
    case 'failed':
      return { ok: false, state: row.status, httpStatus: row.last_status_code, error: row.last_error ?? row.status };
    default:
      // Waiting for the tick (the hub was down, or another worker holds it).
      return { ok: true, state: 'pending', httpStatus: row.last_status_code, error: row.last_error };
  }
}

/**
 * Writes one composed email to the outbox and hands it to the hub now.
 *
 * - The same `idempotencyKey` twice is one email: the second call reports the
 *   first one's state.
 * - Outside production, an address that isn't `*@resend.dev` is recorded as
 *   `skipped` and never offered to the hub.
 * - Never throws: an email must not take a Stripe webhook or an admin action down.
 */
export async function queueEmail(intent: EmailIntent, deps: { db?: Db } = {}): Promise<QueueEmailResult> {
  const to = intent.to.trim().toLowerCase();
  if (!EMAIL_RE.test(to)) return { ok: false, state: 'invalid', httpStatus: null, error: 'no valid recipient email' };

  const db: Db = deps.db ?? getSupabaseAdmin();
  const skipped = onlyTestRecipients() && !isTestRecipient(to);
  try {
    const { error } = await db.from('email_outbox').insert({
      idempotency_key: intent.idempotencyKey,
      email_type: intent.type,
      category: EMAIL_TYPES[intent.type],
      to_email: to,
      subject: intent.subject,
      html: intent.html,
      text_body: intent.text ?? null,
      entity_type: intent.entityType ?? null,
      entity_id: intent.entityId && UUID_RE.test(intent.entityId) ? intent.entityId : null,
      ...(skipped ? { status: 'skipped', last_error: 'not sent: a real address outside production' } : {}),
    });
    if (error && error.code !== '23505') throw new Error(error.message);

    if (!skipped && !error) {
      const drained = await drainEmailOutbox({ keys: [intent.idempotencyKey], limit: 1 }, { db });
      if (drained.skipped === 'not_configured') {
        console.error('[email-outbox] the Kigaru connection is not configured; the email waits in the outbox');
      }
    }
    const row = await readRow(db, intent.idempotencyKey);
    return row ? resultFromRow(row) : { ok: false, state: 'error', httpStatus: null, error: 'outbox row not found' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email-outbox] could not queue the email', { key: intent.idempotencyKey, error: message });
    return { ok: false, state: 'error', httpStatus: null, error: `outbox: ${message}`.slice(0, 300) };
  }
}

/** Bodies of settled rows go after 30 days: the outbox is a queue, not an archive. */
export async function purgeSettledEmailBodies(deps: { db?: Db; now?: number } = {}): Promise<void> {
  const db: Db = deps.db ?? getSupabaseAdmin();
  const cutoff = new Date((deps.now ?? Date.now()) - BODY_RETENTION_MS).toISOString();
  const { error } = await db
    .from('email_outbox')
    .update({ html: '', text_body: null })
    .in('status', ['sent', 'rejected', 'failed', 'skipped'])
    .lt('updated_at', cutoff)
    .neq('html', '');
  if (error) console.error('[email-outbox] could not purge old bodies:', error.message);
}
