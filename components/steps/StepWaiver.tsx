'use client';

import { useState, useMemo, useEffect } from 'react';
import { useBooking } from '@/context/BookingContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SignatureCanvas } from '@/components/waiver/SignatureCanvas';
import type { WaiverParticipant, WaiverSigner } from '@/types/booking';
import { WAIVER_TEXT } from '@/lib/waiver-text';
import { generateWaiverPdf } from '@/lib/waiver-pdf';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'review' | 'signing' | 'uploading' | 'done';

interface SignerDef {
  signer_name: string;
  role: 'participant' | 'guardian';
  participants_covered: string[];
  guardian_relationship?: string;
}

// ─── Signer derivation ────────────────────────────────────────────────────────

function buildSigners(participants: WaiverParticipant[], leadName: string): SignerDef[] {
  const signers: SignerDef[] = [];

  // Adults sign for themselves
  participants.forEach((p) => {
    if (!p.is_minor) {
      signers.push({
        signer_name: p.name,
        role: 'participant',
        participants_covered: [p.name],
      });
    }
  });

  // Minors: group by guardian name (one signer per unique guardian)
  const guardianMap = new Map<string, { relationship: string; minors: string[] }>();
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
        });
      }
    }
  });

  guardianMap.forEach((data, key) => {
    // Find original casing from participants
    const guardian = participants.find(
      (p) => p.is_minor && p.guardian_name?.trim().toLowerCase() === key
    );
    signers.push({
      signer_name: guardian?.guardian_name ?? key,
      role: 'guardian',
      participants_covered: data.minors,
      guardian_relationship: data.relationship,
    });
  });

  // Ensure lead booker is in the list if they are an adult participant
  // (they are always participant index 0)
  const leadParticipant = participants[0];
  if (leadParticipant && !leadParticipant.is_minor) {
    // already added above — nothing to do
    void leadName;
  }

  return signers;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepWaiver() {
  const {
    state,
    setWaiverAccepted,
    setWaiverParticipants,
    setWaiverSigners,
    setWaiverSessionId,
    goNext,
    goPrev,
  } = useBooking();

  // Build initial participant list from booking state
  const allParticipantNames: string[] = useMemo(() => {
    const names = [state.customer?.name ?? 'Rider 1'];
    (state.additional_participants ?? []).forEach((p) => {
      if (p.name?.trim()) names.push(p.name.trim());
    });
    return names;
  }, [state.customer?.name, state.additional_participants]);

  // ── Phase state ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('setup');

  // ── Phase 1: participant setup ───────────────────────────────────────────────
  const initParticipants = (): WaiverParticipant[] =>
    allParticipantNames.map((name) => ({ name, is_minor: false }));

  const savedParticipantsMatchCurrentBooking =
    state.waiver_participants?.length === allParticipantNames.length &&
    state.waiver_participants.every((participant, idx) => participant.name === allParticipantNames[idx]);

  const [participants, setParticipants] = useState<WaiverParticipant[]>(
    savedParticipantsMatchCurrentBooking
      ? (state.waiver_participants ?? initParticipants())
      : initParticipants()
  );

  useEffect(() => {
    if (savedParticipantsMatchCurrentBooking && state.waiver_participants) {
      setParticipants(state.waiver_participants);
      return;
    }
    setParticipants(initParticipants());
  }, [savedParticipantsMatchCurrentBooking, state.waiver_participants, allParticipantNames]);

  const updateParticipant = (idx: number, patch: Partial<WaiverParticipant>) => {
    setParticipants((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const setupIsValid = participants.every((p) => {
    if (!p.is_minor) return true;
    return !!p.guardian_name?.trim();
  });

  // ── Phase 2/3: signers ───────────────────────────────────────────────────────
  const [signerDefs, setSignerDefs] = useState<SignerDef[]>([]);
  const [currentSignerIdx, setCurrentSignerIdx] = useState(0);
  const [completedSigners, setCompletedSigners] = useState<WaiverSigner[]>([]);

  // Per-signer form state
  const [agreed, setAgreed] = useState(false);
  const [confirmedSig, setConfirmedSig] = useState<string | null>(null);

  const handleSetupContinue = () => {
    setWaiverParticipants(participants);
    const defs = buildSigners(participants, state.customer?.name ?? 'Rider 1');
    setSignerDefs(defs);
    setPhase('review');
  };

  const handleStartSigning = () => {
    setCurrentSignerIdx(0);
    setAgreed(false);
    setConfirmedSig(null);
    setPhase('signing');
  };

  const handleSubmitSignature = async () => {
    if (!confirmedSig) return;
    const def = signerDefs[currentSignerIdx];
    const agreedAt = new Date().toISOString();

    // Generate PDF client-side
    let pdfDataUrl = '';
    try {
      pdfDataUrl = await generateWaiverPdf({
        signerName: def.signer_name,
        signerEmail: currentSignerIdx === 0 ? (state.customer?.email ?? undefined) : undefined,
        role: def.role,
        participantsCovered: def.participants_covered,
        guardianRelationship: def.guardian_relationship,
        agreedAt,
        tourType: state.trail_type,
        locationName: state.location_name,
        tourDate: state.date,
        signatureDataUrl: confirmedSig,
      });
    } catch (e) {
      console.error('[waiver] PDF generation failed:', e);
    }

    const signed: WaiverSigner = {
      signer_name: def.signer_name,
      signer_email: currentSignerIdx === 0 ? (state.customer?.email ?? undefined) : undefined,
      role: def.role,
      participants_covered: def.participants_covered,
      guardian_relationship: def.guardian_relationship,
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
      // All signers done — upload
      setPhase('uploading');
      await uploadWaivers(updated);
    }
  };

  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadWaivers = async (signers: WaiverSigner[]) => {
    setUploadError(null);
    try {
      const res = await fetch('/api/waivers/store', {
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
          context: {
            tour_type: state.trail_type,
            location_name: state.location_name,
            tour_date: state.date,
            customer_email: state.customer?.email,
          },
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error ?? 'Upload failed');
      }

      const { waiver_session_id } = await res.json();
      setWaiverSigners(signers);
      setWaiverSessionId(waiver_session_id);
      setWaiverAccepted(true);
      setPhase('done');
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Failed to store waivers. Please try again.');
      setPhase('signing'); // let them retry from last signer
      setCurrentSignerIdx(completedSigners.length); // already-signed stay done
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const currentDef = signerDefs[currentSignerIdx];
  const handleWaiverBack = () => {
    if (phase === 'setup') {
      goPrev();
      return;
    }
    if (phase === 'review') {
      setPhase('setup');
      return;
    }
    if (phase === 'signing' && completedSigners.length === 0) {
      setPhase('review');
    }
  };

  return (
    <div>
      {/* Shared header and back button */}
      {phase !== 'uploading' && phase !== 'done' && (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Waiver &amp; Release</h2>
            <p className="text-muted-foreground mt-1">
              Each adult participant must sign individually. Guardians sign on behalf of minors.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleWaiverBack}
            disabled={phase === 'signing' && completedSigners.length > 0}
            className="mb-6 gap-1.5 border-border text-foreground hover:bg-muted disabled:opacity-40"
          >
            ← Back
          </Button>
        </>
      )}

      {/* ── Phase 1: Setup ── */}
      {phase === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">
            For each participant, confirm their age group:
          </p>

          {participants.map((p, idx) => (
            <div key={idx} className="border border-border rounded-xl p-4 bg-card space-y-3">
              <p className="text-sm font-semibold text-foreground">
                {idx === 0 ? `${p.name} (You)` : p.name}
              </p>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`age-${idx}`}
                    checked={!p.is_minor}
                    onChange={() => updateParticipant(idx, { is_minor: false, guardian_name: undefined, guardian_relationship: undefined })}
                    className="accent-green-600"
                  />
                  <span className="text-sm text-foreground">Adult (18+)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
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
                <div className="space-y-3 pt-1 border-t border-border">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
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
                    <Label className="text-xs text-muted-foreground mb-1 block">Relationship</Label>
                    <select
                      value={p.guardian_relationship ?? 'parent'}
                      onChange={(e) => updateParticipant(idx, { guardian_relationship: e.target.value })}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                    >
                      <option value="parent">Parent</option>
                      <option value="legal_guardian">Legal Guardian</option>
                      <option value="other">Other (specify in notes)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}

          <Button
            onClick={handleSetupContinue}
            disabled={!setupIsValid}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            Continue →
          </Button>
        </div>
      )}

      {/* ── Phase 2: Review signers ── */}
      {phase === 'review' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Required Signatures</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {signerDefs.length === 1
                ? '1 signature required before booking is confirmed.'
                : `${signerDefs.length} signatures required. Each signer will complete them in sequence.`}
            </p>
          </div>

          <div className="space-y-3">
            {signerDefs.map((s, i) => (
              <div key={i} className="border border-border rounded-xl p-4 bg-card flex items-start gap-3">
                <div className="mt-0.5 h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.signer_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.role === 'participant'
                      ? 'Signing for themselves'
                      : `Guardian signing for: ${s.participants_covered.join(', ')} (${s.guardian_relationship ?? 'guardian'})`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Each signer must read the full waiver, check the agreement box, and provide a digital signature before the booking can proceed.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setPhase('setup')}
              className="border-border text-foreground"
            >
              ← Back
            </Button>
            <Button
              onClick={handleStartSigning}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              Begin Signing
            </Button>
          </div>
        </div>
      )}

      {/* ── Phase 3: Signing ── */}
      {phase === 'signing' && currentDef && (
        <div className="space-y-5">
          {/* Progress */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Signer {currentSignerIdx + 1} of {signerDefs.length}
              </p>
              <h2 className="text-xl font-bold text-foreground mt-1">{currentDef.signer_name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentDef.role === 'participant'
                  ? 'Signing for themselves'
                  : `Signing as ${currentDef.guardian_relationship ?? 'guardian'} for: ${currentDef.participants_covered.join(', ')}`}
              </p>
            </div>
            {signerDefs.length > 1 && (
              <div className="flex gap-1.5">
                {signerDefs.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i < currentSignerIdx
                        ? 'bg-green-500'
                        : i === currentSignerIdx
                        ? 'bg-green-600 ring-2 ring-green-300'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Previously completed signers (read-only) */}
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
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              {uploadError}
            </div>
          )}

          {/* Waiver text */}
          <div className="border border-border rounded-xl bg-card max-h-72 overflow-y-auto p-5">
            <pre className="text-xs leading-5 text-muted-foreground whitespace-pre-wrap font-sans">
              {WAIVER_TEXT}
            </pre>
          </div>

          {/* Agreement checkbox */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Checkbox
              id={`agree-${currentSignerIdx}`}
              checked={agreed}
              onCheckedChange={(v) => setAgreed(!!v)}
              className="mt-0.5 border-2 border-slate-400 dark:border-slate-500 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600"
            />
            <Label htmlFor={`agree-${currentSignerIdx}`} className="text-sm text-foreground leading-relaxed cursor-pointer">
              I, <strong>{currentDef.signer_name}</strong>, have read and fully understand the Liability Waiver above.
              I voluntarily agree to all terms
              {currentDef.role === 'guardian'
                ? ` on behalf of ${currentDef.participants_covered.join(' and ')}, for whom I am the ${currentDef.guardian_relationship ?? 'guardian'}.`
                : ' and confirm I am 18 years of age or older.'}
            </Label>
          </div>

          {/* Signature canvas */}
          {agreed && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">
                Draw your signature below:
              </p>
              <SignatureCanvas
                onConfirm={(dataUrl) => setConfirmedSig(dataUrl)}
                onClear={() => setConfirmedSig(null)}
              />
              {confirmedSig && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  ✓ Signature captured — click &quot;Submit Signature&quot; to continue
                </p>
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
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="h-10 w-10 rounded-full border-4 border-green-600 border-t-transparent animate-spin" />
          <p className="text-base font-semibold text-foreground">Saving waiver records…</p>
          <p className="text-sm text-muted-foreground">Uploading signatures and generating evidence PDFs.</p>
        </div>
      )}

      {/* ── Phase: Done ── */}
      {phase === 'done' && (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center py-8 space-y-3">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {completedSigners.length === 1 ? 'Waiver Signed' : `All ${completedSigners.length} Waivers Signed`}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Signatures recorded and evidence PDFs generated. Your booking is ready to be confirmed.
            </p>
          </div>

          <div className="space-y-2">
            {completedSigners.map((cs, i) => (
              <div key={i} className="flex items-center gap-3 border border-green-200 dark:border-green-800 rounded-xl p-3 bg-green-50 dark:bg-green-950/20">
                <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-foreground">{cs.signer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cs.role === 'participant'
                      ? 'Participant waiver'
                      : `Guardian waiver — covering ${cs.participants_covered.join(', ')}`}
                    {' · '}Signed {new Date(cs.agreed_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={() => goNext()}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            Continue to Payment →
          </Button>
        </div>
      )}
    </div>
  );
}
