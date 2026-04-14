import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { markReviewRequestReceived } from '@/lib/review-requests';

const BodySchema = z.object({
  enrollment_id: z.string().uuid(),
  platform: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || session !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await markReviewRequestReceived({
    enrollmentId: parsed.data.enrollment_id,
    platform: parsed.data.platform ?? 'manual_admin',
  });

  return NextResponse.json({ ok: true });
}
