'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, Modal, Select, useAction } from '@/components/kit';
import { api } from '@/lib/admin/api';

// "Send a test email" (lib/admin/email-test.ts): one of the eight customer emails,
// with sample data, to an address the operator types — through Kigaru, the way a
// guest would get it, without a booking or n8n. The result stays next to the button
// (§8.5) and the email shows up in the list below within a minute.

type Option = { value: string; label: string };

const TRAILS: Option[] = [
  { value: 'paved', label: 'Paved trail' },
  { value: 'mtb', label: 'Mountain bike' },
];

export function TestEmailButton({ options }: { options: Option[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(options[0]?.value ?? '');
  const [trail, setTrail] = useState(TRAILS[0].value);
  const [to, setTo] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const send = useAction(
    (body: { email: string; trail: string; to: string }) => api.post<{ state: string; message: string }>('/api/admin/emails/test', body),
    {
      // The list re-reads itself; a server refresh would only ask the hub again.
      refresh: false,
      onSuccess: (data) => {
        setDone(data?.message ?? 'Sent.');
        setOpen(false);
      },
    },
  );

  function start() {
    setOpen(true);
    setProblem(null);
    setDone(null);
    send.clearError();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = to.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return setProblem('Type a full email address.');
    setProblem(null);
    await send.run({ email, trail, to: address });
  }

  return (
    <div className="flex flex-col items-end gap-1 max-sm:w-full">
      {/* Full width on the phone, like every header action (§1). */}
      <Button variant="secondary" size="sm" layout="max-sm:w-full" onClick={start}>
        Send a test email
      </Button>
      {done ? (
        <p role="status" className="text-xs text-fg-2">
          {done}
        </p>
      ) : null}

      <Modal
        open={open}
        onClose={() => (send.pending ? undefined : setOpen(false))}
        title="Send a test email"
        footer={
          <>
            <Button variant="secondary" disabled={send.pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="test-email" variant="primary" loading={send.pending}>
              Send test
            </Button>
          </>
        }
      >
        {/* noValidate: the browser's own bubble would hide the inline error (§8.5). */}
        <form id="test-email" onSubmit={submit} noValidate className="space-y-4">
          <p className="text-sm text-fg-2">
            Sends the email exactly as a guest gets it, with sample details and &quot;[Test]&quot; in the subject. It goes
            through Kigaru and shows up in the list below. No booking, lead or guest is involved.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Email" value={email} onChange={(e) => setEmail(e.target.value)}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select label="Ride" value={trail} onChange={(e) => setTrail(e.target.value)}>
              {TRAILS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Send to"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="you@example.com"
            hint="A marketing test (follow-ups, review requests) has an Unsubscribe link: clicking it stops marketing emails to that address."
            error={problem ?? undefined}
            autoFocus
          />
          {send.error ? (
            <p role="alert" className="text-xs text-tone-red">
              {send.error}
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
