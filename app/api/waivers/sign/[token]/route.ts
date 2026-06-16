import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';
import { WAIVER_VERSION } from '@/lib/waiver-text';

// Public endpoint: a customer signs the waiver for a manual booking via its
// unguessable link token. Records are linked to the booking immediately and the
// booking's waiver_accepted flag is flipped. Mirrors /api/waivers/store, but
// keyed by token + linked up front (the booking already exists).

interface SignerPayload {
  signer_name: string;
  signer_email?: string;
  role: 'participant' | 'guardian';
  participants_covered: string[];
  guardian_relationship?: string;
  signature_data_url: string; // data:image/png;base64,...
  pdf_data_url: string;       // data:application/pdf;base64,...
  agreed_at: string;
}

function stripDataUri(dataUri: string): string {
  const idx = dataUri.indexOf(',');
  return idx >= 0 ? dataUri.slice(idx + 1) : dataUri;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Resolve the booking from the (unguessable) waiver link token.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking, error: bookingErr } = await (supabase as any)
      .from('bookings')
      .select('id, status, waiver_session_id, waiver_accepted, trail_type, date, customers(email), locations(name)')
      .eq('waiver_link_token', token)
      .is('deleted_at', null)
      .maybeSingle();

    if (bookingErr) throw bookingErr;
    if (!booking) return NextResponse.json({ error: 'Waiver link not found' }, { status: 404 });
    if (booking.status === 'cancelled' || booking.status === 'refunded') {
      return NextResponse.json({ error: 'This booking is no longer active.' }, { status: 409 });
    }
    if (booking.waiver_accepted) {
      return NextResponse.json({ error: 'This waiver has already been signed.' }, { status: 409 });
    }

    const body = await req.json();
    const signers: SignerPayload[] = body?.signers;
    if (!Array.isArray(signers) || signers.length === 0) {
      return NextResponse.json({ error: 'No signers provided' }, { status: 400 });
    }
    for (const s of signers) {
      if (!s.signer_name?.trim()) {
        return NextResponse.json({ error: 'Each signer must have a name' }, { status: 400 });
      }
      if (!s.signature_data_url?.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Invalid signature data' }, { status: 400 });
      }
      if (!Array.isArray(s.participants_covered) || s.participants_covered.length === 0) {
        return NextResponse.json({ error: 'Each signer must cover at least one participant' }, { status: 400 });
      }
    }

    const sessionId: string = booking.waiver_session_id ?? randomUUID();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';
    const userAgent = req.headers.get('user-agent') ?? 'unknown';
    const locationName = (booking.locations as { name?: string } | null)?.name ?? null;

    const insertRows: Record<string, unknown>[] = [];
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      let signatureUrl: string | null = null;
      let pdfUrl: string | null = null;

      const signatureBuffer = Buffer.from(stripDataUri(signer.signature_data_url), 'base64');
      const sigPath = `waivers/${sessionId}/signer-${i}/signature.png`;
      const { data: sigUpload, error: sigErr } = await supabase.storage
        .from('waivers')
        .upload(sigPath, signatureBuffer, { contentType: 'image/png', upsert: true });
      if (sigErr) {
        console.error(`[waivers/sign] signature upload failed for signer ${i}:`, sigErr);
      } else if (sigUpload) {
        signatureUrl = supabase.storage.from('waivers').getPublicUrl(sigPath).data?.publicUrl ?? null;
      }

      if (signer.pdf_data_url?.startsWith('data:application/pdf')) {
        const pdfBuffer = Buffer.from(stripDataUri(signer.pdf_data_url), 'base64');
        const pdfPath = `waivers/${sessionId}/signer-${i}/waiver.pdf`;
        const { data: pdfUpload, error: pdfErr } = await supabase.storage
          .from('waivers')
          .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
        if (pdfErr) {
          console.error(`[waivers/sign] pdf upload failed for signer ${i}:`, pdfErr);
        } else if (pdfUpload) {
          pdfUrl = supabase.storage.from('waivers').getPublicUrl(pdfPath).data?.publicUrl ?? null;
        }
      }

      insertRows.push({
        session_id: sessionId,
        booking_id: booking.id, // linked immediately — the booking already exists
        signer_name: signer.signer_name.trim(),
        signer_email: signer.signer_email ?? null,
        signer_role: signer.role,
        guardian_relationship: signer.guardian_relationship ?? null,
        participants_covered: signer.participants_covered,
        agreed_at: signer.agreed_at,
        ip_address: ip,
        user_agent: userAgent,
        waiver_version: WAIVER_VERSION,
        tour_type: booking.trail_type ?? null,
        location_name: locationName,
        tour_date: booking.date ?? null,
        signature_url: signatureUrl,
        pdf_url: pdfUrl,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any).from('waiver_records').insert(insertRows);
    if (insertError) {
      console.error('[waivers/sign] DB insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to store waiver records' }, { status: 500 });
    }

    const agreedTimes = signers.map((s) => s.agreed_at).filter(Boolean).sort();
    const acceptedAt = agreedTimes.length ? agreedTimes[agreedTimes.length - 1] : new Date().toISOString();

    await supabase
      .from('bookings')
      .update({ waiver_accepted: true, waiver_accepted_at: acceptedAt })
      .eq('id', booking.id);

    await sendSenzaiEvent({
      event_name: 'waiver.signed',
      occurred_at: acceptedAt,
      source_event_id: sessionId,
      idempotency_key: `waiver_session:${sessionId}:signed`,
      source_route: '/api/waivers/sign',
      authoritative_source: 'supabase.waiver_records.insert',
      entity_type: 'waiver_session',
      entity_id: sessionId,
      refs: { waiver_session_id: sessionId, booking_id: booking.id },
      data: {
        waiver_session_id: sessionId,
        booking_id: booking.id,
        waiver_version: WAIVER_VERSION,
        signer_count: signers.length,
        signer_roles: signers.map((s) => s.role),
        participant_names: signers.flatMap((s) => s.participants_covered),
        manual_booking: true,
        tour_type: booking.trail_type ?? null,
        location_name: locationName,
        tour_date: booking.date ?? null,
      },
    });

    console.log(`[waivers/sign] booking ${booking.id}: ${signers.length} waiver(s) signed`);
    return NextResponse.json({ ok: true, waiver_session_id: sessionId });
  } catch (err) {
    console.error('[waivers/sign] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
