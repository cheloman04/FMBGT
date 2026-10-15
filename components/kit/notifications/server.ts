// =============================================================================
// La campanita — la parte de SERVIDOR
// =============================================================================
// Los avisos del dueño del negocio viven en el hub (`notifications`, los mismos
// que su campanita del portal de Kigaru). El primero que la app del cliente ve es
// «Your assistant passed a conversation to you» (`agent_handoff`): alguien espera
// a una persona en Instagram, Messenger o WhatsApp. Este módulo es el puente, con
// el mismo patrón que la bandeja: habla con el hub con la conexión del spoke y
// entrega a la isla un view-model ya resuelto.
//
//   import { hubFromEnv } from "@/components/kit/conversations/server";
//   import { createNotificationRoutes, loadNotifications, notificationsNav } from "@/components/kit/notifications/server";
//
// 🔒 EL SECRETO DE LA CONEXIÓN NO BAJA AL NAVEGADOR. Este fichero no sale por el
// barrel (`@/components/kit`): se importa por su ruta, solo desde servidor. Un
// test del kit comprueba que ninguna isla lo importa.
//
// 🪤 EL `tenant_id` NO SE MANDA NUNCA: el hub lo saca de la conexión, y solo
// devuelve los avisos de SU dueño.
//
// 🪤 Sin imports relativos de valor (solo `import type`): los tests lo cargan con
// Node tal cual. Por eso la conexión (`HubConfig`) llega de fuera —
// `hubFromEnv()` de `conversations/server`— y el `fetch` al hub está repetido.
// =============================================================================

import type { HubConfig, HubFailure } from "../conversations/server";
import type { NavBadgeValue } from "../nav";
import type {
  HubNotification,
  HubNotificationPage,
  NotificationItem,
  NotificationsData,
  NotificationsLoad,
  NotificationsNav,
  NotificationsReadAllResult,
} from "./types";

export type * from "./types";
export type { HubConfig, HubFailure };

// -----------------------------------------------------------------------------
// La conexión con el hub
// -----------------------------------------------------------------------------

const READ_TIMEOUT_MS = 10_000;
/** El menú no puede esperar más que esto al hub: el layout corre en cada carga. */
const NAV_TIMEOUT_MS = 2_500;
/** Cuántos avisos por tanda (el tope del hub es 50). */
export const NOTIFICATIONS_PAGE_SIZE = 20;

async function hubFetch(
  config: HubConfig,
  path: string,
  { method = "GET", body, timeoutMs = READ_TIMEOUT_MS }: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "x-senzai-connection-key": config.key,
    "x-senzai-connection-secret": config.secret,
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  return (config.fetch ?? fetch)(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  const json = (await res.json().catch(() => null)) as unknown;
  return json && typeof json === "object" ? (json as Record<string, unknown>) : null;
}

async function refused(res: Response, what: string): Promise<HubFailure> {
  const body = await readJson(res);
  console.error(`[kit/notifications] el hub devolvió ${res.status} al ${what}`);
  const detail = typeof body?.error === "string" && body.error ? body.error : `hub ${res.status}`;
  return { ok: false, kind: "refused", status: res.status, detail };
}

function unreachable(err: unknown, what: string): HubFailure {
  // Nunca se registra la petición: lleva el secreto en las cabeceras.
  const reason = err instanceof Error ? err.name : "error";
  console.error(`[kit/notifications] no se pudo hablar con el hub al ${what} (${reason})`);
  return { ok: false, kind: "unreachable", detail: "could not reach the hub" };
}

function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function listOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Una tanda de avisos, del más nuevo al más viejo. `before` es el `nextBefore` de la anterior. */
export async function fetchNotificationPage(
  config: HubConfig,
  { before, limit = NOTIFICATIONS_PAGE_SIZE }: { before?: string | null; limit?: number } = {},
): Promise<{ ok: true; page: HubNotificationPage } | HubFailure> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  try {
    const res = await hubFetch(config, `/api/channels/notifications?${params.toString()}`);
    if (!res.ok) return refused(res, "listar");
    const body = await readJson(res);
    return {
      ok: true,
      page: {
        notifications: listOf<HubNotification>(body?.notifications),
        unread_count: count(body?.unread_count),
        total_count: count(body?.total_count),
        has_more: body?.has_more === true,
        next_before: typeof body?.next_before === "string" && body.next_before ? body.next_before : null,
      },
    };
  } catch (err) {
    return unreachable(err, "listar");
  }
}

