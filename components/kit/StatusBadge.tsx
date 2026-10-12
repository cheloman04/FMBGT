import { cx } from "./cx";
import { TONE_CLASSES, type StatusMeta } from "./status";

/** La única forma de pintar un estado (§6.2): un punto y la etiqueta, en un badge del tono. */
export function StatusBadge({
  meta,
  size = "md",
  dot = true,
}: {
  meta: StatusMeta;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tone.bg,
        tone.text,
      )}
    >
      {dot ? <span aria-hidden="true" className={cx("h-1.5 w-1.5 rounded-full", tone.dot)} /> : null}
      {meta.label}
    </span>
  );
}
