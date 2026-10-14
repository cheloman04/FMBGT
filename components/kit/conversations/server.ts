// =============================================================================
// La bandeja de conversaciones — la parte de SERVIDOR
// =============================================================================
// Las conversaciones de Instagram, Messenger y WhatsApp viven en el hub; el
// operador las atiende en SU spoke (regla de producto: la operación diaria del
// cliente no vive en el /portal del hub). Este módulo es el puente: habla con el
// hub con la conexión del spoke y entrega a la isla un view-model ya resuelto.
//
//   import { createInboxRoutes, hubFromEnv, inboxVisible, loadInbox } from "@/components/kit/conversations/server";
//
// 🔒 EL SECRETO DE LA CONEXIÓN NO BAJA AL NAVEGADOR. Este fichero no sale por el
// barrel del kit (`@/components/kit`), que importan las islas: se importa por su
// ruta, solo desde código de servidor (`page.tsx`, `layout.tsx`, `lib/`). Un test
// del kit comprueba que ningún fichero `"use client"` lo importa. Todo lo que el
// navegador necesita del hub pasa por las rutas que fabrica `createInboxRoutes`.
//
// 🪤 EL `tenant_id` NO SE MANDA NUNCA: el hub lo saca de la conexión. Por eso un
// id de conversación de otro negocio da 404 aunque se acierte el UUID.
//
// 🪤 Sin imports relativos de valor (solo `import type`): los tests lo cargan con
// Node tal cual. Por eso `fill` está repetido en `inbox.ts`.
// =============================================================================

import type {
  AttachmentKind,
  HubAttachment,
  HubChannelReport,
  HubConversation,
  HubMessage,
  HubOutcome,
  HubTemplateView,
  InboxChannel,
  InboxConversation,
  InboxData,
  InboxHandlerResult,
  InboxLoad,
  InboxMessage,
  InboxSendResult,
  InboxTemplate,
  InboxThread,
} from "./types";

export type * from "./types";

// -----------------------------------------------------------------------------
// La conexión con el hub
// -----------------------------------------------------------------------------

export type HubConfig = {
  /** El origen del hub, sin barra final (`https://os.kigaru.app`). */
  baseUrl: string;
  key: string;
  secret: string;
  /** Sustituye a `fetch`: tests, y el hub falso del playground. */
  fetch?: typeof fetch;
};

/**
 * La conexión del spoke, leída del entorno, o `null` si falta algo.
 *
 * Son las MISMAS variables que la ingesta (`SENZAI_CONNECTION_KEY` y
 * `SENZAI_CONNECTION_SECRET`): el hub saca el tenant de la conexión, así que la
 * credencial es lo que dice de quién son las conversaciones. La base sale de
 * `SENZAI_HUB_URL` si existe y, si no, del ORIGEN de `SENZAI_INGEST_URL`.
 *
 * Devuelve `null` en vez de lanzar: quien llama decide qué significa (la ruta,
 * un 503 que lo dice; el menú, no enseñar la entrada).
 */
export function hubFromEnv(env: Record<string, string | undefined> = process.env): HubConfig | null {
  const key = env.SENZAI_CONNECTION_KEY?.trim();
  const secret = env.SENZAI_CONNECTION_SECRET?.trim();
  const baseUrl = originOf(env.SENZAI_HUB_URL) ?? originOf(env.SENZAI_INGEST_URL);
  if (!key || !secret || !baseUrl) return null;
  return { baseUrl, key, secret };
}

