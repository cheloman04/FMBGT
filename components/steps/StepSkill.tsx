'use client';

import Image from 'next/image';
import { useBooking } from '@/context/BookingContext';
import type { SkillLevel } from '@/types/booking';
import { Button } from '@/components/ui/button';

const SKILL_OPTIONS: Array<{
  level: SkillLevel;
  label: string;
  description: string;
  image: string;
}> = [
  {
    level: 'first_time',
    label: 'First Time Rider',
    description: "Never ridden a mountain bike before. Our guides will introduce you to the basics and help you feel comfortable on the trail.",
    image: '/trails/skill-first-time.svg',
  },
  {
    level: 'beginner',
    label: 'Beginner',
    description: 'Some experience riding bikes. Suitable for easy trails with gentle terrain and basic obstacles.',
    image: '/trails/skill-beginner.svg',
  },
  {
    level: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable riding on trails with roots, climbs, and moderate technical terrain.',
    image: '/trails/skill-intermediate.svg',
  },
  {
    level: 'advanced',
    label: 'Advanced',
    description: 'For experienced riders comfortable with steep climbs, drops, and technical trail features.',
    image: '/trails/skill-advanced.svg',
  },
];

export function StepSkill() {
  const { setSkillLevel, goNext, goPrev } = useBooking();

  const handleSelect = (level: SkillLevel) => {
    setSkillLevel(level);
    goNext();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">What&apos;s Your Skill Level?</h2>
        <p className="text-muted-foreground mt-1">
          We&apos;ll match you with the best trail for your experience.
        </p>
      </div>

      <Button variant="ghost" onClick={goPrev} className="mb-4 text-muted-foreground">
        ← Back
      </Button>

      <div className="grid gap-4 sm:grid-cols-2">
        {SKILL_OPTIONS.map((option) => (
          <div
            key={option.level}
            className="flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden
                       transition-all duration-250 ease-in-out cursor-pointer
                       hover:border-green-500 hover:shadow-lg hover:-translate-y-1"
            onClick={() => handleSelect(option.level)}
          >
            {/* Image */}
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={option.image}
                alt={option.label}
                fill
                className="object-cover"
              />
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 p-4 gap-3">
              <h3 className="font-semibold text-sm leading-snug text-foreground">{option.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{option.description}</p>
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 text-white text-xs mt-1"
                onClick={(e) => { e.stopPropagation(); handleSelect(option.level); }}
              >
                Select
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
