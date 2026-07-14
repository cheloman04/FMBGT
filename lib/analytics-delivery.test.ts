import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { rpc, insert, update, eq, sendSenzaiEvent } = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  sendSenzaiEvent: vi.fn(),
}));

eq.mockReturnValue({ eq });
update.mockReturnValue({ eq });

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    rpc,
    from: () => ({ insert, update }),
  }),
}));
vi.mock('@/lib/senzai-ingest', () => ({ sendSenzaiEvent }));
vi.mock('@/lib/ga4-mp', () => ({ sendGa4Event: vi.fn() }));
vi.mock('@/lib/meta-capi', () => ({ sendMetaEvent: vi.fn() }));

import { processAnalyticsDeliveries, queueSenzaiEvent, retryDelayMs } from './analytics-delivery';

const input = {
  event_name: 'payment.deposit_succeeded',
  occurred_at: '2026-07-13T12:00:00.000Z',
  source_event_id: 'pi_1',
  idempotency_key: 'stripe_payment:pi_1:payment.deposit_succeeded',
  source_route: '/api/webhooks/stripe',
  authoritative_source: 'stripe.checkout.session.completed',
  entity_type: 'payment',
  entity_id: 'pi_1',
} as const;

function row(attemptCount: number) {
  return {
    id: 'delivery-1',
    delivery_key: `senzai:${input.idempotency_key}`,
    destination: 'senzai',
    event_name: input.event_name,
    source_event_id: input.source_event_id,
    payload: { destination: 'senzai', input },
    attempt_count: attemptCount,
  };
}

describe('analytics delivery outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ eq });
  });

  it('does not redeliver the same logical event after the unique key already completed', async () => {
    rpc
      .mockResolvedValueOnce({ data: [row(1)], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    insert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
    sendSenzaiEvent.mockResolvedValue({ ok: true, hubStatus: 'translated', error: null });

    await queueSenzaiEvent(input);
    await queueSenzaiEvent(input);

    expect(sendSenzaiEvent).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ delivery_key: `senzai:${input.idempotency_key}` })
    );
  });

  it('persists a failed attempt and succeeds on a later claim', async () => {
    rpc
      .mockResolvedValueOnce({ data: [row(1)], error: null })
      .mockResolvedValueOnce({ data: [row(2)], error: null });
    sendSenzaiEvent
      .mockResolvedValueOnce({ ok: false, hubStatus: 'failed', error: 'temporary failure' })
      .mockResolvedValueOnce({ ok: true, hubStatus: 'translated', error: null });

    await expect(processAnalyticsDeliveries()).resolves.toEqual({
      claimed: 1,
      delivered: 0,
      failed: 1,
    });
    await expect(processAnalyticsDeliveries()).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      failed: 0,
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'delivered' }));
  });

  it('uses bounded exponential backoff', () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(120_000);
    expect(retryDelayMs(20)).toBe(6 * 60 * 60 * 1000);
  });
});
