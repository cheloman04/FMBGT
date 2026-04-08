import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/cal';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const timeZone = searchParams.get('timeZone') ?? 'America/New_York';

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'dateFrom and dateTo are required' },
        { status: 400 }
      );
    }

    console.log(`[availability] dateFrom=${dateFrom} dateTo=${dateTo} timeZone=${timeZone}`);

    const slots = await getAvailableSlots({ dateFrom, dateTo, timeZone });

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
