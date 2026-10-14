import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getOperator, unauthorized } from '@/lib/admin/auth';

const Schema = z.object({ lead_id: z.string().uuid() });

// Takes an archived lead out of the Trash, as it was. Nothing is sent.
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
  const { data, error } = await (supabase as any)
    .from('leads')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', lead_id)
    .not('deleted_at', 'is', null)
    .select('id');

  if (error) {
    console.error('[admin] restore-lead error:', error);
    return NextResponse.json({ error: 'The lead could not be restored. Try again.' }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: 'This lead isn’t in the Trash any more. Reload the page.' }, { status: 404 });
  }

  console.log(`[admin] restore-lead lead_id=${lead_id} by ${adminUser.email}`);
  return NextResponse.json({ ok: true, lead_id });
}
