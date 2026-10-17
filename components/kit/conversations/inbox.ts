// =============================================================================
// La bandeja de conversaciones — la lógica pura de la isla
// =============================================================================
// Qué se lee de cada mensaje, cómo se nombra a quien escribe, qué segmentos hay,
// cómo se juntan las páginas y qué dice el estado de entrega. Vive aparte de los componentes por dos razones:
// tiene tests (`node --test`), y la lista y el hilo leen el MISMO mensaje con las
// mismas palabras — una foto es «Photo» en los dos sitios, nunca «Photo» en uno y
// «Template» en el otro.
//
// Los textos entran por `labels` (§6): todos con su inglés por defecto, y con
// `{placeholders}` en vez de funciones, porque `labels` viaja de una página de
// servidor a la isla y una función no se puede serializar.
//
// 🪤 Sin imports relativos de valor (solo `import type`): los tests lo cargan con
// Node tal cual.
// =============================================================================

import type { StatusMeta } from "../status";
import type {
  AgentState,
  InboxAttachment,
  InboxChannel,
  InboxConversation,
  InboxCounts,
  InboxMessage,
  InboxPage,
  InboxPreview,
  InboxSegment,
  InboxTemplate,
} from "./types";

export type InboxLabels = {
  // Segmentos y cabecera
  segmentsLabel: string;
  segmentAll: string;
  segmentWaiting: string;
  segmentAgent: string;
  segmentOperator: string;
  countsApprox: string;
  searchLabel: string;
  searchPlaceholder: string;
  clearSearch: string;
  refresh: string;
  refreshing: string;
  refreshFailed: string;
  // Más páginas
  showingCount: string;
  loadMore: string;
  loadingMore: string;
  loadMoreFailed: string;
  // Vacíos y errores
  noChannelsTitle: string;
  noChannelsHint: string;
  emptyTitle: string;
  emptyHint: string;
  emptyWaitingTitle: string;
  emptyAgentTitle: string;
  emptyOperatorTitle: string;
  noResultsTitle: string;
  noResultsHint: string;
  loadFailedTitle: string;
  notConfiguredTitle: string;
  retry: string;
  pickConversation: string;
  // La lista
  waiting: string;
  handledByYou: string;
  outboundPrefix: string;
  unknownContact: string;
  // El agente, por canal
  agentAnswering: string;
  agentMuted: string;
  agentUnconfigured: string;
  agentUnknown: string;
  // El hilo
  loadingThread: string;
  threadFailed: string;
  emptyThread: string;
  olderHidden: string;
  you: string;
  agent: string;
  automatic: string;
  close: string;
  // Responder y devolver
  replyLabel: string;
  replyPlaceholder: string;
  send: string;
  sending: string;
  takeoverWarning: string;
  whatsappWindow: string;
  agentSwitch: string;
  agentOn: string;
  agentOff: string;
  tookOver: string;
  handBackConfirmTitle: string;
  handBackConfirmMuted: string;
  handBackConfirmUnconfigured: string;
  handBackConfirm: string;
  cancel: string;
  handedBack: string;
  // Archivar y borrar (contrato §2.4)
  archive: string;
  restore: string;
  deleteForever: string;
  archivedLink: string;
  archivedTitle: string;
  archivedHint: string;
  backToInbox: string;
  archivedBadge: string;
  archivedDone: string;
  restoredDone: string;
  deletedDone: string;
  undo: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  deleteConfirm: string;
  emptyArchivedTitle: string;
  emptyArchivedHint: string;
  // Contenido de los mensajes
  template: string;
  templateUntitled: string;
  noText: string;
  photo: string;
  photos: string;
  voiceNote: string;
  voiceNotes: string;
  video: string;
  videos: string;
  document: string;
  documents: string;
  attachments: string;
  sticker: string;
  location: string;
  postback: string;
  call: string;
  transcript: string;
  attachmentPending: string;
  attachmentFailed: string;
  openDocument: string;
  openPhoto: string;
  // Entrega de lo que se manda
  deliverySending: string;
  deliverySent: string;
  deliverySentNoReceipts: string;
  deliveryDelivered: string;
  deliveryRead: string;
  deliveryFailed: string;
  deliverySkipped: string;
  deliveryUnknown: string;
  // Canales
  channelNames: Record<string, string>;
};