function originOf(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** `unreachable` = no pudimos preguntar. `refused` = el hub contestó que no. */
export type HubFailure =
  | { ok: false; kind: "unreachable"; detail: string }
  | { ok: false; kind: "refused"; status: number; detail: string };

const READ_TIMEOUT_MS = 10_000;
// Mandar pasa por el conector de la red a través del hub: dos saltos en serie.
const SEND_TIMEOUT_MS = 55_000;

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

/**
 * Una lista del cuerpo, o vacía. El hub es de otro repo: una forma inesperada no
 * puede tirar el layout del área (que pregunta por los canales en cada carga).
 */
function listOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function refused(res: Response, what: string): Promise<HubFailure> {
  const body = await readJson(res);
  console.error(`[kit/conversations] el hub devolvió ${res.status} al ${what}`);
  const detail = typeof body?.error === "string" && body.error ? body.error : `hub ${res.status}`;
  return { ok: false, kind: "refused", status: res.status, detail };
}

function unreachable(err: unknown, what: string): HubFailure {
  // Nunca se registra la petición: lleva el secreto en las cabeceras.
  const reason = err instanceof Error ? err.name : "error";
  console.error(`[kit/conversations] no se pudo hablar con el hub al ${what} (${reason})`);
  return { ok: false, kind: "unreachable", detail: "could not reach the hub" };
}

/** Los hilos del cliente, del más reciente al más viejo. */
export async function listConversations(
  config: HubConfig,
  { limit = 50 }: { limit?: number } = {},
): Promise<{ ok: true; conversations: HubConversation[] } | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/conversations?limit=${limit}`);
    if (!res.ok) return refused(res, "listar");
    const body = await readJson(res);
    return { ok: true, conversations: listOf<HubConversation>(body?.conversations) };
  } catch (err) {
    return unreachable(err, "listar");
  }
}

/** Por canal: cuántas cuentas activas hay y qué hace el agente. */
export async function fetchChannels(
  config: HubConfig,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<{ ok: true; channels: HubChannelReport[] } | HubFailure> {
  try {
    const res = await hubFetch(config, "/api/channels/agent-switch", { timeoutMs });
    if (!res.ok) return refused(res, "leer los canales");
    const body = await readJson(res);
    return { ok: true, channels: listOf<HubChannelReport>(body?.channels) };
  } catch (err) {
    return unreachable(err, "leer los canales");
  }
}

export async function fetchThread(
  config: HubConfig,
  conversationId: string,
  { limit = THREAD_LIMIT }: { limit?: number } = {},
): Promise<
  | { ok: true; conversation: InboxThread["conversation"]; messages: HubMessage[] }
  | HubFailure
> {
  try {
    const res = await hubFetch(config, `/api/channels/conversations/${conversationId}/messages?limit=${limit}`);
    if (!res.ok) return refused(res, "leer el hilo");
    const body = await readJson(res);
    const conversation = body?.conversation as InboxThread["conversation"] | undefined;
    if (!conversation) return { ok: false, kind: "refused", status: 502, detail: "the hub sent no conversation" };
    return { ok: true, conversation, messages: listOf<HubMessage>(body?.messages) };
  } catch (err) {
    return unreachable(err, "leer el hilo");
  }
}

/**
 * Contestar como una PERSONA del negocio.
 *
 * 🪤 CEDE EL HILO. El hub lo manda con `senderType: "human"`, marca la
 * conversación como `handler: human` y el agente se calla hasta que alguien se la
 * devuelva con `setHandler(…, "agent")`. Por eso la isla nunca pinta la caja de
 * responder sin el botón de devolver.
 *
 * 🪤 UN 200 DEL HUB NO ES UN MENSAJE ENVIADO. El hub contesta 200 con un
 * `outcome` que puede decir `failed` o `rejected` (la ventana de 24 h cerrada, el
 * canal caído, una capacidad que ese canal no tiene). Aquí se devuelve el
 * `outcome` tal cual; quien decide si salió es `isSent`, una sola vez.
 */
export async function sendReply(
  config: HubConfig,
  conversationId: string,
  text: string,
): Promise<{ ok: true; outcome: HubOutcome | null } | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { text },
      timeoutMs: SEND_TIMEOUT_MS,
    });
    const body = await readJson(res);
    const outcome = body?.outcome && typeof body.outcome === "object" ? (body.outcome as HubOutcome) : null;
    // Un error del hub SIN `outcome` es que no llegó ni a intentarlo.
    if (res.status >= 400 && !outcome) {
      console.error(`[kit/conversations] el hub devolvió ${res.status} al enviar`);
      const detail = typeof body?.error === "string" && body.error ? body.error : `hub ${res.status}`;
      return { ok: false, kind: "refused", status: res.status, detail };
    }
    return { ok: true, outcome };
  } catch (err) {
    return unreachable(err, "enviar");
  }
}

/** ¿Salió? Solo `sent` o `queued_retry` (el conector lo reintenta). Nunca el código HTTP. */
export function isSent(outcome: HubOutcome | null | undefined): boolean {
  return outcome?.status === "sent" || outcome?.status === "queued_retry";
}

/** Quién lleva el hilo. `agent` es lo que lo devuelve a la automatización. */
export async function setHandler(
  config: HubConfig,
  conversationId: string,
  handler: "agent" | "human",
): Promise<{ ok: true; handler: string; changed: boolean } | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/conversations/${conversationId}`, {
      method: "PATCH",
      body: { handler },
    });
    if (!res.ok) return refused(res, "mover el handler");
    const body = await readJson(res);
    // `changed` se transmite tal cual: inventarse un cambio que no hubo hace que la
    // pantalla diga que movió algo que sigue igual.
    return {
      ok: true,
      handler: typeof body?.handler === "string" ? body.handler : handler,
      changed: body?.changed === true,
    };
  } catch (err) {
    return unreachable(err, "mover el handler");
  }
}

