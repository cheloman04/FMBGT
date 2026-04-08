import type { AvailabilitySlot } from '@/types/booking';

const CAL_API_BASE = 'https://api.cal.com/v1';
const CAL_API_KEY = process.env.CAL_API_KEY;
const CAL_EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID;
const CAL_USERNAME = process.env.CAL_USERNAME;

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
    url.searchParams.set('apiKey', CAL_API_KEY);
    url.searchParams.set('username', CAL_USERNAME);
    url.searchParams.set('eventTypeId', CAL_EVENT_TYPE_ID);
    url.searchParams.set('startTime', startDate.toISOString());
    url.searchParams.set('endTime', endDate.toISOString());
    url.searchParams.set('timeZone', tz);

    // Log sanitized URL for debugging (API key redacted)
    const debugUrl = url.toString().replace(CAL_API_KEY, 'REDACTED');
    console.log('[cal] Requesting slots:', debugUrl);

    const response = await fetch(url.toString(), {
      next: { revalidate: 300 },
    });

    const rawBody = await response.text();
    console.log('[cal] Raw response status:', response.status);
    console.log('[cal] Raw response body:', rawBody.slice(0, 2000)); // first 2 KB

    if (!response.ok) {
      throw new Error(`Cal.com API error ${response.status}: ${rawBody.slice(0, 200)}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch {
      throw new Error(`Cal.com returned non-JSON: ${rawBody.slice(0, 200)}`);
    }

    const slots = transformCalResponse(data, tz);
    console.log(`[cal] Transformed ${slots.length} slot(s)`);
    if (slots.length > 0) {
      console.log('[cal] First slot:', slots[0]);
      console.log('[cal] Last slot:', slots[slots.length - 1]);
    }

    return slots;
  } catch (error) {
    console.error('[cal] getAvailableSlots error:', error);
    // Fallback to mock so the UI is never broken during dev
    return getMockAvailability(params.dateFrom, params.dateTo);
  }
}

// ---------------------------------------------------------------------------
// Transform Cal.com /v1/slots response → AvailabilitySlot[]
// Response shape: { slots: { "YYYY-MM-DD": [{ time: "<ISO>" }, ...], ... } }
// ---------------------------------------------------------------------------

function transformCalResponse(data: unknown, timeZone: string): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const calData = data as { slots?: Record<string, Array<{ time?: string }>> };

  if (!calData?.slots || typeof calData.slots !== 'object') {
    console.warn('[cal] Unexpected response shape — no "slots" key:', JSON.stringify(data).slice(0, 300));
    return slots;
  }

  for (const [date, timeSlots] of Object.entries(calData.slots)) {
    if (!Array.isArray(timeSlots)) continue;
    for (const slot of timeSlots) {
      const isoTime = slot.time ?? '';
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
  // Pattern: T<HH>:<MM>:<SS>±<HH>:<MM> or T<HH>:<MM>:<SS>+<HH><MM> etc.
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

    // Intl hour12:false can return "24" for midnight — normalise to "00"
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

  // Parse as local dates (not UTC midnight) to avoid timezone shift in the loop
  const [fromY, fromM, fromD] = dateFrom.split('-').map(Number);
  const [toY, toM, toD] = dateTo.split('-').map(Number);
  const start = new Date(fromY, fromM - 1, fromD);
  const end   = new Date(toY,   toM - 1,   toD);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // toIsoDate using LOCAL methods so keys match the calendar
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) continue; // Business is weekdays only in mock

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
// Cal.com booking types
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
    console.warn('[cal] CAL_API_KEY or CAL_EVENT_TYPE_ID not set — skipping booking creation');
    return null;
  }

  try {
    const url = new URL(`${CAL_API_BASE}/bookings`);
    url.searchParams.set('apiKey', CAL_API_KEY);

    const body = {
      eventTypeId: Number(CAL_EVENT_TYPE_ID),
      start: params.startIso,
      end: params.endIso,
      responses: {
        name: params.name,
        email: params.email,
      },
      timeZone: params.timeZone ?? 'America/New_York',
      language: 'en',
      metadata: {},
      ...(params.notes ? { title: params.notes } : {}),
    };

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[cal] Booking creation failed: ${response.status}`, errorText);
      return null;
    }

    let data: { uid?: string };
    try {
      data = await response.json() as { uid?: string };
    } catch {
      console.error('[cal] Failed to parse booking response as JSON');
      return null;
    }
    console.log(`[cal] Booking created: uid=${data.uid}`);
    return data.uid ?? null;
  } catch (error) {
    console.error('[cal] createCalBooking error:', error);
    return null;
  }
}
