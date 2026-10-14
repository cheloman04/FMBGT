import Image from 'next/image';
import type { ReactNode } from 'react';

// Sign in, forgot and reset password: outside the guard (the middleware lets
// them through) and outside the shell. One narrow column on the admin's canvas:
// the logo, the page (its PageHeader and its form) and the name underneath.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <Image
          src="https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png"
          alt="Florida Mountain Bike Trail Guided Tours"
          width={64}
          height={64}
          className="mb-6 rounded-xl"
          priority
        />
        {children}
        <p className="mt-10 text-xs text-fg-muted">Florida Mountain Bike Trail Guided Tours &copy; {new Date().getFullYear()}</p>
      </div>
    </main>
  );
}
