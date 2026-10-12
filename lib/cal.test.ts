import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NextRequest } from 'next/server';
import { easternLocalToUtcIso } from './booking-datetime';

// No '@/' alias in vitest — point it at the real modules.
vi.mock('@/lib/location-meta', () => import('./location-meta'));
vi.mock('@/lib/booking-datetime', () => import('./booking-datetime'));
vi.mock('@/lib/cal', () => import('./cal'));
vi.mock('@/lib/location-status', () => import('./location-status'));
vi.mock('@/lib/bike-counts', () => import('./bike-counts'));
// The availability route's Supabase-backed helpers (Sanford shared tours, bike
// inventory) aren't reached for an MTB tour with no rental bikes.
vi.mock('@/lib/inventory', () => ({ getFleetUsage: vi.fn() }));
vi.mock('@/lib/shared-tours', () => ({ getSharedTourSlots: vi.fn() }));

type CalModule = typeof import('./cal');

const LENGTH_REJECTED = JSON.stringify({
  status: 'error',
  error: {
    code: 'BadRequestException',
    message:
      "Can't specify 'lengthInMinutes' because event type does not have multiple possible lengths. Please, remove the 'lengthInMinutes' field from the request.",
  },
});

function jsonResponse(status: number, body: string) {
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

async function loadCal(): Promise<CalModule> {
  vi.resetModules();
  return import('./cal');
}

const MTB_BOOKING = {
  startIso: '2026-10-24T13:00:00.000Z',
  endIso: '2026-10-24T15:00:00.000Z',
  name: 'Test Rider',
  email: 'rider@example.com',
  trailType: 'mtb' as const,
  locationName: 'Markham Woods Trail, Lake Mary',
};

describe('Cal.com booking writes', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('CAL_API_KEY', 'cal_test_key');
    vi.stubEnv('CAL_EVENT_TYPE_ID_MTB', '5145953');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sentBody = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body as string);

  it('sends the meeting point as an attendee-defined location and the real tour length', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, JSON.stringify({ data: { uid: 'uid-1' } })));
    const { createCalBooking } = await loadCal();

    const result = await createCalBooking(MTB_BOOKING);

    expect(result).toEqual({ uid: 'uid-1', error: null });
    const body = sentBody(0);
    expect(body.location).toEqual({ type: 'attendeeDefined', location: '8515 Markham Rd, Lake Mary, FL 32746' });
    expect(body.lengthInMinutes).toBe(120);
    expect(body.eventTypeId).toBe(5145953);
  });

  it('retries without lengthInMinutes when the event type has a single duration', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(400, LENGTH_REJECTED))
      .mockResolvedValueOnce(jsonResponse(200, JSON.stringify({ data: { uid: 'uid-2' } })));
    const { createCalBooking } = await loadCal();

    const result = await createCalBooking(MTB_BOOKING);

    expect(result.uid).toBe('uid-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(1).lengthInMinutes).toBeUndefined();
    expect(sentBody(1).location).toBeDefined();
  });

  it('reports the Cal.com error message when the slot is not available', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(409, JSON.stringify({ error: { message: 'User either already has booking at this time or is not available' } }))
    );
    const { createCalBooking } = await loadCal();

    const result = await createCalBooking(MTB_BOOKING);

    expect(result.uid).toBeNull();
    expect(result.status).toBe(409);
    expect(result.error).toContain('not available');
    // One retry at the default length (see the next test), then it gives up.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the default length when the tour runs past the end of the schedule', async () => {
    // 10:00 + 2 h ends after the 8–11 AM schedule, so Cal.com refuses the real length.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(409, JSON.stringify({ error: { message: 'User either already has booking at this time or is not available' } }))
      )
      .mockResolvedValueOnce(jsonResponse(200, JSON.stringify({ data: { uid: 'uid-short' } })));
    const { createCalBooking } = await loadCal();

    const result = await createCalBooking({
      ...MTB_BOOKING,
      startIso: '2026-10-27T14:00:00.000Z',
      endIso: '2026-10-27T16:00:00.000Z',
    });

    expect(result).toEqual({ uid: 'uid-short', error: null });
    expect(sentBody(0).lengthInMinutes).toBe(120);
    expect(sentBody(1).lengthInMinutes).toBeUndefined();
    expect(sentBody(1).start).toBe('2026-10-27T14:00:00.000Z');
  });

  it('books a normal tour without the shared-tour flags', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, JSON.stringify({ data: { uid: 'uid-3' } })));
    const { createCalBooking } = await loadCal();

    await createCalBooking(MTB_BOOKING);

    expect(sentBody(0).allowConflicts).toBeUndefined();
    expect(sentBody(0).skipBookingLimits).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers['cal-api-version']).toBe('2024-08-13');
  });

  it('joins a shared Sanford tour with the conflict and booking-limit bypass', async () => {
    vi.stubEnv('CAL_EVENT_TYPE_ID_PAVED_SANFORD', '5398819');
    fetchMock.mockResolvedValueOnce(jsonResponse(201, JSON.stringify({ data: { uid: 'uid-group-2' } })));
    const { createCalBooking } = await loadCal();

    const result = await createCalBooking({
      ...MTB_BOOKING,
      trailType: 'paved',
      locationName: 'Sanford Historic Riverfront Tour',
      joinSharedTour: true,
    });

    expect(result).toEqual({ uid: 'uid-group-2', error: null });
    expect(sentBody(0)).toMatchObject({ eventTypeId: 5398819, allowConflicts: true, skipBookingLimits: true });
    // The bypass flags only exist from this API version on.
    expect(fetchMock.mock.calls[0][1].headers['cal-api-version']).toBe('2026-02-25');
  });

  it('moves a booking into a shared Sanford tour with the bypass flags', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, JSON.stringify({ data: { uid: 'uid-moved' } })));
    const { rescheduleCalBooking } = await loadCal();

    await rescheduleCalBooking('uid-old', {
      startIso: '2026-10-27T13:00:00.000Z',
      endIso: '2026-10-27T15:00:00.000Z',
      joinSharedTour: true,
    });

    expect(sentBody(0)).toMatchObject({ allowConflicts: true, skipBookingLimits: true });
    expect(fetchMock.mock.calls[0][1].headers['cal-api-version']).toBe('2026-02-25');
  });

  it('reschedules to the new start and returns the new uid', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, JSON.stringify({ data: { uid: 'uid-new' } })));
    const { rescheduleCalBooking } = await loadCal();

    const result = await rescheduleCalBooking('uid-old', {
      startIso: '2026-10-25T13:00:00.000Z',
      endIso: '2026-10-25T16:00:00.000Z',
    });

    expect(result).toEqual({ uid: 'uid-new', error: null });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.cal.com/v2/bookings/uid-old/reschedule');
    expect(sentBody(0)).toMatchObject({ start: '2026-10-25T13:00:00.000Z', lengthInMinutes: 180 });
  });

  it('treats cancelling an event Cal.com no longer has as done', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, JSON.stringify({ error: { message: 'not found' } })));
    const { cancelCalBooking } = await loadCal();

    await expect(cancelCalBooking('uid-gone')).resolves.toEqual({ ok: true, error: null });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.cal.com/v2/bookings/uid-gone/cancel');
  });
});

