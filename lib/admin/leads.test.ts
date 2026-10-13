import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/pricing', () => import('../pricing'));
vi.mock('@/lib/discounts', () => import('../discounts'));
vi.mock('@/lib/display-time', () => import('../display-time'));
vi.mock('@/lib/booking-money', () => import('../booking-money'));
vi.mock('@/lib/booking-flow-progress', () => import('../booking-flow-progress'));
// The kit's barrel pulls in React components; its pure modules are all this needs.
vi.mock('@/components/kit', async () => ({
  ...(await import('../../components/kit/url')),
  ...(await import('../../components/kit/status')),
  ...(await import('../../components/kit/time')),
}));

const {
  canStartFollowUp,
  followUpState,
  hotSince,
  latestEnrollmentByLead,
  leadFreshness,
  leadViewMetrics,
  leadViewOptions,
  leadsEmpty,
  legacyLeadsUrl,
  parseLeadView,
  stepsByEnrollment,
  toLeadDetail,
  toLeadRow,
} = await import('./leads');

type Lead = Parameters<typeof toLeadRow>[0];
type Enrollment = NonNullable<Parameters<typeof toLeadRow>[1]>;
type Step = Parameters<typeof toLeadRow>[2][number];

const ID = '3f2b8c1e-5a4d-4e6f-8a9b-1c2d3e4f5a6b';
const NOW = new Date('2026-10-13T16:00:00Z');

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: ID,
  full_name: 'Sam Rivera',
  email: 'sam@example.com',
  phone: '407-555-0101',
  zip_code: '32801',
  heard_about_us: 'Instagram',
  selected_trail_type: 'mtb',
  selected_skill_level: 'first_time',
  selected_location_name: 'Santos',
  selected_bike: 'standard',
  selected_date: '2026-10-20',
  selected_time_slot: '08:00',
  selected_duration_hours: 2,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  last_step_completed: 'date_selected',
  last_activity_at: '2026-10-13T13:00:00Z', // 3h before NOW
  status: 'lead',
  created_at: '2026-10-12T15:00:00Z',
  booking_id: null,
  converted_at: null,
  lost_at: null,
  ...over,
});

const enrollment = (over: Partial<Enrollment> = {}): Enrollment => ({
  id: 'e1',
  lead_id: ID,
  status: 'active',
  enrolled_at: '2026-10-13T14:00:00Z',
  next_step_due_at: null,
  lost_at: null,
  stop_reason: null,
  webhook_triggered_at: '2026-10-13T14:00:01Z',
  ...over,
});

const step = (n: number, key: string, over: Partial<Step> = {}): Step => ({
  id: `s${n}`,
  enrollment_id: 'e1',
  step_number: n,
  step_key: key,
  scheduled_for: '2026-10-13T15:00:00Z',
  sent_at: null,
  status: 'pending',
  skip_reason: null,
  ...over,
});

/** Intl writes a narrow no-break space before AM/PM: compare with plain spaces. */
const plain = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');

describe('the view in the URL', () => {
  it('reads the view, falling back to open', () => {
    expect(parseLeadView('hot')).toBe('hot');
    expect(parseLeadView(['lost'])).toBe('lost');
    expect(parseLeadView('converted')).toBe('open');
    expect(parseLeadView(undefined)).toBe('open');
  });

  it('the strip filters by view, keeps the search and drops the page and the drawer', () => {
    const counts = { open: 16, hot: 2, following: 5, lost: 3 };
    const metrics = leadViewMetrics(counts, 'hot', '/admin/leads', { q: 'sam', page: '2', lead: ID, view: 'hot' });
    expect(metrics.map((m) => [m.key, m.value, m.href])).toEqual([
      ['open', '16', '/admin/leads?q=sam'],
      ['hot', '2', '/admin/leads?q=sam&view=hot'],
      ['following', '5', '/admin/leads?q=sam&view=following'],
      ['lost', '3', '/admin/leads?q=sam&view=lost'],
    ]);
    expect(metrics.find((m) => m.active)?.key).toBe('hot');
    expect(leadViewOptions(counts, 'open', '/admin/leads', {}).map((o) => o.value)).toEqual([null, 'hot', 'following', 'lost']);
  });

  it('hot starts a day before now', () => {
    expect(hotSince(NOW)).toBe('2026-10-12T16:00:00.000Z');
  });

  it('an empty list says what fills it; a search says where it looked', () => {
    expect(leadsEmpty('open', '')).toMatch(/^No open leads\./);
    expect(leadsEmpty('following', '')).toMatch(/three emails over a week/);
    expect(leadsEmpty('lost', 'zed')).toMatch(/^No leads match “zed”\./);
  });

  it('the old /admin links to leads and trash go to their routes', () => {
    expect(legacyLeadsUrl('leads', undefined)).toBe('/admin/leads');
    expect(legacyLeadsUrl('leads', ID.toUpperCase())).toBe(`/admin/leads?lead=${ID}`);
    expect(legacyLeadsUrl(undefined, ID)).toBe(`/admin/leads?lead=${ID}`);
    expect(legacyLeadsUrl('leads', 'not-an-id')).toBe('/admin/leads');
    expect(legacyLeadsUrl('trash', undefined)).toBe('/admin/trash');
    expect(legacyLeadsUrl(undefined, undefined)).toBeNull();
    expect(legacyLeadsUrl('confirmed', undefined)).toBeNull();
  });
});