export const INBOX_LABELS: InboxLabels = {
  segmentsLabel: "Filter conversations",
  segmentAll: "All",
  segmentWaiting: "Waiting",
  segmentAgent: "AI agent",
  segmentOperator: "Operator",
  countsApprox: "The counts cover the {count} most recent conversations.",
  searchLabel: "Search conversations",
  searchPlaceholder: "Search by name or number",
  clearSearch: "Clear",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  refreshFailed: "Couldn't refresh: {reason}",

  showingCount: "Showing {showing} of {total} conversations",
  loadMore: "Load more",
  loadingMore: "Loading…",
  loadMoreFailed: "Couldn't load more: {reason}",

  noChannelsTitle: "No messaging channel is connected yet.",
  noChannelsHint: "When Instagram, Messenger or WhatsApp is connected in Kigaru, the conversations appear here.",
  emptyTitle: "No conversations yet.",
  emptyHint: "Messages people send on {channels} appear here as they arrive.",
  emptyWaitingTitle: "Nobody is waiting for a reply.",
  emptyAgentTitle: "The AI agent isn't handling any conversation.",
  emptyOperatorTitle: "Nobody on your team is handling a conversation.",
  noResultsTitle: "No conversation matches “{query}”.",
  noResultsHint: "The search looks at names and numbers, not at what was written.",
  loadFailedTitle: "Couldn't load the conversations.",
  notConfiguredTitle: "The inbox isn't connected to Kigaru on this site.",
  retry: "Try again",
  pickConversation: "Pick a conversation to read it and reply.",

  waiting: "Waiting",
  handledByYou: "You're handling it",
  outboundPrefix: "Sent: ",
  unknownContact: "{channel} user",

  agentAnswering: "The AI agent answers {channel}.",
  agentMuted: "The AI agent is switched off for {channel}: messages wait here for you.",
  agentUnconfigured: "No AI agent answers {channel} yet: messages wait here for you.",
  agentUnknown: "AI agent on {channel}: {state}.",

  loadingThread: "Reading the conversation…",
  threadFailed: "Couldn't read this conversation.",
  emptyThread: "This conversation has no messages yet.",
  olderHidden: "Showing the last {count} messages.",
  you: "You",
  agent: "AI agent",
  automatic: "Automatic",
  close: "Close",

  replyLabel: "Reply",
  replyPlaceholder: "Write a reply…",
  send: "Send",
  sending: "Sending…",
  takeoverWarning:
    "If you reply, you take over this conversation: the AI agent stops answering it until you turn it back on.",
  whatsappWindow: "Their last WhatsApp message is over 24 hours old: a free-text reply may not go out.",
  agentSwitch: "AI agent",
  agentOn: "On",
  agentOff: "Off",
  tookOver: "You're handling this conversation. The AI agent won't reply until you turn it back on.",
  handBackConfirmTitle: "Nobody will answer this conversation",
  handBackConfirmMuted: "The AI agent is switched off for {channel}. If you hand this conversation back, nobody replies until you take it again.",
  handBackConfirmUnconfigured: "No AI agent answers {channel} yet. If you hand this conversation back, nobody replies until you take it again.",
  handBackConfirm: "Hand it back",
  cancel: "Cancel",
  handedBack: "The AI agent handles this conversation again.",

  archive: "Archive",
  restore: "Restore",
  deleteForever: "Delete forever",
  archivedLink: "Archived",
  archivedTitle: "Archived conversations",
  archivedHint: "A conversation goes back to the inbox as soon as the person writes again.",
  backToInbox: "Back to inbox",
  archivedBadge: "Archived",
  archivedDone: "Archived the conversation with {name}",
  restoredDone: "{name} is back in the inbox.",
  deletedDone: "Deleted the conversation with {name}",
  undo: "Undo",
  deleteConfirmTitle: "Delete this conversation forever?",
  deleteConfirmBody:
    "This deletes the messages with {name} and their attachments from Kigaru, and it can't be undone. The chat stays in {channel}: this doesn't delete it there. If they write again, a new conversation starts.",
  deleteConfirm: "Delete forever",
  emptyArchivedTitle: "No archived conversations.",
  emptyArchivedHint: "Archive a conversation to take it out of the inbox. It comes back if the person writes again.",

  template: "Template: {title}",
  templateUntitled: "Template sent",
  noText: "Message without text",
  photo: "Photo",
  photos: "{count} photos",
  voiceNote: "Voice note",
  voiceNotes: "{count} voice notes",
  video: "Video",
  videos: "{count} videos",
  document: "Document",
  documents: "{count} documents",
  attachments: "{count} attachments",
  sticker: "Sticker",
  location: "Location",
  postback: "Tapped a button",
  call: "Call",
  transcript: "Transcript",
  attachmentPending: "Attachment not available yet",
  attachmentFailed: "Couldn't open the attachment",
  openDocument: "Open document",
  openPhoto: "See the photo full size",

  deliverySending: "Sending…",
  deliverySent: "Sent, not confirmed",
  deliverySentNoReceipts: "Sent",
  deliveryDelivered: "Delivered",
  deliveryRead: "Read",
  deliveryFailed: "Not delivered",
  deliverySkipped: "Not sent",
  deliveryUnknown: "Unknown status: {status}",

  channelNames: {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    messenger: "Messenger",
    sms: "SMS",
    webchat: "Web chat",
    tiktok: "TikTok",
    telegram: "Telegram",
  },
};

