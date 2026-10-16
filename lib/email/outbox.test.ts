import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock('@/components/kit/conversations/server', () => ({ hubFromEnv: () => null }));
const { notifySupportAlert } = vi.hoisted(() => ({ notifySupportAlert: vi.fn() }));
vi.mock('@/lib/n8n', () => ({ notifySupportAlert }));

import { isTestRecipient, kigaruEmailTypes, onlyTestRecipients, sendsViaKigaru } from './config';
import { postEmailToHub, type HubEmailBody } from './hub';
import {
  MAX_EMAIL_ATTEMPTS,
  drainEmailOutbox,
  emailRetryDelayMs,
  hubBodyFromRow,
  queueEmail,
  settleAttempt,
  type EmailOutboxRow,
} from './outbox';

const CONNECTION = { baseUrl: 'https://hub.test', key: 'k', secret: 's3cr3t' };
const BODY: HubEmailBody = {
  to: 'guest@resend.dev',
  subject: 'Hi',
  html: '<p>Hi</p>',
  email_type: 'booking_confirmed',
  category: 'transactional',
  idempotency_key: 'booking_confirmed:b1',
};

function hubAnswering(status: number, body: unknown = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Response.json(body, { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('the switch per email type (KIGARU_EMAIL_TYPES)', () => {
  it('lists the types that go through Kigaru; unknown names are ignored; * is all of them', () => {
    expect([...kigaruEmailTypes('booking_confirmed, review_request,nonsense')]).toEqual(['booking_confirmed', 'review_request']);
    expect(kigaruEmailTypes('').size).toBe(0);
    expect(kigaruEmailTypes(undefined).size).toBe(0);
    expect(kigaruEmailTypes('*').size).toBe(5);
    expect(sendsViaKigaru('lead_follow_up', 'booking_confirmed')).toBe(false);
    expect(sendsViaKigaru('lead_follow_up', 'lead_follow_up')).toBe(true);
  });

  it('only production may send to a real address; elsewhere only *@resend.dev', () => {
    expect(onlyTestRecipients('production')).toBe(false);
    expect(onlyTestRecipients('preview')).toBe(true);
    expect(onlyTestRecipients(undefined)).toBe(true);
    expect(isTestRecipient('Delivered@Resend.dev')).toBe(true);
    expect(isTestRecipient('guest@gmail.com')).toBe(false);
  });
});

describe('POST /api/channels/email: what each answer means', () => {
  it('202 and 200 duplicate are accepted; the secret travels in headers, never in the body', async () => {
    const hub = hubAnswering(202, { ok: true, id: 'e1', status: 'queued', duplicate: false });
    const out = await postEmailToHub(CONNECTION, BODY, hub.fetchImpl);
    expect(out).toEqual({ kind: 'accepted', httpStatus: 202, hubEmailId: 'e1', hubStatus: 'queued', duplicate: false });
    expect(hub.calls[0].url).toBe('https://hub.test/api/channels/email');
    expect((hub.calls[0].init.headers as Record<string, string>)['x-senzai-connection-secret']).toBe('s3cr3t');
    expect(String(hub.calls[0].init.body)).not.toContain('s3cr3t');
    expect(JSON.parse(String(hub.calls[0].init.body)).idempotency_key).toBe('booking_confirmed:b1');

    const dup = await postEmailToHub(CONNECTION, BODY, hubAnswering(200, { ok: true, id: 'e1', status: 'delivered', duplicate: true }).fetchImpl);
    expect(dup).toMatchObject({ kind: 'accepted', duplicate: true, hubStatus: 'delivered' });
  });

  it('retries ONLY 429, 5xx (503 paused included) and network errors', async () => {
    expect((await postEmailToHub(CONNECTION, BODY, hubAnswering(429).fetchImpl)).kind).toBe('retry');
    const paused = await postEmailToHub(CONNECTION, BODY, hubAnswering(503, { error: 'paused', reason: 'paused', retryable: true }).fetchImpl);
    expect(paused).toMatchObject({ kind: 'retry', httpStatus: 503 });
    expect(paused.kind === 'retry' && paused.error).toContain('paused');
    const down = await postEmailToHub(CONNECTION, BODY, (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch);
    expect(down).toEqual({ kind: 'retry', httpStatus: null, error: 'network: TypeError' });
  });

  it('a 422 is final (suppressed, not configured, invalid); a 409 is our bug; 401/403 the connection', async () => {
    const suppressed = await postEmailToHub(CONNECTION, BODY, hubAnswering(422, { error: 'unsubscribed', reason: 'suppressed', scope: 'marketing' }).fetchImpl);
    expect(suppressed).toMatchObject({ kind: 'rejected', httpStatus: 422, reason: 'suppressed' });
    const invalid = await postEmailToHub(CONNECTION, BODY, hubAnswering(422, { error: 'Validation failed', details: { html: ['must carry {{unsubscribe_url}}'] } }).fetchImpl);
    expect(invalid).toMatchObject({ kind: 'rejected', reason: 'invalid' });
    expect(invalid.kind === 'rejected' && invalid.error).toContain('unsubscribe_url');
    const conflict = await postEmailToHub(CONNECTION, BODY, hubAnswering(409, { error: 'used', code: 'idempotency_conflict' }).fetchImpl);
    expect(conflict).toMatchObject({ kind: 'rejected', reason: 'idempotency_conflict' });
    expect(await postEmailToHub(CONNECTION, BODY, hubAnswering(403, { error: 'scope' }).fetchImpl)).toMatchObject({ kind: 'rejected', reason: 'http_403' });
  });
});

const ROW: EmailOutboxRow = {
  id: 'row-1',
  idempotency_key: 'review_request:step-1',
  email_type: 'review_request',
  category: 'marketing',
  to_email: 'guest@resend.dev',
  subject: 'Quick favor?',
  html: '<a href="{{unsubscribe_url}}">x</a>',
  text_body: 'Unsubscribe: {{unsubscribe_url}}',
  entity_type: 'booking',
  entity_id: '8c1e2f4a-0000-4000-8000-000000000001',
  status: 'processing',
  attempt_count: 1,
  last_status_code: null,
  last_error: null,
};

describe('settling one attempt', () => {
  const NOW = Date.parse('2026-10-16T12:00:00Z');

  it('accepted → sent, with the hub id (only if it is a uuid)', () => {
    const s = settleAttempt(ROW, { kind: 'accepted', httpStatus: 202, hubEmailId: '6b0d0000-0000-4000-8000-000000000001', hubStatus: 'queued', duplicate: false }, NOW);
    expect(s.status).toBe('sent');
    expect(s.patch).toMatchObject({ hub_email_id: '6b0d0000-0000-4000-8000-000000000001', last_status_code: 202, last_error: null });
    expect(settleAttempt(ROW, { kind: 'accepted', httpStatus: 200, hubEmailId: 'nope', hubStatus: null, duplicate: true }, NOW).patch.hub_email_id).toBeNull();
  });

  it('a suppression is final and quiet; any other rejection alerts', () => {
    const quiet = settleAttempt(ROW, { kind: 'rejected', httpStatus: 422, reason: 'suppressed', error: 'unsubscribed' }, NOW);
    expect(quiet).toMatchObject({ status: 'rejected', alert: false });
    expect(settleAttempt(ROW, { kind: 'rejected', httpStatus: 422, reason: 'not_configured', error: 'x' }, NOW).alert).toBe(true);
    expect(settleAttempt(ROW, { kind: 'rejected', httpStatus: 409, reason: 'idempotency_conflict', error: 'x' }, NOW).alert).toBe(true);
  });

  it('a retry waits with backoff; past the last attempt it gives up and alerts', () => {
    const later = settleAttempt(ROW, { kind: 'retry', httpStatus: 503, error: 'paused' }, NOW);
    expect(later.status).toBe('pending');
    expect(later.patch.next_attempt_at).toBe(new Date(NOW + 60_000).toISOString());
    const dead = settleAttempt({ attempt_count: MAX_EMAIL_ATTEMPTS }, { kind: 'retry', httpStatus: 500, error: 'boom' }, NOW);
    expect(dead).toMatchObject({ status: 'failed', alert: true });
    expect(emailRetryDelayMs(1)).toBe(60_000);
    expect(emailRetryDelayMs(4)).toBe(8 * 60_000);
    expect(emailRetryDelayMs(30)).toBe(2 * 60 * 60 * 1000);
  });

  it('the body handed to the hub is the row, with its entity only when both halves are there', () => {
    expect(hubBodyFromRow(ROW)).toEqual({
      to: 'guest@resend.dev',
      subject: 'Quick favor?',
      html: ROW.html,
      text: ROW.text_body,
      email_type: 'review_request',
      category: 'marketing',
      idempotency_key: 'review_request:step-1',
      entity_type: 'booking',
      entity_id: ROW.entity_id,
    });
    expect(hubBodyFromRow({ ...ROW, entity_id: null, text_body: null })).not.toHaveProperty('entity_type');
  });
});

/** A tiny fake of the two queries the outbox makes. */
function fakeDb(claimed: EmailOutboxRow[], stored?: Partial<EmailOutboxRow>) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const rpc = vi.fn(async () => ({ data: claimed, error: null }));
  const chain = {
    eq: () => chain,
    maybeSingle: async () => ({ data: stored ?? null }),
  };
  const db = {
    rpc,
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      },
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
      select: () => chain,
    }),
  };
  return { db, rpc, updates, inserts };
}

