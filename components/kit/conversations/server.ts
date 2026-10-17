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
  CallAttended,
  CallAttendedResult,
  CallCounts,
  CallDetail,
  CallDirection,
  CallItem,
  CallPeriod,
  CallSegment,
  CallTurn,
  CallView,
  CallsData,
  CallsLoad,
  CallsNav,
  HubAttachment,
  HubCall,
  HubCallCounts,
  HubCallTurn,
  HubChannelReport,
  HubConversation,
  HubInboxCounts,
  HubMessage,
  HubOutcome,
  HubTemplateView,
  InboxChannel,
  InboxConversation,
  InboxCounts,
  InboxData,
  InboxHandlerResult,
  InboxLoad,
  InboxMessage,
  InboxPage,
  InboxSegment,
  InboxSendResult,
  InboxTemplate,
  InboxThread,
} from "./types";
import type { NavBadgeValue } from "../nav";

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

/** Qué página de la bandeja se pide. Todo opcional: sin nada, la primera de «all». */
export type InboxListRequest = {
  segment?: InboxSegment;
  /** Nombre o número. El hub busca sin acentos ni signos, sobre todo el conjunto. */
  query?: string | null;
  /** El `nextCursor` de la página anterior, tal cual. */
  cursor?: string | null;
  limit?: number;
};

export type HubConversationList = {
  conversations: HubConversation[];
  nextCursor: string | null;
  counts: HubInboxCounts | null;
  countsExact: boolean;
};

/**
 * Una página de hilos del cliente, del que se movió último al primero
 * (contrato §2.1, «Leer la bandeja»).
 *
 * Pide SIEMPRE `kind=messages` y `counts=1`: la voz la deja fuera el hub —sobre
 * el conjunto, no sobre la página— y las cuentas de los segmentos salen de todo
 * el conjunto que acotan el tipo y la búsqueda, no de las filas que cupieron.
 *
 * 🪤 UN HUB ANTERIOR A LA DECISIÓN 12 ignora esos parámetros y contesta solo
 * `{ conversations }`: sin `next_cursor` ni `counts`. Se lee como una sola página
 * sin cifras (`counts: null`), nunca como «0 esperando».
 */
export async function listConversations(
  config: HubConfig,
  { segment = "all", query = null, cursor = null, limit = CONVERSATION_LIMIT }: InboxListRequest = {},
): Promise<({ ok: true } & HubConversationList) | HubFailure> {
  const params = new URLSearchParams({ kind: "messages", filter: SEGMENT_FILTER[segment], counts: "1", limit: String(limit) });
  if (query) params.set("q", query);
  if (cursor) params.set("cursor", cursor);
  try {
    const res = await hubFetch(config, `/api/channels/conversations?${params}`);
    if (!res.ok) return refused(res, "listar");
    const body = await readJson(res);
    return {
      ok: true,
      conversations: listOf<HubConversation>(body?.conversations),
      nextCursor: typeof body?.next_cursor === "string" && body.next_cursor ? body.next_cursor : null,
      counts: hubCounts(body?.counts),
      countsExact: body?.counts_exact !== false,
    };
  } catch (err) {
    return unreachable(err, "listar");
  }
}

/** Las cuentas del cuerpo, solo si traen las cuatro como números. Si no, ninguna. */
function hubCounts(value: unknown): HubInboxCounts | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const keys = ["todas", "esperando", "agente", "operador"] as const;
  if (!keys.every((k) => typeof c[k] === "number" && Number.isFinite(c[k]))) return null;
  return { todas: c.todas as number, esperando: c.esperando as number, agente: c.agente as number, operador: c.operador as number };
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
 *
 * Los HILOS de voz los deja fuera el hub (`kind=messages`), que es donde tiene
 * que pasar: filtrarlos aquí, después de paginar, dejaba páginas cortas y cuentas
 * que no cuadraban con la lista. Este filtro queda para los CANALES (la voz no es
 * pestaña ni hace visible la bandeja) y como red ante un hub anterior.
 */
const EXCLUDED_CHANNELS = new Set(["voice"]);

/**
 * Los cuatro segmentos, en el orden de la tira. La URL del spoke los nombra en
 * inglés (`?segment=waiting`); el cable, como el hub (`filter=esperando`).
 *
 * 🪤 Repetidos en `inbox.ts` (la isla), porque este fichero no importa valores
 * relativos; un test exige que sean los mismos.
 */
