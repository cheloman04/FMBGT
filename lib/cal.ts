import type { AvailabilitySlot } from '@/types/booking';

const CAL_API_BASE = 'https://api.cal.com/v1';
const CAL_API_KEY = process.env.CAL_API_KEY;
const CAL_EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID;
const CAL_USERNAME = process.env.CAL_USERNAME;

export interface CalAvailabilityParams {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  timeZone?: string;
}

// Fetch available slots from Cal.com
export async function getAvailableSlots(
  params: CalAvailabilityParams
): Promise<AvailabilitySlot[]> {
  // PLACEHOLDER: Replace with real Cal.com API call
  // Cal.com API v1 endpoint: GET /availability
  // Docs: https://cal.com/docs/api-reference

  if (!CAL_API_KEY || !CAL_EVENT_TYPE_ID || !CAL_USERNAME) {
    // Return mock data for development
    return getMockAvailability(params.dateFrom, params.dateTo);
  }

  try {
    // Cal.com v1 uses /slots (not /availability) for available booking times
    const url = new URL(`${CAL_API_BASE}/slots`);
    url.searchParams.set('apiKey', CAL_API_KEY);
    url.searchParams.set('username', CAL_USERNAME);
    url.searchParams.set('eventTypeId', CAL_EVENT_TYPE_ID);
    // /slots uses startTime/endTime as full ISO strings
    url.searchParams.set('startTime', `${params.dateFrom}T00:00:00.000Z`);
    url.searchParams.set('endTime', `${params.dateTo}T23:59:59.000Z`);
    if (params.timeZone) {
      url.searchParams.set('timeZone', params.timeZone);
    }

    const response = await fetch(url.toString(), {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`Cal.com API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform Cal.com response to our format
    // Adjust based on actual Cal.com API response shape
    return transformCalResponse(data);
  } catch (error) {
    console.error('Cal.com API error:', error);
    // Fallback to mock data on error
    return getMockAvailability(params.dateFrom, params.dateTo);
  }
}

// Transform Cal.com /v1/slots response to our AvailabilitySlot format
// Response shape: { slots: { "2026-04-01": [{ time: "2026-04-01T09:00:00-04:00" }, ...] } }
function transformCalResponse(data: unknown): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const calData = data as { slots?: Record<string, Array<{ time?: string }>> };

  if (calData?.slots) {
    for (const [date, timeSlots] of Object.entries(calData.slots)) {
      if (Array.isArray(timeSlots)) {
        for (const slot of timeSlots) {
          // Extract HH:MM from the ISO time string
          const isoTime = slot.time ?? '';
          const time = isoTime ? new Date(isoTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'America/New_York',
          }) : '';
          if (time) {
            slots.push({ date, time, available: true });
          }
        }
      }
    }
  }

  return slots;
}

// Mock availability data for development/testing
function getMockAvailability(dateFrom: string, dateTo: string): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const times = ['08:00', '10:00', '13:00', '15:00'];

  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    times.forEach((time) => {
      // Make some slots unavailable for realism
      const available = Math.random() > 0.3;
      slots.push({
        date: dateStr,
        time,
        available,
      });
    });
  }

  return slots;
}

export interface CalBookingParams {
  startIso: string;   // ISO 8601 UTC e.g. "2026-04-15T13:00:00.000Z"
  endIso: string;     // startIso + duration_hours
  name: string;
  email: string;
  timeZone?: string;  // default: 'America/New_York'
  notes?: string;     // shown as booking title in Cal.com
}

// Create a booking in Cal.com after payment is confirmed.
// Returns the Cal.com booking uid, or null if credentials are missing or the call fails.
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

// Group slots by date for easier rendering
export function groupSlotsByDate(
  slots: AvailabilitySlot[]
): Record<string, AvailabilitySlot[]> {
  return slots.reduce(
    (acc, slot) => {
      if (!acc[slot.date]) {
        acc[slot.date] = [];
      }
      acc[slot.date].push(slot);
      return acc;
    },
    {} as Record<string, AvailabilitySlot[]>
  );
}
