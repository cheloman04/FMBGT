import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdminUser } from '@/lib/admin-auth';
import { suggestPartnerCode, FAM_CODE } from '@/lib/discounts';

const CreateSchema = z.object({
  partner_name: z.string().min(2).max(100),
  discount_code: z.string().min(3).max(30).regex(/^[A-Z0-9\-]+$/, 'Code must be uppercase letters, numbers, and hyphens only'),
  discount_percentage: z.number().min(1).max(100),
  notes: z.string().max(500).optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean().optional(),
  discount_percentage: z.number().min(1).max(100).optional(),
  notes: z.string().max(500).optional(),
});

// GET — list all referral partners
export async function GET() {
  try {
    await requireAdminUser();
    const supabase = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('referral_partners')
      .select('id, partner_name, discount_code, discount_percentage, active, uses_count, notes, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ partners: data ?? [] });
  } catch (err) {
    console.error('[referral-partners GET]', err);
    return NextResponse.json({ error: 'Failed to fetch referral partners' }, { status: 500 });
  }
}

// POST — create a new referral partner
export async function POST(req: NextRequest) {
  try {
    await requireAdminUser();
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const { partner_name, discount_code, discount_percentage, notes } = parsed.data;
    const upperCode = discount_code.toUpperCase();

    // FAM-FMBGT is reserved
    if (upperCode === FAM_CODE) {
      return NextResponse.json({ error: 'That code is reserved.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check uniqueness
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('referral_partners')
      .select('id')
      .eq('discount_code', upperCode)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Discount code already exists.' }, { status: 409 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('referral_partners')
      .insert({
        partner_name: partner_name.trim(),
        discount_code: upperCode,
        discount_percentage,
        notes: notes?.trim() ?? null,
        active: true,
      })
      .select('id, partner_name, discount_code, discount_percentage, active, uses_count, notes, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ partner: data }, { status: 201 });
  } catch (err) {
    console.error('[referral-partners POST]', err);
    return NextResponse.json({ error: 'Failed to create referral partner' }, { status: 500 });
  }
}

// PATCH — update active status, percentage, or notes
export async function PATCH(req: NextRequest) {
  try {
    await requireAdminUser();
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const { id, ...updates } = parsed.data;
    const supabase = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('referral_partners')
      .update(updates)
      .eq('id', id)
      .select('id, partner_name, discount_code, discount_percentage, active, uses_count, notes, created_at')
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    return NextResponse.json({ partner: data });
  } catch (err) {
    console.error('[referral-partners PATCH]', err);
    return NextResponse.json({ error: 'Failed to update referral partner' }, { status: 500 });
  }
}

// Utility export used by other server code
export { suggestPartnerCode };