/** Los textos por defecto con lo que el proyecto cambie (incluidos los nombres de canal). */
export function mergeLabels(labels: Partial<InboxLabels> = {}): InboxLabels {
  return { ...INBOX_LABELS, ...labels, channelNames: { ...INBOX_LABELS.channelNames, ...labels.channelNames } };
}

/** `"{count} photos"` → `"3 photos"`. Un hueco sin valor se queda visible: así se nota. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** El nombre del canal. Uno que el kit no conoce se enseña tal cual, no se esconde. */
export function channelName(channel: string, labels: InboxLabels): string {
  return labels.channelNames[channel] ?? channel;
}

/** «Laura M.», «+17875550123» o «Instagram user». Nunca el id de la plataforma. */
export function contactName(c: Pick<InboxConversation, "name" | "phone" | "channel">, labels: InboxLabels): string {
  return c.name ?? c.phone ?? fill(labels.unknownContact, { channel: channelName(c.channel, labels) });
}

/** «Instagram, Messenger and WhatsApp» con `Intl` (la conjunción del idioma). */
export function listChannels(channels: InboxChannel[], labels: InboxLabels, locale = "en-US"): string {
  const names = channels.map((c) => channelName(c.channel, labels));
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
}

// -----------------------------------------------------------------------------
// Qué se lee de un mensaje
// -----------------------------------------------------------------------------

type Readable = { text: string | null; messageType: string | null; template: InboxTemplate | null };

/** Lo que se lee del mensaje, y si es su texto propio (`muted: false`) o una descripción. */
export type Reading = { text: string; muted: boolean };

const SINGULAR: Record<InboxAttachment["kind"], keyof InboxLabels> = {
  image: "photo",
  audio: "voiceNote",
  video: "video",
  file: "document",
};
const PLURAL: Record<InboxAttachment["kind"], keyof InboxLabels> = {
  image: "photos",
  audio: "voiceNotes",
  video: "videos",
  file: "documents",
};

/** Los tipos que no son un adjunto. `text`, `template` y `unknown` faltan a propósito. */
const LOOSE_TYPE: Record<string, keyof InboxLabels> = {
  sticker: "sticker",
  location: "location",
  postback: "postback",
  call: "call",
};

const TYPE_KIND: Record<string, InboxAttachment["kind"]> = { image: "image", audio: "audio", video: "video", file: "file" };

function isTemplate(m: Readable): boolean {
  return m.messageType === "template" || m.template !== null;
}

/**
 * Qué se lee de un mensaje SIN sus adjuntos delante: la vista previa de la lista
 * (el hub manda el último mensaje con su tipo, nunca con sus adjuntos) y el fondo
 * de la burbuja.
 *
 * 🪤 UNA PLANTILLA NO TRAE TEXTO: el cuerpo lo compone la plataforma. Lo que sí se
 * sabe es CUÁL fue, y eso se dice, rotulado: el título de la plantilla no es lo
 * que la persona leyó en su teléfono.
 *
 * 🪤 Y «SIN TEXTO» TAMPOCO ES «PLANTILLA»: una foto suelta se nombra por su tipo.
 * Un tipo que el kit no conoce sale crudo —feo pero visible— y `unknown` también:
 * es el hub diciendo que no supo clasificarlo, y un nombre bonito lo taparía.
 */
