'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-green-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-8">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/booking"
          className={cn(buttonVariants({ variant: 'default' }), 'bg-green-600 hover:bg-green-700 text-white')}
        >
          Book a Tour
        </Link>
      </div>
    </div>
  );
}
