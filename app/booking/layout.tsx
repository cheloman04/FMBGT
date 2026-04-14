import Image from 'next/image';
import Link from 'next/link';
import { BookingFrame } from '@/components/BookingFrame';
import { BookingProvider } from '@/context/BookingContext';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border py-4">
          <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <Image
                src="https://nhgpxegozgljqebxqtnq.supabase.co/storage/v1/object/public/images/logos/fmbgt-logo.png"
                alt="Florida MTB Guided Tours"
                width={48}
                height={48}
                className="object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Florida Mountain Bike Trail Guided Tours
                </h1>
                <p className="text-sm text-muted-foreground">Secure Booking</p>
              </div>
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <BookingFrame>{children}</BookingFrame>
      </div>
    </BookingProvider>
  );
}
