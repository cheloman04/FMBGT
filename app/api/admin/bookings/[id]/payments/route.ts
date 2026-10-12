/**
 * POST /api/admin/bookings/[id]/payments — move money on an online booking after
 * an edit: charge the saved card, record a payment, refund to the card or record
 * a cash refund (lib/booking-payments.ts). `request_id` (a UUID per click) keeps
 * a double submit from charging or refunding twice.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { applyBookingPayment } from '@/lib/booking-payments';

const Amount = z.number().int().min(1).max(100_000_00);
const Method = z.enum(['cash', 'zelle', 'venmo', 'other']);
const RequestId = z.string().uuid();

const PaymentSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('charge_card'), amount_cents: Amount, request_id: RequestId }),
  z.object({ action: z.literal('record_payment'), amount_cents: Amount, method: Method, request_id: RequestId }),
  z.object({
    action: z.literal('refund_card'),
    amount_cents: Amount,
    request_id: RequestId,
    reason: z.string().trim().max(300).nullish(),
  }),
  z.object({
    action: z.literal('record_refund'),
    amount_cents: Amount,
    method: Method,
    request_id: RequestId,
    reason: z.string().trim().max(300).nullish(),
  }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUserFromCookieStore(await cookies());
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = PaymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await applyBookingPayment(id, parsed.data, admin.email ?? null);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/bookings/payments POST]', err);
    return NextResponse.json({ error: 'Failed to record the payment' }, { status: 500 });
  }
}
