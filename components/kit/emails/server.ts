// =============================================================================
// Los correos del negocio — la parte de SERVIDOR
// =============================================================================
// El hub manda el correo del estudio a SUS clientes (carril 5, contrato §5): el
// spoke compone (confirmación de reserva, cobros, seguimientos, reseñas), el hub
// lo encola, lo envía desde la cuenta de Resend de Kigaru y sigue su entrega. Este
// módulo es el puente para LEERLO desde el admin del spoke, con el mismo patrón
// que la bandeja: habla con el hub con la conexión del spoke (alcance
// `email:read`) y entrega a la isla un view-model ya resuelto.
//
//   import { hubFromEnv } from "@/components/kit/conversations/server";
//   import { createEmailRoutes, emailsVisible, loadEmails } from "@/components/kit/emails/server";
//
// 🔒 EL SECRETO DE LA CONEXIÓN NO BAJA AL NAVEGADOR. Este fichero no sale por el
// barrel (`@/components/kit`): se importa por su ruta, solo desde servidor. Un
// test del kit comprueba que ninguna isla lo importa.
//
// 🪤 EL `tenant_id` NO SE MANDA NUNCA: el hub lo saca de la conexión, y solo
// enseña lo que ESTE estudio mandó por el carril (no los avisos de Kigaru al
// estudio). Un id de otro estudio da el mismo 404 que uno que no existe.
//
// 🪤 SIN «opened»: el seguimiento de aperturas va apagado (decisión E3) y Apple
// Mail «abre» solo. Si el hub contara una apertura, aquí cuenta como entregado y
// la apertura no se enseña.
//
// 🪤 Sin imports relativos de valor (solo `import type`): los tests lo cargan con
// Node tal cual. Por eso la conexión (`HubConfig`) llega de fuera —`hubFromEnv()`
// de `conversations/server`—, el `fetch` al hub está repetido y los segmentos y
// periodos también están en `log.ts` (un test comprueba que dicen lo mismo).
// =============================================================================

import type { HubConfig, HubFailure } from "../conversations/server";
import type {
  EmailCounts,
  EmailDetail,
  EmailEvent,
  EmailItem,
  EmailPeriod,
  EmailSegment,
  EmailView,
  EmailsData,
  EmailsLoad,
  HubEmail,
  HubEmailEvent,
  HubEmailPage,
} from "./types";

export type * from "./types";
export type { HubConfig, HubFailure };

// -----------------------------------------------------------------------------
// Segmentos y periodos (la misma lista que `log.ts`)
// -----------------------------------------------------------------------------

/**
 * Qué estados del hub cuenta cada segmento. `opened` va con `delivered`: si llegó
 * a abrirse, llegó.
 */
export const SEGMENT_STATUSES: Record<EmailSegment, readonly string[] | null> = {
  all: null,
  delivered: ["delivered", "opened"],
  sending: ["queued", "sent"],
  problems: ["bounced", "complained", "failed"],
  not_sent: ["suppressed"],
};

/** Días hacia atrás desde ahora; `null` = sin límite. */
export const PERIOD_DAYS: Record<EmailPeriod, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };

const DEFAULT_VIEW: EmailView = { segment: "all", type: null, period: "30d", to: null };

// -----------------------------------------------------------------------------
// La conexión con el hub
// -----------------------------------------------------------------------------

const READ_TIMEOUT_MS = 10_000;
/** El menú no puede esperar más que esto al hub: el layout corre en cada carga. */
const NAV_TIMEOUT_MS = 2_500;
/** Cuántas filas por página (el tope del hub es 100). */
export const EMAILS_PAGE_SIZE = 50;
const MAX_LIMIT = 100;

