import { describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point the imports at the real modules.
vi.mock('@/lib/display-time', () => import('../display-time'));
vi.mock('@/lib/booking-money', () => import('../booking-money'));

const {
  bikeOptions,
  createdHref,
  emptyManualForm,
  formProblem,
  heightOptions,
  initialForm,
  locationOptions,
  manualCreatePayload,
  manualEditPayload,
  manualMoneyNote,
  newRider,
  onlineEditPayload,
  previewLines,
  savedNotice,
  savedQuery,
  skillOptions,
  timeOptions,
  toCents,
  withTour,
} = await import('./booking-form');

type Booking = Parameters<typeof initialForm>[0];
type Preview = Parameters<typeof previewLines>[0];

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  booking_source: 'online',
  trail_type: 'mtb',
  skill_level: 'beginner',
  date: '2026-10-20',
  time_slot: '08:00',
  duration_hours: 3,
  location_id: 'loc-1',
  bike_rental: 'standard',
  rider_height_inches: 70,
  participant_info: [{ name: 'Sam', bike_rental: 'electric', height_inches: 66 }],
  addons: { gopro: true },
  total_price: 30000,
  payment_method: null,
  admin_notes: null,
  customer_name: 'Jane Rider',
  customer_email: 'jane@example.com',
  customer_phone: null,
  ...over,
});

const preview = (over: Partial<Preview> = {}): Preview => ({
  changes: [],
  price: null,
  balance: { scheduled_from: 0, scheduled_to: 0, due_at: null, unsettled: 0 },
  calendar: null,
  waiver_needs: [],
  warnings: [],
  ...over,
});

describe('choices', () => {
  it('start times every 15 minutes, 6 AM to 7 PM Eastern, keeping an off-grid one', () => {
    const grid = timeOptions('08:00');
    expect(grid).toHaveLength(53);
    expect(grid[0]).toEqual({ value: '06:00', label: '6:00 AM' });
    expect(grid.at(-1)).toEqual({ value: '19:00', label: '7:00 PM' });
    const odd = timeOptions('08:10');
    expect(odd).toHaveLength(54);
    expect(odd.map((t) => t.value).slice(8, 11)).toEqual(['08:00', '08:10', '08:15']);
    // Not a time: nothing added.
    expect(timeOptions('')).toHaveLength(53);
  });

  it('dollars to cents, and heights, bikes and skills from what the booking allows', () => {
    expect(toCents('45')).toBe(4500);
    expect(toCents('45.505')).toBe(4551);
    expect(toCents('')).toBeNull();
    expect(toCents('-1')).toBeNull();
    expect(toCents('abc')).toBeNull();
    expect(heightOptions(70)).toHaveLength(6);
    expect(heightOptions(68).at(-1)).toEqual({ label: '68"', value: 68 });
    expect(bikeOptions('paved')).toEqual(['standard', 'electric']);
    expect(bikeOptions('mtb')).toEqual(['none', 'standard', 'electric']);
    const locations = [
      { id: 'a', name: 'A', tour_type: 'mtb' as const, skill_levels: ['advanced' as const] },
      { id: 'b', name: 'B', tour_type: 'mtb' as const, skill_levels: null },
    ];
    expect(skillOptions(locations, 'a')).toEqual(['advanced']);
    expect(skillOptions(locations, 'b')).toHaveLength(4);
  });
});

describe('the form', () => {
  it('opens with what the booking has', () => {
    const form = initialForm(booking());
    expect(form).toMatchObject({
      customer_name: 'Jane Rider',
      customer_phone: '',
      skill_level: 'beginner',
      duration_hours: 3,
      bike_rental: 'standard',
      riders: [{ name: 'Sam', bike_rental: 'electric', height_inches: 66 }],
      gopro: true,
      pickup_dropoff: false,
      manual_total: '300.00',
      manual_payment_method: 'cash',
      custom_price: false,
      notify_customer: false,
    });
  });

  it('a paved tour is two hours on a rental; a rider without a bike rides the lead’s', () => {
    const form = initialForm(
      booking({ trail_type: 'paved', duration_hours: 3, bike_rental: null, participant_info: [{ name: 'Kid' }], skill_level: 'weird' }),
    );
    expect(form).toMatchObject({ duration_hours: 2, bike_rental: 'standard', skill_level: '', riders: [{ name: 'Kid', bike_rental: 'standard' }] });
    expect(newRider({ bike_rental: 'electric' })).toEqual({ name: '', bike_rental: 'electric', height_inches: null });
  });

  it('says what blocks a save, one thing at a time', () => {
    const ok = initialForm(booking());
    expect(formProblem(ok, false)).toBeNull();
    expect(formProblem({ ...ok, customer_name: ' ' }, false)).toBe('The customer needs a name.');
    expect(formProblem({ ...ok, customer_email: 'jane' }, false)).toBe('The customer needs a valid email.');
    expect(formProblem({ ...ok, date: '' }, false)).toBe('Pick the tour date.');
    expect(formProblem({ ...ok, time_slot: '' }, false)).toBe('Pick the start time.');
    expect(formProblem({ ...ok, riders: [...ok.riders, newRider(ok)] }, false)).toBe('Rider 3 needs a name, or remove the rider.');
    expect(formProblem({ ...ok, custom_price: true }, false)).toBe('Enter the custom price.');
    expect(formProblem({ ...ok, custom_price: true, price_override: '250' }, false)).toBe('Say why the price is custom (internal).');
    expect(formProblem({ ...ok, manual_total: '' }, true)).toBe('Enter the agreed total.');
    // A manual booking has no custom price: its total is the price.
    expect(formProblem({ ...ok, custom_price: true }, true)).toBeNull();
  });
});