export const INBOX_SEGMENTS: readonly InboxSegment[] = ["all", "waiting", "agent", "operator"];

const SEGMENT_FILTER: Record<InboxSegment, keyof HubInboxCounts> = {
  all: "todas",
  waiting: "esperando",
  agent: "agente",
  operator: "operador",
};

export function isInboxSegment(value: unknown): value is InboxSegment {
  return typeof value === "string" && (INBOX_SEGMENTS as readonly string[]).includes(value);
}

/**
 * El segmento de la URL de una PÁGINA: uno que no se entiende es «all», que la
 * tira enseña elegido (se ve, no engaña). La ruta proxy, en cambio, da 400: allí
 * solo llega lo que manda la isla, y un valor raro es un fallo de quien llama.
 */
export function readSegment(value: string | string[] | null | undefined): InboxSegment {
  const raw = Array.isArray(value) ? value[0] : value;
  return isInboxSegment(raw) ? raw : "all";
}

/** Lo más largo que se busca: un nombre y un número caben de sobra. */
const MAX_QUERY = 100;

/** La búsqueda de la URL de una página: sin espacios de sobra, cortada al tope, o `null`. */
export function readQuery(value: string | string[] | null | undefined): string | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim();
  return raw ? raw.slice(0, MAX_QUERY) : null;
}

/** Las cuentas del cable, con las claves de la isla. */
export function toInboxCounts(counts: HubInboxCounts | null): InboxCounts | null {
  if (!counts) return null;
  return { all: counts.todas, waiting: counts.esperando, agent: counts.agente, operator: counts.operador };
}

function toPage(list: HubConversationList, request: InboxListRequest): InboxPage {
  return {
    segment: request.segment ?? "all",
    query: request.query ?? null,
    conversations: list.conversations.filter((c) => !EXCLUDED_CHANNELS.has(c.channel)).map(toInboxConversation),
    nextCursor: list.nextCursor,
    counts: toInboxCounts(list.counts),
    countsExact: list.countsExact,
  };
}

/**
 * El orden de las pestañas. Un canal que no está aquí va al final, por nombre.
 * Telegram, el último: es el banco de pruebas del agente, sin clientes detrás.
 */
const CHANNEL_ORDER = ["whatsapp", "instagram", "messenger", "sms", "webchat", "tiktok", "telegram"];

function channelRank(channel: string): number {
  const i = CHANNEL_ORDER.indexOf(channel);
  return i === -1 ? CHANNEL_ORDER.length : i;
}

/** Cuántos hilos trae cada página (el tope del hub es 100). */
export const CONVERSATION_LIMIT = 50;
/** Lo más que se pide de una vez: el tope del hub. Al releer, la isla pide lo que enseña. */
const MAX_CONVERSATION_LIMIT = 100;
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
  badSegment: string;
  badQuery: string;
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
  badSegment: "Unknown segment: it is all, waiting, agent or operator.",
  badQuery: "The search is too long: 100 characters at most.",
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

/** Los textos que necesita `failureMessage`: los de la bandeja y los de las llamadas los tienen. */
type FailureMessages = Pick<InboxServerMessages, "unreachable" | "rejected" | "notFound" | "busy" | "hubError">;

