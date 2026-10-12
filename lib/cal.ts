import type { AvailabilitySlot, TrailType } from '@/types/booking';
import { getBookingLocationMeta } from '@/lib/location-meta';
import { utcIsoToEasternLocal } from '@/lib/booking-datetime';

const CAL_API_BASE = 'https://api.cal.com/v2';
// Tours run in Florida: slots are shown and stored (bookings.time_slot) as
// Eastern wall-clock time, whatever the visitor's browser time zone is.
const TOUR_TIME_ZONE = 'America/New_York';
const CAL_API_KEY = process.env.CAL_API_KEY;
const CAL_USERNAME = process.env.CAL_USERNAME;
const CAL_EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID;
const CAL_EVENT_TYPE_ID_MTB = process.env.CAL_EVENT_TYPE_ID_MTB ?? CAL_EVENT_TYPE_ID;
const CAL_EVENT_TYPE_ID_PAVED_SANFORD = process.env.CAL_EVENT_TYPE_ID_PAVED_SANFORD;
const CAL_EVENT_TYPE_ID_PAVED_BLUE_SPRING = process.env.CAL_EVENT_TYPE_ID_PAVED_BLUE_SPRING;

const SANFORD_PAVED_LOCATION = 'Sanford Historic Riverfront Tour';
const BLUE_SPRING_PAVED_LOCATION = 'Spring to Spring Trail Tour - Blue Spring State Park';
const BLUE_SPRING_PAVED_LOCATION_ALT = 'Spring to Spring Trail Tour – Blue Spring State Park';

function normalizeCalLocationName(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CalEventTypeLookupInput {
  trailType?: TrailType | null;
  locationName?: string | null;
}

export function getCalEventTypeId(input: CalEventTypeLookupInput): string | null {
  const normalizedLocationName = normalizeCalLocationName(input.locationName);

  if (input.trailType === 'mtb') {
    return CAL_EVENT_TYPE_ID_MTB ?? null;
  }

  if (input.trailType === 'paved') {
    if (normalizedLocationName === normalizeCalLocationName(SANFORD_PAVED_LOCATION)) {
      return CAL_EVENT_TYPE_ID_PAVED_SANFORD ?? null;
    }

    if (
      normalizedLocationName === normalizeCalLocationName(BLUE_SPRING_PAVED_LOCATION) ||
      normalizedLocationName === normalizeCalLocationName(BLUE_SPRING_PAVED_LOCATION_ALT)
    ) {
      return CAL_EVENT_TYPE_ID_PAVED_BLUE_SPRING ?? null;
    }
  }

  return null;
}

/**
 * Sanford tours take several groups at the same time slot (bikes permitting);
 * every other tour is one group per day.
 */
export function allowsSharedTours(locationName: string | null | undefined): boolean {
  return normalizeCalLocationName(locationName) === normalizeCalLocationName(SANFORD_PAVED_LOCATION);
}

/** Headers for Cal.com v2 GET requests (no Content-Type) */
function calGetHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${CAL_API_KEY}`,
    'cal-api-version': '2024-09-04',
  };
}

const CAL_WRITE_API_VERSION = '2024-08-13';
// `allowConflicts` / `skipBookingLimits` only exist from this API version on.
const CAL_SHARED_TOUR_API_VERSION = '2026-02-25';

/** Headers for Cal.com v2 POST/PATCH requests */
function calHeaders(apiVersion = CAL_WRITE_API_VERSION): HeadersInit {
  return {
    Authorization: `Bearer ${CAL_API_KEY}`,
    'cal-api-version': apiVersion,
    'Content-Type': 'application/json',
  };
}

export interface CalAvailabilityParams {
  dateFrom: string; // YYYY-MM-DD (Eastern calendar date)
  dateTo: string;   // YYYY-MM-DD
  trailType?: TrailType | null;
  locationName?: string | null;
  /** Tour length when it's known up front: Cal.com then only offers starts the whole tour fits after. */
  durationMinutes?: number;
}

// ---------------------------------------------------------------------------
// Public: fetch available slots
// ---------------------------------------------------------------------------

export async function getAvailableSlots(
  params: CalAvailabilityParams
): Promise<AvailabilitySlot[]> {
  const eventTypeId = getCalEventTypeId({
    trailType: params.trailType,
    locationName: params.locationName,
  });

  if (!CAL_API_KEY || !eventTypeId || !CAL_USERNAME) {
    console.log('[cal] Credentials not set — using mock data');
    return getMockAvailability(params.dateFrom, params.dateTo);
  }

  try {
    // Extend the UTC range by 1 day on each side so no slot is missed due to
    // the timezone offset between the local date and UTC midnight.
    const startDate = new Date(`${params.dateFrom}T00:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - 1);

    const endDate = new Date(`${params.dateTo}T23:59:59.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    const url = new URL(`${CAL_API_BASE}/slots`);
    url.searchParams.set('eventTypeId', eventTypeId);
    url.searchParams.set('start', startDate.toISOString());
    url.searchParams.set('end', endDate.toISOString());
    url.searchParams.set('timeZone', TOUR_TIME_ZONE);
    if (params.durationMinutes) url.searchParams.set('duration', String(params.durationMinutes));

    console.log(
      `[cal] Resolved event type ${eventTypeId} for trail=${params.trailType ?? 'unknown'} location="${params.locationName ?? 'unknown'}"`
    );
    console.log('[cal] Requesting slots (v2):', url.toString());

    const response = await fetch(url.toString(), {
      headers: calGetHeaders(),
      next: { revalidate: 300 },
    });

    const rawBody = await response.text();
    console.log('[cal] Raw response status:', response.status);
    console.log('[cal] Raw response body:', rawBody.slice(0, 2000));

    if (!response.ok) {
      throw new Error(`Cal.com API error ${response.status}: ${rawBody.slice(0, 200)}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch {
      throw new Error(`Cal.com returned non-JSON: ${rawBody.slice(0, 200)}`);
    }

    const slots = transformCalV2Response(data, params.dateFrom, params.dateTo);
    console.log(`[cal] Transformed ${slots.length} slot(s)`);
    if (slots.length > 0) {
      console.log('[cal] First slot:', slots[0]);
      console.log('[cal] Last slot:', slots[slots.length - 1]);
    }

    return slots;
  } catch (error) {
    console.error('[cal] getAvailableSlots error:', error);
    return getMockAvailability(params.dateFrom, params.dateTo);
  }
}