async function hubFetch(config: HubConfig, path: string, { timeoutMs = READ_TIMEOUT_MS }: { timeoutMs?: number } = {}): Promise<Response> {
  return (config.fetch ?? fetch)(`${config.baseUrl}${path}`, {
    method: "GET",
    headers: {
      "x-senzai-connection-key": config.key,
      "x-senzai-connection-secret": config.secret,
    },
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
  console.error(`[kit/emails] el hub devolvió ${res.status} al ${what}`);
  const detail = typeof body?.error === "string" && body.error ? body.error : `hub ${res.status}`;
  return { ok: false, kind: "refused", status: res.status, detail };
}

function unreachable(err: unknown, what: string): HubFailure {
  // Nunca se registra la petición: lleva el secreto en las cabeceras.
  const reason = err instanceof Error ? err.name : "error";
  console.error(`[kit/emails] no se pudo hablar con el hub al ${what} (${reason})`);
  return { ok: false, kind: "unreachable", detail: "could not reach the hub" };
}

function listOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** El `since` de un periodo, contado hacia atrás desde `now`. Sin zona que adivinar. */
export function periodSince(period: EmailPeriod, now: number = Date.now()): string | null {
  const days = PERIOD_DAYS[period];
  return days === null ? null : new Date(now - days * 86_400_000).toISOString();
}

/** La query del hub para una vista (contrato §5.2). */
export function hubEmailQuery(
  view: EmailView,
  { cursor = null, limit = EMAILS_PAGE_SIZE, now = Date.now() }: { cursor?: string | null; limit?: number; now?: number } = {},
): string {
  const params = new URLSearchParams({ limit: String(limit) });
  const statuses = SEGMENT_STATUSES[view.segment];
  if (statuses) params.set("status", statuses.join(","));
  if (view.type) params.set("email_type", view.type);
  const since = periodSince(view.period, now);
  if (since) params.set("since", since);
  if (view.to) params.set("to", view.to);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

/** Una página de correos, del más nuevo al más viejo (`GET /api/channels/emails`). */
export async function fetchEmailPage(
  config: HubConfig,
  view: EmailView,
  opts: { cursor?: string | null; limit?: number; now?: number; timeoutMs?: number } = {},
): Promise<{ ok: true; page: HubEmailPage } | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/emails?${hubEmailQuery(view, opts)}`, { timeoutMs: opts.timeoutMs });
    if (!res.ok) return refused(res, "listar");
    const body = await readJson(res);
    const counts = body?.counts;
    return {
      ok: true,
      page: {
        items: listOf<HubEmail>(body?.items),
        next_cursor: typeof body?.next_cursor === "string" && body.next_cursor ? body.next_cursor : null,
        counts: counts && typeof counts === "object" && !Array.isArray(counts) ? (counts as Record<string, number>) : null,
      },
    };
  } catch (err) {
    return unreachable(err, "listar");
  }
}

/** Un correo con su línea de eventos (`GET /api/channels/emails/{id}`). */
export async function fetchEmail(
  config: HubConfig,
  id: string,
): Promise<{ ok: true; email: HubEmail & { events: HubEmailEvent[] } } | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/emails/${id}`);
    if (!res.ok) return refused(res, "leer un correo");
    const body = await readJson(res);
    if (!body || typeof body.id !== "string") return { ok: false, kind: "refused", status: 502, detail: "the hub sent no email" };
    return { ok: true, email: { ...(body as unknown as HubEmail), events: listOf<HubEmailEvent>(body.events) } };
  } catch (err) {
    return unreachable(err, "leer un correo");
  }
}

// -----------------------------------------------------------------------------
// Del hub al view-model
// -----------------------------------------------------------------------------

const KNOWN_STATUSES = new Set(["queued", "sent", "delivered", "bounced", "complained", "failed", "suppressed"]);
const TIMELINE_TYPES = new Set(["queued", "sent", "delivered", "delivery_delayed", "bounced", "complained", "failed", "suppressed"]);

/** El estado que se pinta. `opened` → `delivered` (E3); uno desconocido pasa tal cual (badge gris). */
export function emailStatus(status: string): string {
  if (status === "opened") return "delivered";
  return KNOWN_STATUSES.has(status) ? status : status || "queued";
}

