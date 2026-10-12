import { NextRequest, NextResponse } from 'next/server';
import { allowsSharedTours, getAvailableSlots } from '@/lib/cal';
import { easternLocalToUtcIso } from '@/lib/booking-datetime';
import { lacksBikes, type BikeCounts } from '@/lib/bike-counts';
import { getFleetUsage } from '@/lib/inventory';
import { getSharedTourSlots } from '@/lib/shared-tours';
import type { AvailabilitySlot, TrailType } from '@/types/booking';

// Same as the event types' minimum booking notice in Cal.com (1200 min).
const SHARED_TOUR_MIN_NOTICE_MS = 20 * 60 * 60 * 1000;

function toCount(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Sanford: offer the time of a tour another group already booked (lib/shared-tours.ts). */
async function addSharedTourSlots(
  slots: AvailabilitySlot[],
  input: { locationName: string; dateFrom: string; dateTo: string }
): Promise<AvailabilitySlot[]> {
  try {
    const earliest = Date.now() + SHARED_TOUR_MIN_NOTICE_MS;
    const offered = new Set(slots.map((s) => `${s.date} ${s.time}`));
    const shared = (await getSharedTourSlots(input)).filter(
      (s) => !offered.has(`${s.date} ${s.time}`) && Date.parse(easternLocalToUtcIso(s.date, s.time)) >= earliest
    );
    console.log(`[availability] Adding ${shared.length} shared Sanford tour slot(s)`);
    return [...slots, ...shared.map((s) => ({ date: s.date, time: s.time, available: true }))];
  } catch (error) {
    console.error('[availability] shared tour lookup failed:', error);
    return slots;
  }
}

/** Hide dates whose leftover fleet can't seat the group (checkout re-checks). */
async function removeDatesWithoutBikes(
  slots: AvailabilitySlot[],
  input: { dateFrom: string; dateTo: string; needed: BikeCounts }
): Promise<AvailabilitySlot[]> {
  try {
    const { totals, usedByDate } = await getFleetUsage(input.dateFrom, input.dateTo);
    const noBikesUsed: BikeCounts = { bikes: 0, electric: 0 };
    return slots.filter((s) => !lacksBikes(totals, usedByDate.get(s.date) ?? noBikesUsed, input.needed));
  } catch (error) {
    console.error('[availability] bike inventory lookup failed:', error);
    return slots;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const timeZone = searchParams.get('timeZone') ?? 'America/New_York';
    const trailType = searchParams.get('trailType') as TrailType | null;
    const locationName = searchParams.get('locationName');
    // Rental bikes the group needs (optional — set once riders are chosen).
    const needed: BikeCounts = {
      bikes: toCount(searchParams.get('bikes')),
      electric: toCount(searchParams.get('electricBikes')),
    };

    if (!dateFrom || !dateTo || !trailType || !locationName) {
      return NextResponse.json(
        { error: 'dateFrom, dateTo, trailType, and locationName are required' },
        { status: 400 }
      );
    }

    console.log(
      `[availability] dateFrom=${dateFrom} dateTo=${dateTo} timeZone=${timeZone} trailType=${trailType} locationName="${locationName}" bikes=${needed.bikes} electric=${needed.electric}`
    );

    let slots = await getAvailableSlots({ dateFrom, dateTo, timeZone, trailType, locationName });

    if (allowsSharedTours(locationName)) {
      slots = await addSharedTourSlots(slots, { locationName, dateFrom, dateTo });
    }
    if (needed.bikes > 0 || needed.electric > 0) {
      slots = await removeDatesWithoutBikes(slots, { dateFrom, dateTo, needed });
    }

    console.log(`[availability] Returning ${slots.length} slot(s) to client`);

    // Group by date so frontend can log how many dates have slots
    const dateCount = new Set(slots.map((s) => s.date)).size;
    console.log(`[availability] Unique dates with slots: ${dateCount}`);

    return NextResponse.json(
      { slots },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Availability error:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}
