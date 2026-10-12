import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/cal';
import { isLocationComingSoon } from '@/lib/location-status';
import { SANFORD_MAX_RIDERS, buildSanfordSlots, isSanfordLocation } from '@/lib/sanford';
import { getSanfordRidersBooked } from '@/lib/sanford-departures';
import type { TrailType } from '@/types/booking';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const timeZone = searchParams.get('timeZone') ?? 'America/New_York';
    const trailType = searchParams.get('trailType') as TrailType | null;
    const locationName = searchParams.get('locationName');

    if (!dateFrom || !dateTo || !trailType || !locationName) {
      return NextResponse.json(
        { error: 'dateFrom, dateTo, trailType, and locationName are required' },
        { status: 400 }
      );
    }

    console.log(
      `[availability] dateFrom=${dateFrom} dateTo=${dateTo} timeZone=${timeZone} trailType=${trailType} locationName="${locationName}"`
    );

    // "Coming Soon" locations can't be booked, so they have no open slots.
    if (isLocationComingSoon(locationName)) {
      return NextResponse.json({ slots: [] });
    }

    // Sanford: one shared 10:00 departure a day. Seats change with every booking,
    // so this response is never cached.
    if (trailType === 'paved' && isSanfordLocation(locationName)) {
      const riders = Math.min(SANFORD_MAX_RIDERS, Math.max(1, Number(searchParams.get('riders')) || 1));
      const [calSlots, ridersBooked] = await Promise.all([
        // Eastern time, so the departure reads 10:00 for every visitor.
        getAvailableSlots({ dateFrom, dateTo, timeZone: 'America/New_York', trailType, locationName }),
        getSanfordRidersBooked(dateFrom, dateTo),
      ]);
      const slots = buildSanfordSlots({ calSlots, ridersBooked, riders, dateFrom, dateTo });
      console.log(`[availability] Sanford: ${slots.length} departure(s) for ${riders} rider(s)`);
      return NextResponse.json({ slots }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const slots = await getAvailableSlots({ dateFrom, dateTo, timeZone, trailType, locationName });

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