export function toEmailItem(e: HubEmail): EmailItem {
  const category = e.category === "transactional" || e.category === "marketing" ? e.category : null;
  return {
    id: e.id,
    to: e.to,
    subject: e.subject?.trim() || "",
    type: e.email_type,
    category,
    status: emailStatus(e.status) as EmailItem["status"],
    queuedAt: e.queued_at,
    sentAt: e.sent_at ?? null,
    // Una apertura implica entrega: si el hub solo anotó la apertura, esa es la hora.
    deliveredAt: e.delivered_at ?? (e.status === "opened" ? e.opened_at : null) ?? null,
    bouncedAt: e.bounced_at ?? null,
    complainedAt: e.complained_at ?? null,
    failureReason: e.failure_reason?.trim() || null,
    entityType: e.entity_type ?? null,
    entityId: e.entity_id ?? null,
  };
}

/** La línea de eventos sin aperturas ni tipos que el kit no sabe nombrar. */
export function toEmailEvents(events: readonly HubEmailEvent[]): EmailEvent[] {
  return events
    .filter((e) => TIMELINE_TYPES.has(e.type) && typeof e.at === "string")
    .map((e) => ({ type: e.type as EmailEvent["type"], at: e.at, detail: e.detail?.trim() || null }));
}

export function toEmailDetail(e: HubEmail & { events: readonly HubEmailEvent[] }): EmailDetail {
  return { ...toEmailItem(e), events: toEmailEvents(e.events) };
}

