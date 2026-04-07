import { ArrowRight } from "lucide-react";

export function CTAButton({
  children,
  secondary = false,
  href = '/booking',
  trackLocation = 'unknown',
  onClick,
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      data-track="cta_click"
      data-location={trackLocation}
      className={
        secondary
          ? "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#cfc3ad] bg-white/60 px-5 py-3 text-sm font-semibold text-[#183328] transition hover:bg-white"
          : "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1f5a43] px-5 py-3 text-sm font-semibold text-[#f8f3e8] transition hover:-translate-y-0.5 hover:bg-[#174b37]"
      }
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}
