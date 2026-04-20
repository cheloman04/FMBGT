'use client';

import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import type { BikeRental, AdditionalParticipant } from '@/types/booking';
import { BookingStepActions } from '@/components/BookingStepActions';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { formatPrice, PRICING, calculatePriceBreakdown } from '@/lib/pricing';

// ── Business rules ────────────────────────────────────────────────────────────
const MAX_PARTICIPANTS: Record<string, number> = {
  'Blue Spring State Park': 4,
  'Sanford Historic Riverfront Tour': 6,
};
const NO_ELECTRIC_LOCATIONS = new Set(['Blue Spring State Park']);
// Fleet cap applies to both Sanford (paved) and all MTB locations
const FLEET_MAX_STANDARD = 4;
const FLEET_MAX_ELECTRIC = 2;

function getMaxParticipants(locationName: string, trailType: string): number {
  if (trailType === 'paved') return MAX_PARTICIPANTS[locationName] ?? 4;
  return 6;
}

// ── Shared helpers ────────────────────────────────────────────────────────────
const MTB_BIKE_OPTIONS: Array<{ value: BikeRental; label: string; description: string; price: string }> = [
  { value: 'none',     label: 'No Bike (BYOB)',       description: 'Bring your own bike.',                          price: `from ${formatPrice(PRICING.BASE_NO_BIKE)}` },
  { value: 'standard', label: 'Standard Bike',        description: 'Quality rental bike included.',                 price: `from ${formatPrice(PRICING.BASE_WITH_BIKE)}` },
  { value: 'electric', label: 'Electric Bike',        description: 'Motor-assisted. Limited availability.',         price: `from ${formatPrice(PRICING.BASE_WITH_BIKE + PRICING.ADDONS.electric_upgrade)}` },
];

const HEIGHT_OPTIONS = [
  { label: "Under 5'0\" (< 60\")",     value: 59 },
  { label: "5'0\" – 5'3\" (60–63\")",  value: 62 },
  { label: "5'4\" – 5'7\" (64–67\")",  value: 66 },
  { label: "5'8\" – 5'11\" (68–71\")", value: 70 },
  { label: "6'0\" – 6'3\" (72–75\")",  value: 74 },
  { label: "Over 6'3\" (> 75\")",      value: 76 },
];

function HeightSelect({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <select
      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="">Select height...</option>
      {HEIGHT_OPTIONS.map((h) => (
        <option key={h.value} value={h.value}>{h.label}</option>
      ))}
    </select>
  );
}