export function failureMessage(f: HubFailure, messages: FailureMessages = INBOX_SERVER_MESSAGES): string {
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

async function loadData(config: HubConfig, request: InboxListRequest): Promise<{ ok: true; data: InboxData } | HubFailure> {
  // Las dos a la vez: cada salto al hub son ~200 ms.
  const [list, channels] = await Promise.all([listConversations(config, request), fetchChannels(config)]);
  if (!list.ok) return list;
  if (!channels.ok) return channels;
  return { ok: true, data: { channels: toInboxChannels(channels.channels), ...toPage(list, request) } };
}

/** Una página siguiente: solo la lista. Los canales ya están pintados. */
async function loadPage(config: HubConfig, request: InboxListRequest): Promise<{ ok: true; page: InboxPage } | HubFailure> {
  const list = await listConversations(config, request);
  if (!list.ok) return list;
  return { ok: true, page: toPage(list, request) };
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
  {
    segment,
    query,
    messages = INBOX_SERVER_MESSAGES,
  }: {
    /** El `?segment=` de la página, tal cual: uno que no se entiende es «all». */
    segment?: string | string[] | null;
    /** El `?q=` de la página, tal cual. */
    query?: string | string[] | null;
    messages?: InboxServerMessages;
  } = {},
): Promise<InboxLoad> {
  if (!config) return { ok: false, reason: "not_configured", error: messages.notConfigured };
  // El primer pintado ya es el de la URL: un enlace a «waiting» abre en «waiting».
  const result = await loadData(config, { segment: readSegment(segment), query: readQuery(query) });
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
  /**
   * `GET <endpoint>?segment=&q=&limit=` → `{ data: InboxData }`, la primera página
   * con los canales; con `&cursor=` → `{ data: InboxPage }`, solo la siguiente.
   */
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

/** Cuántas filas pedir: las de una página, o las que la isla enseña al releer, hasta el tope del hub. */
function listLimit(raw: string | null): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1) return CONVERSATION_LIMIT;
  return Math.min(n, MAX_CONVERSATION_LIMIT);
}

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
      const params = new URL(req.url).searchParams;
      // 🪤 Un segmento que no se entiende es un 400, no «all»: aquí solo llega lo
      // que manda la isla, y la tira enseñaría «Waiting» encima de la lista entera.
      const segment = params.get("segment");
      if (segment !== null && !isInboxSegment(segment)) return json({ error: messages.badSegment }, 400);
      const query = params.get("q")?.trim() || null;
      if (query && query.length > MAX_QUERY) return json({ error: messages.badQuery }, 400);
      const request: InboxListRequest = {
        segment: segment ?? "all",
        query,
        // El cursor es opaco: lo valida el hub, que es quien lo escribió (400 si no es suyo).
        cursor: params.get("cursor") || null,
        limit: listLimit(params.get("limit")),
      };
      if (request.cursor) {
        const page = await loadPage(opened.config, request);
        if (!page.ok) return fail(page);
        return json({ data: page.page });
      }
      const result = await loadData(opened.config, request);
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

// =============================================================================
// Las llamadas (contrato §2.3, «Las llamadas»; decisión 12)
// =============================================================================
// El registro de llamadas del estudio, para que su admin atienda las que piden a
// una persona («Needs a human»). Misma conexión y mismos alcances que la bandeja:
// `channels:read` para leer y escuchar, `channels:write` para marcar como atendida.
// Por eso vive en este fichero: reutiliza el `fetch` al hub, los 401/403 que salen
// como 502 y el 404 sin oráculo, sin copiarlos.
//
//   import { callsBadge, callsNav, createCallRoutes, hubFromEnv, loadCalls } from "@/components/kit/conversations/server";
//
// 🪤 LA MARCA ES LA MISMA QUE VE KIGARU: atendida aquí, deja de contar en
// «Requieren humano» también en el admin del hub, y al revés.
//
// 🪤 QUIÉN MARCA LO DICE EL SERVIDOR, NO EL NAVEGADOR: `attendedBy(req)` sale de la
// sesión del área. Un `by` que viniera en el cuerpo se ignora.
// =============================================================================

/**
 * Los cuatro cortes, en el orden de la tira. La URL del spoke los nombra en inglés
 * (`?segment=needs_human`); el cable, como el hub (`filter=humano`).
 *
 * 🪤 Repetidos en `calls.ts` (la isla), porque este fichero no importa valores
 * relativos; un test exige que sean los mismos. Igual los periodos y direcciones.
 */
export const CALL_SEGMENTS: readonly CallSegment[] = ["all", "answered", "unanswered", "needs_human"];
/** En el orden del control. */
export const CALL_PERIODS: readonly CallPeriod[] = ["7d", "30d", "all"];
export const CALL_DIRECTIONS: readonly CallDirection[] = ["all", "inbound", "outbound"];

/**
 * Lo que se ve sin filtros: TODO, como el contrato. 🪤 Con «30 días» por defecto
 * una llamada pendiente de hace cinco semanas desaparecería de la vista, y la cifra
 * del menú (que cuenta todas) no cuadraría con la de la tira.
 */
export const DEFAULT_CALL_VIEW: CallView = { segment: "all", period: "all", direction: "all", query: null };

