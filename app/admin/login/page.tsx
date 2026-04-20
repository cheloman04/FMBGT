'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const ADMIN_EMAIL = 'floridamountainbikeguides@gmail.com';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push('/admin');
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo + Branding */}
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
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            Welcome to Florida Mountain Bike Trail Guided Tours
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Client&apos;s Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Admin Email
              </label>
              <input
                id="email"
                type="email"
                readOnly
                value={email}
                className="w-full border border-input bg-muted text-foreground rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link href="/admin/forgot-password" className="text-sm font-medium text-green-600 hover:text-green-700">
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Florida Mountain Bike Trail Guided Tours &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
