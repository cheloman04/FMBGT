import { formatDateTime, formatRelative } from "./time";

/**
 * "3h ago" con la hora completa al pasar por encima (`title`).
 *
 * Ambas en la zona del NEGOCIO (`timeZone`), no en la de quien mira (§8.7). "Hace
 * N" se calcula al pintar, así que servidor e hidratación pueden discrepar por
 * segundos: de ahí `suppressHydrationWarning`.
 */
export function RelativeTime({
  iso,
  timeZone,
  locale = "en-US",
}: {
  iso: string | null | undefined;
  /** Zona IANA del negocio, p. ej. "America/New_York". */
  timeZone?: string;
  locale?: string;
}) {
  if (!iso) return <span>—</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso, timeZone, locale)} suppressHydrationWarning>
      {formatRelative(iso, { timeZone, locale })}
    </time>
  );
}
