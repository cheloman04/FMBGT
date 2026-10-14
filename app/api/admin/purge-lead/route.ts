import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getOperator, unauthorized } from '@/lib/admin/auth';
import { recordFinancialEvent } from '@/lib/financial-log';

const Schema = z.object({ lead_id: z.string().uuid() });

// Deletes an archived lead for good. The database cascades its follow-up
// (enrollments and their emails) and its booking-flow sessions; its bookings
// and the Financial log keep their rows, unlinked from it.
export async function POST(req: NextRequest) {
  // The session first, before any work: an API answers 401, never a redirect.
  const adminUser = await getOperator();
  if (!adminUser) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { lead_id } = parsed.data;
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead, error: lookupError } = await (supabase as any)
    .from('leads')
    .select('id, deleted_at')
    .eq('id', lead_id)
    .maybeSingle();

  if (lookupError) {
    console.error('[admin] purge-lead lookup error:', lookupError);
    return NextResponse.json({ error: 'The lead could not be read. Try again.' }, { status: 500 });
  }
  if (!lead) return NextResponse.json({ error: 'This lead was already deleted. Reload the page.' }, { status: 404 });
  // Only what is already in the Trash.
  if (!lead.deleted_at) {
    return NextResponse.json({ error: 'This lead isn’t in the Trash any more. Reload the page.' }, { status: 409 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('leads').delete().eq('id', lead_id).not('deleted_at', 'is', null);
  if (error) {
    console.error('[admin] purge-lead error:', error);
    return NextResponse.json({ error: 'The lead could not be deleted. Try again.' }, { status: 500 });
  }

  await recordFinancialEvent({
    event_name: 'admin.lead_purged',
    event_category: 'ops',
    severity: 'warning',
    entity_type: 'lead',
    entity_id: lead_id,
    // Not lead_id: it is a foreign key, and the lead is gone (the insert would
    // fail). entity_id keeps the id.
    lead_id: null,
    status: 'deleted',
    message: 'Admin permanently deleted archived lead',
    metadata: { admin_email: adminUser.email ?? null },
  });

  console.log(`[admin] purge-lead lead_id=${lead_id} by ${adminUser.email}`);
  return NextResponse.json({ ok: true, lead_id });
}
