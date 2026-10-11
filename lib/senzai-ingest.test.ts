import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildSenzaiEventPayload, sendSenzaiEvent, type SenzaiEventInput } from './senzai-ingest';

function paymentInput(overrides: Partial<SenzaiEventInput> = {}): SenzaiEventInput {
  return {
    event_name: 'payment.deposit_succeeded',
    occurred_at: '2026-07-13T12:00:00.000Z',
    source_event_id: 'pi_deposit_1',
    idempotency_key: 'stripe_payment:pi_deposit_1:payment.deposit_succeeded',
    source_route: '/api/webhooks/stripe',
    authoritative_source: 'stripe.checkout.session.completed',
    entity_type: 'payment',
    entity_id: 'pi_deposit_1',
    amount: { value: 12_345, currency: 'USD', unit: 'cents' },
    data: {
      booking_id: 'booking-1',
      booking_total_cents: 50_000,
      amount_collected_cents: 12_345,
      charge_type: 'deposit',
    },
    ...overrides,
  };
}

describe('Senzai ingestion contract', () => {
  it('places entity, amount, currency, source identity, and metadata where the Hub reads them', () => {
    const payload = buildSenzaiEventPayload(paymentInput());

    expect(payload).toMatchObject({
      source_event_id: 'pi_deposit_1',
      entity: { type: 'payment', id: 'pi_deposit_1' },
      amount: { value: 12_345, currency: 'USD', unit: 'cents' },
      attributes: {
        booking_id: 'booking-1',
        booking_total_cents: 50_000,
        amount_collected_cents: 12_345,
        charge_type: 'deposit',
      },
    });
    expect(payload.attributes).not.toHaveProperty('data');
  });

  it('uses distinct stable identities and collected amounts for deposit and balance', () => {
    const deposit = buildSenzaiEventPayload(paymentInput());
    const balance = buildSenzaiEventPayload(
      paymentInput({
        event_name: 'payment.remaining_balance_succeeded',
        source_event_id: 'pi_balance_1',
        idempotency_key: 'stripe_payment:pi_balance_1:payment.remaining_balance_succeeded',
        entity_id: 'pi_balance_1',
        amount: { value: 37_655, currency: 'USD', unit: 'cents' },
        data: {
          booking_id: 'booking-1',
          balance_amount_cents: 37_655,
          amount_collected_cents: 37_655,
          charge_type: 'remaining_balance',
        },
      })
    );

    expect(deposit.event_name).toBe('payment.deposit_succeeded');
    expect(deposit.amount?.value).toBe(12_345);
    expect(balance.event_name).toBe('payment.remaining_balance_succeeded');
    expect(balance.amount?.value).toBe(37_655);
    expect(balance.source_event_id).not.toBe(deposit.source_event_id);
  });
});

describe('Hub acknowledgement (contract 2026-10-01 §1.1)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function hubReplies(status: number, body: unknown) {
    vi.stubEnv('SENZAI_INGEST_URL', 'https://hub.example.com');
    vi.stubEnv('SENZAI_CONNECTION_KEY', 'key');
    vi.stubEnv('SENZAI_CONNECTION_SECRET', 'secret');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
  }

  it('treats translated, duplicate and skipped as delivered', async () => {
    hubReplies(202, { data: { status: 'translated' } });
    expect((await sendSenzaiEvent(paymentInput())).ok).toBe(true);

    hubReplies(200, { data: { duplicate: true } });
    expect(await sendSenzaiEvent(paymentInput())).toMatchObject({ ok: true, hubStatus: 'duplicate' });

    hubReplies(200, { data: { status: 'skipped', reason: 'unmapped' } });
    expect(await sendSenzaiEvent(paymentInput())).toMatchObject({ ok: true, hubStatus: 'skipped' });
  });

  it('does not treat a 2xx without an acknowledgement as delivered', async () => {
    hubReplies(200, { ok: true });
    expect((await sendSenzaiEvent(paymentInput())).ok).toBe(false);
  });
});