/** Las cuentas por estado del hub, sumadas por segmento. Sin cuentas, `null`. */
export function toEmailCounts(counts: Record<string, number> | null): EmailCounts | null {
  if (!counts) return null;
  const n = (s: string) => {
    const v = Number(counts[s]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  };
  const sum = (list: readonly string[]) => list.reduce((acc, s) => acc + n(s), 0);
  const out = { all: 0 } as EmailCounts;
  for (const [segment, statuses] of Object.entries(SEGMENT_STATUSES) as [EmailSegment, readonly string[] | null][]) {
    if (statuses) out[segment] = sum(statuses);
  }
  out.all = Object.keys(counts).reduce((acc, s) => acc + n(s), 0);
  return out;
}

export function toEmailsData(page: HubEmailPage, view: EmailView): EmailsData {
  return {
    view,
    items: page.items.map(toEmailItem),
    nextCursor: page.next_cursor,
    counts: toEmailCounts(page.counts),
  };
}

// -----------------------------------------------------------------------------
// Los textos del servidor
// -----------------------------------------------------------------------------

export type EmailsServerMessages = {
  notConfigured: string;
  notEnabled: string;
  unreachable: string;
  notFound: string;
  busy: string;
  hubError: string;
  badId: string;
  badQuery: string;
};

export const EMAILS_SERVER_MESSAGES: EmailsServerMessages = {
  notConfigured:
    "The connection to Kigaru isn't configured on this deployment (SENZAI_CONNECTION_KEY, SENZAI_CONNECTION_SECRET and SENZAI_INGEST_URL).",
  notEnabled:
    "Kigaru rejected this site's connection ({status}). Check the connection key and that it has the email:read scope.",
  unreachable: "Couldn't reach Kigaru to read the emails. Try again in a moment.",
  notFound: "Email not found.",
  busy: "Kigaru is busy right now. Try again in a moment.",
  hubError: "Kigaru couldn't answer ({status}). Try again in a moment.",
  badId: "Invalid email id.",
  badQuery: "Invalid filter: {field}.",
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/**
 * El fallo del hub como respuesta para el navegador.
 *
 * 🪤 UN 401/403 DEL HUB SALE COMO 502: es la CONEXIÓN del spoke (o el alcance que
 * le falta), no la sesión del operador, y el cliente de API del kit manda al login
 * ante cualquier 401. Un 422 del hub (un filtro que no le gustó) sale como 400.
 */
export function emailFailureStatus(f: HubFailure): number {
  if (f.kind === "unreachable") return 502;
  if (f.status === 401 || f.status === 403) return 502;
  if (f.status === 404) return 404;
  if (f.status === 400 || f.status === 422) return 400;
  if (f.status === 429) return 429;
  return 502;
}

export function emailFailureMessage(f: HubFailure, messages: EmailsServerMessages = EMAILS_SERVER_MESSAGES): string {
  if (f.kind === "unreachable") return messages.unreachable;
  if (f.status === 401 || f.status === 403) return fill(messages.notEnabled, { status: f.status });
  if (f.status === 404) return messages.notFound;
  if (f.status === 400 || f.status === 422) return f.detail;
  if (f.status === 429) return messages.busy;
  return fill(messages.hubError, { status: f.status });
}

// -----------------------------------------------------------------------------
// Los cargadores de la página y del menú
// -----------------------------------------------------------------------------

/**
 * La primera página de una vista, para el primer pintado. La vista sale de la URL
 * de la página (`parseEmailView(searchParams)`, del barrel).
 *
 * 🪤 UN FALLO DEL HUB NO ES UNA LISTA VACÍA: vuelve con su causa.
 */
export async function loadEmails(
  config: HubConfig | null,
  view: EmailView = DEFAULT_VIEW,
  { messages = EMAILS_SERVER_MESSAGES, now }: { messages?: EmailsServerMessages; now?: number } = {},
): Promise<EmailsLoad> {
  if (!config) return { ok: false, view, reason: "not_configured", error: messages.notConfigured };
  const result = await fetchEmailPage(config, view, { now });
  if (!result.ok) {
    const rejected = result.kind === "refused" && (result.status === 401 || result.status === 403);
    return { ok: false, view, reason: rejected ? "not_enabled" : "hub_error", error: emailFailureMessage(result, messages) };
  }
  return { ok: true, data: toEmailsData(result.page, view) };
}

type VisibilityEntry = { visible: boolean; at: number };
const visibilityCache = new Map<string, VisibilityEntry>();

/**
 * Si la entrada «Emails» del menú se ve.
 *
 * - Sin conexión configurada: no.
 * - El hub contesta 403 (la conexión no tiene `email:read`): no. Es el estado de
 *   un spoke al que aún no se le ha encendido el correo; el día que se le concede
 *   el alcance, aparece sola.
 * - El hub falla, tarda (2,5 s) o rechaza la credencial (401): SÍ. Un fallo no
 *   esconde la vista; la página dirá la causa.
 *
 * Guarda la respuesta buena un minuto (el layout corre en cada carga) y nunca lanza.
 */
export async function emailsVisible(
  config: HubConfig | null,
  { timeoutMs = NAV_TIMEOUT_MS, ttlMs = 60_000, now = Date.now() }: { timeoutMs?: number; ttlMs?: number; now?: number } = {},
): Promise<boolean> {
  if (!config) return false;
  const cacheKey = `${config.baseUrl}|${config.key}`;
  const hit = visibilityCache.get(cacheKey);
  if (hit && now - hit.at < ttlMs) return hit.visible;
  const result = await fetchEmailPage(config, { ...DEFAULT_VIEW, period: "7d" }, { limit: 1, now, timeoutMs });
  if (!result.ok) {
    if (result.kind === "refused" && result.status === 403) {
      visibilityCache.set(cacheKey, { visible: false, at: now });
      return false;
    }
    return true;
  }
  visibilityCache.set(cacheKey, { visible: true, at: now });
  return true;
}

// -----------------------------------------------------------------------------
// Las rutas proxy
// -----------------------------------------------------------------------------

/**
 * Lo que un `route.ts` del spoke re-exporta. Nada más:
 *
 *   // app/api/admin/emails/route.ts       → export const GET = emailRoutes.list;
 *   // app/api/admin/emails/[id]/route.ts  → export const GET = emailRoutes.item.GET;
 *
 * 🪤 UN `route.ts` SOLO PUEDE EXPORTAR HANDLERS. Un export de más compila con
 * Turbopack y rompe con `next build --webpack`.
 */
export type EmailRoutes = {
  /** `GET <endpoint>?segment=&type=&period=&to=&cursor=&limit=` → `{ data: EmailsData }`. */
  list: (req: Request) => Promise<Response>;
  item: {
    /** `GET <endpoint>/<id>` → `{ data: EmailDetail }`. */
    GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
};

export type EmailRouteOptions = {
  /** La guarda del área: `null` deja pasar; una `Response` (el 401 del proyecto) corta. Va primero. */
  authorize: (req: Request) => Promise<Response | null | undefined>;
  /**
   * De dónde sale la conexión: `() => hubFromEnv()` de `conversations/server`.
   * 🪤 Con la flecha: `hubFromEnv` recibe el ENTORNO, no la petición.
   */
  hub: (req: Request) => HubConfig | null;
  messages?: Partial<EmailsServerMessages>;
  /** El reloj de los periodos. Solo para tests. */
  now?: () => number;
};

const ROW_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Un cursor del hub (base64url). Lo valida el hub; aquí solo se acota. */
const CURSOR = /^[A-Za-z0-9_-]{1,400}$/;
const EMAIL_TYPE = /^[a-z][a-z0-9_]{0,63}$/;
const ADDRESS = /^[^@\s]+@[^@\s]+$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** La vista y la página que pide la isla, o el nombre del parámetro que no vale. */
export function parseListRequest(
  params: URLSearchParams,
): { ok: true; view: EmailView; cursor: string | null; limit: number } | { ok: false; field: string } {
  const segment = params.get("segment") ?? "all";
  if (!(segment in SEGMENT_STATUSES)) return { ok: false, field: "segment" };
  const period = params.get("period") ?? DEFAULT_VIEW.period;
  if (!(period in PERIOD_DAYS)) return { ok: false, field: "period" };
  const type = params.get("type")?.trim() || null;
  if (type !== null && !EMAIL_TYPE.test(type)) return { ok: false, field: "type" };
  const to = params.get("to")?.trim().toLowerCase() || null;
  if (to !== null && (to.length > 254 || !ADDRESS.test(to))) return { ok: false, field: "to" };
  const cursor = params.get("cursor");
  if (cursor !== null && !CURSOR.test(cursor)) return { ok: false, field: "cursor" };
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? EMAILS_PAGE_SIZE : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { ok: false, field: "limit" };
  return { ok: true, view: { segment: segment as EmailSegment, type, period: period as EmailPeriod, to }, cursor, limit };
}

export function createEmailRoutes({ authorize, hub, messages: overrides, now = Date.now }: EmailRouteOptions): EmailRoutes {
  const messages: EmailsServerMessages = { ...EMAILS_SERVER_MESSAGES, ...overrides };
  const fail = (f: HubFailure) => json({ error: emailFailureMessage(f, messages) }, emailFailureStatus(f));

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
      const parsed = parseListRequest(new URL(req.url).searchParams);
      if (!parsed.ok) return json({ error: fill(messages.badQuery, { field: parsed.field }) }, 400);
      const result = await fetchEmailPage(opened.config, parsed.view, { cursor: parsed.cursor, limit: parsed.limit, now: now() });
      if (!result.ok) return fail(result);
      return json({ data: toEmailsData(result.page, parsed.view) });
    },

    item: {
      async GET(req, ctx) {
        const opened = await open(req);
        if ("response" in opened) return opened.response;
        const { id } = await ctx.params;
        if (!ROW_ID.test(id)) return json({ error: messages.badId }, 400);
        const result = await fetchEmail(opened.config, id);
        if (!result.ok) return fail(result);
        const data: EmailDetail = toEmailDetail(result.email);
        return json({ data });
      },
    },
  };
}
