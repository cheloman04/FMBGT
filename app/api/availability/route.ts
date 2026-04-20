import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/cal';
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
