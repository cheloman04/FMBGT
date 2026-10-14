'use client';

import { useState, type FormEvent } from 'react';
import { BackLink, Button, Input, PageHeader } from '@/components/kit';
import { getSupabaseClient } from '@/lib/supabase';

// Also the shell's "Change password": the link lands on reset-password.
export default function AdminForgotPasswordPage() {
  // Starts empty so the page doesn't show the admin username (browser autofill still works).
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setSent(false);
    setError('');
    try {
      const { error: resetError } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (resetError) setError(resetError.message);
      else setSent(true);
    } catch {
      setError('The reset email could not be sent right now. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BackLink href="/admin/login" label="Sign in" />
      <PageHeader eyebrow="Admin" title="Reset your password" subtitle="We’ll email a link to set a new one." />
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          required
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {sent ? (
          <p role="status" className="text-sm text-fg-2">
            If that email belongs to an admin account, the reset link is on its way.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-tone-red">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={loading} disabled={!email} layout="w-full">
          {loading ? 'Sending…' : 'Send the reset link'}
        </Button>
      </form>
    </>
  );
}
