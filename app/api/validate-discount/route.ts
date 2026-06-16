import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveFamDiscount } from '@/lib/discounts';
import { GIFT_CARD_LABEL } from '@/lib/gift-cards';

// Validates a code entered at checkout. Resolves, in order:
//   1. Friends & Family (FAM-FMBGT, no DB)
//   2. Partner referral codes (referral_partners) — percentage discount
//   3. Gift cards (gift_cards) — fixed dollar amount
// Read-only: a gift card is NOT reserved here, only at create-checkout.
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'No code provided.' }, { status: 400 });
    }

    const upper = code.trim().toUpperCase();

    // 1. Friends & Family code (no DB hit)
    const fam = resolveFamDiscount(upper);
    if (fam) {
      return NextResponse.json({
        valid: true,
        type: 'discount',
        code: fam.code,
        label: fam.label,
        percentage: fam.percentage,
        partner_id: null,
      });
    }

    const supabase = getSupabaseAdmin();

    // 2. Partner referral code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: partner, error: partnerErr } = await (supabase as any)
      .from('referral_partners')
      .select('id, partner_name, discount_code, discount_percentage, active')
      .eq('discount_code', upper)
      .maybeSingle();

    if (partnerErr) throw partnerErr;

    if (partner) {
      if (!partner.active) {
        return NextResponse.json({ valid: false, error: 'This discount code is no longer active.' });
      }
      return NextResponse.json({
        valid: true,
        type: 'discount',
        code: partner.discount_code,
        label: `${partner.partner_name} Partner Discount`,
        percentage: partner.discount_percentage,
        partner_id: partner.id,
      });
    }

    // 3. Gift card (fixed amount, single-use)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: card, error: cardErr } = await (supabase as any)
      .from('gift_cards')
      .select('id, code, amount_cents, status')
      .eq('code', upper)
      .maybeSingle();

    if (cardErr) throw cardErr;

    if (card) {
      if (card.status === 'active') {
        return NextResponse.json({
          valid: true,
          type: 'gift_card',
          code: card.code,
          label: GIFT_CARD_LABEL,
          amount_cents: card.amount_cents,
          gift_card_id: card.id,
        });
      }
      const reason =
        card.status === 'redeemed'
          ? 'This gift card has already been used.'
          : card.status === 'reserved'
            ? 'This gift card is being used in another checkout right now.'
            : 'This gift card is no longer valid.';
      return NextResponse.json({ valid: false, error: reason });
    }

    return NextResponse.json({ valid: false, error: 'Invalid code.' });
  } catch (err) {
    console.error('[validate-discount]', err);
    return NextResponse.json({ valid: false, error: 'Could not validate code.' }, { status: 500 });
  }
}
