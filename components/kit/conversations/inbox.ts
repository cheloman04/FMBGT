// =============================================================================
// La bandeja de conversaciones — la lógica pura de la isla
// =============================================================================
// Qué se lee de cada mensaje, cómo se nombra a quien escribe, qué pestañas hay y
// qué dice el estado de entrega. Vive aparte de los componentes por dos razones:
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
import type { AgentState, InboxAttachment, InboxChannel, InboxConversation, InboxMessage, InboxPreview, InboxTemplate } from "./types";

export type InboxLabels = {
  // Pestañas y cabecera
  tabsLabel: string;
  all: string;
  waitingCount: string;
  nobodyWaiting: string;
  refresh: string;
  refreshing: string;
  refreshFailed: string;
  truncated: string;
  // Vacíos y errores
  noChannelsTitle: string;
  noChannelsHint: string;
  emptyTitle: string;
  emptyHint: string;
  emptyChannelTitle: string;
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
  handBack: string;
  handingBack: string;
  handBackConfirmTitle: string;
  handBackConfirmMuted: string;
  handBackConfirmUnconfigured: string;
  handBackConfirm: string;
  cancel: string;
  handedBack: string;
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
  deliveryDelivered: string;
  deliveryRead: string;
  deliveryFailed: string;
  deliverySkipped: string;
  deliveryUnknown: string;
  // Canales
  channelNames: Record<string, string>;
};

export const INBOX_LABELS: InboxLabels = {
  tabsLabel: "Channels",
  all: "All",
  waitingCount: "{count} waiting for a reply",
  nobodyWaiting: "Nobody is waiting for a reply",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  refreshFailed: "Couldn't refresh: {reason}",
  truncated: "Showing the {count} most recent conversations.",

  noChannelsTitle: "No messaging channel is connected yet.",
  noChannelsHint: "When Instagram, Messenger or WhatsApp is connected in Kigaru, the conversations appear here.",
  emptyTitle: "No conversations yet.",
  emptyHint: "Messages people send on {channels} appear here as they arrive.",
  emptyChannelTitle: "No {channel} conversations yet.",
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
    "If you reply, you take over this conversation: the AI agent stops answering it until you hand it back.",
  whatsappWindow: "Their last WhatsApp message is over 24 hours old: a free-text reply may not go out.",
  handBack: "Hand back to the AI agent",
  handingBack: "Handing back…",
  handBackConfirmTitle: "Nobody will answer this conversation",
  handBackConfirmMuted: "The AI agent is switched off for {channel}. If you hand this conversation back, nobody replies until you take it again.",
  handBackConfirmUnconfigured: "No AI agent answers {channel} yet. If you hand this conversation back, nobody replies until you take it again.",
  handBackConfirm: "Hand it back",
  cancel: "Cancel",
  handedBack: "The AI agent handles this conversation again.",

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
 * Qué se dice bajo un saliente, o `null` (un entrante no lleva nada).
 *
 * 🪤 `sent` NO ES `delivered`. `sent` es «la plataforma lo aceptó en cola»; en
 * Meta el webhook de entrega es la única fuente de estado y, si se pierde, el
 * mensaje se queda en `sent` para siempre. Por eso dice «Sent, not confirmed» y
 * no comparte tono con «Delivered» (verde) ni con «Sending…» (azul, se resolverá
 * solo). Un estado que el kit no conoce se enseña crudo, en rojo: callarlo lo
 * haría pasar por bueno.
 */
export function deliveryStatus(m: Pick<InboxMessage, "direction" | "status" | "error">, labels: InboxLabels): StatusMeta | null {
  if (m.direction !== "outbound") return null;
  switch (m.status) {
    case "queued":
    case "pending":
    case "sending":
      return { label: labels.deliverySending, tone: "blue" };
    case "sent":
      return { label: labels.deliverySent, tone: "gray" };
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

export type InboxTab = { key: string; label: string; waiting: number };

/** Clave de la pestaña que enseña todo. Ningún canal se llama así. */
export const ALL_TAB = "all";

/**
 * Las pestañas: «All» y un canal por cada uno con cuentas activas (WhatsApp solo
 * si hay un número conectado). Con un canal solo, no hay pestañas que elegir.
 */
export function inboxTabs(channels: InboxChannel[], conversations: InboxConversation[], labels: InboxLabels): InboxTab[] {
  if (channels.length < 2) return [];
  const waitingIn = (channel: string | null) =>
    conversations.filter((c) => c.waiting && (channel === null || c.channel === channel)).length;
  return [
    { key: ALL_TAB, label: labels.all, waiting: waitingIn(null) },
    ...channels.map((c) => ({ key: c.channel, label: channelName(c.channel, labels), waiting: waitingIn(c.channel) })),
  ];
}

/** Los hilos de la pestaña. Una pestaña que ya no existe (el canal se desconectó) cae a todos. */
export function conversationsIn(conversations: InboxConversation[], tab: string, channels: InboxChannel[]): InboxConversation[] {
  if (tab === ALL_TAB || !channels.some((c) => c.channel === tab)) return conversations;
  return conversations.filter((c) => c.channel === tab);
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
 * ¿La ventana de 24 h de WhatsApp sigue abierta? Fuera de ella un texto libre no
 * sale (solo plantillas). Se avisa, no se prohíbe: quien sabe de verdad es el hub,
 * y su `outcome` lo dirá.
 */
export function whatsappWindowOpen(lastInboundAt: string | null, now: number): boolean {
  if (!lastInboundAt) return false;
  const at = new Date(lastInboundAt).getTime();
  return Number.isFinite(at) && now - at < 24 * 3600 * 1000;
}

/** La ruta proxy del adjunto: la que va en el `src` de la miniatura. */
export function mediaUrl(endpoint: string, conversationId: string, messageId: string, index: number): string {
  return `${endpoint}/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/media/${index}`;
}
