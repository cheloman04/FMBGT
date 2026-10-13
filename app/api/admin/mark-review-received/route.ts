import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { markReviewRequestReceived } from '@/lib/review-requests';
import { getOperator, unauthorized } from '@/lib/admin/auth';

const BodySchema = z.object({
  enrollment_id: z.string().uuid(),
  platform: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  // The session first, before any work: an API answers 401, never a redirect.
  const adminUser = await getOperator();
  if (!adminUser) return unauthorized();

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
