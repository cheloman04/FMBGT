// =============================================================================
// La campanita: los tipos que viajan del hub al navegador
// =============================================================================
// Como en la bandeja, dos contratos que no se mezclan:
//
//   · `HubNotification*` — lo que devuelve el hub (`senzai-v1`,
//                          `GET /api/channels/notifications`). Solo lo ve `server.ts`.
//   · `Notification*`    — el view-model que la ruta proxy del spoke entrega a la isla.
//
// 🪤 Solo tipos: los importan con `import type` el servidor y la isla, y Node los
// borra al cargar los `.ts` en los tests.
// =============================================================================

/** Un aviso, como lo da el hub. */
export type HubNotification = {
  id: string;
  /** Hoy solo `agent_handoff`: el catálogo del contrato decide qué tipos ve la app. */
  kind: string;
  title: string;
  body: string | null;
  /** A dónde lleva. En `agent_handoff`, el hilo en la bandeja de esta misma app (URL absoluta). */
  link_url: string | null;
  read_at: string | null;
  created_at: string;
  conversation_id: string | null;
  channel: string | null;
};

/** Una página de avisos (`GET /api/channels/notifications`). */
export type HubNotificationPage = {
  notifications: HubNotification[];
  unread_count: number;
  total_count: number;
  has_more: boolean;
  next_before: string | null;
};

/** Un aviso, ya resuelto para pintarlo. */
export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  /** El enlace tal cual lo dio el hub; la isla decide si es de esta app (`internalHref`). */
  href: string | null;
  read: boolean;
  at: string;
  channel: string | null;
};

/** Lo que pinta la página: una tanda de avisos y los recuentos. */
export type NotificationsData = {
  items: NotificationItem[];
  /** Sin leer, en total: el número del menú. */
  unread: number;
  /** Cuántos hay en total (leídos o no): «Showing N of M». */
  total: number;
  /** El cursor de la tanda siguiente, o `null` si no hay más. */
  nextBefore: string | null;
};

/**
 * El primer pintado. Un fallo viaja con su causa: «no hay avisos» no se puede
 * decir sin haber preguntado.
 *
 * - `not_configured`: este despliegue no tiene la conexión con Kigaru.
 * - `not_enabled`: el hub rechaza la conexión (sin el alcance `notifications:read`).
 * - `hub_error`: el hub no contestó o falló.
 */
export type NotificationsLoad =
  | { ok: true; data: NotificationsData }
  | { ok: false; reason: "not_configured" | "not_enabled" | "hub_error"; error: string };

/** Lo que el menú necesita saber de la campanita. */
export type NotificationsNav = {
  /** Si la entrada se enseña. */
  visible: boolean;
  /** Sin leer, o `null` si no se pudo preguntar (entonces no se pinta número). */
  unread: number | null;
};

/** `POST <endpoint>/read-all` → cuántos se marcaron. */
export type NotificationsReadAllResult = { updated: number };
