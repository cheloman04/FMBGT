import { Compass } from "lucide-react";

export function SectionHeading({ eyebrow, title, text, center = false }) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-[#efe7d7] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900">
        <Compass className="h-3.5 w-3.5" />
        {eyebrow}
      </div>
      <h2 className="text-3xl font-bold tracking-tight text-[#10261d] sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-[#4d5d56] sm:text-lg">{text}</p>
    </div>
  );
}
