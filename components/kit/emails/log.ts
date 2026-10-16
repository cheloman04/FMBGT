// =============================================================================
// Los correos del negocio — la lógica pura de la isla y sus textos
// =============================================================================
// Lo que decide la isla sin tocar la red: qué vista pide la URL, cómo se funde un
// refresco con lo ya cargado, qué color lleva cada estado y qué dice cada texto.
// Separado para probarlo con Node tal cual.
//
// 🪤 Sin imports relativos de valor (solo `import type`): los tests lo cargan con
// Node tal cual. Por eso los segmentos y los periodos están repetidos en
// `server.ts`, y un test comprueba que las dos copias dicen lo mismo.
// =============================================================================

import type { StatusMeta } from "../status";
import type { EmailItem, EmailPeriod, EmailSegment, EmailView, EmailsData } from "./types";

/** El orden de la tira de arriba. */
export const EMAIL_SEGMENTS: readonly EmailSegment[] = ["all", "delivered", "sending", "problems", "not_sent"];

/** El orden del selector de periodo. */
export const EMAIL_PERIODS: readonly EmailPeriod[] = ["7d", "30d", "90d", "all"];

/** Lo que se ve sin filtros: todo lo del último mes. */
export const DEFAULT_EMAIL_VIEW: EmailView = { segment: "all", type: null, period: "30d", to: null };

/** Cuántas filas por página (el tope del hub es 100). */
export const EMAILS_PAGE_SIZE = 50;

const EMAIL_TYPE = /^[a-z][a-z0-9_]{0,63}$/;
const ADDRESS = /^[^@\s]+@[^@\s]+$/;

/** ¿Parece una dirección? Lo mismo que acepta el filtro `to` del hub. */
export function isEmailAddress(value: string): boolean {
  return value.length <= 254 && ADDRESS.test(value);
}