/** Solo el número de sin leer (`count_only=1`): lo barato, para el menú. */
export async function fetchUnreadCount(
  config: HubConfig,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<{ ok: true; unread: number } | HubFailure> {
  try {
    const res = await hubFetch(config, "/api/channels/notifications?count_only=1", { timeoutMs });
    if (!res.ok) return refused(res, "contar");
    const body = await readJson(res);
    return { ok: true, unread: count(body?.unread_count) };
  } catch (err) {
    return unreachable(err, "contar");
  }
}

/** Leído (o no). Es la misma fila que la campanita del portal: leerla aquí la apaga allí. */
export async function markNotificationRead(
  config: HubConfig,
  id: string,
  read: boolean,
): Promise<{ ok: true; notification: HubNotification } | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/notifications/${id}`, { method: "PATCH", body: { read } });
    if (!res.ok) return refused(res, "marcar");
    const body = await readJson(res);
    const notification = body?.notification as HubNotification | undefined;
    if (!notification) return { ok: false, kind: "refused", status: 502, detail: "the hub sent no notification" };
    return { ok: true, notification };
  } catch (err) {
    return unreachable(err, "marcar");
  }
}

/**
 * Todos leídos, HASTA `until` (el `at` del aviso más nuevo que la pantalla enseña).
 * 🪤 Sin él, un traspaso que entra mientras se pulsa el botón quedaría leído sin
 * que nadie lo haya visto.
 */
export async function markAllNotificationsRead(
  config: HubConfig,
  until: string | null,
): Promise<{ ok: true; updated: number } | HubFailure> {
  try {
    const res = await hubFetch(config, "/api/channels/notifications/read-all", {
      method: "POST",
      body: until ? { until } : {},
    });
    if (!res.ok) return refused(res, "marcar todos");
    const body = await readJson(res);
    return { ok: true, updated: count(body?.updated) };
  } catch (err) {
    return unreachable(err, "marcar todos");
  }
}

// -----------------------------------------------------------------------------
// Del hub al view-model
// -----------------------------------------------------------------------------

export function toNotificationItem(n: HubNotification): NotificationItem {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title?.trim() || "",
    body: n.body?.trim() || null,
    href: n.link_url?.trim() || null,
    read: Boolean(n.read_at),
    at: n.created_at,
    channel: n.channel ?? null,
  };
}

export function toNotificationsData(page: HubNotificationPage): NotificationsData {
  const items = page.notifications.map(toNotificationItem);
  return {
    items,
    unread: page.unread_count,
    // Un hub que no manda el total (o uno que miente por debajo) no puede dejar
    // «Showing 20 of 3»: como mínimo, los que ya se ven.
    total: Math.max(page.total_count, items.length),
    nextBefore: page.has_more ? page.next_before : null,
  };
}

// -----------------------------------------------------------------------------
// Los textos del servidor
// -----------------------------------------------------------------------------

export type NotificationsServerMessages = {
  notConfigured: string;
  notEnabled: string;
  unreachable: string;
  notFound: string;
  busy: string;
  hubError: string;
  badId: string;
  badRead: string;
};

export const NOTIFICATIONS_SERVER_MESSAGES: NotificationsServerMessages = {
  notConfigured:
    "The connection to Kigaru isn't configured on this deployment (SENZAI_CONNECTION_KEY, SENZAI_CONNECTION_SECRET and SENZAI_INGEST_URL).",
  notEnabled:
    "Kigaru rejected this site's connection ({status}). Check the connection key and that it has the notifications:read scope.",
  unreachable: "Couldn't reach Kigaru to read the notifications. Try again in a moment.",
  notFound: "Notification not found.",
  busy: "Kigaru is busy right now. Try again in a moment.",
  hubError: "Kigaru couldn't answer ({status}). Try again in a moment.",
  badId: "Invalid notification id.",
  badRead: "Pass read as true or false.",
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/**
 * El fallo del hub como respuesta para el navegador.
 *
 * 🪤 UN 401/403 DEL HUB SALE COMO 502: es la CONEXIÓN del spoke (o el alcance que
 * le falta), no la sesión del operador, y el cliente de API del kit manda al login
 * ante cualquier 401.
 */
export function notificationFailureStatus(f: HubFailure): number {
  if (f.kind === "unreachable") return 502;
  if (f.status === 401 || f.status === 403) return 502;
  if (f.status === 404) return 404;
  if (f.status === 400) return 400;
  if (f.status === 429) return 429;
  return 502;
}

export function notificationFailureMessage(
  f: HubFailure,
  messages: NotificationsServerMessages = NOTIFICATIONS_SERVER_MESSAGES,
): string {
  if (f.kind === "unreachable") return messages.unreachable;
  if (f.status === 401 || f.status === 403) return fill(messages.notEnabled, { status: f.status });
  if (f.status === 404) return messages.notFound;
  if (f.status === 400) return f.detail;
  if (f.status === 429) return messages.busy;
  return fill(messages.hubError, { status: f.status });
}

// -----------------------------------------------------------------------------
// Los cargadores de la página y del menú
// -----------------------------------------------------------------------------

/**
 * La primera tanda, para el primer pintado de la página.
 *
 * 🪤 UN FALLO DEL HUB NO ES UNA CAMPANITA VACÍA: vuelve con su causa.
 */
export async function loadNotifications(
  config: HubConfig | null,
  { messages = NOTIFICATIONS_SERVER_MESSAGES }: { messages?: NotificationsServerMessages } = {},
): Promise<NotificationsLoad> {
  if (!config) return { ok: false, reason: "not_configured", error: messages.notConfigured };
  const result = await fetchNotificationPage(config);
  if (!result.ok) {
    const rejected = result.kind === "refused" && (result.status === 401 || result.status === 403);
    return { ok: false, reason: rejected ? "not_enabled" : "hub_error", error: notificationFailureMessage(result, messages) };
  }
  return { ok: true, data: toNotificationsData(result.page) };
}

/**
 * La entrada «Notifications» del menú: si se ve y cuántos sin leer.
 *
 * - Sin conexión configurada: no se ve.
 * - El hub contesta 403 (la conexión no tiene `notifications:read`): no se ve. Es
 *   el estado de un spoke al que todavía no se le ha encendido la campanita; el
 *   día que se le concede el alcance, aparece sola.
 * - El hub falla, tarda (2,5 s) o rechaza la credencial (401): SÍ se ve, sin
 *   número. Un fallo no puede esconder los avisos de quien los tiene; la página
 *   dirá la causa.
 *
 * Nunca lanza. No se recuerda: el número tiene que ser el de ahora.
 */
export async function notificationsNav(
  config: HubConfig | null,
  { timeoutMs = NAV_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<NotificationsNav> {
  if (!config) return { visible: false, unread: null };
  const result = await fetchUnreadCount(config, { timeoutMs });
  if (result.ok) return { visible: true, unread: result.unread };
  if (result.kind === "refused" && result.status === 403) return { visible: false, unread: null };
  return { visible: true, unread: null };
}

/**
 * El badge del menú: ámbar, porque un aviso de estos es alguien esperando a una
 * persona (pide atención; no es una avería). Sin número si no se pudo contar.
 */
export function notificationsBadge(nav: NotificationsNav): NavBadgeValue | undefined {
  if (nav.unread === null) return undefined;
  return { count: nav.unread, tone: "amber" };
}

// -----------------------------------------------------------------------------
// Las rutas proxy
// -----------------------------------------------------------------------------

/**
 * Lo que un `route.ts` del spoke re-exporta. Nada más:
 *
 *   // app/api/admin/notifications/route.ts           → export const GET = notificationRoutes.list;
 *   // app/api/admin/notifications/[id]/route.ts      → export const PATCH = notificationRoutes.item.PATCH;
 *   // app/api/admin/notifications/read-all/route.ts  → export const POST = notificationRoutes.readAll;
 *
 * 🪤 UN `route.ts` SOLO PUEDE EXPORTAR HANDLERS. Un export de más compila con
 * Turbopack y rompe con `next build --webpack`.
 */
export type NotificationRoutes = {
  /** `GET <endpoint>[?before=<nextBefore>]` → `{ data: NotificationsData }`. */
  list: (req: Request) => Promise<Response>;
  item: {
    /** `PATCH <endpoint>/<id>` `{ read }` → `{ data: NotificationItem }`. */
    PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  /** `POST <endpoint>/read-all` `{ until? }` → `{ data: { updated } }`. */
  readAll: (req: Request) => Promise<Response>;
};

export type NotificationRouteOptions = {
  /** La guarda del área: `null` deja pasar; una `Response` (el 401 del proyecto) corta. Va primero. */
  authorize: (req: Request) => Promise<Response | null | undefined>;
  /**
   * De dónde sale la conexión: `() => hubFromEnv()` de `conversations/server`.
   * 🪤 Con la flecha: `hubFromEnv` recibe el ENTORNO, no la petición.
   */
  hub: (req: Request) => HubConfig | null;
  messages?: Partial<NotificationsServerMessages>;
};

/** Cualquier 8-4-4-4-12 hexadecimal: lo que el `uuid` de Postgres acepta. */
const ROW_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Un cursor del hub (`created_at` de Postgres). Lo valida el hub; aquí solo se acota. */
const CURSOR = /^[0-9T:.+\-Z ]{10,40}$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createNotificationRoutes({ authorize, hub, messages: overrides }: NotificationRouteOptions): NotificationRoutes {
  const messages: NotificationsServerMessages = { ...NOTIFICATIONS_SERVER_MESSAGES, ...overrides };
  const fail = (f: HubFailure) => json({ error: notificationFailureMessage(f, messages) }, notificationFailureStatus(f));

  async function open(req: Request): Promise<{ response: Response } | { config: HubConfig }> {
    const denied = await authorize(req);
    if (denied) return { response: denied };
    const config = hub(req);
    if (!config) return { response: json({ error: messages.notConfigured }, 503) };
    return { config };
  }

  return {
    async list(req) {
      const opened = await open(req);
      if ("response" in opened) return opened.response;
      const before = new URL(req.url).searchParams.get("before");
      if (before !== null && !CURSOR.test(before)) return json({ error: "Invalid cursor." }, 400);
      const result = await fetchNotificationPage(opened.config, { before });
      if (!result.ok) return fail(result);
      return json({ data: toNotificationsData(result.page) });
    },

    item: {
      async PATCH(req, ctx) {
        const opened = await open(req);
        if ("response" in opened) return opened.response;
        const { id } = await ctx.params;
        if (!ROW_ID.test(id)) return json({ error: messages.badId }, 400);
        const body = (await req.json().catch(() => null)) as { read?: unknown } | null;
        if (typeof body?.read !== "boolean") return json({ error: messages.badRead }, 422);
        const result = await markNotificationRead(opened.config, id, body.read);
        if (!result.ok) return fail(result);
        return json({ data: toNotificationItem(result.notification) });
      },
    },

    async readAll(req) {
      const opened = await open(req);
      if ("response" in opened) return opened.response;
      const body = (await req.json().catch(() => null)) as { until?: unknown } | null;
      const raw = body?.until ?? null;
      // 🪤 Un `until` que no se entiende es un 400, no «todos»: soltarlo marcaría
      // como leído justo el aviso que la pantalla todavía no enseñaba.
      if (raw !== null && (typeof raw !== "string" || !CURSOR.test(raw))) return json({ error: "Invalid cursor." }, 400);
      const until = typeof raw === "string" ? raw : null;
      const result = await markAllNotificationsRead(opened.config, until);
      if (!result.ok) return fail(result);
      const data: NotificationsReadAllResult = { updated: result.updated };
      return json({ data });
    },
  };
}
