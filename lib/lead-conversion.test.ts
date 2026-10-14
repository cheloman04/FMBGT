import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest: a chainable fake Supabase client records each call
// (`from`, `update`, `eq`, …) and resolves to `db.result` when awaited.
const db = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  calls: [] as unknown[][],
  cancelFollowUp: vi.fn(async (leadId: string) => {
    void leadId;
  }),
}));

vi.mock('@/lib/supabase', () => {
  const query: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(db.result).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          db.calls.push([String(prop), ...args]);
          return query;
        };
      },
    },
  );
  return { getSupabaseAdmin: () => query };
});
vi.mock('@/lib/lead-followup', () => ({ cancelActiveFollowUpForConversion: db.cancelFollowUp }));

const { convertLead, escapeLike, findOpenLeadsByEmail, isOpenLead, normalizeEmail, openLeadsForEmail } = await import(
  './lead-conversion'
);

type Lead = Parameters<typeof isOpenLead>[0];

const lead = (over: Partial<Lead>): Lead => ({
  id: 'lead-1',
  full_name: 'Laura Walton',
  email: 'lmwalton2011@gmail.com',
  status: 'lead',
  booking_id: null,
  converted_at: null,
  deleted_at: null,
  last_activity_at: '2026-10-10T15:00:00Z',
  created_at: '2026-10-10T14:00:00Z',
  ...over,
});

beforeEach(() => {
  db.result = { data: null, error: null };
  db.calls = [];
  db.cancelFollowUp.mockClear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeEmail / escapeLike', () => {
  it('trims and lowercases, empty for missing', () => {
    expect(normalizeEmail('  LMWalton2011@Gmail.COM ')).toBe('lmwalton2011@gmail.com');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });

  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('first_last@x.com')).toBe(String.raw`first\_last@x.com`);
    expect(escapeLike('a%b@x.com')).toBe(String.raw`a\%b@x.com`);
    expect(escapeLike(String.raw`a\b@x.com`)).toBe(String.raw`a\\b@x.com`);
    expect(escapeLike('plain@x.com')).toBe('plain@x.com');
  });
});

describe('isOpenLead', () => {
  it('accepts open and lost leads', () => {
    expect(isOpenLead(lead({ status: 'lead' }))).toBe(true);
    expect(isOpenLead(lead({ status: 'lost' }))).toBe(true);
  });

  it('rejects converted, archived or deleted leads and any conversion column', () => {
    expect(isOpenLead(lead({ status: 'converted' }))).toBe(false);
    expect(isOpenLead(lead({ status: 'archived' }))).toBe(false);
    expect(isOpenLead(lead({ status: null }))).toBe(false);
    expect(isOpenLead(lead({ deleted_at: '2026-10-11T00:00:00Z' }))).toBe(false);
    expect(isOpenLead(lead({ booking_id: 'b-1' }))).toBe(false);
    expect(isOpenLead(lead({ converted_at: '2026-10-11T00:00:00Z' }))).toBe(false);
  });
});

