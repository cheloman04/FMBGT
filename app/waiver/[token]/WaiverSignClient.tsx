'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SignatureCanvas } from '@/components/waiver/SignatureCanvas';
import { WAIVER_TEXT } from '@/lib/waiver-text';
import { generateWaiverPdf } from '@/lib/waiver-pdf';
import { formatFloridaTime } from '@/lib/display-time';

const LOGO_URL =
  'https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'review' | 'signing' | 'uploading' | 'done';

interface WaiverParticipant {
  name: string;
  is_minor: boolean;
  guardian_name?: string;
  guardian_relationship?: string;
}

interface SignerDef {
  signer_name: string;
  role: 'participant' | 'guardian';
  participants_covered: string[];
  guardian_relationship?: string;
}

interface CompletedSigner extends SignerDef {
  signer_email?: string;
  signature_data_url: string;
  pdf_data_url: string;
  agreed_at: string;
}

interface Props {
  token: string;
  alreadySigned: boolean;
  cancelled: boolean;
  customerEmail?: string;
  participantNames: string[];
  context: {
    trailType?: string;
    locationName?: string;
    tourDate?: string;
    timeSlot?: string;
    bookingRef?: string;
  };
}

// ─── Signer derivation (adults sign for themselves; one signer per guardian) ────

function buildSigners(participants: WaiverParticipant[]): SignerDef[] {
  const signers: SignerDef[] = [];

  participants.forEach((p) => {
    if (!p.is_minor) {
      signers.push({ signer_name: p.name, role: 'participant', participants_covered: [p.name] });
    }
  });

  const guardianMap = new Map<string, { relationship: string; minors: string[]; display: string }>();
  participants.forEach((p) => {
    if (p.is_minor && p.guardian_name) {
      const key = p.guardian_name.trim().toLowerCase();
      const existing = guardianMap.get(key);
      if (existing) {
        existing.minors.push(p.name);
      } else {
        guardianMap.set(key, {
          relationship: p.guardian_relationship ?? 'parent',
          minors: [p.name],
          display: p.guardian_name.trim(),
        });
      }
    }
  });

  guardianMap.forEach((data) => {
    signers.push({
      signer_name: data.display,
      role: 'guardian',
      participants_covered: data.minors,
      guardian_relationship: data.relationship,
    });
  });

  return signers;
}

// ─── Page shell ─────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src={LOGO_URL}
            alt="Florida Mountain Bike Guided Tours"
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl object-contain shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
          />
          <p className="mt-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Florida Mountain Bike Guided Tours
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-[0_18px_40px_rgba(23,26,20,0.08)] sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}