const CALL_FILTER: Record<CallSegment, keyof HubCallCounts> = {
  all: "todas",
  answered: "contestadas",
  unanswered: "sin_contestar",
  needs_human: "humano",
};

/** Cuántas llamadas trae cada página (el tope del hub es 100). */
export const CALLS_PAGE_SIZE = 50;
const MAX_CALLS_LIMIT = 100;
const NAV_TIMEOUT_MS = 2_500;

export function isCallSegment(value: unknown): value is CallSegment {
  return typeof value === "string" && (CALL_SEGMENTS as readonly string[]).includes(value);
}

export function isCallPeriod(value: unknown): value is CallPeriod {
  return typeof value === "string" && (CALL_PERIODS as readonly string[]).includes(value);
}

export function isCallDirection(value: unknown): value is CallDirection {
  return typeof value === "string" && (CALL_DIRECTIONS as readonly string[]).includes(value);
}

type RawParam = string | string[] | null | undefined;
const first = (value: RawParam) => (Array.isArray(value) ? value[0] : value);

/**
 * La vista de la URL de una PÁGINA: lo que no se entiende cae al valor por defecto,
 * que la tira y los controles enseñan elegido (se ve, no engaña). La ruta proxy, en
 * cambio, da 400: allí solo llega lo que manda la isla.
 */
export function readCallView({
  segment,
  period,
  direction,
  query,
}: { segment?: RawParam; period?: RawParam; direction?: RawParam; query?: RawParam } = {}): CallView {
  const s = first(segment);
  const p = first(period);
  const d = first(direction);
  return {
    segment: isCallSegment(s) ? s : DEFAULT_CALL_VIEW.segment,
    period: isCallPeriod(p) ? p : DEFAULT_CALL_VIEW.period,
    direction: isCallDirection(d) ? d : DEFAULT_CALL_VIEW.direction,
    query: readQuery(query),
  };
}

export type HubCallList = {
  calls: HubCall[];
  nextCursor: string | null;
  counts: HubCallCounts | null;
  avgDurationSecs: number | null;
  avgDurationOver: number;
  countsExact: boolean;
};

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

/** Las cuentas del cuerpo, solo si traen las cuatro como números. Si no, ninguna. */
function hubCallCounts(value: unknown): HubCallCounts | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const keys = ["todas", "contestadas", "sin_contestar", "humano"] as const;
  if (!keys.every((k) => typeof c[k] === "number" && Number.isFinite(c[k]))) return null;
  return {
    todas: c.todas as number,
    contestadas: c.contestadas as number,
    sin_contestar: c.sin_contestar as number,
    humano: c.humano as number,
  };
}

/**
 * Una página del registro, de la más reciente a la más vieja (contrato §2.3).
 * Manda SIEMPRE periodo, dirección y corte: el hub da 400 a uno que no entiende, y
 * así un valor mal escrito no se convierte en «todas» sin avisar.
 */
export async function listCalls(
  config: HubConfig,
  {
    view,
    cursor = null,
    limit = CALLS_PAGE_SIZE,
    timeoutMs,
  }: { view: CallView; cursor?: string | null; limit?: number; timeoutMs?: number },
): Promise<({ ok: true } & HubCallList) | HubFailure> {
  const params = new URLSearchParams({
    period: view.period,
    direction: view.direction,
    filter: CALL_FILTER[view.segment],
    limit: String(limit),
  });
  if (view.query) params.set("q", view.query);
  if (cursor) params.set("cursor", cursor);
  try {
    const res = await hubFetch(config, `/api/channels/calls?${params}`, { timeoutMs });
    if (!res.ok) return refused(res, "listar las llamadas");
    const body = await readJson(res);
    return {
      ok: true,
      calls: listOf<HubCall>(body?.calls),
      nextCursor: typeof body?.next_cursor === "string" && body.next_cursor ? body.next_cursor : null,
      counts: hubCallCounts(body?.counts),
      avgDurationSecs: finiteOrNull(body?.avg_duration_secs),
      avgDurationOver: finiteOrNull(body?.avg_duration_over) ?? 0,
      countsExact: body?.counts_exact !== false,
    };
  } catch (err) {
    return unreachable(err, "listar las llamadas");
  }
}

