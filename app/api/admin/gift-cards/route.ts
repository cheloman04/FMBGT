import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdminUser } from '@/lib/admin-auth';

const GIFT_CARD_COLUMNS =
  'id, code, amount_cents, status, recipient_name, recipient_email, purchaser_name, notes, ' +
  'reserved_booking_id, redeemed_booking_id, redeemed_amount_cents, redeemed_at, created_by, created_at';

const CreateSchema = z.object({
  amount_cents: z.number().int().positive().max(100_000_00), // sanity cap: $100,000
  recipient_name: z.string().max(120).optional(),
  recipient_email: z.string().max(200).optional(),
  purchaser_name: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  code: z.string().min(4).max(40).regex(/^[A-Z0-9-]+$/, 'Code must be uppercase letters, numbers, and hyphens only').optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.literal('void').optional(),
  notes: z.string().max(500).optional(),
});

const DeleteSchema = z.object({ id: z.string().uuid() });

// Unambiguous alphabet (no 0/O, 1/I/L) — gift codes are bearer instruments.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomBlock(n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}
function generateGiftCardCode(): string {
  return `GIFT-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}`;
}

// GET — list all gift cards (newest first)
export async function GET() {
  try {
    await requireAdminUser();
    const supabase = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('gift_cards')
      .select(GIFT_CARD_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ gift_cards: data ?? [] });
  } catch (err) {
    console.error('[gift-cards GET]', err);
    return NextResponse.json({ error: 'Failed to fetch gift cards' }, { status: 500 });
  }
}

// POST — mint a new gift card
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const { amount_cents, recipient_name, recipient_email, purchaser_name, notes, code } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Resolve the code: explicit (must be unique) or auto-generated (retry on collision).
    let finalCode: string | null = null;
    if (code) {
      const upper = code.toUpperCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('gift_cards')
        .select('id')
        .eq('code', upper)
        .maybeSingle();
      if (existing) return NextResponse.json({ error: 'That gift card code already exists.' }, { status: 409 });
      finalCode = upper;
    } else {
      for (let attempt = 0; attempt < 5 && !finalCode; attempt++) {
        const candidate = generateGiftCardCode();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: clash } = await (supabase as any)
          .from('gift_cards')
          .select('id')
          .eq('code', candidate)
          .maybeSingle();
        if (!clash) finalCode = candidate;
      }
      if (!finalCode) {
        return NextResponse.json({ error: 'Could not generate a unique code. Try again.' }, { status: 500 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('gift_cards')
      .insert({
        code: finalCode,
        amount_cents,
        recipient_name: recipient_name?.trim() || null,
        recipient_email: recipient_email?.trim() || null,
        purchaser_name: purchaser_name?.trim() || null,
        notes: notes?.trim() || null,
        created_by: admin.email ?? null,
        status: 'active',
      })
      .select(GIFT_CARD_COLUMNS)
      .single();

    if (error) {
      // Unique violation race
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'That gift card code already exists.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ gift_card: data }, { status: 201 });
  } catch (err) {
    console.error('[gift-cards POST]', err);
    return NextResponse.json({ error: 'Failed to mint gift card' }, { status: 500 });
  }
}

// PATCH — void an active card, or edit notes
export async function PATCH(req: NextRequest) {
  try {
    await requireAdminUser();
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const { id, status, notes } = parsed.data;
    const supabase = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchErr } = await (supabase as any)
      .from('gift_cards')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });

    // Only an active card may be voided (a reserved card is mid-checkout; a
    // redeemed card is already spent).
    if (status === 'void' && existing.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot void a ${existing.status} gift card. Only active cards can be voided.` },
        { status: 409 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes.trim() || null;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('gift_cards')
      .update(updates)
      .eq('id', id)
      .select(GIFT_CARD_COLUMNS)
      .single();

    if (error) throw error;
    return NextResponse.json({ gift_card: data });
  } catch (err) {
    console.error('[gift-cards PATCH]', err);
    return NextResponse.json({ error: 'Failed to update gift card' }, { status: 500 });
  }
}

// DELETE — permanently remove a VOID gift card (hygiene). Redeemed cards are
// kept as history; active/reserved cards must be voided first.
export async function DELETE(req: NextRequest) {
  try {
    await requireAdminUser();
    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchErr } = await (supabase as any)
      .from('gift_cards')
      .select('id, status')
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
    if (existing.status !== 'void') {
      return NextResponse.json(
        { error: 'Only void gift cards can be deleted. Void it first.' },
        { status: 409 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('gift_cards')
      .delete()
      .eq('id', parsed.data.id);
    if (error) throw error;
    return NextResponse.json({ success: true, id: parsed.data.id });
  } catch (err) {
    console.error('[gift-cards DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete gift card' }, { status: 500 });
  }
}
