// =============================================================================
// Los correos del negocio: los tipos que viajan del hub al navegador
// =============================================================================
// Como en la bandeja y la campanita, dos contratos que no se mezclan:
//
//   · `HubEmail*` — lo que devuelve el hub (`senzai-v1`, `GET /api/channels/emails`
//                   y `/{id}`, contrato §5.2). Solo lo ve `server.ts`.
//   · `Email*`    — el view-model que la ruta proxy del spoke entrega a la isla.
//
// 🪤 Solo tipos: los importan con `import type` el servidor y la isla, y Node los
// borra al cargar los `.ts` en los tests.
// =============================================================================

/** Un correo, como lo da el hub (contrato §5.2). */
export type HubEmail = {
  id: string;
  to: string;
  subject: string;
  email_type: string;
  category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  queued_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  failure_reason: string | null;
};

/** Un hito de la línea de eventos del detalle (`GET /api/channels/emails/{id}`). */
export type HubEmailEvent = { type: string; at: string; detail: string | null };

/** Una página de la lista (`GET /api/channels/emails`). */
export type HubEmailPage = {
  items: HubEmail[];
  next_cursor: string | null;
  /** Por estado, con los mismos filtros salvo `status` y `cursor`. `null` si no vino. */
  counts: Record<string, number> | null;
};

/**
 * Los estados que pinta el kit. 🪤 Sin `opened`: el seguimiento de aperturas va
 * apagado (decisión E3) y Apple Mail «abre» solo; si algún día llegara uno, cuenta
 * como `delivered`.
 */
export type EmailStatus = "queued" | "sent" | "delivered" | "bounced" | "complained" | "failed" | "suppressed";

/**
 * Los segmentos de arriba, cada uno un grupo de estados:
 *   all · delivered · sending (queued + sent) · problems (bounced + complained +
 *   failed) · not_sent (suppressed).
 */
export type EmailSegment = "all" | "delivered" | "sending" | "problems" | "not_sent";

/** La ventana de la lista, sobre la fecha en que se encoló, contada hacia atrás desde ahora. */
export type EmailPeriod = "7d" | "30d" | "90d" | "all";

/** Lo que se pide: los filtros de la vista, todos en la URL. */
export type EmailView = {
  segment: EmailSegment;
  /** Un `email_type` (`booking_confirmed`) o `null` = todos. */
  type: string | null;
  period: EmailPeriod;
  /** Una dirección exacta (sin distinguir mayúsculas) o `null`. */
  to: string | null;
};

/** Un correo, ya resuelto para pintarlo. */
export type EmailItem = {
  id: string;
  to: string;
  subject: string;
  type: string;
  category: "transactional" | "marketing" | null;
  status: EmailStatus;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
  failureReason: string | null;
  entityType: string | null;
  entityId: string | null;
};

/** Un hito de la línea de eventos, sin aperturas. */
export type EmailEvent = {
  type: "queued" | "sent" | "delivered" | "delivery_delayed" | "bounced" | "complained" | "failed" | "suppressed";
  at: string;
  detail: string | null;
};

/** Un correo con su línea de eventos, de lo más viejo a lo más nuevo. */
export type EmailDetail = EmailItem & { events: EmailEvent[] };

/** Cuántos hay por segmento, del conjunto (no de las filas que cupieron). */
export type EmailCounts = Record<EmailSegment, number>;

/** Lo que pinta la lista: una vista, sus filas y las cuentas. */
export type EmailsData = {
  view: EmailView;
  items: EmailItem[];
  /** El cursor de la página siguiente, o `null` si no hay más. */
  nextCursor: string | null;
  /** `null` si el hub no las mandó: los segmentos salen con «—», nunca con un 0. */
  counts: EmailCounts | null;
};

/**
 * El primer pintado. Un fallo viaja con su causa: «no has mandado ningún correo»
 * no se puede decir sin haber preguntado.
 *
 * - `not_configured`: este despliegue no tiene la conexión con Kigaru.
 * - `not_enabled`: el hub rechaza la conexión (sin el alcance `email:read`).
 * - `hub_error`: el hub no contestó o falló.
 */
export type EmailsLoad =
  | { ok: true; data: EmailsData }
  | { ok: false; view: EmailView; reason: "not_configured" | "not_enabled" | "hub_error"; error: string };