describe('what each API receives', () => {
  it('an online edit: trimmed, re-priced unless a custom price, the dry run first', () => {
    const form = { ...initialForm(booking()), customer_name: ' Jane R ', customer_phone: ' ', admin_notes: ' VIP ' };
    expect(onlineEditPayload(form, 'mtb', true)).toMatchObject({
      dry_run: true,
      customer_name: 'Jane R',
      customer_phone: null,
      duration_hours: 3,
      skill_level: 'beginner',
      participants: [{ name: 'Sam', bike_rental: 'electric', height_inches: 66 }],
      addons: { gopro: true, pickup_dropoff: false },
      admin_notes: 'VIP',
      price_override_cents: null,
      price_override_reason: null,
    });
    const custom = { ...form, custom_price: true, price_override: '250', price_override_reason: ' friend ' };
    expect(onlineEditPayload(custom, 'mtb', false)).toMatchObject({ dry_run: false, price_override_cents: 25000, price_override_reason: 'friend' });
  });

  it('a paved edit sends two hours, no skill and no add-ons', () => {
    const payload = onlineEditPayload(initialForm(booking({ trail_type: 'paved' })), 'paved', true);
    expect(payload).toMatchObject({ duration_hours: 2, skill_level: null });
    expect(payload.addons).toBeUndefined();
  });

  it('a manual edit: its agreed total and how it was paid, no location', () => {
    const form = { ...initialForm(booking({ booking_source: 'manual', payment_method: 'zelle' })), manual_total: '60987' };
    const payload = manualEditPayload({ ...form, manual_total: '609.87' }, 'b1');
    expect(payload).toMatchObject({
      action: 'update',
      id: 'b1',
      total_cents: 60987,
      payment_method: 'zelle',
      additional_participants: [{ name: 'Sam', bike_rental: 'electric', height_inches: 66 }],
    });
    expect(payload).not.toHaveProperty('location_id');
  });
});

describe('before saving: the preview', () => {
  it('lists the changes, then what they set off', () => {
    const lines = previewLines(
      preview({
        changes: [{ field: 'date', label: 'Date', from: 'Oct 20', to: 'Oct 21' }],
        price: { from: 30000, to: 35000, quoted: 35000, overridden: false },
        balance: { scheduled_from: 15000, scheduled_to: 20000, due_at: '2026-10-20T00:00:00.000Z', unsettled: 0 },
        calendar: 'reschedule',
      }),
      '2026-10-19T00:00:00.000Z',
    );
    expect(lines.map((l) => l.text)).toEqual([
      'Date: Oct 20 → Oct 21',
      'Price $300.00 → $350.00 (website prices)',
      'Automatic card charge $150.00 → $200.00 on Oct 20, 2026',
      'The Cal.com event moves to the new time.',
    ]);
    expect(lines.some((l) => l.attention)).toBe(false);
  });

  it('flags what the operator has to act on', () => {
    const lines = previewLines(
      preview({
        changes: [{ field: 'riders', label: 'Riders', from: '1', to: '3' }],
        price: { from: 30000, to: 25000, quoted: 40000, overridden: true },
        balance: { scheduled_from: 10000, scheduled_to: 10000, due_at: '2026-10-21T00:00:00.000Z', unsettled: -2500 },
        calendar: 'recreate',
        waiver_needs: ['Sam', 'Kid'],
        warnings: ['Only 1 e-bike left that day'],
      }),
      '2026-10-19T00:00:00.000Z',
    );
    expect(lines.map((l) => l.text)).toEqual([
      'Riders: 1 → 3',
      'Price $300.00 → $250.00 (custom; the website price would be $400.00)',
      'The card charge moves to Oct 21, 2026',
      '$25.00 will be owed back to the customer: refund it after saving.',
      'The Cal.com event is replaced with one at the new location.',
      'Sam, Kid still need to sign the waiver: the link reopens.',
      'Only 1 e-bike left that day',
    ]);
    expect(lines.filter((l) => l.attention).map((l) => l.key)).toEqual(['refund', 'waiver', 'warning-0']);
    const owed = previewLines(preview({ balance: { scheduled_from: 0, scheduled_to: 0, due_at: null, unsettled: 4500 }, waiver_needs: ['Sam'] }), null);
    expect(owed.map((l) => l.text)).toEqual([
      'The customer will owe $45.00 that nothing charges automatically: collect it after saving.',
      'Sam still needs to sign the waiver: the link reopens.',
    ]);
  });
});

