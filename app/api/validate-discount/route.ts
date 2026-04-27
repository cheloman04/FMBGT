import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveFamDiscount, FAM_CODE } from '@/lib/discounts';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'No code provided.' }, { status: 400 });
    }

    const upper = code.trim().toUpperCase();

    // Check Friends & Family code first (no DB hit)
    const fam = resolveFamDiscount(upper);
    if (fam) {
      return NextResponse.json({
        valid: true,
        code: fam.code,
        label: fam.label,
        percentage: fam.percentage,
        partner_id: null,
      });
    }

    // Look up in referral_partners table
    const supabase = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('referral_partners')
      .select('id, partner_name, discount_code, discount_percentage, active')
      .eq('discount_code', upper)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ valid: false, error: 'Invalid discount code.' });
    }

    if (!data.active) {
      return NextResponse.json({ valid: false, error: 'This discount code is no longer active.' });
    }

    return NextResponse.json({
      valid: true,
      code: data.discount_code,
      label: `${data.partner_name} Partner Discount`,
      percentage: data.discount_percentage,
      partner_id: data.id,
    });
  } catch (err) {
    console.error('[validate-discount]', err);
    return NextResponse.json({ valid: false, error: 'Could not validate code.' }, { status: 500 });
  }
}
