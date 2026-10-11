import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No '@/' alias in vitest — point it at the real module.
vi.mock('@/lib/location-meta', () => import('./location-meta'));

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
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, JSON.stringify({ error: { message: 'User either already has booking at this time or is not available' } }))
    );
    const { createCalBooking } = await loadCal();

    const result = await createCalBooking(MTB_BOOKING);

    expect(result.uid).toBeNull();
    expect(result.status).toBe(409);
    expect(result.error).toContain('not available');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
