import { BookingProvider } from '@/context/BookingContext';
import { BookingStepper } from '@/components/BookingStepper';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 py-4">
          <div className="max-w-3xl mx-auto px-4">
            <h1 className="text-xl font-bold text-gray-900">
              Florida Mountain Bike Trail Guided Tours
            </h1>
            <p className="text-sm text-gray-500">Secure Booking</p>
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