function TourSummary({ context }: { context: Props['context'] }) {
  const trail =
    context.trailType === 'mtb'
      ? 'Mountain Bike Tour'
      : context.trailType === 'paved'
      ? 'Scenic Paved Trail Tour'
      : null;
  return (
    <div className="mb-5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {trail && <SummaryRow label="Tour" value={trail} />}
        {context.locationName && <SummaryRow label="Location" value={context.locationName} />}
        {context.tourDate && <SummaryRow label="Date" value={context.tourDate} />}
        {context.timeSlot && <SummaryRow label="Time" value={context.timeSlot} />}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-foreground">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function WaiverSignClient({
  token,
  alreadySigned,
  cancelled,
  customerEmail,
  participantNames,
  context,
}: Props) {
  const [phase, setPhase] = useState<Phase>('setup');

  const [participants, setParticipants] = useState<WaiverParticipant[]>(
    participantNames.map((name) => ({ name, is_minor: false }))
  );

  const [signerDefs, setSignerDefs] = useState<SignerDef[]>([]);
  const [currentSignerIdx, setCurrentSignerIdx] = useState(0);
  const [completedSigners, setCompletedSigners] = useState<CompletedSigner[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [confirmedSig, setConfirmedSig] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const updateParticipant = (idx: number, patch: Partial<WaiverParticipant>) => {
    setParticipants((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const setupIsValid = participants.every((p) => (p.is_minor ? !!p.guardian_name?.trim() : true));

  const handleSetupContinue = () => {
    setSignerDefs(buildSigners(participants));
    setPhase('review');
  };

  const handleStartSigning = () => {
    setCurrentSignerIdx(0);
    setAgreed(false);
    setConfirmedSig(null);
    setPhase('signing');
  };

  const uploadWaivers = async (signers: CompletedSigner[]) => {
    setUploadError(null);
    try {
      const res = await fetch(`/api/waivers/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signers: signers.map((s) => ({
            signer_name: s.signer_name,
            signer_email: s.signer_email,
            role: s.role,
            participants_covered: s.participants_covered,
            guardian_relationship: s.guardian_relationship,
            signature_data_url: s.signature_data_url,
            pdf_data_url: s.pdf_data_url,
            agreed_at: s.agreed_at,
          })),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error ?? 'Upload failed');
      }
      setPhase('done');
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Failed to store the waiver. Please try again.');
      setPhase('signing');
      setCurrentSignerIdx(completedSigners.length);
    }
  };

  const handleSubmitSignature = async () => {
    if (!confirmedSig) return;
    const def = signerDefs[currentSignerIdx];
    const agreedAt = new Date().toISOString();

    let pdfDataUrl = '';
    try {
      pdfDataUrl = await generateWaiverPdf({
        signerName: def.signer_name,
        signerEmail: currentSignerIdx === 0 ? customerEmail : undefined,
        role: def.role,
        participantsCovered: def.participants_covered,
        guardianRelationship: def.guardian_relationship,
        agreedAt,
        tourType: context.trailType,
        locationName: context.locationName,
        tourDate: context.tourDate,
        bookingRef: context.bookingRef,
        signatureDataUrl: confirmedSig,
      });
    } catch (e) {
      console.error('[waiver] PDF generation failed:', e);
    }

    const signed: CompletedSigner = {
      ...def,
      signer_email: currentSignerIdx === 0 ? customerEmail : undefined,
      signature_data_url: confirmedSig,
      pdf_data_url: pdfDataUrl,
      agreed_at: agreedAt,
    };

    const updated = [...completedSigners, signed];
    setCompletedSigners(updated);

    if (currentSignerIdx + 1 < signerDefs.length) {
      setCurrentSignerIdx((i) => i + 1);
      setAgreed(false);
      setConfirmedSig(null);
    } else {
      setPhase('uploading');
      await uploadWaivers(updated);
    }
  };

  // ── Terminal states ────────────────────────────────────────────────────────────
  if (cancelled) {
    return (
      <Shell>
        <div className="py-10 text-center">
          <h1 className="text-2xl font-bold text-foreground">Booking Cancelled</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This booking is no longer active, so the waiver can’t be signed. Please contact your guide if you think this is a mistake.
          </p>
        </div>
      </Shell>
    );
  }

  if (alreadySigned && phase !== 'done') {
    return (
      <Shell>
        <div className="flex flex-col items-center py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Waiver Already Signed</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            This waiver has already been completed for your booking. There’s nothing more you need to do — see you on the trail!
          </p>
        </div>
      </Shell>
    );
  }

  const currentDef = signerDefs[currentSignerIdx];

  const handleBack = () => {
    if (phase === 'review') setPhase('setup');
    else if (phase === 'signing' && completedSigners.length === 0) setPhase('review');
  };

  return (
    <Shell>
      {/* Header */}
      {phase !== 'uploading' && phase !== 'done' && (
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-bold text-foreground">Waiver &amp; Release</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each adult participant must sign individually. Guardians sign on behalf of minors.
          </p>
        </div>
      )}

      {phase === 'setup' && <TourSummary context={context} />}

      {/* ── Phase 1: Setup ── */}
      {phase === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">For each participant, confirm their age group:</p>

          {participants.map((p, idx) => (
            <div key={idx} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">{idx === 0 ? `${p.name} (You)` : p.name}</p>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`age-${idx}`}
                    checked={!p.is_minor}
                    onChange={() => updateParticipant(idx, { is_minor: false, guardian_name: undefined, guardian_relationship: undefined })}
                    className="accent-green-600"
                  />
                  <span className="text-sm text-foreground">Adult (18+)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`age-${idx}`}
                    checked={p.is_minor}
                    onChange={() => updateParticipant(idx, { is_minor: true })}
                    className="accent-green-600"
                  />
                  <span className="text-sm text-foreground">Minor (under 18)</span>
                </label>
              </div>

              {p.is_minor && (
                <div className="space-y-3 border-t border-border pt-1">
                  <div>
                    <Label className="mb-1 block text-xs text-muted-foreground">
                      Parent / Guardian Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={p.guardian_name ?? ''}
                      onChange={(e) => updateParticipant(idx, { guardian_name: e.target.value })}
                      placeholder="Full legal name of guardian"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-muted-foreground">Relationship</Label>
                    <select
                      value={p.guardian_relationship ?? 'parent'}
                      onChange={(e) => updateParticipant(idx, { guardian_relationship: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="parent">Parent</option>
                      <option value="legal_guardian">Legal Guardian</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}

          <Button onClick={handleSetupContinue} disabled={!setupIsValid} className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
            Continue →
          </Button>
        </div>
      )}

      {/* ── Phase 2: Review ── */}
      {phase === 'review' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Required Signatures</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {signerDefs.length === 1
                ? '1 signature required.'
                : `${signerDefs.length} signatures required. Each signer completes them in sequence.`}
            </p>
          </div>

          <div className="space-y-3">
            {signerDefs.map((s, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.signer_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.role === 'participant'
                      ? 'Signing for themselves'
                      : `Guardian signing for: ${s.participants_covered.join(', ')} (${s.guardian_relationship ?? 'guardian'})`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleBack} className="border-border text-foreground">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back</span>
            </Button>
            <Button onClick={handleStartSigning} className="flex-1 bg-green-600 hover:bg-green-700 text-white" size="lg">
              Begin Signing
            </Button>
          </div>
        </div>
      )}

      {/* ── Phase 3: Signing ── */}
      {phase === 'signing' && currentDef && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Signer {currentSignerIdx + 1} of {signerDefs.length}
              </p>
              <h2 className="mt-1 text-xl font-bold text-foreground">{currentDef.signer_name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {currentDef.role === 'participant'
                  ? 'Signing for themselves'
                  : `Signing as ${currentDef.guardian_relationship ?? 'guardian'} for: ${currentDef.participants_covered.join(', ')}`}
              </p>
            </div>
          </div>

          {completedSigners.length > 0 && (
            <div className="space-y-1.5">
              {completedSigners.map((cs, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {cs.signer_name} — signed
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {uploadError}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-5">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-5 text-muted-foreground">{WAIVER_TEXT}</pre>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <Checkbox
              id={`agree-${currentSignerIdx}`}
              checked={agreed}
              onCheckedChange={(v) => setAgreed(!!v)}
              className="mt-0.5 border-2 border-slate-400 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600 dark:border-slate-500"
            />
            <Label htmlFor={`agree-${currentSignerIdx}`} className="cursor-pointer text-sm leading-relaxed text-foreground">
              I, <strong>{currentDef.signer_name}</strong>, have read and fully understand the Liability Waiver above. I voluntarily agree to all terms
              {currentDef.role === 'guardian'
                ? ` on behalf of ${currentDef.participants_covered.join(' and ')}, for whom I am the ${currentDef.guardian_relationship ?? 'guardian'}.`
                : ' and confirm I am 18 years of age or older.'}
            </Label>
          </div>

          {agreed && (
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Draw your signature below:</p>
              <SignatureCanvas onConfirm={(dataUrl) => setConfirmedSig(dataUrl)} onClear={() => setConfirmedSig(null)} />
              {confirmedSig && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-400">✓ Signature captured — submit to continue</p>
              )}
            </div>
          )}

          <Button
            onClick={handleSubmitSignature}
            disabled={!agreed || !confirmedSig}
            className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-40"
            size="lg"
          >
            {currentSignerIdx + 1 < signerDefs.length
              ? `Submit & Continue to Signer ${currentSignerIdx + 2} of ${signerDefs.length}`
              : 'Submit Signature & Finalize'}
          </Button>
        </div>
      )}

      {/* ── Phase: Uploading ── */}
      {phase === 'uploading' && (
        <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
          <p className="text-base font-semibold text-foreground">Saving your waiver…</p>
          <p className="text-sm text-muted-foreground">Uploading signatures and generating evidence PDFs.</p>
        </div>
      )}

      {/* ── Phase: Done ── */}
      {phase === 'done' && (
        <div className="space-y-6">
          <div className="flex flex-col items-center space-y-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {completedSigners.length <= 1 ? 'Waiver Signed' : `All ${completedSigners.length} Waivers Signed`}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your signature has been recorded with a timestamped evidence record. You’re all set for your tour — see you on the trail!
            </p>
          </div>

          {completedSigners.length > 0 && (
            <div className="space-y-2">
              {completedSigners.map((cs, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20">
                  <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cs.signer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cs.role === 'participant' ? 'Participant waiver' : `Guardian waiver — covering ${cs.participants_covered.join(', ')}`}
                      {' · '}Signed {formatFloridaTime(cs.agreed_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
