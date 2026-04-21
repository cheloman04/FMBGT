import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSenzaiEvent } from '@/lib/senzai-ingest';
import { WAIVER_VERSION } from '@/lib/waiver-text';
import { randomUUID } from 'crypto';

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

interface RequestBody {
  signers: SignerPayload[];
  context: {
    tour_type?: string;
    location_name?: string;
    tour_date?: string;
    customer_email?: string;
  };
}

// Strip data URI prefix and return raw base64
function stripDataUri(dataUri: string): string {
  const idx = dataUri.indexOf(',');
  return idx >= 0 ? dataUri.slice(idx + 1) : dataUri;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { signers, context } = body;

    if (!Array.isArray(signers) || signers.length === 0) {
      return NextResponse.json({ error: 'No signers provided' }, { status: 400 });
    }

    // Validate each signer has a name and signature
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

    const supabase = getSupabaseAdmin();
    const sessionId = randomUUID();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';
    const userAgent = req.headers.get('user-agent') ?? 'unknown';

    // Upload signatures + PDFs to Supabase Storage, insert waiver_records
    const insertRows = [];

    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      let signatureUrl: string | null = null;
      let pdfUrl: string | null = null;

      const signatureBase64 = stripDataUri(signer.signature_data_url);
      const signatureBuffer = Buffer.from(signatureBase64, 'base64');
      const sigPath = `waivers/${sessionId}/signer-${i}/signature.png`;

      const { data: sigUpload, error: sigErr } = await supabase.storage
        .from('waivers')
        .upload(sigPath, signatureBuffer, {
          contentType: 'image/png',
          upsert: false,
        });

      if (sigErr) {
        console.error(`[waivers/store] Signature upload failed for signer ${i}:`, sigErr);
        // Don't abort — store record without URL
      } else if (sigUpload) {
        const { data: sigUrlData } = supabase.storage.from('waivers').getPublicUrl(sigPath);
        signatureUrl = sigUrlData?.publicUrl ?? null;
      }

      // PDF upload
      if (signer.pdf_data_url?.startsWith('data:application/pdf')) {
        const pdfBase64 = stripDataUri(signer.pdf_data_url);
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const pdfPath = `waivers/${sessionId}/signer-${i}/waiver.pdf`;

        const { data: pdfUpload, error: pdfErr } = await supabase.storage
          .from('waivers')
          .upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (pdfErr) {
          console.error(`[waivers/store] PDF upload failed for signer ${i}:`, pdfErr);
        } else if (pdfUpload) {
          const { data: pdfUrlData } = supabase.storage.from('waivers').getPublicUrl(pdfPath);
          pdfUrl = pdfUrlData?.publicUrl ?? null;
        }
      }

      insertRows.push({
        session_id: sessionId,
        booking_id: null,
        signer_name: signer.signer_name.trim(),
        signer_email: signer.signer_email ?? null,
        signer_role: signer.role,
        guardian_relationship: signer.guardian_relationship ?? null,
        participants_covered: signer.participants_covered,
        agreed_at: signer.agreed_at,
        ip_address: ip,
        user_agent: userAgent,
        waiver_version: WAIVER_VERSION,
        tour_type: context.tour_type ?? null,
        location_name: context.location_name ?? null,
        tour_date: context.tour_date ?? null,
        signature_url: signatureUrl,
        pdf_url: pdfUrl,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from('waiver_records')
      .insert(insertRows);

    if (insertError) {
      console.error('[waivers/store] DB insert failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to store waiver records' },
        { status: 500 }
      );
    }

    console.log(`[waivers/store] Session ${sessionId}: ${signers.length} waiver(s) stored`);

    const occurredAt = signers.reduce((latest, signer) => {
      const agreedAt = signer.agreed_at || latest;
      return agreedAt > latest ? agreedAt : latest;
    }, new Date().toISOString());

    await sendSenzaiEvent({
      event_name: 'waiver.signed',
      occurred_at: occurredAt,
      source_event_id: sessionId,
      idempotency_key: `waiver_session:${sessionId}:signed`,
      source_route: '/api/waivers/store',
      authoritative_source: 'supabase.waiver_records.insert',
      entity_type: 'waiver_session',
      entity_id: sessionId,
      refs: {
        waiver_session_id: sessionId,
      },
      data: {
        waiver_session_id: sessionId,
        waiver_version: WAIVER_VERSION,
        signer_count: signers.length,
        signer_roles: signers.map((signer) => signer.role),
        participant_names: signers.flatMap((signer) => signer.participants_covered),
        customer_email: context.customer_email ?? null,
        tour_type: context.tour_type ?? null,
        location_name: context.location_name ?? null,
        tour_date: context.tour_date ?? null,
      },
    });

    return NextResponse.json({ waiver_session_id: sessionId });
  } catch (err) {
    console.error('[waivers/store] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
