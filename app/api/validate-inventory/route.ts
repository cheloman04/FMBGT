import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBookingInventory } from '@/lib/inventory';

const Schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bike_rental: z.enum(['none', 'standard', 'electric']),
  addons: z.object({
    gopro: z.boolean().optional(),
    pickup_dropoff: z.boolean().optional(),
    electric_upgrade: z.boolean().optional(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { date, bike_rental, addons } = parsed.data;
    const result = await validateBookingInventory(date, bike_rental, addons);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Inventory validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