describe('openLeadsForEmail', () => {
  it('matches the email case-insensitively and ignores surrounding spaces', () => {
    const found = openLeadsForEmail([lead({ email: ' LMWalton2011@gmail.com ' })], 'lmwalton2011@GMAIL.com');
    expect(found.map((l) => l.id)).toEqual(['lead-1']);
  });

  it('needs the exact email, not a LIKE look-alike', () => {
    expect(openLeadsForEmail([lead({ email: 'lmwalton2011@gmail.co' })], 'lmwalton2011@gmail.com')).toEqual([]);
    expect(openLeadsForEmail([lead({ email: 'first-last@x.com' })], 'first_last@x.com')).toEqual([]);
  });

  it('drops leads that are not open', () => {
    const leads = [
      lead({ id: 'converted', status: 'converted' }),
      lead({ id: 'deleted', deleted_at: '2026-10-11T00:00:00Z' }),
      lead({ id: 'linked', booking_id: 'b-1' }),
      lead({ id: 'open' }),
    ];
    expect(openLeadsForEmail(leads, 'lmwalton2011@gmail.com').map((l) => l.id)).toEqual(['open']);
  });

  it('puts the most recently active first, falling back to created_at, unknown last', () => {
    const leads = [
      lead({ id: 'old', last_activity_at: '2026-09-01T00:00:00Z' }),
      lead({ id: 'unknown', last_activity_at: null, created_at: null }),
      lead({ id: 'new', last_activity_at: '2026-10-12T00:00:00Z' }),
      lead({ id: 'created-only', last_activity_at: null, created_at: '2026-10-01T00:00:00Z' }),
    ];
    expect(openLeadsForEmail(leads, 'lmwalton2011@gmail.com').map((l) => l.id)).toEqual([
      'new',
      'created-only',
      'old',
      'unknown',
    ]);
  });

  it('finds nothing for an empty email', () => {
    expect(openLeadsForEmail([lead({ email: '' })], '  ')).toEqual([]);
    expect(openLeadsForEmail([lead({ email: null })], null)).toEqual([]);
  });
});

describe('findOpenLeadsByEmail', () => {
  it('queries open leads by escaped, case-insensitive email and keeps the exact matches', async () => {
    db.result = {
      data: [lead({ id: 'look-alike', email: 'first-last@x.com' }), lead({ id: 'match', email: 'First_Last@x.com' })],
      error: null,
    };
    const found = await findOpenLeadsByEmail(' First_Last@X.com ');
    expect(found.map((l) => l.id)).toEqual(['match']);
    expect(db.calls).toContainEqual(['from', 'leads']);
    expect(db.calls).toContainEqual(['ilike', 'email', String.raw`first\_last@x.com`]);
    expect(db.calls).toContainEqual(['in', 'status', ['lead', 'lost']]);
    expect(db.calls).toContainEqual(['is', 'deleted_at', null]);
    expect(db.calls).toContainEqual(['is', 'booking_id', null]);
    expect(db.calls).toContainEqual(['is', 'converted_at', null]);
  });

  it('returns nothing on a lookup error instead of throwing', async () => {
    db.result = { data: null, error: { message: 'boom' } };
    await expect(findOpenLeadsByEmail('a@b.com')).resolves.toEqual([]);
  });

  it('does not query for an empty email', async () => {
    await expect(findOpenLeadsByEmail('   ')).resolves.toEqual([]);
    expect(db.calls).toEqual([]);
  });
});

describe('convertLead', () => {
  it('marks the lead converted into the booking and stops its follow-up', async () => {
    await expect(convertLead('lead-1', 'booking-1', { source: 'manual-booking' })).resolves.toBe(true);

    expect(db.calls[0]).toEqual(['from', 'leads']);
    const update = db.calls.find((c) => c[0] === 'update')?.[1] as Record<string, unknown>;
    expect(update).toMatchObject({
      status: 'converted',
      booking_id: 'booking-1',
      last_step_completed: 'booking_confirmed',
    });
    expect(update.converted_at).toEqual(expect.any(String));
    expect(update.last_activity_at).toBe(update.converted_at);
    expect(update.updated_at).toBe(update.converted_at);
    expect(db.calls).toContainEqual(['eq', 'id', 'lead-1']);
    expect(db.cancelFollowUp).toHaveBeenCalledWith('lead-1');
  });

  it('still stops the follow-up when the update fails, and reports false', async () => {
    db.result = { data: null, error: { message: 'boom' } };
    await expect(convertLead('lead-1', 'booking-1', { source: 'stripe-webhook' })).resolves.toBe(false);
    expect(db.cancelFollowUp).toHaveBeenCalledWith('lead-1');
  });

  it('never throws', async () => {
    db.cancelFollowUp.mockRejectedValueOnce(new Error('down'));
    await expect(convertLead('lead-1', 'booking-1', { source: 'free-booking' })).resolves.toBe(true);
  });
});
