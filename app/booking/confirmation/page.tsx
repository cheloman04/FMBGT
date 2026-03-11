'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useBooking } from '@/context/BookingContext';
import { cn } from '@/lib/utils';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const { reset } = useBooking();
  const bookingId = searchParams.get('booking_id');

  useEffect(() => {
    // Reset booking state after confirmation
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
      <p className="text-gray-500 mb-2">
        Your guided tour is booked. Get ready to ride!
      </p>

      {bookingId && (
        <p className="text-sm text-gray-400 mb-6">
          Booking ID: <span className="font-mono font-medium text-gray-600">{bookingId}</span>
        </p>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-5 max-w-md mx-auto mb-8 text-left">
        <h3 className="font-semibold text-green-900 mb-3">What happens next?</h3>
        <ul className="space-y-2 text-sm text-green-800">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">📧</span>
            <span>A confirmation email has been sent to you with your booking details.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">📅</span>
            <span>A calendar invite will be sent so you don&apos;t forget your ride.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">📞</span>
            <span>Our team will reach out 24 hours before your tour with meeting point details.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">🚴</span>
            <span>Wear comfortable clothing and closed-toe shoes. Helmets are provided.</span>
          </li>
        </ul>
      </div>

      <div className="flex gap-3 justify-center">
        <Link
          href="/booking/step1-trail"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Book Another Tour
        </Link>
        <a
          href="https://floridamtbguidedtours.com"
          className={cn(buttonVariants({ variant: 'default' }), 'bg-green-600 hover:bg-green-700 text-white')}
        >
          Return to Website
        </a>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-500">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
