import Link from "next/link";
import { IconChevronLeft } from "./_icons";

/**
 * La vuelta a la lista desde una página de detalle (§5.5), encima del
 * `PageHeader`. Nombra el DESTINO ("Bookings"), no la acción ("Back").
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60 max-sm:min-h-11"
    >
      <IconChevronLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
