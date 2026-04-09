import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

// ── POST /api/leads — create a new lead ──────────────────────────────────────

const CreateLeadSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  zip_code: z.string().max(10).optional(),
  heard_about_us: z.string().max(50).optional(),
  selected_trail_type: z.enum(['paved', 'mtb']).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid lead data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('leads')
      .insert({
        full_name: parsed.data.full_name,
        email: parsed.data.email.toLowerCase().trim(),
        phone: parsed.data.phone ?? null,
        zip_code: parsed.data.zip_code ?? null,
        heard_about_us: parsed.data.heard_about_us ?? null,
        selected_trail_type: parsed.data.selected_trail_type ?? null,
        utm_source: parsed.data.utm_source ?? null,
        utm_medium: parsed.data.utm_medium ?? null,
        utm_campaign: parsed.data.utm_campaign ?? null,
        utm_content: parsed.data.utm_content ?? null,
        utm_term: parsed.data.utm_term ?? null,
        last_step_completed: 'lead_captured',
        last_activity_at: now,
        source: 'booking_platform',
        status: 'lead',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[leads] Failed to create lead:', error.message);
      return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
    }

    console.log(`[leads] Created lead ${data.id} for ${parsed.data.email}`);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error('[leads] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/leads — list leads for admin ────────────────────────────────────

export async function GET(req: NextRequest) {
  // Admin auth check
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || session !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'lead';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200);

  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('leads')
    .select(`
      id, full_name, email, phone, zip_code, heard_about_us,
      selected_trail_type, selected_location_name,
      utm_source, utm_medium, utm_campaign,
      last_step_completed, last_activity_at, status,
      created_at, booking_id
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[leads] Failed to fetch leads:', error.message);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }

  return NextResponse.json({ leads: data ?? [] });
}
