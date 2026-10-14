// =============================================================================
// La bandeja de conversaciones: los tipos que viajan del hub al navegador
// =============================================================================
// Dos contratos distintos, y conviene no mezclarlos:
//
//   · `Hub*`   — lo que devuelve el hub (`senzai-v1`, `src/app/api/channels/`).
//                Solo lo ve `server.ts`. Nunca llega al navegador tal cual.
//   · `Inbox*` — el view-model que la ruta proxy del spoke entrega a la isla. Ya
//                resuelto: el nombre que se enseña, si espera respuesta, qué es
//                cada adjunto. La isla no vuelve a decidir nada de eso (§4).
//
// 🪤 Solo tipos: lo importan con `import type` el servidor y la isla, y Node lo
// borra al cargar los `.ts` en los tests. Un valor aquí rompería esa carga.
// =============================================================================

/** Lo que el hub dice del agente de un canal (`GET /api/channels/agent-switch`). */
export type AgentState = "answering" | "muted" | "unconfigured" | "not_connected" | "mixed";

export type HubTemplateView = {
  title: string | null;
  label?: string | null;
  key?: string | null;
  name?: string | null;
  language: string | null;
  content_sid: string | null;
};

export type HubConversation = {
  id: string;
  channel: string;
  status: string;
  /** `agent` = automatizado · `human` = lo lleva una persona. */
  handler: string;
  last_message_at: string | null;
  last_inbound_at: string | null;
  contact: {
    display_name: string | null;
    /** El id de la plataforma. En Instagram y Messenger, un PSID: NO es un teléfono. */
    external_user_id: string;
    contact_id: string | null;
    /** Los últimos 10 dígitos, recortados por el hub. `null` si el canal no usa el teléfono. */
    phone_digits10: string | null;
  } | null;
  last_message: {
    text: string | null;
    direction: string;
    at: string;
    message_type?: string | null;
    /** Lo decide el hub. Un hub anterior no lo manda: entonces, la dirección. */
    needs_reply?: boolean;
    template?: HubTemplateView | null;
  } | null;
};

export type HubAttachment = {
  index: number;
  type: string;
  mime_type: string | null;
  mirrored: boolean;
  transcript?: string;
};

export type HubMessage = {
  id: string;
  direction: string;
  sender_type: string;
  message_type: string;
  text: string | null;
  status: string;
  error: string | null;
  occurred_at: string;
  attachments?: HubAttachment[];
  template?: HubTemplateView | null;
};

export type HubChannelReport = {
  channel: string;
  state: string;
  enabled: boolean;
  /** Cuentas activas de ese canal. 0 = el cliente no ha conectado la red. */
  accounts: number;
  /** ¿Hay agente al que despachar? `false` con cuentas es trabajo del operador. */
  route_configured: boolean;
};

/** Lo que contesta el hub al mandar: manda `status`, no el código HTTP. */
export type HubOutcome = {
  status: string;
  error?: string;
  message_id?: string;
};

// -----------------------------------------------------------------------------
// El view-model del navegador
// -----------------------------------------------------------------------------

/** Un canal con cuentas activas. Los que no tienen ninguna no llegan. */
export type InboxChannel = {
  channel: string;
  accounts: number;
  /** El estado del agente en ese canal. Uno que este kit no conoce llega crudo. */
  agent: AgentState | string;
};

export type InboxTemplate = {
  /** El nombre legible de la plantilla, o `null` si el hub solo sabe el SID. */
  title: string | null;
  language: string | null;
  contentSid: string | null;
};

export type InboxPreview = {
  text: string | null;
  direction: "inbound" | "outbound";
  messageType: string | null;
  template: InboxTemplate | null;
  at: string;
};

export type InboxConversation = {
  id: string;
  channel: string;
  status: string;
  handler: "agent" | "human" | string;
  /** El nombre que dio la plataforma, o `null`: la isla pone el genérico del canal. */
  name: string | null;
  /**
   * El teléfono, solo en un canal que lo usa como identidad (WhatsApp, SMS).
   *
   * 🪤 En Instagram y Messenger es SIEMPRE `null`, aunque el id de la plataforma
   * sean solo dígitos: tiene forma de teléfono y no lo es, y casaría con la ficha
   * de otra persona. El servidor ni siquiera manda ese id al navegador.
   */
  phone: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  /** El último mensaje deja a la persona esperando respuesta (lo decide el hub). */
  waiting: boolean;
  last: InboxPreview | null;
};

export type InboxData = {
  channels: InboxChannel[];
  conversations: InboxConversation[];
  /** El hub devolvió el máximo pedido: puede haber hilos más viejos que no se ven. */
  truncated: boolean;
};

/** La carga inicial de la página. Un fallo NO es una bandeja vacía: se dice cuál. */
export type InboxLoad =
  | { ok: true; data: InboxData }
  | { ok: false; reason: "not_configured" | "hub_error"; error: string };

export type AttachmentKind = "image" | "audio" | "video" | "file";

export type InboxAttachment = {
  index: number;
  kind: AttachmentKind;
  mimeType: string | null;
  /** `false` = el hub aún no copió los bytes (lo hace en diferido). No es un error. */
  mirrored: boolean;
  transcript: string | null;
};

export type SenderType = "user" | "agent" | "human" | "system";

export type InboxMessage = {
  id: string;
  direction: "inbound" | "outbound";
  sender: SenderType | string;
  type: string;
  text: string | null;
  status: string;
  error: string | null;
  at: string;
  attachments: InboxAttachment[];
  template: InboxTemplate | null;
};

export type InboxThread = {
  conversation: { id: string; channel: string; status: string; handler: string };
  messages: InboxMessage[];
  /** Hay mensajes más viejos que los que se enseñan. */
  truncated: boolean;
};

export type InboxSendResult = { sent: true; status: string };

export type InboxHandlerResult = { handler: string; changed: boolean };
