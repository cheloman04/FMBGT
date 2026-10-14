'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Button, Input, PageHeader, PasswordInput } from '@/components/kit';

// `next` is set by middleware.ts. Only same-origin /admin paths are honored, so the
// login page can't be used to bounce someone to another site.
function safeNextPath(raw: string | null): string {
  if (!raw) return '/admin';
  try {
    const base = 'http://admin.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base) return '/admin';
    if (!/^\/admin(\/|$)/.test(url.pathname) || url.pathname.startsWith('/admin/login')) return '/admin';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/admin';
  }
}

// Set by the admin's API client and the panel guard when the session ran out (?expired=1).
function SessionExpiredNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get('expired') !== '1') return null;
  return (
    <p role="status" className="mb-5 rounded-lg border border-tone-amber/30 bg-tone-amber/10 px-3 py-2 text-sm text-tone-amber">
      Your session expired. Sign in again to continue.
    </p>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();
  // Starts empty: pre-filling it showed the admin username to anyone on this page.
  // The browser's own autofill (autoComplete="username") still fills it in.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // Read at submit time so the form itself doesn't need a Suspense boundary.
        router.push(safeNextPath(new URLSearchParams(window.location.search).get('next')));
        return;
      }
      setError('Incorrect email or password. Try again.');
    } catch {
      setError('Connection error. Try again.');
    }
    setLoading(false);
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Sign in" subtitle="The dashboard of Florida Mountain Bike Trail Guided Tours." />
      <Suspense fallback={null}>
        <SessionExpiredNotice />
      </Suspense>
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
        <PasswordInput
          label="Password"
          required
          autoComplete="current-password"
          showLabel="Show password"
          hideLabel="Hide password"
          value={password}
          onChange={setPassword}
        />
        {error ? (
          <p role="alert" className="text-sm text-tone-red">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={loading} disabled={!email || !password} layout="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <Link
        href="/admin/forgot-password"
        className="mt-5 inline-block text-sm font-medium text-fg-2 underline underline-offset-2 hover:text-fg"
      >
        Forgot your password?
      </Link>
    </>
  );
}
