/** Marks a ride that is announced but not bookable yet (data/trails.ts `comingSoon`). */
export function ComingSoonBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ${className}`}
    >
      Coming soon
    </span>
  );
}
