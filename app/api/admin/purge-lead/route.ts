import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';
import { recordFinancialEvent } from '@/lib/financial-log';

const Schema = z.object({ lead_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const adminUser = await getAdminUserFromCookieStore(cookieStore);
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { lead_id } = parsed.data;
  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead } = await (supabase as any)
    .from('leads')
    .select('id, deleted_at, full_name')
    .eq('id', lead_id)
    .single();

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!lead.deleted_at) return NextResponse.json({ error: 'Lead is not in trash' }, { status: 409 });

  // Delete lead — bookings were already soft-deleted (archived) so they stay in booking trash
  const { error } = await supabase.from('leads').delete().eq('id', lead_id);
  if (error) {
    console.error('[admin] purge-lead error:', error);
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }

  await recordFinancialEvent({
    event_name: 'admin.lead_purged',
    event_category: 'ops',
    severity: 'warning',
    entity_type: 'lead',
    entity_id: lead_id,
    lead_id,
    status: 'deleted',
    message: 'Admin permanently deleted archived lead',
    metadata: { admin_email: adminUser.email ?? null },
  });

  console.log(`[admin] purge-lead lead_id=${lead_id} by ${adminUser.email}`);
  return NextResponse.json({ ok: true, lead_id });
}