/** Una llamada entera: con su transcripción y el hilo de mensajería de la misma persona. */
export async function fetchCall(
  config: HubConfig,
  callId: string,
): Promise<{ ok: true; call: HubCall; messagingConversationId: string | null } | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/calls/${callId}`);
    if (!res.ok) return refused(res, "leer la llamada");
    const body = await readJson(res);
    const call = body?.call && typeof body.call === "object" ? (body.call as HubCall) : null;
    if (!call) return { ok: false, kind: "refused", status: 502, detail: "the hub sent no call" };
    const messaging = body?.messaging_conversation_id;
    return { ok: true, call, messagingConversationId: typeof messaging === "string" && ROW_ID.test(messaging) ? messaging : null };
  } catch (err) {
    return unreachable(err, "leer la llamada");
  }
}

/**
 * Marcar (`true`, con quién) o desmarcar (`false`) una llamada como atendida.
 *
 * 🪤 Solo se marca una que pide a una persona: otra da 409. Marcar una ya marcada
 * no cambia nada: se queda la PRIMERA marca, con su quién y su cuándo. Por eso se
 * devuelve la marca que dice el hub, no la que se pidió.
 */
export async function setCallAttended(
  config: HubConfig,
  callId: string,
  attended: boolean,
  by?: string,
): Promise<({ ok: true } & CallAttendedResult) | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/calls/${callId}`, {
      method: "PATCH",
      body: attended ? { attended: true, by } : { attended: false },
    });
    if (!res.ok) return refused(res, "marcar la llamada");
    const body = await readJson(res);
    const call = (body?.call ?? {}) as Partial<Pick<HubCall, "id" | "needs_human" | "attended">>;
    return {
      ok: true,
      id: typeof call.id === "string" ? call.id : callId,
      needsHuman: call.needs_human === true,
      attended: toAttended(call.attended),
    };
  } catch (err) {
    return unreachable(err, "marcar la llamada");
  }
}

/**
 * La grabación: una URL firmada de una hora, que el hub firma al pedirla (al pulsar
 * «play», no al listar). El 404 es «no existe, no es tuya o no tiene grabación», todo igual.
 */
export async function fetchRecording(
  config: HubConfig,
  conversationId: string,
  callId: string,
): Promise<{ ok: true; url: string; mimeType: string | null } | HubFailure> {
  try {
    const res = await hubFetch(config, `/api/channels/conversations/${conversationId}/messages/${callId}/recording`);
    if (!res.ok) return refused(res, "leer la grabación");
    const body = await readJson(res);
    if (typeof body?.url !== "string" || !body.url) {
      return { ok: false, kind: "refused", status: 502, detail: "the hub sent no recording URL" };
    }
    return { ok: true, url: body.url, mimeType: typeof body.mime_type === "string" ? body.mime_type : null };
  } catch (err) {
    return unreachable(err, "leer la grabación");
  }
}

// -----------------------------------------------------------------------------
// Del hub al view-model
// -----------------------------------------------------------------------------

function toAttended(value: unknown): CallAttended | null {
  if (!value || typeof value !== "object") return null;
  const a = value as { at?: unknown; by?: unknown };
  if (typeof a.at !== "string" || !a.at) return null;
  return { at: a.at, by: typeof a.by === "string" && a.by.trim() ? a.by.trim() : null };
}

const textOrNull = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * Una llamada como la pinta la lista.
 *
 * 🪤 EL TELÉFONO SOLO SALE CON `phone_digits10`, como en la bandeja: lo decide el
 * hub. Y el `external_user_id` crudo no baja al navegador.
 */
export function toCallItem(c: HubCall): CallItem {
  const digits = c.contact?.phone_digits10 ? (c.contact.external_user_id ?? "").replace(/\D/g, "") : "";
  return {
    id: c.id,
    conversationId: c.conversation_id,
    direction: c.direction === "inbound" ? "inbound" : "outbound",
    at: c.occurred_at,
    outcome: c.outcome,
    durationSecs: finiteOrNull(c.duration_secs),
    lang: textOrNull(c.lang),
    summary: textOrNull(c.summary),
    needsHuman: c.needs_human === true,
    humanNote: textOrNull(c.human_note),
    attended: toAttended(c.attended),
    optOut: c.opt_out === true,
    purpose: textOrNull(c.purpose),
    label: textOrNull(c.label),
    recording: c.recording === true,
    transcriptTurns:
      typeof c.transcript_turns === "number" ? c.transcript_turns : Array.isArray(c.transcript) ? c.transcript.length : 0,
    name: textOrNull(c.contact?.display_name),
    phone: digits ? `+${digits}` : null,
  };
}