/**
 * Un adjunto: una URL firmada de una hora del archivo que el hub copió a su
 * bucket. Se pide al abrir la foto, no al pintar el hilo. El 404 del hub es «no
 * existe, no es tuyo, ese índice no existe o aún no está copiado», todo igual.
 */
export async function fetchMedia(
  config: HubConfig,
  conversationId: string,
  messageId: string,
  index: number,
): Promise<{ ok: true; url: string; mimeType: string | null } | HubFailure> {
  try {
    const res = await hubFetch(
      config,
      `/api/channels/conversations/${conversationId}/messages/${messageId}/media/${index}`,
    );
    if (!res.ok) return refused(res, "leer el adjunto");
    const body = await readJson(res);
    if (typeof body?.url !== "string" || !body.url) {
      return { ok: false, kind: "refused", status: 502, detail: "the hub sent no media URL" };
    }
    return { ok: true, url: body.url, mimeType: typeof body.mime_type === "string" ? body.mime_type : null };
  } catch (err) {
    return unreachable(err, "leer el adjunto");
  }
}

// -----------------------------------------------------------------------------
// Del hub al view-model
// -----------------------------------------------------------------------------

/**
 * La voz no entra en esta bandeja: una llamada es su propia burbuja (estado,
 * transcripción, grabación) y a un hilo de voz no se le contesta con texto.
 */
const EXCLUDED_CHANNELS = new Set(["voice"]);

/**
 * El orden de las pestañas. Un canal que no está aquí va al final, por nombre.
 * Telegram, el último: es el banco de pruebas del agente, sin clientes detrás.
 */
const CHANNEL_ORDER = ["whatsapp", "instagram", "messenger", "sms", "webchat", "tiktok", "telegram"];

function channelRank(channel: string): number {
  const i = CHANNEL_ORDER.indexOf(channel);
  return i === -1 ? CHANNEL_ORDER.length : i;
}

/** Cuántos hilos se piden al hub (su tope es 100). */
export const CONVERSATION_LIMIT = 50;
/** Cuántos mensajes de un hilo (su tope es 200). */
export const THREAD_LIMIT = 100;

/**
 * Los canales que la bandeja enseña: los que tienen al menos una cuenta activa.
 *
 * 🪤 `not_connected` (el cliente no conectó la red) NO es `unconfigured` (falta la
 * ruta del agente, trabajo nuestro). Un canal `unconfigured` SÍ entra: los
 * mensajes llegan, se guardan y se contestan desde aquí aunque no haya agente.
 */
