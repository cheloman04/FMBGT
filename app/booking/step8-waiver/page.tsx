'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBooking } from '@/context/BookingContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function Step8WaiverPage() {
  const router = useRouter();
  const { setWaiverAccepted } = useBooking();
  const [accepted, setAccepted] = useState(false);

  const handleContinue = () => {
    if (!accepted) return;
    setWaiverAccepted(true);
    router.push('/booking/step9-payment');
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Terms &amp; Liability Waiver</h2>
        <p className="text-gray-500 mt-1">Please read and accept before proceeding to payment.</p>
      </div>

      <Button variant="ghost" onClick={() => router.back()} className="mb-4 text-gray-500">
        ← Back
      </Button>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 max-h-96 overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-3">Liability Waiver &amp; Release of Claims</h3>

        <div className="prose prose-sm text-gray-600 space-y-4">
          <p>
            By participating in any guided bicycle tour operated by Florida Mountain Bike Trail
            Guided Tours (&quot;Company&quot;), you acknowledge and agree to the following terms:
          </p>

          <h4 className="font-semibold text-gray-800">1. Assumption of Risk</h4>
          <p>
            Mountain biking and cycling activities involve inherent risks, including but not limited
            to falls, collisions, equipment failure, and unpredictable trail conditions. You
            voluntarily assume all risks associated with participation in this activity.
          </p>

          <h4 className="font-semibold text-gray-800">2. Release of Liability</h4>
          <p>
            You hereby release, discharge, and covenant not to sue Florida Mountain Bike Trail
            Guided Tours, its owners, employees, agents, guides, and affiliates from any and all
            claims, demands, damages, costs, and causes of action arising from your participation
            in any guided tour.
          </p>

          <h4 className="font-semibold text-gray-800">3. Medical Acknowledgment</h4>
          <p>
            You certify that you are physically capable of participating in bicycle activities and
            are not aware of any medical conditions that would prevent safe participation. You
            agree to immediately inform your guide of any physical limitations.
          </p>

          <h4 className="font-semibold text-gray-800">4. Equipment &amp; Helmet Policy</h4>
          <p>
            Helmets are mandatory for all participants. Rental equipment must be inspected before
            use. You are responsible for reporting any equipment issues to your guide immediately.
          </p>

          <h4 className="font-semibold text-gray-800">5. Cancellation Policy</h4>
          <p>
            Cancellations made 48+ hours in advance receive a full refund. Cancellations within
            24–48 hours receive a 50% refund. No refunds for cancellations within 24 hours or
            no-shows. Tours cancelled by the Company due to unsafe conditions will receive a
            full refund or reschedule option.
          </p>

          <h4 className="font-semibold text-gray-800">6. Photo &amp; Media Release</h4>
          <p>
            Unless otherwise requested in writing, you grant the Company permission to use
            photographs or videos taken during your tour for promotional purposes.
          </p>

          <h4 className="font-semibold text-gray-800">7. Governing Law</h4>
          <p>
            This agreement is governed by the laws of the State of Florida. Any disputes shall
            be resolved in the courts of Orange County, Florida.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Checkbox
          id="waiver"
          checked={accepted}
          onCheckedChange={(checked) => setAccepted(!!checked)}
          className="mt-0.5"
        />
        <Label htmlFor="waiver" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
          I have read and understand the Liability Waiver &amp; Terms of Service. I voluntarily
          agree to all terms and conditions, and I am 18 years of age or older (or have guardian
          consent).
        </Label>
      </div>

      <Button
        onClick={handleContinue}
        disabled={!accepted}
        className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        size="lg"
      >
        Accept &amp; Continue to Payment
      </Button>
    </div>
  );
}
