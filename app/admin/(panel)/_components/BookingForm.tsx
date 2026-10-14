'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Button,
  DatePicker,
  Input,
  Section,
  Select,
  StatusBadge,
  Textarea,
  buttonClasses,
  useAction,
} from '@/components/kit';
import { api } from '@/lib/admin/api';
import {
  BIKE_LABELS,
  DURATIONS,
  PAYMENT_METHODS,
  SKILL_LABELS,
  bikeOptions,
  createdHref,
  emptyManualForm,
  formProblem,
  heightOptions,
  initialForm,
  isManualBooking,
  locationOptions,
  manualCreatePayload,
  manualEditPayload,
  manualMoneyNote,
  newRider,
  onlineEditPayload,
  previewLines,
  savedQuery,
  skillOptions,
  timeOptions,
  withTour,
  type BookingFormState,
  type CreateResponse,
  type EditableBooking,
  type FormLocation,
  type PaymentMethod,
  type RiderForm,
  type SaveResponse,
} from '@/lib/admin/booking-form';
import { NEEDS_ATTENTION } from '@/lib/admin/status-meta';
import type { EditPreview } from '@/lib/booking-edit';
import { isLocationComingSoon } from '@/lib/location-status';
import type { BikeRental, SkillLevel, TrailType } from '@/types/booking';

// The booking form of the admin (lib/admin/booking-form.ts has its rules): it
// edits a booking, and creates a manual one (`mode="create"`).
//
// An online booking is re-priced with the website prices, so it goes through
// "Review changes" (the API's dry run) before "Save changes". A manual one keeps
// its agreed total and saves directly. Either way the save lands back on the
// booking, which says what the save did (?saved=…). A new manual booking picks
// its tour and says what was collected; it lands on its new page (?created=…),
// where the waiver link is.

export type BookingFormBooking = EditableBooking & {
  location_name: string | null;
  discount_code: string | null;
  discount_label: string | null;
  remaining_balance_due_at: string | null;
};

/** A checkbox with its explanation underneath. */
function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-fg-2">
      <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-ac-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint ? <span className="mt-0.5 block text-xs text-fg-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

function RiderRow({
  label,
  name,
  bike,
  height,
  bikes,
  onName,
  onBike,
  onHeight,
  onRemove,
}: {
  label: string;
  name: string;
  bike: BikeRental;
  height: number | null;
  bikes: BikeRental[];
  /** Absent for the lead rider: their name is the customer's. */
  onName?: (name: string) => void;
  onBike: (bike: BikeRental) => void;
  onHeight: (height: number | null) => void;
  onRemove?: () => void;
}): ReactNode {
  return (
    // Up to lg the name takes its own line and the bike and height share the
    // next (at 768 the content is ~485px wide). From lg, one line per rider: each
    // row is its own grid, so the last column has a fixed width and the lead's
    // row (no Remove) lines up with the others.
    <li className="grid grid-cols-2 items-end gap-3 py-3 first:pt-0 lg:grid-cols-[minmax(0,1fr)_9rem_9rem_5rem]">
      {onName ? (
        <Input
          label={label}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Full name"
          layout="col-span-2 lg:col-span-1"
        />
      ) : (
        <div className="col-span-2 lg:col-span-1">
          <p className="mb-1.5 text-xs font-medium text-fg-muted">{label}</p>
          <p className="py-2 text-sm text-fg">{name || 'The customer'}</p>
        </div>
      )}
      <Select label="Bike" value={bike} onChange={(e) => onBike(e.target.value as BikeRental)}>
        {bikes.map((b) => (
          <option key={b} value={b}>
            {BIKE_LABELS[b]}
          </option>
        ))}
      </Select>
      <Select
        label="Height"
        value={height ?? ''}
        onChange={(e) => onHeight(e.target.value ? Number(e.target.value) : null)}
        disabled={bike === 'none'}
        hint={bike === 'none' ? 'Rides their own bike' : undefined}
      >
        <option value="">Unknown</option>
        {heightOptions(height).map((h) => (
          <option key={h.value} value={h.value}>
            {h.label}
          </option>
        ))}
      </Select>
      {onRemove ? (
        <Button size="sm" variant="ghost" onClick={onRemove} layout="col-span-2 justify-self-start lg:col-span-1 lg:justify-self-auto">
          Remove
        </Button>
      ) : (
        <span className="max-lg:hidden" />
      )}
    </li>
  );
}