function MTBBikeSelector({
  value, onChange, electricAllowed, standardDisabled, electricDisabled,
}: {
  value: BikeRental | undefined;
  onChange: (v: BikeRental) => void;
  electricAllowed: boolean;
  standardDisabled?: boolean;
  electricDisabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {MTB_BIKE_OPTIONS.filter((o) => o.value !== 'electric' || electricAllowed).map((opt) => {
        const disabled =
          (opt.value === 'standard' && standardDisabled && value !== 'standard') ||
          (opt.value === 'electric' && electricDisabled && value !== 'electric');
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            className={`w-full text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Card className={`transition-all ${disabled ? '' : 'cursor-pointer'} ${value === opt.value ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : disabled ? 'border-border' : 'hover:border-border'}`}>
              <CardHeader className="py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-sm">{opt.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {disabled ? 'No availability for this booking' : opt.description}
                    </CardDescription>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground ml-3 whitespace-nowrap">{opt.price}</span>
                </div>
              </CardHeader>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

const SANFORD_BIKE_OPTIONS: Array<{ value: BikeRental; label: string; description: string; price: string }> = [
  { value: 'standard', label: 'Standard Bike', description: 'Quality rental bike included.',        price: 'Included'                                   },
  { value: 'electric', label: 'Electric Bike',  description: 'Motor-assisted. Limited availability.', price: `+${formatPrice(PRICING.ADDONS.electric_upgrade)} upgrade` },
];

/** Card-style selector for Sanford paved: matches MTB layout */
function SanfordBikeSelector({
  value, onChange, standardDisabled, electricDisabled,
}: {
  value: BikeRental | undefined;
  onChange: (v: BikeRental) => void;
  standardDisabled: boolean;
  electricDisabled: boolean;
}) {
  return (
    <div className="space-y-2">
      {SANFORD_BIKE_OPTIONS.map((opt) => {
        const disabled =
          (opt.value === 'standard' && standardDisabled && value !== 'standard') ||
          (opt.value === 'electric' && electricDisabled && value !== 'electric');
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            className={`w-full text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Card className={`transition-all ${disabled ? '' : 'cursor-pointer'} ${value === opt.value ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : disabled ? 'border-border' : 'hover:border-border'}`}>
              <CardHeader className="py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-sm">{opt.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {disabled ? 'No availability for this booking' : opt.description}
                    </CardDescription>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground ml-3 whitespace-nowrap">{opt.price}</span>
                </div>
              </CardHeader>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function StepBike() {
  const { state, setBikeRental, setRiderHeight, setParticipants, setCustomer, setPriceBreakdown, goNext, goPrev } = useBooking();
  const isPaved   = state.trail_type === 'paved';
  const isSanford = state.location_name === 'Sanford Historic Riverfront Tour';
  const electricAllowed = !NO_ELECTRIC_LOCATIONS.has(state.location_name ?? '');
  const maxCount  = getMaxParticipants(state.location_name ?? '', state.trail_type ?? 'mtb');

  // ── Rider 1 state ──────────────────────────────────────────────────────────
  const [rider1Name, setRider1Name] = useState(state.customer?.name ?? '');
  const [count, setCount] = useState(state.participant_count ?? 1);
  const defaultBike: BikeRental = isPaved ? 'standard' : (
    state.bike_rental === 'electric' && !electricAllowed ? 'standard' : (state.bike_rental ?? undefined as unknown as BikeRental)
  );
  const [rider1Bike, setRider1Bike] = useState<BikeRental | undefined>(defaultBike);
  const [rider1Height, setRider1Height] = useState<number | undefined>(state.rider_height_inches);

  // ── Additional riders state ────────────────────────────────────────────────
  const initAdditionals = (): AdditionalParticipant[] => {
    const existing = state.additional_participants ?? [];
    const needed   = (state.participant_count ?? 1) - 1;
    if (existing.length >= needed) return existing.slice(0, needed);
    const defaultBikeForNew: BikeRental = isPaved ? 'standard' : undefined as unknown as BikeRental;
    return [...existing, ...Array(needed - existing.length).fill({ name: '', bike_rental: defaultBikeForNew, height_inches: undefined })];
  };
  const [additionals, setAdditionals] = useState<AdditionalParticipant[]>(initAdditionals);

  const handleCountChange = (newCount: number) => {
    setCount(newCount);
    setAdditionals((prev) => {
      const needed = newCount - 1;
      if (prev.length >= needed) return prev.slice(0, needed);
      const defaultBikeForNew: BikeRental = isPaved ? 'standard' : undefined as unknown as BikeRental;
      return [...prev, ...Array(needed - prev.length).fill({ name: '', bike_rental: defaultBikeForNew, height_inches: undefined })];
    });
  };

  const updateAdditional = (idx: number, patch: Partial<AdditionalParticipant>) => {
    setAdditionals((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  // ── Sanford fleet counts ───────────────────────────────────────────────────
  const standardCount = (rider1Bike === 'standard' ? 1 : 0) + additionals.filter(p => p.bike_rental === 'standard').length;
  const electricCount = (rider1Bike === 'electric' ? 1 : 0) + additionals.filter(p => p.bike_rental === 'electric').length;

  // Fleet cap applies to both Sanford paved and all MTB locations
  const hasFleetCap = isSanford || !isPaved;
  function isStandardDisabled(currentBike: BikeRental | undefined) {
    return hasFleetCap && standardCount >= FLEET_MAX_STANDARD && currentBike !== 'standard';
  }
  function isElectricDisabled(currentBike: BikeRental | undefined) {
    return hasFleetCap && electricCount >= FLEET_MAX_ELECTRIC && currentBike !== 'electric';
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const isValid = (): boolean => {
    if (!rider1Name.trim()) return false;
    if (isPaved) {
      if (!rider1Height) return false;
      if (isSanford && !rider1Bike) return false;
      for (const p of additionals) {
        if (!p.name.trim() || !p.height_inches) return false;
        if (isSanford && !p.bike_rental) return false;
      }
      // Sanford: total bike allocations must equal count (no unassigned)
      if (isSanford && (standardCount + electricCount) !== count) return false;
      return true;
    }
    // MTB
    if (!rider1Bike) return false;
    if (rider1Bike !== 'none' && !rider1Height) return false;
    for (const p of additionals) {
      if (!p.name.trim() || !p.bike_rental) return false;
      if (p.bike_rental !== 'none' && !p.height_inches) return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (!isValid()) return;
    const effectiveBike: BikeRental = isPaved ? (rider1Bike ?? 'standard') : rider1Bike!;
    setBikeRental(effectiveBike);
    if (rider1Height) setRiderHeight(rider1Height);
    setParticipants(count, additionals);
    setCustomer({ ...(state.customer ?? { name: '', email: '' }), name: rider1Name.trim() });

    // For paved trails, both the duration and addons steps are skipped, so
    // setPriceBreakdown is never called in those steps. Compute it here so
    // StepPayment always has a valid price_breakdown regardless of trail type.
    // For MTB, the duration/addons steps will overwrite this with the final value.
    const breakdown = calculatePriceBreakdown(
      effectiveBike,
      state.duration_hours ?? 2,
      state.addons ?? { gopro: false, pickup_dropoff: false, electric_upgrade: false },
      state.trail_type,
      additionals,
      { liveTestMode: state.live_test_mode }
    );
    setPriceBreakdown(breakdown);

    goNext();
  };

  // ── Count selector ────────────────────────────────────────────────────────
  const CountSelector = (
    <div className="mb-6">
      <Label className="block mb-2 font-medium text-foreground">How many riders?</Label>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleCountChange(n)}
            className={`w-10 h-10 rounded-lg border-2 text-sm font-semibold transition-colors ${
              count === n
                ? 'border-green-500 bg-green-600 text-white'
                : 'border-border bg-background text-foreground hover:border-green-400'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">Max {maxCount} riders at this location.</p>
    </div>
  );

  // ── PAVED flow ─────────────────────────────────────────────────────────────
  if (isPaved) {
    return (
      <div>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">Riders &amp; Bikes</h2>
          <p className="text-muted-foreground mt-1">
            {isSanford
              ? 'Choose a bike type for each rider. 4 standard bikes and 2 e-bikes available.'
              : 'Bikes are included. We need each rider\'s height for sizing.'}
          </p>
        </div>

        <BookingStepActions onBack={goPrev} />

        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            ✓ Bike included — {formatPrice(PRICING.PAVED_FLAT)} per rider · 2-hour guided tour
            {isSanford && ` · E-bike upgrade +${formatPrice(PRICING.ADDONS.electric_upgrade)}/rider`}
          </p>
        </div>

        {isSanford && count > 1 && (
          <div className="mb-4 flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Standard: <span className={`font-semibold ${standardCount > FLEET_MAX_STANDARD ? 'text-destructive' : 'text-foreground'}`}>{standardCount}/{FLEET_MAX_STANDARD}</span>
            </span>
            <span className="text-muted-foreground">
              E-bikes: <span className={`font-semibold ${electricCount > FLEET_MAX_ELECTRIC ? 'text-destructive' : 'text-foreground'}`}>{electricCount}/{FLEET_MAX_ELECTRIC}</span>
            </span>
          </div>
        )}

        {CountSelector}

        <div className="space-y-4 mb-6">
          {/* Rider 1 */}
          <div className="p-4 border border-border rounded-lg bg-card">
            <p className="text-sm font-semibold text-foreground mb-3">Rider 1 (You)</p>
            <div className="mb-3">
              <Label className="block mb-1 text-sm text-foreground">Full name <span className="text-destructive">*</span></Label>
              <Input
                value={rider1Name}
                onChange={(e) => setRider1Name(e.target.value)}
                placeholder="Your full legal name"
                className="text-sm"
              />
            </div>
            {isSanford && (
              <div className="mb-3">
                <Label className="block mb-1 text-sm text-foreground">Bike type</Label>
                <SanfordBikeSelector
                  value={rider1Bike}
                  onChange={setRider1Bike}
                  standardDisabled={isStandardDisabled(rider1Bike)}
                  electricDisabled={isElectricDisabled(rider1Bike)}
                />
              </div>
            )}
            <Label className="block mb-1 text-sm text-foreground">Height (for bike sizing)</Label>
            <HeightSelect value={rider1Height} onChange={setRider1Height} />
          </div>

          {/* Riders 2-N */}
          {additionals.map((p, idx) => (
            <div key={idx} className="p-4 border border-border rounded-lg bg-card">
              <p className="text-sm font-semibold text-foreground mb-3">Rider {idx + 2}</p>
              <div className="space-y-3">
                <div>
                  <Label className="block mb-1 text-sm text-foreground">Name</Label>
                  <Input
                    value={p.name}
                    onChange={(e) => updateAdditional(idx, { name: e.target.value })}
                    placeholder="Full name"
                    className="text-sm"
                  />
                </div>
                {isSanford && (
                  <div>
                    <Label className="block mb-1 text-sm text-foreground">Bike type</Label>
                    <SanfordBikeSelector
                      value={p.bike_rental}
                      onChange={(v) => updateAdditional(idx, { bike_rental: v })}
                      standardDisabled={isStandardDisabled(p.bike_rental)}
                      electricDisabled={isElectricDisabled(p.bike_rental)}
                    />
                  </div>
                )}
                <div>
                  <Label className="block mb-1 text-sm text-foreground">Height (for bike sizing)</Label>
                  <HeightSelect
                    value={p.height_inches}
                    onChange={(v) => updateAdditional(idx, { height_inches: v, bike_rental: p.bike_rental ?? 'standard' })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleContinue} disabled={!isValid()} className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
          Continue
        </Button>
      </div>
    );
  }

  // ── MTB flow ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">Riders &amp; Bike Rental</h2>
        <p className="text-muted-foreground mt-1">
          Select a bike option for each rider. Fleet: {FLEET_MAX_STANDARD} standard bikes and {FLEET_MAX_ELECTRIC} e-bikes available.
        </p>
      </div>

      <BookingStepActions onBack={goPrev} backVariant="ghost" />

      {count > 1 && (
        <div className="mb-4 flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Standard rentals: <span className={`font-semibold ${standardCount > FLEET_MAX_STANDARD ? 'text-destructive' : 'text-foreground'}`}>{standardCount}/{FLEET_MAX_STANDARD}</span>
          </span>
          {electricAllowed && (
            <span className="text-muted-foreground">
              E-bikes: <span className={`font-semibold ${electricCount > FLEET_MAX_ELECTRIC ? 'text-destructive' : 'text-foreground'}`}>{electricCount}/{FLEET_MAX_ELECTRIC}</span>
            </span>
          )}
        </div>
      )}

      {CountSelector}

      <div className="space-y-5 mb-6">
        {/* Rider 1 */}
        <div className="p-4 border border-border rounded-lg bg-card">
          <p className="text-sm font-semibold text-foreground mb-3">Rider 1 (You)</p>
          <div className="mb-3">
            <Label className="block mb-1 text-sm text-foreground">Full name <span className="text-destructive">*</span></Label>
            <Input
              value={rider1Name}
              onChange={(e) => setRider1Name(e.target.value)}
              placeholder="Your full legal name"
              className="text-sm"
            />
          </div>
          <MTBBikeSelector
            value={rider1Bike}
            onChange={setRider1Bike}
            electricAllowed={electricAllowed}
            standardDisabled={isStandardDisabled(rider1Bike)}
            electricDisabled={isElectricDisabled(rider1Bike)}
          />
          {rider1Bike && rider1Bike !== 'none' && (
            <div className="mt-3">
              <Label className="block mb-1 text-sm text-foreground">Height (for bike sizing)</Label>
              <HeightSelect value={rider1Height} onChange={setRider1Height} />
            </div>
          )}
        </div>

        {/* Riders 2-N */}
        {additionals.map((p, idx) => (
          <div key={idx} className="p-4 border border-border rounded-lg bg-card">
            <p className="text-sm font-semibold text-foreground mb-3">Rider {idx + 2}</p>
            <div className="mb-3">
              <Label className="block mb-1 text-sm text-foreground">Name</Label>
              <Input
                value={p.name}
                onChange={(e) => updateAdditional(idx, { name: e.target.value })}
                placeholder="Full name"
                className="text-sm"
              />
            </div>
            <MTBBikeSelector
              value={p.bike_rental}
              onChange={(v) => updateAdditional(idx, { bike_rental: v, height_inches: v === 'none' ? undefined : p.height_inches })}
              electricAllowed={electricAllowed}
              standardDisabled={isStandardDisabled(p.bike_rental)}
              electricDisabled={isElectricDisabled(p.bike_rental)}
            />
            {p.bike_rental && p.bike_rental !== 'none' && (
              <div className="mt-3">
                <Label className="block mb-1 text-sm text-foreground">Height (for bike sizing)</Label>
                <HeightSelect value={p.height_inches} onChange={(v) => updateAdditional(idx, { height_inches: v })} />
              </div>
            )}
          </div>
        ))}
      </div>

      <Button onClick={handleContinue} disabled={!isValid()} className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
        Continue
      </Button>
    </div>
  );
}