type ParamSource = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function read(source: ParamSource, name: string): string | null {
  if (typeof (source as { get?: unknown }).get === "function") return (source as { get(n: string): string | null }).get(name);
  const value = (source as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export type EmailParamNames = { segment: string; type: string; period: string; to: string };

export const EMAIL_PARAMS: EmailParamNames = { segment: "segment", type: "type", period: "period", to: "to" };

/**
 * La vista que pide la URL. Lo que no se entiende cae al valor por defecto: un
 * enlace viejo o tecleado a mano abre la lista, no un error. (La ruta proxy, en
 * cambio, contesta 400: quien la llama es la isla, que solo manda valores buenos.)
 */
export function parseEmailView(source: ParamSource, names: EmailParamNames = EMAIL_PARAMS): EmailView {
  const segment = read(source, names.segment);
  const type = read(source, names.type)?.trim() ?? "";
  const period = read(source, names.period);
  const to = read(source, names.to)?.trim().toLowerCase() ?? "";
  return {
    segment: (EMAIL_SEGMENTS as readonly string[]).includes(segment ?? "") ? (segment as EmailSegment) : DEFAULT_EMAIL_VIEW.segment,
    type: EMAIL_TYPE.test(type) ? type : null,
    period: (EMAIL_PERIODS as readonly string[]).includes(period ?? "") ? (period as EmailPeriod) : DEFAULT_EMAIL_VIEW.period,
    to: to && isEmailAddress(to) ? to : null,
  };
}

/** Una clave por vista: dos vistas con la misma clave piden lo mismo. */
export function emailViewKey(view: EmailView): string {
  return [view.segment, view.type ?? "", view.period, view.to ?? ""].join("|");
}

/** Las cuentas valen para otra vista si solo cambia el segmento: el hub no las parte por estado. */
export function sameCountsScope(a: EmailView, b: EmailView): boolean {
  return a.type === b.type && a.period === b.period && a.to === b.to;
}

/** La URL de la ruta proxy para una vista (`?segment=…&type=…&period=…&to=…`). */
export function emailListUrl(
  endpoint: string,
  view: EmailView,
  { cursor, limit }: { cursor?: string | null; limit?: number } = {},
): string {
  const params = new URLSearchParams();
  if (view.segment !== "all") params.set("segment", view.segment);
  if (view.type) params.set("type", view.type);
  params.set("period", view.period);
  if (view.to) params.set("to", view.to);
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  return `${endpoint}?${params.toString()}`;
}

// -----------------------------------------------------------------------------
// Los textos
// -----------------------------------------------------------------------------

export type EmailsLabels = {
  segmentsLabel: string;
  segments: Record<EmailSegment, string>;
  periodLabel: string;
  periods: Record<EmailPeriod, string>;
  typeLabel: string;
  allTypes: string;
  /** El nombre de cada `email_type` del proyecto. Sin nombre, se lee el identificador («Booking confirmed»). */
  typeNames: Record<string, string>;
  statuses: Record<string, string>;
  /** Lo que significa cada estado, en el detalle. */
  statusHints: Record<string, string>;
  events: Record<string, string>;
  categories: { transactional: string; marketing: string };
  searchLabel: string;
  searchPlaceholder: string;
  search: string;
  clearSearch: string;
  badAddress: string;
  colTo: string;
  colSubject: string;
  colType: string;
  colStatus: string;
  colWhen: string;
  caption: string;
  openEmail: string;
  detailTitle: string;
  detailTo: string;
  detailType: string;
  detailQueued: string;
  detailSent: string;
  detailDelivered: string;
  detailReason: string;
  timeline: string;
  noBodyNote: string;
  close: string;
  refresh: string;
  refreshing: string;
  /** «Couldn't refresh: {reason}». */
  refreshFailed: string;
  /** «Couldn't load more: {reason}». */
  loadMoreFailed: string;
  /** «Couldn't open it: {reason}». */
  detailFailed: string;
  retry: string;
  emptyTitle: string;
  emptyHint: string;
  emptyFilteredTitle: string;
  emptyFilteredHint: string;
  emptyProblemsTitle: string;
  notConfiguredTitle: string;
  notEnabledTitle: string;
  loadFailedTitle: string;
  /** El sustantivo de «Showing N of M …». */
  noun: string;
};

export const EMAILS_LABELS: EmailsLabels = {
  segmentsLabel: "Email status",
  segments: {
    all: "All",
    delivered: "Delivered",
    sending: "Sending",
    problems: "Problems",
    not_sent: "Not sent",
  },
  periodLabel: "Period",
  periods: { "7d": "7 days", "30d": "30 days", "90d": "90 days", all: "All" },
  typeLabel: "Email type",
  allTypes: "All emails",
  typeNames: {},
  statuses: {
    queued: "Queued",
    sent: "Sent",
    delivered: "Delivered",
    bounced: "Bounced",
    complained: "Marked as spam",
    failed: "Failed",
    suppressed: "Not sent",
  },
  statusHints: {
    queued: "Kigaru has it and is sending it now.",
    sent: "The email service accepted it. Waiting for the recipient's server to confirm delivery.",
    delivered:
      "The recipient's email server accepted it. Whether it was opened isn't tracked: open tracking is off on purpose.",
    bounced:
      "The address rejected it. If the bounce is permanent, this address won't receive more emails from your business.",
    complained: "The recipient marked it as spam. This address won't receive more emails from your business.",
    failed: "It couldn't be sent, even after retrying. The reason is below.",
    suppressed:
      "It wasn't sent: this address bounced, marked an email as spam or unsubscribed before. Unsubscribing from marketing emails still lets booking emails through.",
  },
  events: {
    queued: "Queued",
    sent: "Sent",
    delivered: "Delivered",
    delivery_delayed: "Delayed, still trying",
    bounced: "Bounced",
    complained: "Marked as spam",
    failed: "Failed",
    suppressed: "Not sent",
  },
  categories: { transactional: "Booking", marketing: "Marketing" },
  searchLabel: "Find an address",
  searchPlaceholder: "guest@example.com",
  search: "Find",
  clearSearch: "Clear",
  badAddress: "Type a full email address.",
  colTo: "To",
  colSubject: "Subject",
  colType: "Type",
  colStatus: "Status",
  colWhen: "Sent",
  caption: "Emails",
  openEmail: "Open the email to {to}",
  detailTitle: "Email",
  detailTo: "To",
  detailType: "Type",
  detailQueued: "Queued",
  detailSent: "Sent",
  detailDelivered: "Delivered",
  detailReason: "Reason",
  timeline: "What happened",
  noBodyNote: "Kigaru keeps the delivery history, not the email itself.",
  close: "Close",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  refreshFailed: "Couldn't refresh: {reason}",
  loadMoreFailed: "Couldn't load more: {reason}",
  detailFailed: "Couldn't open it: {reason}",
  retry: "Try again",
  emptyTitle: "No emails in this period.",
  emptyHint:
    "Booking confirmations, payment emails, follow-ups and review requests show up here as your site sends them through Kigaru.",
  emptyFilteredTitle: "No emails match these filters.",
  emptyFilteredHint: "Try another period, type or address.",
  emptyProblemsTitle: "No delivery problems in this period.",
  notConfiguredTitle: "This site isn't connected to Kigaru.",
  notEnabledTitle: "Email isn't turned on for this site yet.",
  loadFailedTitle: "Couldn't load the emails.",
  noun: "emails",
};

/** Los textos con los de quien monta encima; los mapas se funden, no se sustituyen. */
export function mergeEmailLabels(overrides?: Partial<EmailsLabels>): EmailsLabels {
  const merged = { ...EMAILS_LABELS, ...overrides };
  for (const key of ["segments", "periods", "typeNames", "statuses", "statusHints", "events", "categories"] as const) {
    (merged as Record<string, unknown>)[key] = { ...EMAILS_LABELS[key], ...overrides?.[key] };
  }
  return merged;
}

export function fillEmail(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** El nombre de un tipo: el del proyecto o, si no lo nombra, el identificador legible. */
export function emailTypeName(type: string, labels: EmailsLabels): string {
  const named = labels.typeNames[type];
  if (named) return named;
  const words = type.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : type;
}

/**
 * El color de cada estado (§6.2): un solo mapa. Verde solo lo que llegó; rojo lo
 * que no llegará; ámbar lo que no se mandó a propósito; azul y gris lo que va de
 * camino.
 */
export function emailStatusMeta(labels: EmailsLabels): Record<string, StatusMeta> {
  const meta = (key: string, tone: StatusMeta["tone"]): StatusMeta => ({ label: labels.statuses[key] ?? key, tone });
  return {
    queued: meta("queued", "gray"),
    sent: meta("sent", "blue"),
    delivered: meta("delivered", "green"),
    bounced: meta("bounced", "red"),
    complained: meta("complained", "red"),
    failed: meta("failed", "red"),
    suppressed: meta("suppressed", "amber"),
  };
}

/**
 * Cuántos hay en la vista que se enseña: la cuenta de su segmento si hay cuentas
 * y, si no, al menos los que se ven (uno más si el hub dice que hay otra página).
 */
export function shownTotal(data: Pick<EmailsData, "view" | "items" | "nextCursor" | "counts">): number {
  const floor = data.items.length + (data.nextCursor ? 1 : 0);
  if (!data.counts) return floor;
  return Math.max(data.counts[data.view.segment], floor);
}

/** El título del vacío según la vista. */
export function emptyTitle(view: EmailView, labels: EmailsLabels): { title: string; hint?: string } {
  if (view.type || view.to) return { title: labels.emptyFilteredTitle, hint: labels.emptyFilteredHint };
  if (view.segment === "problems") return { title: labels.emptyProblemsTitle };
  if (view.segment !== "all") return { title: labels.emptyFilteredTitle, hint: labels.emptyFilteredHint };
  return { title: labels.emptyTitle, hint: labels.emptyHint };
}

// -----------------------------------------------------------------------------
// Fundir páginas
// -----------------------------------------------------------------------------

/**
 * Un refresco (la primera página, otra vez) fundido con lo que ya se ve.
 *
 * El refresco trae lo nuevo de arriba y el estado al día de sus filas (un `sent`
 * que pasó a `delivered`); lo que se cargó más abajo con «Load more» se conserva,
 * sin repetir ninguno. Las cuentas son las del refresco: son las de ahora.
 */
export function mergeRefresh(prev: EmailsData, fresh: EmailsData): EmailsData {
  if (fresh.items.length === 0 || prev.items.length <= fresh.items.length) return fresh;
  const seen = new Set(fresh.items.map((i) => i.id));
  const oldest = fresh.items[fresh.items.length - 1].queuedAt;
  // Las cadenas ISO del mismo formato se ordenan como las fechas.
  const older = prev.items.filter((i) => !seen.has(i.id) && i.queuedAt < oldest);
  if (older.length === 0) return fresh;
  return { ...fresh, items: [...fresh.items, ...older], nextCursor: prev.nextCursor };
}

/** La página siguiente añadida debajo, sin repetir el de la frontera. */
export function appendPage(prev: EmailsData, next: EmailsData): EmailsData {
  const seen = new Set(prev.items.map((i) => i.id));
  return {
    ...prev,
    items: [...prev.items, ...next.items.filter((i) => !seen.has(i.id))],
    nextCursor: next.nextCursor,
    counts: next.counts ?? prev.counts,
  };
}

/** Una fila al día con lo que trajo el detalle (el estado pudo cambiar mientras). */
export function withItem(data: EmailsData, item: EmailItem): EmailsData {
  if (!data.items.some((i) => i.id === item.id)) return data;
  return { ...data, items: data.items.map((i) => (i.id === item.id ? item : i)) };
}
