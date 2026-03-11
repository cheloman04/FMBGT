import type { AvailabilitySlot } from '@/types/booking';

const CAL_API_BASE = 'https://api.cal.com/v1';
const CAL_API_KEY = process.env.CAL_API_KEY;
const CAL_EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID;

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

  if (!CAL_API_KEY || !CAL_EVENT_TYPE_ID) {
    // Return mock data for development
    return getMockAvailability(params.dateFrom, params.dateTo);
  }

  try {
    const url = new URL(`${CAL_API_BASE}/availability`);
    url.searchParams.set('apiKey', CAL_API_KEY);
    url.searchParams.set('eventTypeId', CAL_EVENT_TYPE_ID);
    url.searchParams.set('dateFrom', params.dateFrom);
    url.searchParams.set('dateTo', params.dateTo);
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

// Transform Cal.com API response to our AvailabilitySlot format
function transformCalResponse(data: unknown): AvailabilitySlot[] {
  // PLACEHOLDER: Adjust based on actual Cal.com response structure
  const slots: AvailabilitySlot[] = [];

  const calData = data as { slots?: Record<string, Array<{ time?: string; startTime?: string }>> };

  if (calData?.slots) {
    for (const [date, timeSlots] of Object.entries(calData.slots)) {
      if (Array.isArray(timeSlots)) {
        for (const slot of timeSlots) {
          slots.push({
            date,
            time: slot.time ?? slot.startTime ?? '',
            available: true,
          });
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