export function readPreview(m: Readable, labels: InboxLabels, { short = false }: { short?: boolean } = {}): Reading {
  if (m.text?.trim()) return { text: m.text, muted: false };
  if (isTemplate(m)) {
    const title = m.template?.title?.trim();
    if (!title) return { text: labels.templateUntitled, muted: true };
    if (short) return { text: title, muted: true };
    const lang = m.template?.language?.trim();
    const named = fill(labels.template, { title });
    return { text: lang ? `${named} · ${lang.toUpperCase().replace(/_/g, "-")}` : named, muted: true };
  }
  const type = (m.messageType ?? "").trim().toLowerCase();
  const kind = TYPE_KIND[type];
  if (kind) return { text: labels[SINGULAR[kind]] as string, muted: true };
  const loose = LOOSE_TYPE[type];
  if (loose) return { text: labels[loose] as string, muted: true };
  return { text: type ? `(${type})` : labels.noText, muted: true };
}

/** «Photo», «3 photos», «2 attachments» — o `null` si no hay ninguno. */
export function describeAttachments(attachments: InboxAttachment[], labels: InboxLabels): string | null {
  if (attachments.length === 0) return null;
  const kinds = new Set(attachments.map((a) => a.kind));
  if (kinds.size > 1) return fill(labels.attachments, { count: attachments.length });
  const [kind] = [...kinds];
  return attachments.length === 1
    ? (labels[SINGULAR[kind]] as string)
    : fill(labels[PLURAL[kind]] as string, { count: attachments.length });
}

/** Qué se lee en la BURBUJA: lo de `readPreview`, y si son solo adjuntos, cuántos. */
export function readMessage(m: Pick<InboxMessage, "text" | "type" | "template" | "attachments">, labels: InboxLabels): Reading {
  const reading = readPreview({ text: m.text, messageType: m.type, template: m.template }, labels);
  if (!reading.muted || isTemplate({ text: m.text, messageType: m.type, template: m.template })) return reading;
  return { text: describeAttachments(m.attachments, labels) ?? reading.text, muted: true };
}

/** La línea de la lista: con «Sent: » delante si fue saliente. */
export function previewLine(last: InboxPreview, labels: InboxLabels): Reading & { prefix: string | null } {
  const reading = readPreview(last, labels, { short: true });
  return { ...reading, prefix: last.direction === "outbound" ? labels.outboundPrefix : null };
}

// -----------------------------------------------------------------------------
// La entrega de lo que se manda
// -----------------------------------------------------------------------------

/**
 * Los canales de los que el hub NO recibe acuses de entrega: en ellos `sent` es
 * lo último que se sabrá de un saliente. Medido en senzai-v1 (su gemela es
 * `expectsDeliverySignal`, en `src/lib/channels/delivery-reconcile.ts`):
 *   • instagram, messenger → la app de Meta no está suscrita a `message_deliveries`.
 *   • telegram             → la Bot API no da acuses.
 *   • webchat              → la fila guardada ES la entrega: el widget la lee.
 * WhatsApp (Cloud y Twilio) y SMS (Twilio) sí traen acuses, y no están aquí.
 *
 * 🪤 ES LA LISTA DE LOS QUE NO TIENEN, no la de los que tienen: un canal que no
 * está aquí cuenta como «con acuse» y su `sent` sigue diciendo «not confirmed».
 * Es el lado seguro: equivocarse así cuesta una etiqueta de más; al revés, un
 * acuse perdido pasaría por entregado. Cuando el hub empiece a consumir los
 * acuses de un canal, se quita de aquí.
 */
const NO_DELIVERY_RECEIPTS: ReadonlySet<string> = new Set(["instagram", "messenger", "telegram", "webchat"]);

/**
 * Qué se dice bajo un saliente, o `null` (un entrante no lleva nada).
 *
 * 🪤 `sent` NO ES `delivered`. `sent` es «la plataforma lo aceptó en cola»; en
 * Meta el webhook de entrega es la única fuente de estado y, si se pierde, el
 * mensaje se queda en `sent` para siempre. Por eso dice «Sent, not confirmed» y
 * no comparte tono con «Delivered» (verde) ni con «Sending…» (azul, se resolverá
 * solo). Un estado que el kit no conoce se enseña crudo, en rojo: callarlo lo
 * haría pasar por bueno.
 *
 * 🪤 Y EN UN CANAL SIN ACUSES (`NO_DELIVERY_RECEIPTS`) ESO NO SE DICE: todos sus
 * salientes se quedan en `sent`, y la duda pintada en cada burbuja enseña a no
 * leerla en WhatsApp, que es donde importa. Ahí dice «Sent», con el mismo tono.
 */