// ---------------------------------------------------------------------------
// Transform Cal.com v2 /slots response → AvailabilitySlot[]
//
// Actual v2 response shape (confirmed from live API):
// {
//   "data": {
//     "YYYY-MM-DD": [{ "start": "<ISO>" }, ...],
//     ...
//   }
// }
//
// `start` is "2026-10-27T08:00:00.000-04:00" when timeZone is sent, or UTC
// ("2026-10-27T12:00:00.000Z") without it. Either way the slot's date and time
// are re-derived in Eastern from the instant itself — the map key is not
// trusted, so a slot can never land on the wrong day — and slots outside the
// requested dates (the query window is padded by a day) are dropped.
// ---------------------------------------------------------------------------

function transformCalV2Response(
  data: unknown,
  dateFrom: string,
  dateTo: string
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const wrapper = data as { data?: Record<string, Array<{ start?: string }>> };

  const slotsMap = wrapper?.data;
  if (!slotsMap || typeof slotsMap !== 'object') {
    console.warn('[cal] v2 response has no data map:', JSON.stringify(data).slice(0, 300));
    return slots;
  }

  for (const timeSlots of Object.values(slotsMap)) {
    if (!Array.isArray(timeSlots)) continue;
    for (const slot of timeSlots) {
      const local = slot.start ? utcIsoToEasternLocal(slot.start) : null;
      if (!local || local.date < dateFrom || local.date > dateTo) continue;
      slots.push({ date: local.date, time: local.time, available: true });
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Mock availability — used when credentials are absent or API call fails
// ---------------------------------------------------------------------------

function getMockAvailability(dateFrom: string, dateTo: string): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const times = ['09:00', '11:00'];

  const [fromY, fromM, fromD] = dateFrom.split('-').map(Number);
  const [toY, toM, toD] = dateTo.split('-').map(Number);
  const start = new Date(fromY, fromM - 1, fromD);
  const end   = new Date(toY,   toM - 1,   toD);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    times.forEach((time) => {
      slots.push({ date: dateStr, time, available: true });
    });
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Group slots by date
// ---------------------------------------------------------------------------

export function groupSlotsByDate(
  slots: AvailabilitySlot[]
): Record<string, AvailabilitySlot[]> {
  return slots.reduce(
    (acc, slot) => {
      if (!acc[slot.date]) acc[slot.date] = [];
      acc[slot.date].push(slot);
      return acc;
    },
    {} as Record<string, AvailabilitySlot[]>
  );
}

// ---------------------------------------------------------------------------
// Cal.com v2 booking writes (create / reschedule / cancel)
// ---------------------------------------------------------------------------

export interface CalBookingParams {
  startIso: string;   // ISO 8601 UTC
  endIso: string;
  name: string;
  email: string;
  timeZone?: string;
  notes?: string;
  trailType?: TrailType | null;
  locationName?: string | null;
  /** Another group's event already holds this time (Sanford) — book alongside it. */
  joinSharedTour?: boolean;
}

/** uid of the Cal.com booking on success; otherwise a human-readable error. */
export interface CalWriteResult {
  uid: string | null;
  error: string | null;
  status?: number;
}

// Optional fields an event type can reject depending on how it is configured in
// Cal.com: `lengthInMinutes` needs "multiple durations" enabled, and `location`
// must fit the event type's location setup. When Cal names one of them in a 400
// we drop it and retry — an event without it beats no calendar event at all.
const DROPPABLE_FIELDS = ['lengthInMinutes', 'location'] as const;

// A group joining a Sanford tour that already has its calendar event books the
// same time on purpose: skip Cal.com's conflict check and its one-booking-per-day
// limit. Cal.com only honours these for the event owner's API key.
const SHARED_TOUR_FLAGS = { allowConflicts: true, skipBookingLimits: true };

type CalPostResult = { ok: boolean; status: number; rawBody: string };

function droppableField(payload: Record<string, unknown>, status: number, rawBody: string) {
  if (status !== 400 && status !== 409) return undefined;
  const named = DROPPABLE_FIELDS.find((field) => field in payload && rawBody.includes(field));
  if (named) return named;
  // The schedules are 8–11 AM (start times), so a tour that runs past 11:00 —
  // 2 h at 10:00, 3 h at 9:00 — is refused as "not available". Fall back to the
  // event type's default length: the start time is still blocked, as it was
  // before multiple durations were turned on.
  return 'lengthInMinutes' in payload ? 'lengthInMinutes' : undefined;
}

async function postCal(
  path: string,
  body: Record<string, unknown>,
  label: string,
  apiVersion?: string
): Promise<CalPostResult> {
  let payload = { ...body };

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${CAL_API_BASE}${path}`, {
      method: 'POST',
      headers: calHeaders(apiVersion),
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(payload),
    });
    const rawBody = await response.text();
    console.log(`[cal] ${label} response status:`, response.status);
    console.log(`[cal] ${label} response body:`, rawBody.slice(0, 1000));

    const rejected =
      attempt < DROPPABLE_FIELDS.length ? droppableField(payload, response.status, rawBody) : undefined;
    if (!rejected) return { ok: response.ok, status: response.status, rawBody };

    console.warn(`[cal] ${label}: Cal.com rejected '${rejected}' — retrying without it`);
    payload = { ...payload };
    delete payload[rejected];
  }
}

function calErrorMessage(result: CalPostResult): string {
  try {
    const parsed = JSON.parse(result.rawBody) as { error?: { message?: string } };
    if (parsed?.error?.message) return `Cal.com ${result.status}: ${parsed.error.message}`;
  } catch {
    /* non-JSON body */
  }
  return `Cal.com ${result.status}: ${result.rawBody.slice(0, 200)}`;
}

function parseCalUid(rawBody: string): string | null {
  try {
    const data = JSON.parse(rawBody) as { data?: { uid?: string } };
    return data?.data?.uid ?? null;
  } catch {
    console.error('[cal] Failed to parse booking response as JSON');
    return null;
  }
}

function minutesBetween(startIso: string, endIso: string): number | null {
  const minutes = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

export async function createCalBooking(
  params: CalBookingParams
): Promise<CalWriteResult> {
  const eventTypeId = getCalEventTypeId({
    trailType: params.trailType,
    locationName: params.locationName,
  });

  if (!CAL_API_KEY || !eventTypeId) {
    console.error(
      '[cal] SKIPPED booking creation — missing env vars:',
      !CAL_API_KEY ? 'CAL_API_KEY' : '',
      !eventTypeId ? `eventTypeId for ${params.trailType ?? 'unknown'} / ${params.locationName ?? 'unknown'}` : '',
      '| booking will have cal_booking_uid=NULL'
    );
    return { uid: null, error: 'Cal.com is not configured for this tour (missing API key or event type)' };
  }

  try {
    const lengthInMinutes = minutesBetween(params.startIso, params.endIso);
    const body: Record<string, unknown> = {
      eventTypeId: Number(eventTypeId),
      start: params.startIso,
      ...(lengthInMinutes ? { lengthInMinutes } : {}),
      attendee: {
        name: params.name,
        email: params.email,
        timeZone: params.timeZone ?? 'America/New_York',
        language: 'en',
      },
      // The event types ask for an attendee-defined location; send the tour's
      // meeting point so the guide's calendar event shows where to meet.
      location: {
        type: 'attendeeDefined',
        location: getBookingLocationMeta(params.locationName).meetingPointAddress,
      },
      metadata: {},
      ...(params.joinSharedTour ? SHARED_TOUR_FLAGS : {}),
    };

    console.log(
      `[cal] Resolved booking event type ${eventTypeId} for trail=${params.trailType ?? 'unknown'} location="${params.locationName ?? 'unknown'}"`
    );
    console.log(
      '[cal] Creating booking (v2):',
      JSON.stringify({ ...body, attendee: { ...(body.attendee as object), email: '[REDACTED]' } })
    );

    const result = await postCal(
      '/bookings',
      body,
      'Booking',
      params.joinSharedTour ? CAL_SHARED_TOUR_API_VERSION : undefined
    );
    if (!result.ok) {
      console.error(`[cal] Booking creation failed: ${result.status}`, result.rawBody.slice(0, 500));
      return { uid: null, error: calErrorMessage(result), status: result.status };
    }

    const uid = parseCalUid(result.rawBody);
    console.log(`[cal] Booking created: uid=${uid}`);
    return uid ? { uid, error: null } : { uid: null, error: 'Cal.com returned no booking uid' };
  } catch (error) {
    console.error('[cal] createCalBooking error:', error);
    return { uid: null, error: (error as Error).message };
  }
}

/**
 * Move an existing Cal.com booking. Cal.com creates a NEW booking for the new
 * time, so the returned uid replaces the old one.
 */
export async function rescheduleCalBooking(
  uid: string,
  params: { startIso: string; endIso: string; reason?: string; joinSharedTour?: boolean }
): Promise<CalWriteResult> {
  if (!CAL_API_KEY) return { uid: null, error: 'Cal.com is not configured (missing CAL_API_KEY)' };

  try {
    const lengthInMinutes = minutesBetween(params.startIso, params.endIso);
    const result = await postCal(
      `/bookings/${encodeURIComponent(uid)}/reschedule`,
      {
        start: params.startIso,
        ...(lengthInMinutes ? { lengthInMinutes } : {}),
        reschedulingReason: params.reason ?? 'Updated by Florida Mountain Bike Guides',
        ...(params.joinSharedTour ? SHARED_TOUR_FLAGS : {}),
      },
      'Reschedule',
      params.joinSharedTour ? CAL_SHARED_TOUR_API_VERSION : undefined
    );
    if (!result.ok) {
      console.error(`[cal] Reschedule failed for ${uid}: ${result.status}`, result.rawBody.slice(0, 500));
      return { uid: null, error: calErrorMessage(result), status: result.status };
    }

    const newUid = parseCalUid(result.rawBody);
    console.log(`[cal] Booking rescheduled: ${uid} -> ${newUid}`);
    return newUid ? { uid: newUid, error: null } : { uid: null, error: 'Cal.com returned no booking uid' };
  } catch (error) {
    console.error('[cal] rescheduleCalBooking error:', error);
    return { uid: null, error: (error as Error).message };
  }
}

/** Cancel a Cal.com booking so the slot opens up again. A 404 counts as done. */
export async function cancelCalBooking(
  uid: string,
  reason?: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!CAL_API_KEY) return { ok: false, error: 'Cal.com is not configured (missing CAL_API_KEY)' };

  try {
    const result = await postCal(
      `/bookings/${encodeURIComponent(uid)}/cancel`,
      { cancellationReason: reason ?? 'Cancelled by Florida Mountain Bike Guides' },
      'Cancel'
    );
    if (result.ok || result.status === 404) {
      console.log(`[cal] Booking cancelled: uid=${uid} (status ${result.status})`);
      return { ok: true, error: null };
    }
    console.error(`[cal] Cancel failed for ${uid}: ${result.status}`, result.rawBody.slice(0, 500));
    return { ok: false, error: calErrorMessage(result) };
  } catch (error) {
    console.error('[cal] cancelCalBooking error:', error);
    return { ok: false, error: (error as Error).message };
  }
}
