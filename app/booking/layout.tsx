import Image from 'next/image';
import { BookingProvider } from '@/context/BookingContext';
import { BookingStepper } from '@/components/BookingStepper';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border py-4">
          <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
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
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">
          <BookingStepper />
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </BookingProvider>
  );
}
