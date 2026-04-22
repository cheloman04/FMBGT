'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

type AdminTopBarProps = {
  activePage: 'dashboard' | 'fin-log';
  title: string;
  subtitle: string;
};

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin' },
  { key: 'fin-log', label: 'Fin Log', href: '/admin/fin-log' },
] as const;

function navClassName(isActive: boolean) {
  return [
    'rounded-xl border px-3.5 py-2 text-center text-sm font-medium transition-colors',
    isActive
      ? 'border-green-500/35 bg-green-500/12 text-foreground'
      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
  ].join(' ');
}

export function AdminTopBar({ activePage, title, subtitle }: AdminTopBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    window.location.href = '/admin/login';
  };

  return (
    <div className="mb-5 rounded-2xl border border-border/70 bg-card/88 p-4 shadow-[0_18px_40px_rgba(23,26,20,0.08)] backdrop-blur-sm sm:mb-8 sm:p-5 dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Image
              src="https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png"
              alt="Florida MTB Guided Tours"
              width={52}
              height={52}
              className="h-11 w-11 rounded-xl object-contain shadow-[0_10px_24px_rgba(0,0,0,0.2)] sm:h-[52px] sm:w-[52px]"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={navClassName(activePage === item.key)}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/admin/forgot-password" className={navClassName(false)}>
              Change Password
            </Link>
            <button onClick={handleLogout} className={navClassName(false)}>
              Sign Out
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-expanded={isMenuOpen}
              aria-label="Toggle admin menu"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/75 p-3 md:hidden">
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 px-3 py-2">
              <span className="text-sm font-medium text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={navClassName(activePage === item.key)}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/admin/forgot-password"
              className={navClassName(false)}
              onClick={() => setIsMenuOpen(false)}
            >
              Change Password
            </Link>
            <button onClick={handleLogout} className={navClassName(false)}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
