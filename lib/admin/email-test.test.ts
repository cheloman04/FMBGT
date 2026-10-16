import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ operator: { email: 'owner@resend.dev' } as unknown, queueEmail: vi.fn() }));
vi.mock('@/lib/admin/auth', () => ({
  getOperator: async () => m.operator,
  unauthorized: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}));
vi.mock('@/lib/app-url', () => ({ getAppUrl: () => 'https://www.floridamountainbikeguides.com' }));
vi.mock('@/lib/location-meta', () => ({ getBookingLocationMeta: () => ({ meetingPointUrl: 'https://maps.test/x' }) }));
vi.mock('@/lib/email/outbox', () => ({ queueEmail: m.queueEmail }));
// No '@/' alias in vitest: the real samples, through the path the module imports.
vi.mock('@/lib/email/test-samples', () => import('../email/test-samples'));

import { sendTestEmail } from './email-test';

const post = (body: unknown) => new Request('https://x/api/admin/emails/test', { method: 'POST', body: JSON.stringify(body) });

describe('POST /api/admin/emails/test', () => {
  beforeEach(() => {
    m.operator = { email: 'owner@resend.dev' };
    m.queueEmail.mockReset().mockResolvedValue({ ok: true, state: 'sent', httpStatus: 202, error: null });
  });

  it('needs the operator’s session, before any work', async () => {
    m.operator = null;
    expect((await sendTestEmail(post({ email: 'booking_confirmed', to: 'a@b.co' }))).status).toBe(401);
    expect(m.queueEmail).not.toHaveBeenCalled();
  });

  it('validates the email and the address', async () => {
    expect((await sendTestEmail(post({ email: 'nope', to: 'a@b.co' }))).status).toBe(400);
    expect((await sendTestEmail(post({ email: 'booking_confirmed', to: 'not-an-email' }))).status).toBe(400);
    expect(m.queueEmail).not.toHaveBeenCalled();
  });

  it('queues the sample through the outbox with its real type and a key of its own every time', async () => {
    const res = await sendTestEmail(post({ email: 'review_1_day', trail: 'mtb', to: '  Dustin@Example.com ' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.state).toBe('sent');
    const intent = m.queueEmail.mock.calls[0][0];
    expect(intent).toMatchObject({ type: 'review_request', to: 'dustin@example.com' });
    expect(intent.subject.startsWith('[Test] ')).toBe(true);
    expect(intent.idempotencyKey).toMatch(/^test:review_request:[0-9a-f-]{36}$/);
    expect(intent).not.toHaveProperty('entityId');
    await sendTestEmail(post({ email: 'review_1_day', trail: 'mtb', to: 'dustin@example.com' }));
    expect(m.queueEmail.mock.calls[1][0].idempotencyKey).not.toBe(intent.idempotencyKey);
  });

  it('says why it didn’t go out: outside production, or a no from Kigaru', async () => {
    m.queueEmail.mockResolvedValueOnce({ ok: true, state: 'skipped', httpStatus: null, error: 'not sent' });
    const skipped = await sendTestEmail(post({ email: 'booking_confirmed', to: 'dustin@example.com' }));
    expect(skipped.status).toBe(409);
    expect((await skipped.json()).error).toContain('resend.dev');

    m.queueEmail.mockResolvedValueOnce({ ok: false, state: 'rejected', httpStatus: 422, error: 'not_configured: Email is not set up' });
    const rejected = await sendTestEmail(post({ email: 'booking_confirmed', to: 'dustin@example.com' }));
    expect(rejected.status).toBe(502);
    expect((await rejected.json()).error).toContain('not_configured');
  });
});