describe('Cal.com availability', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('CAL_API_KEY', 'cal_test_key');
    vi.stubEnv('CAL_USERNAME', 'fmbgt');
    vi.stubEnv('CAL_EVENT_TYPE_ID_MTB', '5145953');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const slotsResponse = (data: Record<string, Array<{ start: string }>>) =>
    jsonResponse(200, JSON.stringify({ status: 'success', data }));

  const getSlots = async (dateFrom = '2026-10-27', dateTo = '2026-11-03') => {
    const { getAvailableSlots } = await loadCal();
    return getAvailableSlots({ dateFrom, dateTo, trailType: 'mtb', locationName: 'Markham Woods Trail, Lake Mary' });
  };

  it('asks Cal.com for Eastern slots — the tours are in Florida, whatever the visitor’s time zone', async () => {
    fetchMock.mockResolvedValueOnce(
      slotsResponse({
        '2026-10-27': [
          { start: '2026-10-27T08:00:00.000-04:00' },
          { start: '2026-10-27T09:00:00.000-04:00' },
          { start: '2026-10-27T10:00:00.000-04:00' },
        ],
      })
    );

    const slots = await getSlots();

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('timeZone')).toBe('America/New_York');
    expect(slots).toEqual([
      { date: '2026-10-27', time: '08:00', available: true },
      { date: '2026-10-27', time: '09:00', available: true },
      { date: '2026-10-27', time: '10:00', available: true },
    ]);
  });

  it('turns UTC slots into Eastern time_slots that book the same instant, across the DST switch', async () => {
    // 8 AM in Florida: 12:00Z while on EDT, 13:00Z once DST ends (Nov 1 2026).
    const offered = ['2026-10-27T12:00:00.000Z', '2026-11-03T13:00:00.000Z'];
    fetchMock.mockResolvedValueOnce(
      slotsResponse({ '2026-10-27': [{ start: offered[0] }], '2026-11-03': [{ start: offered[1] }] })
    );

    const slots = await getSlots();

    expect(slots.map(({ date, time }) => ({ date, time }))).toEqual([
      { date: '2026-10-27', time: '08:00' },
      { date: '2026-11-03', time: '08:00' },
    ]);
    // What gets stored is later sent to Cal.com via easternLocalToUtcIso — it
    // must be the very slot Cal.com offered, or Cal.com refuses the booking.
    expect(slots.map((slot) => easternLocalToUtcIso(slot.date, slot.time))).toEqual(offered);
  });

  it('serves a Pacific visitor the Florida times the tours actually run at', async () => {
    // Cal.com answers in UTC when it isn't asked for a zone; 12:00Z is 8 AM in Florida (5 AM in LA).
    fetchMock.mockResolvedValueOnce(slotsResponse({ '2026-10-27': [{ start: '2026-10-27T12:00:00.000Z' }] }));
    vi.resetModules();
    const { GET } = await import('../app/api/availability/route');

    const query = new URLSearchParams({
      dateFrom: '2026-10-27',
      dateTo: '2026-10-27',
      timeZone: 'America/Los_Angeles', // what older clients sent from the browser
      trailType: 'mtb',
      locationName: 'Markham Woods Trail, Lake Mary',
    });
    const response = await GET(new NextRequest(`http://localhost/api/availability?${query}`));

    expect(await response.json()).toEqual({ slots: [{ date: '2026-10-27', time: '08:00', available: true }] });
  });

  it('files each slot under its Eastern date and drops slots outside the requested dates', async () => {
    fetchMock.mockResolvedValueOnce(
      slotsResponse({
        '2026-10-26': [{ start: '2026-10-26T12:00:00.000Z' }], // padding day before dateFrom
        '2026-10-28': [{ start: '2026-10-28T02:30:00.000Z' }], // 10:30 PM on Oct 27 in Florida
        '2026-10-29': [{ start: '2026-10-29T12:00:00.000Z' }], // after dateTo
      })
    );

    const slots = await getSlots('2026-10-27', '2026-10-28');

    expect(slots).toEqual([{ date: '2026-10-27', time: '22:30', available: true }]);
  });
});

describe('allowsSharedTours', () => {
  it('lets only Sanford take several groups per time slot', async () => {
    const { allowsSharedTours } = await loadCal();

    expect(allowsSharedTours('Sanford Historic Riverfront Tour')).toBe(true);
    expect(allowsSharedTours('  Sanford   Historic Riverfront Tour ')).toBe(true);
    expect(allowsSharedTours('Spring to Spring Trail Tour – Blue Spring State Park')).toBe(false);
    expect(allowsSharedTours('Markham Woods Trail, Lake Mary')).toBe(false);
    expect(allowsSharedTours(null)).toBe(false);
  });
});