export function toInboxChannels(channels: HubChannelReport[]): InboxChannel[] {
  return channels
    .filter((c) => !EXCLUDED_CHANNELS.has(c.channel) && Number(c.accounts) > 0)
    .map((c) => ({ channel: c.channel, accounts: Number(c.accounts), agent: c.state }))
    .sort((a, b) => channelRank(a.channel) - channelRank(b.channel) || a.channel.localeCompare(b.channel));
}

function toTemplate(t: HubTemplateView | null | undefined): InboxTemplate | null {
  if (!t) return null;
  return { title: t.title?.trim() || null, language: t.language ?? null, contentSid: t.content_sid ?? null };
}

/**
 * Un hilo como lo pinta la lista.
 *
 * 🪤 EL TELÉFONO SOLO SALE DE `phone_digits10`, que decide EL HUB por canal. En
 * Instagram y Messenger llega `null` y aquí se queda en `null`: el PSID son
 * dígitos y recortarle diez daría algo con forma de teléfono que casaría con la
 * ficha de otra persona. Por eso tampoco se manda el `external_user_id`.
 */
export function toInboxConversation(c: HubConversation): InboxConversation {
  const last = c.last_message;
  const phone = c.contact?.phone_digits10 ? `+${c.contact.external_user_id.replace(/\D/g, "")}` : null;
  return {
    id: c.id,
    channel: c.channel,
    status: c.status,
    handler: c.handler,
    name: c.contact?.display_name?.trim() || null,
    phone,
    lastMessageAt: c.last_message_at ?? last?.at ?? null,
    lastInboundAt: c.last_inbound_at ?? null,
    // Lo decide el hub (`needs_reply`): una llamada entrante resuelta no espera a
    // nadie. Un hub anterior no lo manda; entonces, la dirección.
    waiting: last ? (last.needs_reply ?? last.direction === "inbound") : false,
    last: last
      ? {
          text: last.text ?? null,
          direction: last.direction === "inbound" ? "inbound" : "outbound",
          messageType: last.message_type ?? null,
          template: toTemplate(last.template),
          at: last.at,
        }
      : null,
  };
}

/** Qué es un adjunto: cruza el tipo del conector con el mime. */
export function attachmentKind(a: Pick<HubAttachment, "type" | "mime_type">): AttachmentKind {
  const mime = (a.mime_type ?? "").toLowerCase();
  if (a.type === "image" || mime.startsWith("image/")) return "image";
  if (a.type === "audio" || mime.startsWith("audio/")) return "audio";
  if (a.type === "video" || mime.startsWith("video/")) return "video";
  return "file";
}

export function toInboxMessage(m: HubMessage): InboxMessage {
  return {
    id: m.id,
    direction: m.direction === "inbound" ? "inbound" : "outbound",
    sender: m.sender_type,
    type: m.message_type,
    text: m.text ?? null,
    status: m.status,
    error: m.error ?? null,
    at: m.occurred_at,
    attachments: listOf<HubAttachment>(m.attachments).map((a) => ({
      index: a.index,
      kind: attachmentKind(a),
      mimeType: a.mime_type ?? null,
      mirrored: a.mirrored === true,
      transcript: a.transcript?.trim() || null,
    })),
    template: toTemplate(m.template),
  };
}

// -----------------------------------------------------------------------------
// Los textos del servidor
// -----------------------------------------------------------------------------

/** Lo que el servidor le dice al operador. `{status}` y `{reason}` se sustituyen. */
export type InboxServerMessages = {
  notConfigured: string;
  unreachable: string;
  rejected: string;
  notFound: string;
  mediaNotFound: string;
  busy: string;
  hubError: string;
  emptyText: string;
  tooLong: string;
  badHandler: string;
  badId: string;
  notSent: string;
};

