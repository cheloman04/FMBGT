import type { AvailabilitySlot } from '@/types/booking';

const CAL_API_BASE = 'https://api.cal.com/v2';
const CAL_API_KEY = process.env.CAL_API_KEY;
const CAL_EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID;
const CAL_USERNAME = process.env.CAL_USERNAME;

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
}

// ---------------------------------------------------------------------------
// Public: fetch available slots
// ---------------------------------------------------------------------------

export async function getAvailableSlots(
  params: CalAvailabilityParams
): Promise<AvailabilitySlot[]> {
  if (!CAL_API_KEY || !CAL_EVENT_TYPE_ID || !CAL_USERNAME) {
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
    url.searchParams.set('eventTypeId', CAL_EVENT_TYPE_ID);
    url.searchParams.set('start', startDate.toISOString());
    url.searchParams.set('end', endDate.toISOString());

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
// Cal.com v2 booking creation
// ---------------------------------------------------------------------------

export interface CalBookingParams {
  startIso: string;   // ISO 8601 UTC
  endIso: string;
  name: string;
  email: string;
  timeZone?: string;
  notes?: string;
}

export async function createCalBooking(
  params: CalBookingParams
): Promise<string | null> {
  if (!CAL_API_KEY || !CAL_EVENT_TYPE_ID) {
    console.error(
      '[cal] SKIPPED booking creation — missing env vars:',
      !CAL_API_KEY ? 'CAL_API_KEY' : '',
      !CAL_EVENT_TYPE_ID ? 'CAL_EVENT_TYPE_ID' : '',
      '| booking will have cal_booking_uid=NULL'
    );
    return null;
  }

  try {
    const url = new URL(`${CAL_API_BASE}/bookings`);

    const body = {
      eventTypeId: Number(CAL_EVENT_TYPE_ID),
      start: params.startIso,
      attendee: {
        name: params.name,
        email: params.email,
        timeZone: params.timeZone ?? 'America/New_York',
        language: 'en',
      },
      metadata: {},
    };

    console.log('[cal] Creating booking (v2):', JSON.stringify({ ...body, attendee: { ...body.attendee, email: '[REDACTED]' } }));

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: calHeaders(),
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(body),
    });

    const rawBody = await response.text();
    console.log('[cal] Booking response status:', response.status);
    console.log('[cal] Booking response body:', rawBody.slice(0, 1000));

    if (!response.ok) {
      console.error(`[cal] Booking creation failed: ${response.status}`, rawBody.slice(0, 500));
      return null;
    }

    let data: { status?: string; data?: { uid?: string } };
    try {
      data = JSON.parse(rawBody) as typeof data;
    } catch {
      console.error('[cal] Failed to parse booking response as JSON');
      return null;
    }

    const uid = data?.data?.uid ?? null;
    console.log(`[cal] Booking created: uid=${uid}`);
    return uid;
  } catch (error) {
    console.error('[cal] createCalBooking error:', error);
    return null;
  }
}
