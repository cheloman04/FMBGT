'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'floridamountainbikeguides@gmail.com';

export default function AdminForgotPasswordPage() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');
    setError('');

    try {
      const redirectTo =
        typeof window === 'undefined'
          ? undefined
          : `${window.location.origin}/admin/reset-password`;

      const supabase = getSupabaseClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(ADMIN_EMAIL, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setStatus('Password reset email sent. Check the admin inbox for the recovery link.');
      }
    } catch {
      setError('Unable to send reset email right now. Please try again.');
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
          <h1 className="text-2xl font-bold text-foreground leading-tight">Reset Admin Password</h1>
          <p className="text-muted-foreground mt-2 text-sm">{ADMIN_EMAIL}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-sm text-muted-foreground">
              We&apos;ll send a secure password reset link to the admin email above.
            </p>

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
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Sending...' : 'Send Reset Email'}
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
