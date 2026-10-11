import type { AvailabilitySlot, TrailType } from '@/types/booking';
import { getBookingLocationMeta } from '@/lib/location-meta';

const CAL_API_BASE = 'https://api.cal.com/v2';
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

/** Headers for Cal.com v2 GET requests (no Content-Type) */
function calGetHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${CAL_API_KEY}`,
    'cal-api-version': '2024-09-04',
  };
}

/** Headers for Cal.com v2 POST/PATCH requests */
function calHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${CAL_API_KEY}`,
    'cal-api-version': '2024-08-13',
    'Content-Type': 'application/json',
  };
}

export interface CalAvailabilityParams {
  dateFrom: string; // YYYY-MM-DD (local date in the target timezone)
  dateTo: string;   // YYYY-MM-DD
  timeZone?: string;
  trailType?: TrailType | null;
  locationName?: string | null;
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

  const tz = params.timeZone ?? 'America/New_York';

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

    const slots = transformCalV2Response(data, tz);
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
//     "YYYY-MM-DD": [{ "start": "<ISO UTC>" }, ...],
//     ...
//   }
// }
// ---------------------------------------------------------------------------

function transformCalV2Response(data: unknown, timeZone: string): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const wrapper = data as { data?: Record<string, Array<{ start?: string }>> };

  const slotsMap = wrapper?.data;
  if (!slotsMap || typeof slotsMap !== 'object') {
    console.warn('[cal] v2 response has no data map:', JSON.stringify(data).slice(0, 300));
    return slots;
  }

  for (const [date, timeSlots] of Object.entries(slotsMap)) {
    if (!Array.isArray(timeSlots)) continue;
    for (const slot of timeSlots) {
      const isoTime = slot.start ?? '';
      if (!isoTime) continue;

      const time = extractLocalTime(isoTime, timeZone);
      if (time) {
        slots.push({ date, time, available: true });
      }
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Reliably extract HH:MM in the target timezone from an ISO timestamp.
//
// Cal.com may return times as:
//   "2026-04-09T09:00:00-04:00"  (already offset-aware → extract directly)
//   "2026-04-09T13:00:00.000Z"   (UTC → convert to local timezone)
// ---------------------------------------------------------------------------

function extractLocalTime(isoTime: string, timeZone: string): string {
  // Fast path: ISO string already carries the timezone offset.
  const offsetMatch = isoTime.match(/T(\d{2}):(\d{2}):\d{2}[+-]\d{2}:?\d{2}$/);
  if (offsetMatch) {
    return `${offsetMatch[1]}:${offsetMatch[2]}`;
  }

  // Slow path: UTC time — convert to target timezone using Intl.
  try {
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const h = parts.find((p) => p.type === 'hour')?.value ?? '';
    const m = parts.find((p) => p.type === 'minute')?.value ?? '';

    if (!h || !m) return '';

    const hour = h === '24' ? '00' : h.padStart(2, '0');
    return `${hour}:${m.padStart(2, '0')}`;
  } catch {
    return '';
  }
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

type CalPostResult = { ok: boolean; status: number; rawBody: string };

async function postCal(path: string, body: Record<string, unknown>, label: string): Promise<CalPostResult> {
  let payload = { ...body };

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${CAL_API_BASE}${path}`, {
      method: 'POST',
      headers: calHeaders(),
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(payload),
    });
    const rawBody = await response.text();
    console.log(`[cal] ${label} response status:`, response.status);
    console.log(`[cal] ${label} response body:`, rawBody.slice(0, 1000));

    const rejected =
      response.status === 400 && attempt < DROPPABLE_FIELDS.length
        ? DROPPABLE_FIELDS.find((field) => field in payload && rawBody.includes(field))
        : undefined;
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
    };

    console.log(
      `[cal] Resolved booking event type ${eventTypeId} for trail=${params.trailType ?? 'unknown'} location="${params.locationName ?? 'unknown'}"`
    );
    console.log(
      '[cal] Creating booking (v2):',
      JSON.stringify({ ...body, attendee: { ...(body.attendee as object), email: '[REDACTED]' } })
    );

    const result = await postCal('/bookings', body, 'Booking');
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
  params: { startIso: string; endIso: string; reason?: string }
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
      },
      'Reschedule'
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