describe('after saving: the booking page says what happened', () => {
  it('a clean save', () => {
    const query = savedQuery({ calendar_ok: true, email_sent: null, preview: { balance: preview().balance, waiver_needs: [] } });
    expect(query).toBe('saved=1&cal=ok');
    expect(savedNotice(Object.fromEntries(new URLSearchParams(query)))).toEqual({
      attention: false,
      lines: ['Booking updated.', 'Calendar updated.'],
    });
  });

  it('a save with something left to do, online or manual', () => {
    const online = savedQuery({
      calendar_ok: false,
      email_sent: true,
      preview: { balance: { scheduled_from: 0, scheduled_to: 0, due_at: null, unsettled: 2500 }, waiver_needs: ['Sam'] },
    });
    expect(online).toBe('saved=1&cal=failed&email=sent&waiver=reopened&owed=2500');
    expect(savedNotice(Object.fromEntries(new URLSearchParams(online)))).toEqual({
      attention: true,
      lines: [
        'Booking updated.',
        'The calendar was NOT updated: use Retry calendar below.',
        'The waiver link reopened for the riders who still have to sign.',
        'The customer was emailed the changes.',
        'The customer still owes $25.00: collect it under Payment.',
      ],
    });
    const manual = savedQuery({ calendar_ok: null, email_sent: false, waiver_reset: true });
    expect(manual).toBe('saved=1&email=failed&waiver=reopened');
    expect(savedNotice({ saved: '1', refund: '1000' })?.lines.at(-1)).toBe('$10.00 is owed back to the customer: refund it under Payment.');
  });

  it('only the codes count: no notice without saved=1, junk amounts ignored', () => {
    expect(savedNotice({})).toBeNull();
    expect(savedNotice({ saved: 'yes' })).toBeNull();
    expect(savedNotice({ saved: '1', owed: 'lots', cal: '<b>' })).toEqual({ attention: false, lines: ['Booking updated.'] });
  });
});

