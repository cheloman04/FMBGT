import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { createLeadBookingSession } from '@/lib/lead-sessions';
import type { TrailType } from '@/types/booking';
import { getAdminUserFromCookieStore } from '@/lib/admin-auth';

// ── POST /api/leads — create a new lead ──────────────────────────────────────

const AttributionPayloadSchema = z.object({
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  flow: z.string().max(100).optional(),
  sequence_key: z.string().max(100).optional(),
  template_key: z.string().max(200).optional(),
  step_key: z.string().max(100).optional(),
  enrollment_id: z.string().uuid().optional(),
  trail_type: z.enum(['paved', 'mtb']).optional(),
  cta: z.string().max(100).optional(),
  captured_at: z.string().datetime().optional(),
});

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
  attribution_first_touch: AttributionPayloadSchema.optional(),
  attribution_last_touch: AttributionPayloadSchema.optional(),
});

type ExistingLeadRecord = {
  id: string;
  status: string;
  booking_id: string | null;
  converted_at: string | null;
  selected_trail_type: TrailType | null;
  last_step_completed: string | null;
  phone: string | null;
  zip_code: string | null;
  heard_about_us: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  first_touch_attribution: Record<string, unknown> | null;
  last_touch_attribution: Record<string, unknown> | null;
};

async function resolveOpenLeadByEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  email: string,
  trailType?: TrailType
): Promise<ExistingLeadRecord | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('leads')
    .select(`
      id, status, booking_id, converted_at, selected_trail_type, last_step_completed,
      phone, zip_code,
      heard_about_us, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      first_touch_attribution, last_touch_attribution
    `)
    .eq('email', email)
    .in('status', ['lead', 'lost'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data?.length) return null;

  const unresolved = (data as ExistingLeadRecord[]).filter(
    (lead) => !lead.booking_id && !lead.converted_at && lead.status !== 'converted'
  );

  if (!unresolved.length) return null;

  return unresolved.find((lead) => lead.selected_trail_type === trailType) ?? unresolved[0];
}

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
    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const firstTouch =
      parsed.data.attribution_first_touch ??
      parsed.data.attribution_last_touch ??
      null;
    const lastTouch = parsed.data.attribution_last_touch ?? firstTouch ?? null;
    const existingLead = await resolveOpenLeadByEmail(
      supabase,
      normalizedEmail,
      parsed.data.selected_trail_type
    );

    if (existingLead) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedLead, error: updateError } = await (supabase as any)
        .from('leads')
        .update({
          full_name: parsed.data.full_name,
          phone: parsed.data.phone ?? existingLead.phone ?? null,
          zip_code: parsed.data.zip_code ?? existingLead.zip_code ?? null,
          heard_about_us: existingLead.heard_about_us ?? parsed.data.heard_about_us ?? null,
          selected_trail_type: parsed.data.selected_trail_type ?? existingLead.selected_trail_type ?? null,
          utm_source: existingLead.utm_source ?? parsed.data.utm_source ?? null,
          utm_medium: existingLead.utm_medium ?? parsed.data.utm_medium ?? null,
          utm_campaign: existingLead.utm_campaign ?? parsed.data.utm_campaign ?? null,
          utm_content: existingLead.utm_content ?? parsed.data.utm_content ?? null,
          utm_term: existingLead.utm_term ?? parsed.data.utm_term ?? null,
          first_touch_attribution: existingLead.first_touch_attribution ?? firstTouch,
          last_touch_attribution: lastTouch ?? existingLead.last_touch_attribution,
          ...(lastTouch ? { attribution_updated_at: now } : {}),
          last_activity_at: now,
          source: 'booking_platform',
          status: existingLead.status === 'lost' ? 'lead' : existingLead.status,
          updated_at: now,
        })
        .eq('id', existingLead.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('[leads] Failed to update existing lead:', updateError.message);
        return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
      }

      const sessionId = await createLeadBookingSession(updatedLead.id);
      console.log(`[leads] Reused lead ${updatedLead.id} for ${normalizedEmail}`);
      return NextResponse.json({ id: updatedLead.id, session_id: sessionId }, { status: 200 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('leads')
      .insert({
        full_name: parsed.data.full_name,
        email: normalizedEmail,
        phone: parsed.data.phone ?? null,
        zip_code: parsed.data.zip_code ?? null,
        heard_about_us: parsed.data.heard_about_us ?? null,
        selected_trail_type: parsed.data.selected_trail_type ?? null,
        utm_source: parsed.data.utm_source ?? null,
        utm_medium: parsed.data.utm_medium ?? null,
        utm_campaign: parsed.data.utm_campaign ?? null,
        utm_content: parsed.data.utm_content ?? null,
        utm_term: parsed.data.utm_term ?? null,
        first_touch_attribution: firstTouch,
        last_touch_attribution: lastTouch,
        attribution_updated_at: lastTouch ? now : null,
        last_step_completed: 'lead_captured',
        last_activity_at: now,
        source: 'booking_platform',
        status: 'lead',
      })
    .select(`
        id,
        full_name,
        email,
        phone,
        selected_trail_type,
        selected_skill_level,
        selected_location_name,
        selected_date,
        last_step_completed,
        created_at
      `)
      .single();

    if (error) {
      console.error('[leads] Failed to create lead:', error.message);
      return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
    }

    const sessionId = await createLeadBookingSession(data.id);

    console.log(`[leads] Created lead ${data.id} for ${normalizedEmail}`);
    return NextResponse.json({ id: data.id, session_id: sessionId }, { status: 201 });
  } catch (err) {
    console.error('[leads] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/leads — list leads for admin ────────────────────────────────────

export async function GET(req: NextRequest) {
  // Admin auth check
  const cookieStore = await cookies();
  const adminUser = await getAdminUserFromCookieStore(cookieStore);
  if (!adminUser) {
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
      selected_trail_type, selected_skill_level, selected_location_name,
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