describe('follow-ups', () => {
  it('keeps the newest enrollment of each lead, and its emails in order', () => {
    const latest = latestEnrollmentByLead([enrollment({ id: 'new' }), enrollment({ id: 'old' })]);
    expect(latest.get(ID)?.id).toBe('new');
    const steps = stepsByEnrollment([step(3, '1_week'), step(1, '1_hour'), step(2, '1_day')]);
    expect(steps.get('e1')?.map((s) => s.step_key)).toEqual(['1_hour', '1_day', '1_week']);
  });

  it('says where the follow-up stands and what comes next', () => {
    expect(followUpState(lead(), null, [])).toEqual({ meta: { label: 'Not started', tone: 'gray' }, detail: 'No follow-up sent yet' });
    const running = followUpState(lead(), enrollment(), [step(1, '1_hour', { status: 'sent' }), step(2, '1_day', { scheduled_for: '2026-10-14T14:00:00Z' })]);
    expect(running.meta.label).toBe('Following up');
    expect(plain(running.detail)).toBe('Next: 1-day email, Oct 14, 2026, 10:00 AM');
    expect(followUpState(lead(), enrollment({ webhook_triggered_at: null }), []).meta.label).toBe('Enrolled');
    expect(followUpState(lead(), enrollment({ status: 'cancelled', stop_reason: 'converted' }), [])).toMatchObject({
      meta: { label: 'Stopped' },
      detail: 'Converted',
    });
    expect(followUpState(lead({ status: 'lost' }), enrollment({ status: 'lost' }), []).meta).toEqual({ label: 'Lost', tone: 'red' });
    expect(followUpState(lead({ converted_at: '2026-10-13T15:00:00Z' }), null, []).meta.label).toBe('Converted');
  });

  it('a follow-up starts only on an open lead with none running', () => {
    expect(canStartFollowUp(lead(), null)).toBe(true);
    expect(canStartFollowUp(lead(), enrollment({ status: 'cancelled' }))).toBe(true);
    expect(canStartFollowUp(lead(), enrollment())).toBe(false);
    expect(canStartFollowUp(lead({ status: 'lost' }), null)).toBe(false);
    expect(canStartFollowUp(lead({ booking_id: 'b1' }), null)).toBe(false);
  });

  it('hot within a day, warm within three, then nothing', () => {
    expect(leadFreshness('2026-10-13T13:00:00Z', NOW)).toEqual({ label: 'Hot', tone: 'amber' });
    expect(leadFreshness('2026-10-11T17:00:00Z', NOW)).toEqual({ label: 'Warm', tone: 'yellow' });
    expect(leadFreshness('2026-10-01T16:00:00Z', NOW)).toBeNull();
  });
});

describe('the row and the drawer', () => {
  it('a row carries the interest, the stage and the follow-up', () => {
    const row = toLeadRow(lead({ utm_source: 'google' }), null, [], NOW);
    expect(row).toMatchObject({
      name: 'Sam Rivera',
      interest: 'MTB · Santos',
      source: 'google',
      stage: 'Date selected',
      lastActive: '3h ago',
      freshness: { label: 'Hot' },
      followUp: { label: 'Not started' },
    });
    expect(row.progress).toBeGreaterThan(0);
    expect(toLeadRow(lead({ selected_trail_type: null, selected_location_name: null }), null, [], NOW).interest).toBeNull();
  });

  it('the drawer has the contact, the intent, the attribution and the follow-up emails', () => {
    const view = toLeadDetail(
      lead({ utm_source: 'google', utm_campaign: 'fall' }),
      enrollment(),
      [step(1, '1_hour', { status: 'sent', sent_at: '2026-10-13T15:00:00Z' }), step(2, '1_day', { scheduled_for: '2026-10-14T14:00:00Z' })],
      NOW,
    );
    expect(view.contact.facts).toEqual([
      { label: 'ZIP', value: '32801' },
      { label: 'Heard about us', value: 'Instagram' },
    ]);
    expect(view.intent.map((f) => f.label)).toEqual(['Trail', 'Skill', 'Location', 'Bike', 'Date', 'Time', 'Duration']);
    expect(view.intent[1]).toEqual({ label: 'Skill', value: 'First time' });
    expect(view.attribution).toEqual([
      { label: 'UTM source', value: 'google' },
      { label: 'UTM campaign', value: 'fall' },
    ]);
    expect(view.progress.label).toMatch(/^\d+ of \d+ steps · last: Date selected$/);
    expect(view.followUp.emails.map((e) => [e.label, e.meta.label, plain(e.when)])).toEqual([
      ['1-hour email', 'Sent', 'Oct 13, 2026, 11:00 AM'],
      ['1-day email', 'Scheduled', 'Due Oct 14, 2026, 10:00 AM'],
    ]);
    // A follow-up is already running: nothing to start.
    expect(view.sendFollowUp).toBeNull();
    expect(toLeadDetail(lead(), null, [], NOW).sendFollowUp).toEqual({ to: 'sam@example.com' });
  });
});
