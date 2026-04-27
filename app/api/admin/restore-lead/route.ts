import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';

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
  const { error } = await (supabase as any)
    .from('leads')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', lead_id)
    .not('deleted_at', 'is', null);

  if (error) {
    console.error('[admin] restore-lead error:', error);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }

  console.log(`[admin] restore-lead lead_id=${lead_id} by ${adminUser.email}`);
  return NextResponse.json({ ok: true, lead_id });
}