export function deliveryStatus(
  m: Pick<InboxMessage, "direction" | "status" | "error">,
  channel: string,
  labels: InboxLabels,
): StatusMeta | null {
  if (m.direction !== "outbound") return null;
  switch (m.status) {
    case "queued":
    case "pending":
    case "sending":
      return { label: labels.deliverySending, tone: "blue" };
    case "sent":
      return { label: NO_DELIVERY_RECEIPTS.has(channel) ? labels.deliverySentNoReceipts : labels.deliverySent, tone: "gray" };
    case "delivered":
      return { label: labels.deliveryDelivered, tone: "green" };
    case "read":
      return { label: labels.deliveryRead, tone: "green" };
    case "failed":
      return { label: m.error ? `${labels.deliveryFailed}: ${m.error}` : labels.deliveryFailed, tone: "red" };
    case "skipped":
      return { label: labels.deliverySkipped, tone: "amber" };
    default:
      return { label: fill(labels.deliveryUnknown, { status: m.status }), tone: "red" };
  }
}

// -----------------------------------------------------------------------------
// Quién habla
// -----------------------------------------------------------------------------

/**
 * La forma de cada burbuja.
 *
 * 🪤 LAS CUATRO TIENEN QUE VERSE DISTINTAS, no solo decir cosas distintas:
 * `sender_type` es la única señal de si contestó una persona o una máquina. Si el
 * agente y el operador comparten forma, «¿ya le contestamos?» deja de tener
 * respuesta en pantalla. Un test cuenta que son cuatro distintas.
 *
 * Sin acento: en un dashboard el acento solo va en cuatro sitios (§7.5). Lo que
 * distingue es el lado, el relleno y el filete. Clases COMPLETAS por remitente:
 * dos utilidades del mismo prop en una cadena las resuelve el orden del CSS.
 */
export const BUBBLE: Record<"user" | "human" | "agent" | "system", string> = {
  // Quien escribe: a la izquierda, con relleno. Es lo que hay que leer.
  user: "mr-auto max-w-[85%] rounded-xl rounded-tl-sm bg-surface px-3 py-2",
  // El operador: a la derecha, relleno hundido y filete.
  human: "ml-auto max-w-[85%] rounded-xl rounded-tr-sm border border-hairline bg-surface-muted px-3 py-2",
  // El agente: a la derecha, solo un filete discontinuo.
  agent: "ml-auto max-w-[85%] rounded-xl rounded-tr-sm border border-dashed border-hairline px-3 py-2",
  // Lo automático (plantillas, acuses): a todo el ancho, un filete al margen.
  system: "w-full border-l-2 border-hairline py-1 pl-3",
};

export function bubbleOf(sender: string): string {
  return sender === "human" || sender === "agent" || sender === "system" ? BUBBLE[sender] : BUBBLE.user;
}

/** Quién firma la burbuja. */
export function authorOf(sender: string, contact: string, labels: InboxLabels): string {
  if (sender === "human") return labels.you;
  if (sender === "agent") return labels.agent;
  if (sender === "system") return labels.automatic;
  return contact;
}

// -----------------------------------------------------------------------------
// Canales y agente
// -----------------------------------------------------------------------------

/**
 * Los cuatro segmentos, en el orden de la tira (decisión 12): los mismos que la
 * bandeja de Kigaru. Excluyentes: «waiting» mira el último mensaje (lo decide el
 * hub, `needs_reply`); «agent» y «operator», quién lleva la conversación.
 *
 * 🪤 Repetidos en `server.ts`, que no importa valores relativos; un test exige
 * que sean los mismos.
 */
export const INBOX_SEGMENTS: readonly InboxSegment[] = ["all", "waiting", "agent", "operator"];

/** El segmento de la URL; uno que no se entiende es «all», que la tira enseña elegido. */
export function segmentFromParam(value: string | null | undefined): InboxSegment {
  return value && (INBOX_SEGMENTS as readonly string[]).includes(value) ? (value as InboxSegment) : "all";
}

