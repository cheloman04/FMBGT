// El menú de un área como DATOS (§5.2): orden, etiquetas, badge y feature.
// Los iconos van aparte, en un `Record<Href, ReactNode>` que `tsc` obliga a que
// sea exhaustivo; así reordenar el menú solo se hace en el `nav.ts` del área, que
// es el fichero que su test vigila.
//
// 🪤 Sin imports relativos: los tests lo cargan con Node tal cual (`.ts`).

export type NavItem<H extends string = string> = {
  href: H;
  label: string;
  /** Clave del badge de esta entrada (`"leads"`, `"actions"`), si lleva contador. */
  badge?: string;
  /** La entrada solo se ve si esta feature está activa (`visibleNav`). */
  feature?: string;
  /**
   * Activa solo con la ruta EXACTA. Para la entrada raíz del área (`/admin`), que
   * si no estaría activa en todas sus subrutas.
   */
  exact?: boolean;
};

/**
 * Declara el menú conservando los `href` como literales, para que el mapa de
 * iconos se pueda tipar con ellos:
 *
 *   export const ADMIN_NAV = defineNav([
 *     { href: "/admin", label: "Overview", exact: true },
 *     { href: "/admin/bookings", label: "Bookings" },
 *     { href: "/admin/leads", label: "Leads", badge: "leads" },
 *   ]);
 *   export type AdminHref = NavHref<typeof ADMIN_NAV>;
 */
export function defineNav<const T extends readonly NavItem[]>(items: T): T {
  return items;
}

export type NavHref<T extends readonly NavItem[]> = T[number]["href"];

/**
 * ¿Esta entrada es la activa? Por segmentos, no por prefijo de texto:
 * `/admin/crm` no se enciende en `/admin/crm-imports`.
 */
export function isNavActive(pathname: string, item: { href: string; exact?: boolean }): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === item.href) return true;
  return !item.exact && path.startsWith(`${item.href}/`);
}

/** Las entradas visibles con estas features activas; las que no piden ninguna, siempre. */
export function visibleNav<T extends NavItem>(items: readonly T[], features: Iterable<string> = []): T[] {
  const on = new Set(features);
  return items.filter((item) => !item.feature || on.has(item.feature));
}

/** Un contador del menú. */
export type NavBadgeValue = {
  count: number;
  /** `red` = algo falló o es urgente; `amber` = pide atención; `accent` = novedad. */
  tone?: "red" | "amber" | "accent";
  /** El recuento no se pudo completar: se pinta "N+" (o "!" si es 0). */
  incomplete?: boolean;
};

export type NavBadges = Partial<Record<string, NavBadgeValue>>;

/** El texto del badge, o `null` si no hay que pintarlo. */
export function badgeText(value: NavBadgeValue | undefined): string | null {
  if (!value) return null;
  if (value.incomplete) return value.count > 0 ? `${Math.min(value.count, 99)}+` : "!";
  if (value.count <= 0) return null;
  return value.count > 99 ? "99+" : String(value.count);
}

/**
 * El evento con el que una isla avisa de que los contadores del menú pueden haber
 * cambiado (marcó un lead como atendido, archivó una reserva). El shell vuelve a
 * pedirlos. Lo dispara `notifyBadgesChanged()` o `useAction({ badges: true })`.
 */
export const BADGES_CHANGED_EVENT = "kit:badges-changed";

export function notifyBadgesChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BADGES_CHANGED_EVENT));
}
