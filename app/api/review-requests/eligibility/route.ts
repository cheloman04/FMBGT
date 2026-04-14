import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateReviewRequestEligibility } from '@/lib/review-requests';

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  enrollment_id: z.string().uuid().optional(),
});

function isAuthorized(req: NextRequest): boolean {
  const secret =
    process.env.N8N_REVIEW_REQUEST_SECRET || process.env.N8N_FOLLOWUP_SECRET;
  if (!secret) return false;
  return req.headers.get('x-followup-secret') === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid review request eligibility payload' }, { status: 400 });
  }

  const result = await evaluateReviewRequestEligibility(
    parsed.data.booking_id,
    parsed.data.enrollment_id
  );

  return NextResponse.json(result);
}