/** La búsqueda de la URL, como la lee el servidor (`readQuery`): sin espacios de sobra y con tope. */
export function queryFromParam(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, 100);
}

export function segmentLabel(segment: InboxSegment, labels: InboxLabels): string {
  switch (segment) {
    case "waiting":
      return labels.segmentWaiting;
    case "agent":
      return labels.segmentAgent;
    case "operator":
      return labels.segmentOperator;
    default:
      return labels.segmentAll;
  }
}

/** Qué hay en cada segmento, para la tira. Sin cuentas (un hub anterior), sin cifra: nunca un 0. */
export function segmentCounts(counts: InboxCounts | null): Record<InboxSegment, number | null> {
  return {
    all: counts?.all ?? null,
    waiting: counts?.waiting ?? null,
    agent: counts?.agent ?? null,
    operator: counts?.operator ?? null,
  };
}

/** ¿La URL pide la vista «Archived»? Solo `?archived=1`, como lo lee el servidor (`readArchived`). */
export function archivedFromParam(value: string | null | undefined): boolean {
  return value === "1";
}

/** El título de una lista vacía: qué se buscó, o qué segmento no tiene a nadie. */
export function emptyListTitle(segment: InboxSegment, query: string, labels: InboxLabels, archived = false): string {
  if (query) return fill(labels.noResultsTitle, { query });
  if (archived && segment === "all") return labels.emptyArchivedTitle;
  if (segment === "waiting") return labels.emptyWaitingTitle;
  if (segment === "agent") return labels.emptyAgentTitle;
  if (segment === "operator") return labels.emptyOperatorTitle;
  return labels.emptyTitle;
}

/**
 * El orden de la bandeja: lo último que se movió, primero; lo que no se movió
 * nunca, al final; y el `id` desempata. Es el orden del hub (`compararBandeja`
 * en `senzai-v1`), y tiene que serlo: con él se decide qué filas viejas siguen
 * detrás de una página releída.
 */
