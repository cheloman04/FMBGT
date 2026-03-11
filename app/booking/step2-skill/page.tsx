'use client';

import { useRouter } from 'next/navigation';
import { useBooking } from '@/context/BookingContext';
import type { SkillLevel } from '@/types/booking';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const SKILL_OPTIONS: Array<{
  level: SkillLevel;
  label: string;
  description: string;
  emoji: string;
}> = [
  {
    level: 'first_time',
    label: 'First Time Rider',
    description: 'Never ridden a mountain bike before. We\'ll guide you every step.',
    emoji: '🌱',
  },
  {
    level: 'beginner',
    label: 'Beginner',
    description: 'Some experience on flat trails. Comfortable with basic bike handling.',
    emoji: '⭐',
  },
  {
    level: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable on trails with obstacles. Can handle moderate terrain.',
    emoji: '⭐⭐',
  },
  {
    level: 'advanced',
    label: 'Advanced',
    description: 'Experienced rider comfortable with technical terrain and obstacles.',
    emoji: '⭐⭐⭐',
  },
];

export default function Step2SkillPage() {
  const router = useRouter();
  const { setSkillLevel } = useBooking();

  const handleSelect = (level: SkillLevel) => {
    setSkillLevel(level);
    router.push('/booking/step3-location');
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">What&apos;s Your Skill Level?</h2>
        <p className="text-gray-500 mt-1">
          We&apos;ll match you with the best trail for your experience.
        </p>
      </div>

      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4 text-gray-500"
      >
        ← Back
      </Button>

      <div className="grid gap-4 sm:grid-cols-2">
        {SKILL_OPTIONS.map((option) => (
          <button
            key={option.level}
            onClick={() => handleSelect(option.level)}
            className="text-left focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg"
          >
            <Card className="h-full hover:border-green-500 hover:shadow-md transition-all cursor-pointer">
              <CardHeader>
                <div className="text-2xl mb-1">{option.emoji}</div>
                <CardTitle className="text-base">{option.label}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