export function toCallDetail(c: HubCall, messagingConversationId: string | null): CallDetail {
  const transcript: CallTurn[] = listOf<HubCallTurn>(c.transcript)
    .filter((t) => typeof t?.message === "string" && t.message.trim())
    .map((t) => ({ role: t.role, text: (t.message as string).trim(), atSecs: finiteOrNull(t.time_in_call_secs) }));
  return { ...toCallItem(c), transcriptTurns: transcript.length, transcript, messagingConversationId };
}

/** Las cuentas del cable, con las claves de la isla. */
export function toCallCounts(counts: HubCallCounts | null): CallCounts | null {
  if (!counts) return null;
  return { all: counts.todas, answered: counts.contestadas, unanswered: counts.sin_contestar, needs_human: counts.humano };
}

export function toCallsData(list: HubCallList, view: CallView): CallsData {
  return {
    view,
    calls: list.calls.map(toCallItem),
    nextCursor: list.nextCursor,
    counts: toCallCounts(list.counts),
    avgDurationSecs: list.avgDurationSecs,
    avgDurationOver: list.avgDurationOver,
    countsExact: list.countsExact,
  };
}

// -----------------------------------------------------------------------------
// Los textos del servidor
// -----------------------------------------------------------------------------

export type CallsServerMessages = FailureMessages & {
  notConfigured: string;
  recordingNotFound: string;
  badId: string;
  badSegment: string;
  badPeriod: string;
  badDirection: string;
  badQuery: string;
  badAttended: string;
  noOperator: string;
  notNeeded: string;
};

export const CALLS_SERVER_MESSAGES: CallsServerMessages = {
  notConfigured: INBOX_SERVER_MESSAGES.notConfigured,
  unreachable: "Couldn't reach Kigaru to read the calls. Try again in a moment.",
  rejected: INBOX_SERVER_MESSAGES.rejected,
  notFound: "Call not found.",
  recordingNotFound: "This call has no recording.",
  busy: INBOX_SERVER_MESSAGES.busy,
  hubError: INBOX_SERVER_MESSAGES.hubError,
  badId: "Invalid call id.",
  badSegment: "Unknown filter: it is all, answered, unanswered or needs_human.",
  badPeriod: "Unknown period: it is all, 7d or 30d.",
  badDirection: "Unknown direction: it is all, inbound or outbound.",
  badQuery: INBOX_SERVER_MESSAGES.badQuery,
  badAttended: "Say whether the call is attended: true or false.",
  noOperator: "Couldn't tell who is signed in, so the call wasn't marked.",
  notNeeded: "This call doesn't need a person.",
};

/** Como `failureStatus`, más el 409 de marcar una llamada que no pide a nadie. */
function callFailureStatus(f: HubFailure): number {
  return f.kind === "refused" && f.status === 409 ? 409 : failureStatus(f);
}

function callFailureMessage(f: HubFailure, messages: CallsServerMessages): string {
  return f.kind === "refused" && f.status === 409 ? messages.notNeeded : failureMessage(f, messages);
}

// -----------------------------------------------------------------------------
// La carga de la página y el menú
// -----------------------------------------------------------------------------

/**
 * Lo que la página entrega a la isla en el primer pintado: ya la vista de la URL.
 *
 * 🪤 UN FALLO DEL HUB NO ES UN REGISTRO VACÍO: «nadie ha llamado» dicho cuando no
 * pudimos preguntar esconde justo las llamadas que esperan a una persona.
 */
export async function loadCalls(
  config: HubConfig | null,
  {
    segment,
    period,
    direction,
    query,
    messages = CALLS_SERVER_MESSAGES,
  }: { segment?: RawParam; period?: RawParam; direction?: RawParam; query?: RawParam; messages?: CallsServerMessages } = {},
): Promise<CallsLoad> {
  const view = readCallView({ segment, period, direction, query });
  if (!config) return { ok: false, reason: "not_configured", error: messages.notConfigured, view };
  const list = await listCalls(config, { view });
  if (!list.ok) return { ok: false, reason: "hub_error", error: callFailureMessage(list, messages), view };
  return { ok: true, data: toCallsData(list, view) };
}