type EditProps = {
  mode?: 'edit';
  booking: BookingFormBooking;
  /** The locations an online booking can move to. */
  locations: FormLocation[];
  /** The booking page: Cancel goes there, and a save lands there. */
  backHref: string;
};

type CreateProps = {
  mode: 'create';
  /** Every active location: the form filters them by tour and skill. */
  locations: FormLocation[];
};

export function BookingForm(props: EditProps | CreateProps) {
  const router = useRouter();
  const { locations } = props;
  const booking = props.mode === 'create' ? null : props.booking;
  const creating = booking === null;
  const manual = creating || isManualBooking(booking);
  const [form, setForm] = useState<BookingFormState>(() => (booking ? initialForm(booking) : emptyManualForm()));
  const trail = form.trail_type;
  const paved = trail === 'paved';
  const [preview, setPreview] = useState<EditPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Any change voids the reviewed preview: what is saved is what was reviewed.
  function set<K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setPreview(null);
    setProblem(null);
  }
  const setRider = (index: number, patch: Partial<RiderForm>) =>
    set('riders', form.riders.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  // A new booking's kind of tour or skill: the location, the bikes and the
  // duration follow (withTour).
  function setTour(change: { trail_type?: TrailType; skill_level?: SkillLevel | '' }) {
    setForm((prev) => withTour(prev, change, locations));
    setProblem(null);
  }

  const id = booking?.id;
  const review = useAction(() => api.patch(`/api/admin/bookings/${id}`, onlineEditPayload(form, trail, true)), {
    refresh: false,
    onSuccess: (data) => setPreview((data as { preview: EditPreview }).preview),
  });
  const save = useAction(
    () =>
      manual
        ? api.patch('/api/admin/manual-booking', manualEditPayload(form, id ?? ''))
        : api.patch(`/api/admin/bookings/${id}`, onlineEditPayload(form, trail, false)),
    {
      // The booking page renders fresh: it is where the save lands.
      refresh: false,
      onSuccess: (data) => {
        setLeaving(true);
        if (props.mode !== 'create') router.replace(`${props.backHref}?${savedQuery(data as SaveResponse)}`);
      },
    },
  );
  const create = useAction(() => api.post('/api/admin/manual-booking', manualCreatePayload(form)), {
    refresh: false,
    // It converts the customer's open lead, if any: the Leads counter may drop.
    badges: true,
    onSuccess: (data) => {
      setLeaving(true);
      router.push(createdHref(data as CreateResponse));
    },
  });

  const reviewed = !manual && preview !== null && preview.changes.length > 0;
  const busy = review.pending || save.pending || create.pending || leaving;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const blocker = formProblem(form, manual, creating);
    if (blocker) return setProblem(blocker);
    if (creating) await create.run();
    else if (manual || reviewed) await save.run();
    else await review.run();
  }

  const error = problem ?? review.error ?? save.error ?? create.error;
  const skills = skillOptions(locations, form.location_id);
  const bikes = bikeOptions(trail);
  const places = locationOptions(locations, trail, form.skill_level);
  const moneyNote = creating ? manualMoneyNote(form) : null;

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-10" noValidate>
      <Section
        title="Customer"
        subtitle={
          creating
            ? 'The confirmation and the waiver link go to this email. A returning customer (same email) is updated, not added twice.'
            : 'Contact changes apply to every booking of this customer.'
        }
      >
        {/* Three across only from lg: at 768 an email doesn't fit a third of ~485px. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Name" value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} autoComplete="off" />
          <Input
            label="Email"
            type="email"
            value={form.customer_email}
            onChange={(e) => set('customer_email', e.target.value)}
            autoComplete="off"
          />
          <Input label="Phone" type="tel" value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} autoComplete="off" />
        </div>
      </Section>

      <Section title="Tour" subtitle="Times in Eastern.">
        {creating ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Kind of tour" value={form.trail_type} onChange={(e) => setTour({ trail_type: e.target.value as TrailType })}>
              <option value="mtb">Mountain bike</option>
              <option value="paved">Paved trail</option>
            </Select>
            {!paved ? (
              <Select
                label="Skill level"
                value={form.skill_level}
                onChange={(e) => setTour({ skill_level: e.target.value as SkillLevel | '' })}
              >
                <option value="">Pick a skill level</option>
                {(Object.keys(SKILL_LABELS) as SkillLevel[]).map((s) => (
                  <option key={s} value={s}>
                    {SKILL_LABELS[s]}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select
              label="Location"
              layout={paved ? undefined : 'sm:col-span-2'}
              value={form.location_id}
              onChange={(e) => set('location_id', e.target.value)}
            >
              <option value="">{places.length ? 'Pick a location' : 'No location takes this tour and skill'}</option>
              {places.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {isLocationComingSoon(l.name) ? ' (coming soon: not bookable online)' : ''}
                </option>
              ))}
            </Select>
          </div>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {manual ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-muted">Location</p>
              <p className="py-2 text-sm text-fg">{booking?.location_name || '—'}</p>
              <p className="text-xs text-fg-muted">To move a manual booking, cancel it and book it again.</p>
            </div>
          ) : (
            <Select label="Location" value={form.location_id} onChange={(e) => set('location_id', e.target.value)}>
              {/* The booking's own location, even if it no longer takes bookings: the select must show what's saved. */}
              {!form.location_id ? <option value="">Pick a location</option> : null}
              {form.location_id && !locations.some((l) => l.id === form.location_id) ? (
                <option value={form.location_id}>{booking?.location_name || 'Current location'} (not active)</option>
              ) : null}
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
          {!paved && !manual ? (
            <Select label="Skill level" value={form.skill_level} onChange={(e) => set('skill_level', e.target.value as SkillLevel | '')}>
              {!form.skill_level ? <option value="">Not set</option> : null}
              {form.skill_level && !skills.includes(form.skill_level) ? (
                <option value={form.skill_level}>{SKILL_LABELS[form.skill_level]} (not offered here)</option>
              ) : null}
              {skills.map((s) => (
                <option key={s} value={s}>
                  {SKILL_LABELS[s]}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <DatePicker label="Date" ariaLabel="Tour date" value={form.date} onChange={(value) => set('date', value)} />
          <Select label="Start time" value={form.time_slot} onChange={(e) => set('time_slot', e.target.value)}>
            {timeOptions(form.time_slot).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          {paved ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-muted">Duration</p>
              <p className="py-2 text-sm text-fg">2 hours (paved)</p>
            </div>
          ) : (
            <Select label="Duration" value={form.duration_hours} onChange={(e) => set('duration_hours', Number(e.target.value))}>
              {(DURATIONS as readonly number[]).includes(form.duration_hours) ? null : (
                <option value={form.duration_hours}>{form.duration_hours} hours</option>
              )}
              {DURATIONS.map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </Select>
          )}
        </div>
        {!paved && !manual ? (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <Check checked={form.gopro} onChange={(v) => set('gopro', v)} label="GoPro package" />
            <Check checked={form.pickup_dropoff} onChange={(v) => set('pickup_dropoff', v)} label="Pickup + dropoff" />
          </div>
        ) : null}
      </Section>

      <Section title="Riders" subtitle="The customer is rider 1. A rented bike needs the rider's height to be fitted.">
        <ul className="divide-y divide-hairline">
          <RiderRow
            label="Rider 1 (lead)"
            name={form.customer_name}
            bike={form.bike_rental}
            height={form.rider_height_inches}
            bikes={bikes}
            onBike={(bike) => set('bike_rental', bike)}
            onHeight={(height) => set('rider_height_inches', height)}
          />
          {form.riders.map((rider, index) => (
            <RiderRow
              key={index}
              label={`Rider ${index + 2}`}
              name={rider.name}
              bike={rider.bike_rental}
              height={rider.height_inches}
              bikes={bikes}
              onName={(name) => setRider(index, { name })}
              onBike={(bike) => setRider(index, { bike_rental: bike })}
              onHeight={(height) => setRider(index, { height_inches: height })}
              onRemove={() => set('riders', form.riders.filter((_, i) => i !== index))}
            />
          ))}
        </ul>
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => set('riders', [...form.riders, newRider(form)])}>
            Add rider
          </Button>
        </div>
      </Section>

      <Section
        title="Price"
        subtitle={creating ? 'Paid off the platform: nothing is charged here. The money goes to the Financial log.' : undefined}
      >
        {manual ? (
          <div className={creating ? 'grid gap-3 sm:grid-cols-3' : 'grid gap-3 sm:grid-cols-2'}>
            <Input
              label="Agreed total ($)"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.manual_total}
              onChange={(e) => set('manual_total', e.target.value)}
            />
            {creating ? (
              <Input
                label="Collected now ($)"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.manual_collected}
                onChange={(e) => set('manual_collected', e.target.value)}
              />
            ) : null}
            <Select
              label="Payment method"
              value={form.manual_payment_method}
              onChange={(e) => set('manual_payment_method', e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            {moneyNote ? <p className="text-sm text-fg-2 sm:col-span-full">{moneyNote}</p> : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-fg-2">
              Riders, bikes, duration, add-ons and location re-price the tour with the website prices
              {booking?.discount_code ? ` (the ${booking.discount_label || booking.discount_code} applies again)` : ''}.
            </p>
            <Check checked={form.custom_price} onChange={(v) => set('custom_price', v)} label="Set a custom price instead" />
            {form.custom_price ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Final price the customer pays ($)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.price_override}
                  onChange={(e) => set('price_override', e.target.value)}
                />
                <Input
                  label="Why (internal)"
                  value={form.price_override_reason}
                  onChange={(e) => set('price_override_reason', e.target.value)}
                  placeholder="e.g. returning customer"
                />
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <Section title="Notes" subtitle="Internal: the customer never sees them.">
        <Textarea
          label="Notes"
          labelHidden
          rows={3}
          value={form.admin_notes}
          onChange={(e) => set('admin_notes', e.target.value)}
        />
      </Section>

      {creating ? (
        <Check
          checked={form.send_confirmation}
          onChange={(v) => set('send_confirmation', v)}
          label="Email the confirmation and the waiver link now"
          hint="Uncheck it to just hold the date: send the email later from the booking’s page."
        />
      ) : (
        <Check
          checked={form.notify_customer}
          onChange={(v) => set('notify_customer', v)}
          label="Email the customer the updated booking"
          hint="Sends “Your booking was updated” with the changes, and the waiver link if a new rider has to sign."
        />
      )}

      {preview ? (
        <Section title="Saving will">
          {preview.changes.length ? (
            <ul className="divide-y divide-hairline">
              {previewLines(preview, booking?.remaining_balance_due_at ?? null).map((line) => (
                <li key={line.key} className="flex items-start gap-2 py-2 text-sm text-fg-2 first:pt-0">
                  {line.attention ? <StatusBadge meta={NEEDS_ATTENTION} size="sm" /> : null}
                  <span className="min-w-0 break-words">{line.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-2">Nothing changed: there is nothing to save.</p>
          )}
        </Section>
      ) : null}

      <div className="space-y-3 border-t border-hairline pt-5">
        {error ? (
          <p role="alert" className="text-sm text-tone-red">
            {error}
          </p>
        ) : null}
        {props.mode === 'create' ? (
          <Button type="submit" loading={busy}>
            {busy ? 'Creating…' : 'Create booking'}
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>
              {manual || reviewed ? (busy ? 'Saving…' : 'Save changes') : busy ? 'Checking…' : 'Review changes'}
            </Button>
            <Link href={props.backHref} className={buttonClasses('secondary', 'md')}>
              Cancel
            </Link>
          </div>
        )}
        {!manual && !reviewed ? (
          <p className="text-xs text-fg-muted">Nothing is saved until you review the changes and save them.</p>
        ) : null}
      </div>
    </form>
  );
}
