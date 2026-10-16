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

/**
 * Las cuentas de la bandeja, sobre el CONJUNTO (`counts=1`, contrato §2.1). Las
 * claves son las del cable, que son las del hub; la isla las lee ya traducidas.
 */
export type HubInboxCounts = { todas: number; esperando: number; agente: number; operador: number };

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

/**
 * Los cuatro segmentos de la bandeja, como los nombra la URL del spoke
 * (`?segment=`). Excluyentes: «waiting» es por el último mensaje, «agent» y
 * «operator» por quién lleva la conversación.
 */
export type InboxSegment = "all" | "waiting" | "agent" | "operator";

/** Cuántas conversaciones hay en cada segmento, sobre todo el conjunto (no la página). */
export type InboxCounts = Record<InboxSegment, number>;

/** Una página de la lista: lo que trae «Load more». */
export type InboxPage = {
  /** Para qué se cargó: la isla compara con la URL y relee si no es lo que se pide. */
  segment: InboxSegment;
  query: string | null;
  conversations: InboxConversation[];
  /** De dónde sigue la página siguiente; `null` = no queda nada detrás. */
  nextCursor: string | null;
  /** `null` = un hub anterior a la decisión 12, que no cuenta: los segmentos salen sin cifra. */
  counts: InboxCounts | null;
  /** `false` = el conjunto pasa del tope del hub y las cuentas son de lo recorrido. */
  countsExact: boolean;
};

/** La primera página, con los canales: lo que pinta la bandeja al cargar y al releer. */
export type InboxData = InboxPage & {
  channels: InboxChannel[];
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

// -----------------------------------------------------------------------------
// Las llamadas (contrato §2.3, «Las llamadas»; decisión 12)
// -----------------------------------------------------------------------------
// Una llamada es una fila del registro: la que hizo el agente (`outbound`) o la
// que le hicieron (`inbound`). Una conversación de voz con seis llamadas son seis
// filas. El hub ya las da sin los datos de operación (ni ids del proveedor, ni
// intentos, ni su línea de tiempo): lo que no llega aquí no existe para el spoke.

/** Cómo acabó, con las palabras del hub (`calls.outcomes` del catálogo). El texto lo pone el kit. */
export type CallOutcome = "in_progress" | "answered" | "voicemail" | "no_answer" | "not_recipient" | "hung_up" | "failed";

/** La marca «atendida»: quién y cuándo. `by` es «Kigaru» si la puso el equipo de Kigaru. */
export type CallAttended = { at: string; by: string | null };

export type HubCallTurn = { role: string; message: string | null; time_in_call_secs: number | null };

/** Una llamada como la da el hub (`GET /api/channels/calls`). */
export type HubCall = {
  id: string;
  conversation_id: string;
  direction: string;
  occurred_at: string;
  outcome: string;
  /** Lo que duró la conversación: `null` si nadie habló (un timbre no es una conversación). */
  duration_secs: number | null;
  lang: string | null;
  summary: string | null;
  needs_human: boolean;
  human_note: string | null;
  attended: CallAttended | null;
  opt_out: boolean;
  purpose: string | null;
  label: string | null;
  recording: boolean;
  /** En la lista: cuántos turnos tiene la transcripción. */
  transcript_turns?: number;
  /** En el detalle (`GET /api/channels/calls/{id}`), en vez de `transcript_turns`. */
  transcript?: HubCallTurn[];
  contact: HubConversation["contact"];
};

/** Los cuatro cortes, sobre el CONJUNTO que acotan periodo, dirección y búsqueda. */
export type HubCallCounts = { todas: number; contestadas: number; sin_contestar: number; humano: number };

/**
 * Los cuatro cortes como los nombra la URL del spoke (`?segment=`). En el cable,
 * como el hub (`filter=humano`). `needs_human` = las PENDIENTES: una ya atendida
 * no cuenta, aquí ni en Kigaru.
 */
export type CallSegment = "all" | "answered" | "unanswered" | "needs_human";
/** Ventana rodante desde ahora, no días del calendario: no hay zona horaria en la que equivocarse. */
export type CallPeriod = "all" | "7d" | "30d";
export type CallDirection = "all" | "inbound" | "outbound";

/** Lo que se pide: la URL de la página y la de la isla dicen lo mismo. */
export type CallView = {
  segment: CallSegment;
  period: CallPeriod;
  direction: CallDirection;
  /** Nombre o número. El hub busca sin acentos ni signos, sobre todo el conjunto. */
  query: string | null;
};

export type CallCounts = Record<CallSegment, number>;

/** Una llamada en la lista del navegador. */
export type CallItem = {
  id: string;
  /** La conversación de voz: con ella y el `id` se pide la grabación. */
  conversationId: string;
  direction: "inbound" | "outbound";
  at: string;
  /** Uno que el kit no conoce llega crudo y se enseña tal cual. */
  outcome: CallOutcome | string;
  durationSecs: number | null;
  lang: string | null;
  summary: string | null;
  needsHuman: boolean;
  /** Qué hay que contestarle, en sus palabras. */
  humanNote: string | null;
  attended: CallAttended | null;
  /** Pidió que no la llamen. */
  optOut: boolean;
  purpose: string | null;
  label: string | null;
  recording: boolean;
  transcriptTurns: number;
  /** El nombre de la ficha enlazada, o `null`: la isla pone el teléfono. */
  name: string | null;
  /** `+` y los dígitos. Solo si el hub dice que es un teléfono (`phone_digits10`). */
  phone: string | null;
};

export type CallTurn = { role: "agent" | "user" | string; text: string; atSecs: number | null };

/** Una llamada entera: lo de la fila más la transcripción y su hilo de mensajería. */
export type CallDetail = CallItem & {
  transcript: CallTurn[];
  /** El hilo de mensajería de la misma persona (mismo número, otro canal), o `null`. */
  messagingConversationId: string | null;
};

/** Lo que la ruta proxy entrega: una página de la lista con las cuentas del conjunto. */
export type CallsData = {
  /** Para qué se cargó: la isla compara con la URL y relee si no es lo que se pide. */
  view: CallView;
  calls: CallItem[];
  nextCursor: string | null;
  /** `null` = el hub no las mandó: los cortes salen sin cifra, nunca con 0. */
  counts: CallCounts | null;
  /** La media de las contestadas con duración; `null` si no hay ninguna. */
  avgDurationSecs: number | null;
  /** Cuántas entraron en la media. */
  avgDurationOver: number;
  /** `false` = el conjunto pasa del tope del hub (20 000): cuentas y lista son de lo recorrido. */
  countsExact: boolean;
};

/** La carga inicial de la página. Un fallo NO es un registro vacío: se dice cuál. */
export type CallsLoad =
  | { ok: true; data: CallsData }
  | { ok: false; reason: "not_configured" | "hub_error"; error: string; view: CallView };

/** Lo que devuelve marcar o desmarcar. */
export type CallAttendedResult = { id: string; needsHuman: boolean; attended: CallAttended | null };

/** La entrada «Calls» del menú: si se ve y cuántas piden a una persona (`null` = no se pudo contar). */
export type CallsNav = { visible: boolean; needsHuman: number | null; exact: boolean };
