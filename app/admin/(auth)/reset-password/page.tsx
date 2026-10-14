'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BackLink, Button, PageHeader, PasswordInput, buttonClasses } from '@/components/kit';
import { getSupabaseClient } from '@/lib/supabase';

// Where the reset email's link lands: its tokens come in the hash (or the query).
function readTokenPayload() {
  if (typeof window === 'undefined') return null;

  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const fromQuery = new URLSearchParams(window.location.search);
  const access_token = fromHash.get('access_token') ?? fromQuery.get('access_token');
  const refresh_token = fromHash.get('refresh_token') ?? fromQuery.get('refresh_token');

  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export default function AdminResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const tokenPayload = useMemo(() => readTokenPayload(), []);

  useEffect(() => {
    let active = true;

    const prepareSession = async () => {
      if (!tokenPayload) {
        setError('This reset link is missing its tokens. Request a new reset email.');
        return;
      }

      const { error: sessionError } = await getSupabaseClient().auth.setSession(tokenPayload);
      if (!active) return;

      if (sessionError) {
        setError('This reset link is invalid or expired. Request a new one.');
        return;
      }

      setSessionReady(true);
    };

    void prepareSession();
    return () => {
      active = false;
    };
  }, [tokenPayload]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!sessionReady) return;

    setError('');
    if (password.length < 8) return setError('Use at least 8 characters for the new password.');
    if (password !== confirmPassword) return setError('The two passwords don’t match.');

    setLoading(true);
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password });
      if (updateError) setError(updateError.message);
      else setDone(true);
    } catch {
      setError('The password could not be updated right now. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <PageHeader eyebrow="Admin" title="Password updated" subtitle="Sign in with the new password." />
        <Link href="/admin/login" className={buttonClasses('primary', 'md', 'w-full')}>
          Sign in
        </Link>
      </>
    );
  }

  // A link that can't be used (no tokens, expired, already used): no form, the way to a new one.
  if (error && !sessionReady) {
    return (
      <>
        <BackLink href="/admin/login" label="Sign in" />
        <PageHeader eyebrow="Admin" title="Set a new password" />
        <p role="alert" className="mb-4 text-sm text-tone-red">
          {error}
        </p>
        <Link href="/admin/forgot-password" className={buttonClasses('primary', 'md', 'w-full')}>
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <BackLink href="/admin/login" label="Sign in" />
      <PageHeader eyebrow="Admin" title="Set a new password" subtitle="At least 8 characters." />
      <form onSubmit={onSubmit} className="space-y-4">
        <PasswordInput
          label="New password"
          required
          autoComplete="new-password"
          showLabel="Show password"
          hideLabel="Hide password"
          value={password}
          onChange={setPassword}
        />
        <PasswordInput
          label="Confirm the new password"
          required
          autoComplete="new-password"
          showLabel="Show password"
          hideLabel="Hide password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
        {error ? (
          <p role="alert" className="text-sm text-tone-red">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={loading} disabled={!sessionReady} layout="w-full">
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </>
  );
}
