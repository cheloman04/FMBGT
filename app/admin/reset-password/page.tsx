'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabase';

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
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const tokenPayload = useMemo(() => readTokenPayload(), []);

  useEffect(() => {
    let active = true;

    const prepareSession = async () => {
      if (!tokenPayload) {
        setError('This reset link is missing required tokens. Request a new password reset email.');
        return;
      }

      const supabase = getSupabaseClient();
      const { error: sessionError } = await supabase.auth.setSession(tokenPayload);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReady) return;

    setError('');
    setStatus('');

    if (password.length < 8) {
      setError('Use at least 8 characters for the new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setStatus('Password updated successfully. You can now sign in to the admin dashboard.');
      }
    } catch {
      setError('Unable to update the password right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png"
              alt="Florida Mountain Bike Trail Guided Tours"
              width={80}
              height={80}
              className="rounded-xl"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Create New Admin Password</h1>
          <p className="text-muted-foreground mt-2 text-sm">Choose a new password for the admin account.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            {status && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                {status}
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !sessionReady}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link href="/admin/login" className="text-sm font-medium text-green-600 hover:text-green-700">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