describe('a new manual booking', () => {
  const locations = [
    { id: 'santos', name: 'Santos', tour_type: 'mtb' as const, skill_levels: ['intermediate' as const, 'advanced' as const] },
    { id: 'markham', name: 'Markham Woods', tour_type: 'mtb' as const, skill_levels: null },
    { id: 'sanford', name: 'Sanford Riverfront', tour_type: 'paved' as const, skill_levels: null },
  ];
  const filled = () => ({
    ...emptyManualForm(),
    customer_name: 'Laura Walton',
    customer_email: 'laura@example.com',
    skill_level: 'beginner' as const,
    location_id: 'markham',
    date: '2026-10-24',
    manual_total: '609.87',
  });

  it('starts as a mountain bike tour at 9 AM that emails the confirmation', () => {
    expect(emptyManualForm()).toMatchObject({
      trail_type: 'mtb',
      time_slot: '09:00',
      duration_hours: 2,
      bike_rental: 'none',
      riders: [],
      manual_payment_method: 'cash',
      send_confirmation: true,
    });
  });

  it('offers the locations of its kind of tour that take its skill', () => {
    expect(locationOptions(locations, 'mtb', '').map((l) => l.id)).toEqual(['santos', 'markham']);
    // A location that doesn't list skills takes them all.
    expect(locationOptions(locations, 'mtb', 'beginner').map((l) => l.id)).toEqual(['markham']);
    expect(locationOptions(locations, 'paved', 'beginner').map((l) => l.id)).toEqual(['sanford']);
  });

  it('a change of tour: paved is two hours on rentals, and a location that no longer fits is cleared', () => {
    const mtb = { ...filled(), duration_hours: 3, bike_rental: 'none' as const, riders: [{ name: 'Sam', bike_rental: 'electric' as const, height_inches: null }] };
    const paved = withTour(mtb, { trail_type: 'paved' }, locations);
    expect(paved).toMatchObject({ trail_type: 'paved', skill_level: '', location_id: '', duration_hours: 2, bike_rental: 'standard' });
    expect(paved.riders).toEqual([{ name: 'Sam', bike_rental: 'electric', height_inches: null }]);
    // A skill the location doesn't take clears it; one it takes keeps it.
    expect(withTour({ ...filled(), location_id: 'santos', skill_level: 'advanced' }, { skill_level: 'beginner' }, locations).location_id).toBe('');
    expect(withTour({ ...filled(), location_id: 'santos', skill_level: 'advanced' }, { skill_level: 'intermediate' }, locations).location_id).toBe('santos');
  });

  it('says what blocks it: its tour, and what was collected', () => {
    expect(formProblem(filled(), true, true)).toBeNull();
    expect(formProblem({ ...filled(), skill_level: '' }, true, true)).toBe('Pick the skill level.');
    expect(formProblem({ ...filled(), trail_type: 'paved', skill_level: '' }, true, true)).toBeNull();
    expect(formProblem({ ...filled(), location_id: '' }, true, true)).toBe('Pick the location.');
    expect(formProblem({ ...filled(), manual_collected: 'abc' }, true, true)).toBe('Enter what was collected, or leave it empty.');
    expect(formProblem({ ...filled(), manual_collected: '700' }, true, true)).toBe('What was collected can’t be more than the total.');
    // An edit doesn't pick its tour: the same form passes without them.
    expect(formProblem({ ...filled(), location_id: '', skill_level: '' }, true)).toBeNull();
  });

  it('what the API receives: trimmed, each rider with their bike, nothing collected is 0', () => {
    const form = {
      ...filled(),
      customer_name: ' Laura Walton ',
      customer_phone: ' ',
      bike_rental: 'standard' as const,
      rider_height_inches: 66,
      riders: [{ name: ' Sam ', bike_rental: 'electric' as const, height_inches: 70 }],
      admin_notes: ' ',
    };
    expect(manualCreatePayload(form)).toEqual({
      customer_name: 'Laura Walton',
      customer_email: 'laura@example.com',
      customer_phone: undefined,
      trail_type: 'mtb',
      skill_level: 'beginner',
      location_id: 'markham',
      date: '2026-10-24',
      time_slot: '09:00',
      duration_hours: 2,
      bike_rental: 'standard',
      rider_height_inches: 66,
      additional_participants: [{ name: 'Sam', bike_rental: 'electric', height_inches: 70 }],
      total_cents: 60987,
      amount_collected_cents: 0,
      payment_method: 'cash',
      admin_notes: undefined,
      send_confirmation: true,
    });
    const paved = manualCreatePayload({ ...form, trail_type: 'paved', duration_hours: 3 });
    expect(paved).toMatchObject({ skill_level: null, duration_hours: 2 });
  });

  it('under the price: what it will owe, or that the email says $0', () => {
    expect(manualMoneyNote({ manual_total: '', manual_collected: '' })).toBeNull();
    expect(manualMoneyNote({ manual_total: '100', manual_collected: '100' })).toBeNull();
    expect(manualMoneyNote({ manual_total: '100', manual_collected: '150' })).toBeNull();
    expect(manualMoneyNote({ manual_total: '0', manual_collected: '' })).toBe(
      'The total is $0, and the confirmation email will say so. Enter the agreed price if there is one.',
    );
    expect(manualMoneyNote({ manual_total: '100', manual_collected: '' })).toBe(
      'Nothing collected yet: this holds the date. It shows $100.00 due until you record the payment on the booking’s page.',
    );
    expect(manualMoneyNote({ manual_total: '100', manual_collected: '40' })).toBe(
      '$40.00 collected now. It shows $60.00 due until you record the payment on the booking’s page.',
    );
  });

  it('lands on its page, which says whether the calendar and the email went out', () => {
    const ok = createdHref({ booking_id: 'b1', cal_booked: true, email_queued: true });
    expect(ok).toBe('/admin/bookings/b1?created=1&cal=ok&email=sent');
    expect(savedNotice(Object.fromEntries(new URL(ok, 'https://x').searchParams))).toEqual({
      attention: false,
      lines: ['Booking created.', 'The confirmation email with the waiver link was sent.'],
    });
    const held = createdHref({ booking_id: 'b1', cal_booked: false, email_queued: false });
    expect(savedNotice(Object.fromEntries(new URL(held, 'https://x').searchParams))).toEqual({
      attention: true,
      lines: [
        'Booking created.',
        'The calendar event was NOT created, so the slot isn’t blocked: use Retry calendar below.',
        'No email was sent: send it from this page when you’re ready.',
      ],
    });
  });
});
