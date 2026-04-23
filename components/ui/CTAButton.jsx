import { ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";

// ctaLocation: identifies where on the page this CTA appears (for GA4 cta_clicked segmentation)
export function CTAButton({ children, secondary = false, href = '/booking', ctaLocation = 'unknown', trackLocation, onClick }) {
  const location = ctaLocation !== 'unknown' ? ctaLocation : (trackLocation ?? 'unknown');

  const handleClick = (e) => {
    if (href.startsWith('/booking') || href === '/booking') {
      track('cta_clicked', {
        cta_text: typeof children === 'string' ? children : 'Book',
        cta_location: location,
        destination: href,
      });
    }
    if (onClick) onClick(e);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
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
