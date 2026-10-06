import type { Difficulty, Trail } from '@/data/trails';

/** Marker color and badge classes per rating, shared by the map and the trail carousel. */
export const DIFFICULTY_STYLE: Record<Difficulty, { color: string; badge: string }> = {
  'First Time':   { color: '#10b981', badge: 'bg-emerald-100 text-emerald-800' },
  Beginner:       { color: '#1f7a54', badge: 'bg-teal-100 text-teal-800' },
  Intermediate:   { color: '#d97706', badge: 'bg-amber-100 text-amber-800' },
  Advanced:       { color: '#dc2626', badge: 'bg-red-100 text-red-800' },
};

/** Paved routes are rated First Time, but "Paved" tells a rider more about them. */
export function badgeLabel(trail: Trail): string {
  return trail.terrain === 'paved' ? 'Paved' : trail.difficulty;
}
