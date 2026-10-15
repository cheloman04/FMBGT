// =============================================================================
// La campanita — la lógica pura de la isla y sus textos
// =============================================================================
// Lo que decide la isla sin tocar la red: a dónde lleva un aviso, cómo se funde
// un refresco con lo ya cargado y qué dice cada texto. Separado para probarlo con
// Node tal cual.
//
// 🪤 Sin imports relativos de valor (solo `import type`): los tests lo cargan con
// Node tal cual. Por eso `fill` está repetido (`conversations/inbox.ts`).
// =============================================================================

import type { NotificationItem, NotificationsData } from "./types";

export type NotificationsLabels = {
  /** «{count} unread». */
  unreadCount: string;
  allCaughtUp: string;
  markAllRead: string;
  markRead: string;
  markUnread: string;
  /** El enlace de un aviso de conversación. */
  openConversation: string;
  /** El enlace de cualquier otro aviso. */
  open: string;
  /** El badge de un aviso sin leer. */
  unread: string;
  refresh: string;
  refreshing: string;
  /** «Couldn't refresh: {reason}». */
  refreshFailed: string;
  /** «Couldn't update it: {reason}». */
  actionFailed: string;
  retry: string;
  emptyTitle: string;
  emptyHint: string;
  notConfiguredTitle: string;
  notEnabledTitle: string;
  loadFailedTitle: string;
  /** El sustantivo de «Showing N of M …». */
  noun: string;
  /** El nombre de cada canal, para la etiqueta del aviso. */
  channelNames: Record<string, string>;
};

export const NOTIFICATIONS_LABELS: NotificationsLabels = {
  unreadCount: "{count} unread",
  allCaughtUp: "You're all caught up.",
  markAllRead: "Mark all as read",
  markRead: "Mark as read",
  markUnread: "Mark as unread",
  openConversation: "Open conversation",
  open: "Open",
  unread: "Unread",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  refreshFailed: "Couldn't refresh: {reason}",
  actionFailed: "Couldn't update it: {reason}",
  retry: "Try again",
  emptyTitle: "No notifications yet.",
  emptyHint:
    "When your assistant passes a conversation to you, it shows up here (and in your email) with a link to reply.",
  notConfiguredTitle: "This site isn't connected to Kigaru.",
  notEnabledTitle: "Notifications aren't turned on for this site yet.",
  loadFailedTitle: "Couldn't load the notifications.",
  noun: "notifications",
  channelNames: {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    messenger: "Messenger",
    sms: "SMS",
    webchat: "Web chat",
    tiktok: "TikTok",
    telegram: "Telegram",
    voice: "Phone",
  },
};

/** Los textos con los de quien monta encima; `channelNames` se funde, no se sustituye. */
export function mergeNotificationLabels(overrides?: Partial<NotificationsLabels>): NotificationsLabels {
  return {
    ...NOTIFICATIONS_LABELS,
    ...overrides,
    channelNames: { ...NOTIFICATIONS_LABELS.channelNames, ...overrides?.channelNames },
  };
}

export function fillNotification(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** El texto del enlace de un aviso. */
export function openLabel(item: Pick<NotificationItem, "kind">, labels: NotificationsLabels): string {
  return item.kind === "agent_handoff" ? labels.openConversation : labels.open;
}

/** El nombre del canal, o el propio identificador si el kit no lo nombra. */
export function notificationChannel(channel: string | null, labels: NotificationsLabels): string | null {
  if (!channel) return null;
  return labels.channelNames[channel] ?? channel;
}

/**
 * Si el enlace es de ESTA app, su ruta (para navegar sin recargar); si no, `null`.
 *
 * El hub escribe el hilo de un traspaso con la URL de la app del cliente
 * (`client_platforms.base_url`), así que en producción casa con el origen. En un
 * preview de Vercel no: entonces es un enlace de fuera y se abre aparte.
 *
 * 🪤 `//otro.sitio/x` empieza por «/» y es OTRO host: no es una ruta propia.
 */
export function internalHref(href: string | null, origin: string): string | null {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : null;
}

/** ¿Se puede abrir? Solo `http(s)` o una ruta propia: nunca un `javascript:` que llegue del hub. */
export function safeHref(href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Un refresco (la primera tanda, otra vez) fundido con lo que ya se ve.
 *
 * El refresco trae lo nuevo de arriba y el estado al día de su tanda; lo que se
 * cargó más abajo con «Load more» se conserva, sin repetir ninguno. Los recuentos
 * son los del refresco: son los de ahora.
 */
export function mergeRefresh(prev: NotificationsData, fresh: NotificationsData): NotificationsData {
  if (fresh.items.length === 0 || prev.items.length <= fresh.items.length) return fresh;
  const seen = new Set(fresh.items.map((i) => i.id));
  const oldest = fresh.items[fresh.items.length - 1].at;
  // Las cadenas ISO del mismo formato se ordenan como las fechas.
  const older = prev.items.filter((i) => !seen.has(i.id) && i.at < oldest);
  if (older.length === 0) return fresh;
  return { ...fresh, items: [...fresh.items, ...older], nextBefore: prev.nextBefore };
}

/** La tanda siguiente añadida debajo, sin repetir ninguno. */
export function appendPage(prev: NotificationsData, next: NotificationsData): NotificationsData {
  const seen = new Set(prev.items.map((i) => i.id));
  return {
    items: [...prev.items, ...next.items.filter((i) => !seen.has(i.id))],
    unread: next.unread,
    total: next.total,
    nextBefore: next.nextBefore,
  };
}

/** Un aviso marcado (o desmarcado) en local, con el recuento al día. */
export function withRead(data: NotificationsData, id: string, read: boolean): NotificationsData {
  const item = data.items.find((i) => i.id === id);
  if (!item || item.read === read) return data;
  return {
    ...data,
    items: data.items.map((i) => (i.id === id ? { ...i, read } : i)),
    unread: Math.max(0, data.unread + (read ? -1 : 1)),
  };
}

/**
 * Todos leídos en local hasta `until` (incluido): lo que el botón acaba de marcar.
 *
 * La lista va del más nuevo al más viejo y `until` es el más nuevo que se ve, así
 * que el hub marcó también los de más abajo que aún no se cargaron: sin leer solo
 * quedan los que se ven y son posteriores a `until` (ninguno, salvo carrera). El
 * refresco de después trae lo que haya entrado mientras.
 */
export function withAllRead(data: NotificationsData, until: string | null): NotificationsData {
  const items = data.items.map((i) => (i.read || (until !== null && i.at > until) ? i : { ...i, read: true }));
  return { ...data, items, unread: items.filter((i) => !i.read).length };
}