export const INBOX_SERVER_MESSAGES: InboxServerMessages = {
  notConfigured:
    "The connection to Kigaru isn't configured on this deployment (SENZAI_CONNECTION_KEY, SENZAI_CONNECTION_SECRET and SENZAI_INGEST_URL).",
  unreachable: "Couldn't reach Kigaru to read the conversations. Try again in a moment.",
  rejected:
    "Kigaru rejected this site's connection ({status}). Check the connection key and that it has the channels:read and channels:write scopes.",
  notFound: "Conversation not found.",
  mediaNotFound: "Attachment not found, or not available yet.",
  busy: "Kigaru is busy right now. Try again in a moment.",
  hubError: "Kigaru couldn't answer ({status}). Try again in a moment.",
  emptyText: "Write a message before sending.",
  tooLong: "The message is too long: 4,000 characters at most.",
  badHandler: "Unknown handler: it is either agent or human.",
  badId: "Invalid conversation id.",
  notSent: "Not sent: {reason}",
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/**
 * El fallo del hub como respuesta para el navegador.
 *
 * 🪤 UN 401/403 DEL HUB SALE COMO 502, NUNCA TAL CUAL. Significa que la CONEXIÓN
 * del spoke está mal (secreto rotado, alcance que falta), no que la sesión del
 * operador caducara; y el cliente de API del kit manda al login ante cualquier
 * 401. Pasarlo tal cual echaría al operador de un panel en el que sí está dentro.
 *
 * 🪤 UN 404 SIGUE SIENDO 404, con el mismo texto para «no existe» y «no es tuyo»:
 * el hub ya los iguala a propósito y aquí no se deshace (sería un oráculo).
 */
export function failureStatus(f: HubFailure): number {
  if (f.kind === "unreachable") return 502;
  if (f.status === 401 || f.status === 403) return 502;
  if (f.status === 404) return 404;
  if (f.status === 400 || f.status === 422) return f.status;
  if (f.status === 429) return 429;
  return 502;
}

export function failureMessage(f: HubFailure, messages: InboxServerMessages = INBOX_SERVER_MESSAGES): string {
  if (f.kind === "unreachable") return messages.unreachable;
  if (f.status === 401 || f.status === 403) return fill(messages.rejected, { status: f.status });
  if (f.status === 404) return messages.notFound;
  if (f.status === 400 || f.status === 422) return f.detail;
  if (f.status === 429) return messages.busy;
  return fill(messages.hubError, { status: f.status });
}

// -----------------------------------------------------------------------------
// Los cargadores de la página y del menú
// -----------------------------------------------------------------------------

async function loadData(config: HubConfig): Promise<{ ok: true; data: InboxData } | HubFailure> {
  // Las dos a la vez: cada salto al hub son ~200 ms.
  const [list, channels] = await Promise.all([
    listConversations(config, { limit: CONVERSATION_LIMIT }),
    fetchChannels(config),
  ]);
  if (!list.ok) return list;
  if (!channels.ok) return channels;
  const conversations = list.conversations.filter((c) => !EXCLUDED_CHANNELS.has(c.channel));
  return {
    ok: true,
    data: {
      channels: toInboxChannels(channels.channels),
      conversations: conversations.map(toInboxConversation),
      truncated: list.conversations.length >= CONVERSATION_LIMIT,
    },
  };
}

/**
 * Lo que la página entrega a la isla en el primer pintado.
 *
 * 🪤 UN FALLO DEL HUB NO ES UNA BANDEJA VACÍA. «Nadie te ha escrito» es la
 * respuesta más tranquilizadora posible, y darla cuando no pudimos preguntar es
 * mentir en la peor dirección. Por eso un fallo vuelve con su causa.
 */
export async function loadInbox(
  config: HubConfig | null,
  { messages = INBOX_SERVER_MESSAGES }: { messages?: InboxServerMessages } = {},
): Promise<InboxLoad> {
  if (!config) return { ok: false, reason: "not_configured", error: messages.notConfigured };
  const result = await loadData(config);
  if (!result.ok) return { ok: false, reason: "hub_error", error: failureMessage(result, messages) };
  return result;
}

const visibilityCache = new Map<string, { visible: boolean; at: number }>();

/**
 * ¿Se enseña la entrada «Conversations» del menú?
 *
 * El módulo se instala al nacer el spoke y la entrada no se ve mientras el
 * cliente no tenga ningún canal con una cuenta activa; el día que conecta uno, la
 * página aparece sola. La regla es la misma que decide las pestañas.
 *
 * - Sin conexión configurada: no (un spoke sin conexión no puede tener bandeja).
 * - El hub falla o tarda: SÍ. Un fallo no puede esconder la bandeja de quien la
 *   tiene; la página dirá la causa.
 * - Se recuerda un minuto: el layout corre en cada carga y cada `router.refresh()`.
 */
export async function inboxVisible(
  config: HubConfig | null,
  { timeoutMs = 2500, ttlMs = 60_000, now = Date.now() }: { timeoutMs?: number; ttlMs?: number; now?: number } = {},
): Promise<boolean> {
  if (!config) return false;
  const cacheKey = `${config.baseUrl}|${config.key}`;
  const hit = visibilityCache.get(cacheKey);
  if (hit && now - hit.at < ttlMs) return hit.visible;
  const result = await fetchChannels(config, { timeoutMs });
  if (!result.ok) return true;
  const visible = toInboxChannels(result.channels).length > 0;
  visibilityCache.set(cacheKey, { visible, at: now });
  return visible;
}

// -----------------------------------------------------------------------------
// Las rutas proxy
// -----------------------------------------------------------------------------

/**
 * Lo que un `route.ts` del spoke re-exporta. Nada más:
 *
 *   // app/api/admin/conversations/[id]/route.ts
 *   import { inboxRoutes } from "@/lib/admin/conversations";
 *   export const dynamic = "force-dynamic";
 *   export const maxDuration = 60;
 *   export const { GET, POST, PATCH } = inboxRoutes.thread;
 *
 * 🪤 UN `route.ts` SOLO PUEDE EXPORTAR HANDLERS (y la config de segmento). Un
 * export de más —la factoría, un helper— compila con Turbopack y rompe con
 * `next build --webpack`, que el CI no siempre corre. Por eso la factoría vive
 * aquí y la ruta solo re-exporta.
 */
export type InboxRoutes = {
  /** `GET <endpoint>` → `{ data: InboxData }`. */
  list: (req: Request) => Promise<Response>;
  thread: {
    /** `GET <endpoint>/<id>` → `{ data: InboxThread }`. */
    GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    /** `POST <endpoint>/<id>` `{ text }` → 201 `{ data: InboxSendResult }`, o el motivo de que no saliera. */
    POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    /** `PATCH <endpoint>/<id>` `{ handler }` → `{ data: InboxHandlerResult }`. */
    PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  /** `GET <endpoint>/<id>/messages/<messageId>/media/<index>` → 302 a la URL firmada. */
  media: (
    req: Request,
    ctx: { params: Promise<{ id: string; messageId: string; index: string }> },
  ) => Promise<Response>;
};

export type InboxRouteOptions = {
  /**
   * La guarda del área: `null` deja pasar; una `Response` (el 401 del proyecto)
   * corta. Se llama ANTES que nada, también antes de validar los ids.
   */
  authorize: (req: Request) => Promise<Response | null | undefined>;
  /** De dónde sale la conexión. Por defecto, `hubFromEnv()`. */
  hub?: (req: Request) => HubConfig | null;
  messages?: Partial<InboxServerMessages>;
};

/**
 * Cualquier 8-4-4-4-12 hexadecimal: lo que el `uuid` de Postgres acepta.
 *
 * 🪤 Una expresión y no `z.string().uuid()`: zod 4 valida además la versión de la
 * RFC y rechaza ids que Postgres acepta (el tenant de Rivas es `aaaaaaaa-0000-…`).
 */
const ROW_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const MEDIA_INDEX = /^\d{1,3}$/;
const MAX_TEXT = 4000;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createInboxRoutes({ authorize, hub = () => hubFromEnv(), messages: overrides }: InboxRouteOptions): InboxRoutes {
  const messages: InboxServerMessages = { ...INBOX_SERVER_MESSAGES, ...overrides };
  const fail = (f: HubFailure) => json({ error: failureMessage(f, messages) }, failureStatus(f));

  async function open(req: Request): Promise<{ response: Response } | { config: HubConfig }> {
    const denied = await authorize(req);
    if (denied) return { response: denied };
    const config = hub(req);
    if (!config) return { response: json({ error: messages.notConfigured }, 503) };
    return { config };
  }

  async function openThread(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const opened = await open(req);
    if ("response" in opened) return opened;
    const { id } = await ctx.params;
    if (!ROW_ID.test(id)) return { response: json({ error: messages.badId }, 400) };
    return { config: opened.config, id };
  }

  return {
    async list(req) {
      const opened = await open(req);
      if ("response" in opened) return opened.response;
      const result = await loadData(opened.config);
      if (!result.ok) return fail(result);
      return json({ data: result.data });
    },

    thread: {
      async GET(req, ctx) {
        const opened = await openThread(req, ctx);
        if ("response" in opened) return opened.response;
        const result = await fetchThread(opened.config, opened.id);
        if (!result.ok) return fail(result);
        const data: InboxThread = {
          conversation: result.conversation,
          messages: result.messages.map(toInboxMessage),
          truncated: result.messages.length >= THREAD_LIMIT,
        };
        return json({ data });
      },

      async POST(req, ctx) {
        const opened = await openThread(req, ctx);
        if ("response" in opened) return opened.response;
        const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) return json({ error: messages.emptyText }, 422);
        if (text.length > MAX_TEXT) return json({ error: messages.tooLong }, 422);

        const result = await sendReply(opened.config, opened.id, text);
        if (!result.ok) return fail(result);
        const { outcome } = result;
        if (!outcome || !isSent(outcome)) {
          // 🪤 Lo que NO salió se responde como error, no como un 200 con
          // `sent: false`: así el cliente de API del kit lo lee como fallo y ninguna
          // pantalla lo puede dar por enviado sin mirar.
          const reason = outcome?.error || outcome?.status || "no outcome";
          return json(
            { error: fill(messages.notSent, { reason }), outcome: outcome ? { status: outcome.status, error: outcome.error ?? null } : null },
            outcome?.status === "rejected" ? 422 : 502,
          );
        }
        const data: InboxSendResult = { sent: true, status: outcome.status };
        return json({ data }, 201);
      },

      async PATCH(req, ctx) {
        const opened = await openThread(req, ctx);
        if ("response" in opened) return opened.response;
        const body = (await req.json().catch(() => null)) as { handler?: unknown } | null;
        const handler = body?.handler;
        if (handler !== "agent" && handler !== "human") return json({ error: messages.badHandler }, 422);
        const result = await setHandler(opened.config, opened.id, handler);
        if (!result.ok) return fail(result);
        const data: InboxHandlerResult = { handler: result.handler, changed: result.changed };
        return json({ data });
      },
    },

    async media(req, ctx) {
      const opened = await open(req);
      if ("response" in opened) return opened.response;
      const { id, messageId, index } = await ctx.params;
      if (!ROW_ID.test(id) || !ROW_ID.test(messageId) || !MEDIA_INDEX.test(index)) {
        return json({ error: messages.badId }, 400);
      }
      const result = await fetchMedia(opened.config, id, messageId, Number(index));
      if (!result.ok && result.kind === "refused" && result.status === 404) return json({ error: messages.mediaNotFound }, 404);
      if (!result.ok) return fail(result);
      // Redirige en vez de devolver la URL: así un `<img src>` o un `<audio src>`
      // apuntan a esta ruta y el navegador hace el resto, sin un fetch por foto. Se
      // deja cachear media hora (la firma vive una): repintar el hilo no vuelve a
      // pedirle al hub que firme. Los bytes no pasan por el spoke.
      return new Response(null, {
        status: 302,
        headers: { Location: result.url, "Cache-Control": "private, max-age=1800" },
      });
    },
  };
}
