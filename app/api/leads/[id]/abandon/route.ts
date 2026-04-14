import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmLeadSessionAbandoned } from '@/lib/lead-sessions';

const BodySchema = z.object({
  session_id: z.string().uuid(),
  reason: z.enum(['page_exit', 'inactivity_timeout']).default('page_exit'),
});

function parseBeaconBody(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    const contentType = req.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await req.json().catch(() => ({}))
      : parseBeaconBody(await req.text());

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid abandonment payload' }, { status: 400 });
    }

    const abandoned = await confirmLeadSessionAbandoned({
      leadId: id,
      sessionId: parsed.data.session_id,
      reason: parsed.data.reason,
      allowedStatuses: ['active'],
    });

    return NextResponse.json({ ok: true, abandoned_confirmed: abandoned }, { status: 200 });
  } catch (error) {
    console.error('[lead-session] Failed to confirm abandonment:', error);
    return NextResponse.json({ ok: true, abandoned_confirmed: false }, { status: 200 });
  }
}