/**
 * La entrada «Calls» del menú: si se ve y cuántas piden a una persona.
 *
 * - Sin conexión configurada: no se ve.
 * - Se ve si la línea de voz tiene una cuenta activa (`agent-switch`, como la
 *   bandeja) o si ya hay llamadas en el historial: una línea desconectada no
 *   esconde las que siguen esperando.
 * - Un hub sin la API de llamadas (404/405) o una conexión sin `channels:read`
 *   (403): no se ve. No hay vista que enseñar.
 * - El hub falla, tarda (2,5 s) o rechaza la credencial (401): SÍ se ve, sin
 *   número. Un fallo no puede esconder las llamadas de quien las tiene.
 *
 * El número es `counts.humano` de `?filter=humano&limit=1`: las PENDIENTES, sobre
 * todo el historial. Nunca lanza. No se recuerda: el número tiene que ser el de ahora.
 */
export async function callsNav(
  config: HubConfig | null,
  { timeoutMs = NAV_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<CallsNav> {
  if (!config) return { visible: false, needsHuman: null, exact: true };
  const [channels, pending] = await Promise.all([
    fetchChannels(config, { timeoutMs }),
    listCalls(config, { view: { ...DEFAULT_CALL_VIEW, segment: "needs_human" }, limit: 1, timeoutMs }),
  ]);
  if (!pending.ok) {
    const missing = pending.kind === "refused" && (pending.status === 403 || pending.status === 404 || pending.status === 405);
    return { visible: !missing, needsHuman: null, exact: true };
  }
  // Sin poder leer los canales, se ve: el lado seguro.
  const voice = channels.ok ? channels.channels.some((c) => c.channel === "voice" && Number(c.accounts) > 0) : true;
  const history = (pending.counts?.todas ?? 0) > 0 || pending.calls.length > 0;
  return { visible: voice || history, needsHuman: pending.counts?.humano ?? null, exact: pending.countsExact };
}

/**
 * El badge del menú: ámbar, porque es alguien esperando a una persona (pide
 * atención; no es una avería). Sin número si no se pudo contar.
 */
export function callsBadge(nav: CallsNav): NavBadgeValue | undefined {
  if (nav.needsHuman === null) return undefined;
  // 🪤 `incomplete` con 0 pinta «!»: solo se dice cuando hay algo que contar.
  return { count: nav.needsHuman, tone: "amber", incomplete: !nav.exact && nav.needsHuman > 0 };
}

// -----------------------------------------------------------------------------
// Las rutas proxy
// -----------------------------------------------------------------------------

/**
 * Lo que un `route.ts` del spoke re-exporta. Nada más:
 *
 *   // app/api/admin/calls/route.ts                → export const GET = callRoutes.list;
 *   // app/api/admin/calls/[id]/route.ts           → export const { GET, PATCH } = callRoutes.call;
 *   // app/api/admin/calls/[id]/recording/route.ts → export const GET = callRoutes.recording;
 *
 * 🪤 UN `route.ts` SOLO PUEDE EXPORTAR HANDLERS. Un export de más compila con
 * Turbopack y rompe con `next build --webpack`.
 */
export type CallRoutes = {
  /** `GET <endpoint>?segment=&period=&direction=&q=&cursor=&limit=` → `{ data: CallsData }`. */
  list: (req: Request) => Promise<Response>;
  call: {
    /** `GET <endpoint>/<id>` → `{ data: CallDetail }`. */
    GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    /** `PATCH <endpoint>/<id>` `{ attended }` → `{ data: CallAttendedResult }`. */
    PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  /** `GET <endpoint>/<id>/recording?conversation=<id>` → 302 a la URL firmada. */
  recording: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
};

export type CallRouteOptions = {
  /** La guarda del área: `null` deja pasar; una `Response` (el 401 del proyecto) corta. Va primero. */
  authorize: (req: Request) => Promise<Response | null | undefined>;
  /**
   * Quién marca la llamada como atendida: el nombre o el correo del admin con
   * sesión, tal como lo enseña la app (se corta a 120 caracteres). Sale de la
   * sesión, en el servidor; el navegador no lo manda.
   */
  attendedBy: (req: Request) => Promise<string | null | undefined> | string | null | undefined;
  /** De dónde sale la conexión. Por defecto, `hubFromEnv()`. */
  hub?: (req: Request) => HubConfig | null;
  messages?: Partial<CallsServerMessages>;
};

const MAX_BY = 120;

function callsLimit(raw: string | null): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1) return CALLS_PAGE_SIZE;
  return Math.min(n, MAX_CALLS_LIMIT);
}

export function createCallRoutes({ authorize, attendedBy, hub = () => hubFromEnv(), messages: overrides }: CallRouteOptions): CallRoutes {
  const messages: CallsServerMessages = { ...CALLS_SERVER_MESSAGES, ...overrides };
  const fail = (f: HubFailure) => json({ error: callFailureMessage(f, messages) }, callFailureStatus(f));

  async function open(req: Request): Promise<{ response: Response } | { config: HubConfig }> {
    const denied = await authorize(req);
    if (denied) return { response: denied };
    const config = hub(req);
    if (!config) return { response: json({ error: messages.notConfigured }, 503) };
    return { config };
  }

  async function openCall(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
      const params = new URL(req.url).searchParams;
      // 🪤 Un valor que no se entiende es un 400, no el de por defecto: aquí solo
      // llega lo que manda la isla, y la tira enseñaría un corte sobre otra lista.
      const segment = params.get("segment");
      if (segment !== null && !isCallSegment(segment)) return json({ error: messages.badSegment }, 400);
      const period = params.get("period");
      if (period !== null && !isCallPeriod(period)) return json({ error: messages.badPeriod }, 400);
      const direction = params.get("direction");
      if (direction !== null && !isCallDirection(direction)) return json({ error: messages.badDirection }, 400);
      const query = params.get("q")?.trim() || null;
      if (query && query.length > MAX_QUERY) return json({ error: messages.badQuery }, 400);
      const view: CallView = {
        segment: segment ?? DEFAULT_CALL_VIEW.segment,
        period: period ?? DEFAULT_CALL_VIEW.period,
        direction: direction ?? DEFAULT_CALL_VIEW.direction,
        query,
      };
      // El cursor es opaco: lo valida el hub, que es quien lo escribió (400 si no es suyo).
      const list = await listCalls(opened.config, { view, cursor: params.get("cursor") || null, limit: callsLimit(params.get("limit")) });
      if (!list.ok) return fail(list);
      return json({ data: toCallsData(list, view) });
    },

    call: {
      async GET(req, ctx) {
        const opened = await openCall(req, ctx);
        if ("response" in opened) return opened.response;
        const result = await fetchCall(opened.config, opened.id);
        if (!result.ok) return fail(result);
        return json({ data: toCallDetail(result.call, result.messagingConversationId) });
      },

      async PATCH(req, ctx) {
        const opened = await openCall(req, ctx);
        if ("response" in opened) return opened.response;
        const body = (await req.json().catch(() => null)) as { attended?: unknown } | null;
        const attended = body?.attended;
        if (typeof attended !== "boolean") return json({ error: messages.badAttended }, 422);
        let by: string | undefined;
        if (attended) {
          by = (await attendedBy(req))?.trim().slice(0, MAX_BY);
          // Sin quién, no se marca: la marca es «atendida por X» en los dos lados.
          if (!by) return json({ error: messages.noOperator }, 500);
        }
        const result = await setCallAttended(opened.config, opened.id, attended, by);
        if (!result.ok) return fail(result);
        const data: CallAttendedResult = { id: result.id, needsHuman: result.needsHuman, attended: result.attended };
        return json({ data });
      },
    },

    async recording(req, ctx) {
      const opened = await openCall(req, ctx);
      if ("response" in opened) return opened.response;
      const conversationId = new URL(req.url).searchParams.get("conversation") ?? "";
      if (!ROW_ID.test(conversationId)) return json({ error: messages.badId }, 400);
      const result = await fetchRecording(opened.config, conversationId, opened.id);
      if (!result.ok && result.kind === "refused" && result.status === 404) return json({ error: messages.recordingNotFound }, 404);
      if (!result.ok) return fail(result);
      // Como un adjunto: un `<audio src>` apunta aquí y el navegador sigue el 302. Se
      // deja cachear media hora (la firma vive una); los bytes no pasan por el spoke.
      return new Response(null, {
        status: 302,
        headers: { Location: result.url, "Cache-Control": "private, max-age=1800" },
      });
    },
  };
}