export function compareInbox(a: Pick<InboxConversation, "id" | "lastMessageAt">, b: Pick<InboxConversation, "id" | "lastMessageAt">): number {
  const ta = a.lastMessageAt;
  const tb = b.lastMessageAt;
  if (ta && tb) {
    if (ta !== tb) return ta < tb ? 1 : -1;
  } else if (ta || tb) {
    return ta ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** «Load more»: la página siguiente detrás de lo que ya se ve, sin repetir filas. */
export function appendPage(
  shown: InboxConversation[],
  page: Pick<InboxPage, "conversations" | "nextCursor">,
): { conversations: InboxConversation[]; nextCursor: string | null } {
  const ids = new Set(shown.map((c) => c.id));
  return { conversations: [...shown, ...page.conversations.filter((c) => !ids.has(c.id))], nextCursor: page.nextCursor };
}

/**
 * Releer sin perder lo que se cargó con «Load more».
 *
 * La isla relee pidiendo tantas filas como enseña (hasta el tope del hub), y lo
 * releído manda en su tramo. Lo que se había cargado MÁS ALLÁ de ese tramo se
 * queda detrás, con su cursor.
 *
 * 🪤 UNA FILA VIEJA QUE CAERÍA DENTRO DEL TRAMO Y NO VINO, YA NO ES DEL SEGMENTO:
 * alguien le contestó (deja de esperar) o cambió de manos. Se quita; dejarla
 * enseñaría «Waiting» encima de una conversación que ya no espera.
 */
export function mergeRefresh(
  shown: InboxConversation[],
  shownCursor: string | null,
  fresh: Pick<InboxPage, "conversations" | "nextCursor">,
): { conversations: InboxConversation[]; nextCursor: string | null } {
  const last = fresh.conversations[fresh.conversations.length - 1];
  // Lo releído llegó hasta el final (o vino vacío): es la lista entera.
  if (!fresh.nextCursor || !last) return { conversations: fresh.conversations, nextCursor: fresh.nextCursor };
  const ids = new Set(fresh.conversations.map((c) => c.id));
  const behind = shown.filter((c) => !ids.has(c.id) && compareInbox(c, last) > 0);
  return {
    conversations: [...fresh.conversations, ...behind],
    nextCursor: behind.length > 0 ? shownCursor : fresh.nextCursor,
  };
}

/**
 * Lo que se avisa del agente: una línea por estado que no sea «contesta», con sus
 * canales juntos («No AI agent answers Instagram and Messenger yet…»). Un canal
 * donde el agente contesta no dice nada: es lo normal.
 *
 * 🪤 `unconfigured` NO impide la bandeja: los mensajes llegan, se guardan y se
 * contestan desde aquí. Lo que falta es quien conteste solo, y eso se dice.
 */
export function agentNotes(channels: InboxChannel[], labels: InboxLabels, locale = "en-US"): string[] {
  const byState = new Map<string, InboxChannel[]>();
  for (const c of channels) {
    if (c.agent === "answering") continue;
    byState.set(c.agent, [...(byState.get(c.agent) ?? []), c]);
  }
  return [...byState].map(([state, list]) => {
    const names = listChannels(list, labels, locale);
    if (state === "muted") return fill(labels.agentMuted, { channel: names });
    if (state === "unconfigured") return fill(labels.agentUnconfigured, { channel: names });
    return fill(labels.agentUnknown, { channel: names, state });
  });
}

/**
 * ¿Devolver el hilo al agente deja a la persona sin respuesta? Entonces se pide
 * confirmación. Un canal que este kit no conoce cuenta como «no contesta»: es el
 * lado seguro, y el diálogo dice por qué.
 */
export function handBackWarning(agent: AgentState | string | undefined, channel: string, labels: InboxLabels): string | null {
  if (agent === "answering") return null;
  const name = channelName(channel, labels);
  if (agent === "muted") return fill(labels.handBackConfirmMuted, { channel: name });
  return fill(labels.handBackConfirmUnconfigured, { channel: name });
}

/**
 * Lo que hace el interruptor «AI agent» del hilo al moverlo.
 *
 * - Encenderlo (`true`) devuelve el hilo al agente (`handler: agent`), y pide
 *   confirmación si en ese canal no hay agente que conteste.
 * - Apagarlo (`false`) lo toma sin escribir nada (`handler: human`): para callar al
 *   agente en ESE hilo cuando se está equivocando. Sin confirmación: no deja a
 *   nadie sin respuesta, la deja en manos del operador, y se deshace con el mismo
 *   interruptor.
 */
export function agentSwitchPlan(
  next: boolean,
  agent: AgentState | string | undefined,
  channel: string,
  labels: InboxLabels,
): { handler: "agent" | "human"; confirm: string | null } {
  return next ? { handler: "agent", confirm: handBackWarning(agent, channel, labels) } : { handler: "human", confirm: null };
}

/**
 * ¿La ventana de 24 h de WhatsApp sigue abierta? Fuera de ella un texto libre no
 * sale (solo plantillas). Se avisa, no se prohíbe: quien sabe de verdad es el hub,
 * y su `outcome` lo dirá.
 */
export function whatsappWindowOpen(lastInboundAt: string | null, now: number): boolean {
  if (!lastInboundAt) return false;
  const at = new Date(lastInboundAt).getTime();
  return Number.isFinite(at) && now - at < 24 * 3600 * 1000;
}

/**
 * El último mensaje de la persona que TENÍA LA PANTALLA, para archivar (contrato §2.4).
 *
 * El más nuevo de los dos: el de la fila de la lista (puede ir 15 s detrás) y el
 * último entrante del hilo abierto. Si la persona escribió después, el hub contesta
 * `409 new_message` y no la archiva. `null` = nunca escribió.
 *
 * 🪤 Por instante, nunca como texto: el hub manda `+00:00` y una fecha de JS acaba
 * en `Z`, y como texto no se ordenan igual.
 */
export function lastInboundSeen(
  rowLastInbound: string | null,
  messages: ReadonlyArray<Pick<InboxMessage, "direction" | "at">> | null | undefined,
): string | null {
  let best = rowLastInbound;
  let bestAt = best ? Date.parse(best) : Number.NEGATIVE_INFINITY;
  for (const m of messages ?? []) {
    if (m.direction !== "inbound") continue;
    const at = Date.parse(m.at);
    if (Number.isFinite(at) && at > bestAt) {
      best = m.at;
      bestAt = at;
    }
  }
  return best;
}

/** La ruta proxy del adjunto: la que va en el `src` de la miniatura. */
export function mediaUrl(endpoint: string, conversationId: string, messageId: string, index: number): string {
  return `${endpoint}/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/media/${index}`;
}
