import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureActiveLeadBookingSession } from '@/lib/lead-sessions';

const BodySchema = z.object({
  current_session_id: z.string().uuid().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid session payload' }, { status: 400 });
    }

    const sessionId = await ensureActiveLeadBookingSession(id, parsed.data.current_session_id);

    return NextResponse.json({ session_id: sessionId }, { status: 200 });
  } catch (error) {
    console.error('[lead-session] Failed to ensure active session:', error);
    return NextResponse.json({ error: 'Failed to ensure lead session' }, { status: 500 });
  }
}