describe('draining the outbox', () => {
  beforeEach(() => notifySupportAlert.mockReset());

  it('without the hub connection it claims nothing: the rows wait', async () => {
    const { db, rpc } = fakeDb([ROW]);
    const out = await drainEmailOutbox({}, { db, connection: null });
    expect(out.skipped).toBe('not_configured');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims only test addresses outside production, and settles each row', async () => {
    const { db, rpc, updates } = fakeDb([ROW]);
    const hub = hubAnswering(202, { ok: true, id: '6b0d0000-0000-4000-8000-000000000001', status: 'queued' });
    const out = await drainEmailOutbox({ limit: 5 }, { db, connection: CONNECTION, fetchImpl: hub.fetchImpl, onlyTest: true });
    expect(rpc).toHaveBeenCalledWith('claim_email_outbox', { p_limit: 5, p_keys: null, p_only_test: true });
    expect(out).toMatchObject({ claimed: 1, sent: 1, outcomes: { 'review_request:step-1': 'sent' } });
    expect(updates[0]).toMatchObject({ status: 'sent' });
    expect(notifySupportAlert).not.toHaveBeenCalled();
  });

  it('a rejection that is not a suppression alerts the support channel', async () => {
    const { db } = fakeDb([ROW]);
    const hub = hubAnswering(422, { error: 'Email is not set up for this business', reason: 'not_configured' });
    const out = await drainEmailOutbox({}, { db, connection: CONNECTION, fetchImpl: hub.fetchImpl, onlyTest: false });
    expect(out.rejected).toBe(1);
    expect(notifySupportAlert).toHaveBeenCalledTimes(1);
    expect(notifySupportAlert.mock.calls[0][0]).toMatchObject({ bookingId: ROW.entity_id, severity: 'warning' });
  });
});

describe('queueEmail', () => {
  it('refuses an email without a usable address, before touching the database', async () => {
    const { db, inserts } = fakeDb([]);
    expect(await queueEmail({ type: 'booking_confirmed', to: 'not-an-email', subject: 's', html: 'h', idempotencyKey: 'k' }, { db })).toMatchObject({
      ok: false,
      state: 'invalid',
    });
    expect(inserts).toHaveLength(0);
  });

  it('🪤 outside production a real address is recorded as skipped and never offered to the hub', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const { db, rpc, inserts } = fakeDb([], { status: 'skipped', last_status_code: null, last_error: 'not sent' });
    const out = await queueEmail(
      { type: 'booking_confirmed', to: 'Real.Guest@Gmail.com', subject: 's', html: 'h', idempotencyKey: 'booking_confirmed:b1', entityType: 'booking', entityId: 'nope' },
      { db },
    );
    expect(inserts[0]).toMatchObject({ status: 'skipped', to_email: 'real.guest@gmail.com', category: 'transactional', entity_id: null });
    expect(rpc).not.toHaveBeenCalled();
    expect(out).toMatchObject({ ok: true, state: 'skipped' });
    vi.unstubAllEnvs();
  });
});
