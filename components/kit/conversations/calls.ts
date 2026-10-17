// =============================================================================
// Las llamadas — la lógica pura de la isla y sus textos
// =============================================================================
// Lo que decide la isla sin tocar la red: qué vista pide la URL, cómo se funde un
// refresco con lo ya cargado, cómo se llama cada resultado, cómo se escribe una
// duración y quién está al otro lado. Separado para probarlo con Node tal cual,
// y para que la fila y el detalle digan lo mismo con las mismas palabras.
//
// Los textos entran por `labels` (§6): todos con su inglés por defecto y con
// `{placeholders}`, porque `labels` viaja de una página de servidor a la isla y
// una función no se puede serializar.
//
// 🪤 Sin imports relativos de valor (solo `import type`): los tests lo cargan con
// Node tal cual. Por eso los cortes, periodos y direcciones están repetidos en
// `server.ts`, y un test comprueba que las dos copias dicen lo mismo.
// =============================================================================

import type { StatusMeta } from "../status";
import type {
  CallAttended,
  CallAttendedResult,
  CallDirection,
  CallItem,
  CallPeriod,
  CallSegment,
  CallView,
  CallsData,
} from "./types";

/** Los cuatro cortes, en el orden de la tira. `needs_human` = las pendientes. */
export const CALL_SEGMENTS: readonly CallSegment[] = ["all", "answered", "unanswered", "needs_human"];
/** En el orden del control. */
export const CALL_PERIODS: readonly CallPeriod[] = ["7d", "30d", "all"];
export const CALL_DIRECTIONS: readonly CallDirection[] = ["all", "inbound", "outbound"];

/** Lo que se ve sin filtros: todo, como el contrato (una pendiente vieja no se esconde). */
export const DEFAULT_CALL_VIEW: CallView = { segment: "all", period: "all", direction: "all", query: null };

/** Cuántas filas por página, y lo más que se relee de una vez (el tope del hub). */
export const CALLS_PAGE_SIZE = 50;
export const CALLS_MAX_REFRESH = 100;

/** Los parámetros de la URL de la página. Se cambian si chocan con otros de la misma página. */
export type CallParamNames = { segment: string; period: string; direction: string; query: string; open: string };

export const CALL_PARAMS: CallParamNames = { segment: "segment", period: "period", direction: "direction", query: "q", open: "call" };

type ParamSource = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function read(source: ParamSource, name: string): string | null {
  if (typeof (source as { get?: unknown }).get === "function") return (source as { get(n: string): string | null }).get(name);
  const value = (source as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

const oneOf = <T extends string>(list: readonly T[], value: string | null, fallback: T): T =>
  value !== null && (list as readonly string[]).includes(value) ? (value as T) : fallback;

/** La búsqueda de la URL, como la lee el servidor (`readQuery`): sin espacios de sobra y con tope. */
export function callQueryFromParam(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, 100);
}

/**
 * La vista que pide la URL. Lo que no se entiende cae al valor por defecto: un
 * enlace viejo o tecleado a mano abre la lista, no un error. Es la misma regla que
 * `readCallView` del servidor, para que el primer pintado y la isla coincidan.
 */
export function parseCallView(source: ParamSource, names: CallParamNames = CALL_PARAMS): CallView {
  const query = callQueryFromParam(read(source, names.query));
  return {
    segment: oneOf(CALL_SEGMENTS, read(source, names.segment), DEFAULT_CALL_VIEW.segment),
    period: oneOf(CALL_PERIODS, read(source, names.period), DEFAULT_CALL_VIEW.period),
    direction: oneOf(CALL_DIRECTIONS, read(source, names.direction), DEFAULT_CALL_VIEW.direction),
    query: query || null,
  };
}

/** Una clave por vista: dos vistas con la misma clave piden lo mismo. */
export function callViewKey(view: CallView): string {
  return [view.segment, view.period, view.direction, view.query ?? ""].join("|");
}

/** Las cuentas valen para otra vista si solo cambia el corte: no dependen de él. */
export function sameCallCountsScope(a: CallView, b: CallView): boolean {
  return a.period === b.period && a.direction === b.direction && (a.query ?? "") === (b.query ?? "");
}

/** ¿Hay algún filtro puesto (además del corte)? Es lo que enseña «Clear filters». */
export function hasCallFilters(view: CallView): boolean {
  return view.period !== DEFAULT_CALL_VIEW.period || view.direction !== DEFAULT_CALL_VIEW.direction || Boolean(view.query);
}

/** La URL de la ruta proxy para una vista. Lo que es por defecto no se escribe. */
export function callListUrl(endpoint: string, view: CallView, { cursor, limit }: { cursor?: string | null; limit?: number } = {}): string {
  const params = new URLSearchParams();
  if (view.segment !== "all") params.set("segment", view.segment);
  if (view.period !== "all") params.set("period", view.period);
  if (view.direction !== "all") params.set("direction", view.direction);
  if (view.query) params.set("q", view.query);
  if (cursor) params.set("cursor", cursor);
  if (limit && limit !== CALLS_PAGE_SIZE) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
}

/** La ruta proxy de una llamada. */
export function callUrl(endpoint: string, id: string): string {
  return `${endpoint}/${encodeURIComponent(id)}`;
}

/** La ruta proxy de la grabación: la que va en el `src` del reproductor (302 a la URL firmada). */
export function recordingUrl(endpoint: string, call: Pick<CallItem, "id" | "conversationId">): string {
  return `${callUrl(endpoint, call.id)}/recording?conversation=${encodeURIComponent(call.conversationId)}`;
}

// -----------------------------------------------------------------------------
// Los textos
// -----------------------------------------------------------------------------

export type CallsLabels = {
  // La tira
  segmentsLabel: string;
  segments: Record<CallSegment, string>;
  avgDuration: string;
  /** El sub de «Calls»: el periodo que se mira. */
  periodSubs: Record<CallPeriod, string>;
  answeredSub: string;
  unansweredSub: string;
  avgSub: string;
  avgSubNone: string;
  needsHumanSub: string;
  needsHumanSubNone: string;
  countsApprox: string;
  // Los filtros
  periodLabel: string;
  periods: Record<CallPeriod, string>;
  directionLabel: string;
  directions: Record<CallDirection, string>;
  clearFilters: string;
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
  emptyTitle: string;
  emptyHint: string;
  emptyFilteredTitle: string;
  emptyFilteredHint: string;
  emptyAnsweredTitle: string;
  emptyUnansweredTitle: string;
  emptyNeedsHumanTitle: string;
  emptyNeedsHumanHint: string;
  noResultsTitle: string;
  noResultsHint: string;
  loadFailedTitle: string;
  notConfiguredTitle: string;
  retry: string;
  pickCall: string;
  // La fila
  incoming: string;
  outgoing: string;
  unknownCaller: string;
  hasRecording: string;
  needsReply: string;
  attendedBy: string;
  attended: string;
  outcomes: Record<string, string>;
  // El detalle
  detailTitle: string;
  loadingCall: string;
  callFailed: string;
  needsReplyNote: string;
  askedForPerson: string;
  noNote: string;
  attendedByAt: string;
  attendedAt: string;
  markAttended: string;
  undoAttended: string;
  saving: string;
  markFailed: string;
  openMessages: string;
  recordingLabel: string;
  recordingFailed: string;
  noRecording: string;
  noRecordingVoicemail: string;
  noRecordingNoAnswer: string;
  noRecordingHungUp: string;
  noRecordingInProgress: string;
  noRecordingFailed: string;
  noRecordingAnswered: string;
  tabsLabel: string;
  tabSummary: string;
  tabTranscript: string;
  noSummary: string;
  noTranscript: string;
  factDirection: string;
  factWhen: string;
  factDuration: string;
  factLanguage: string;
  factReason: string;
  optOut: string;
  agent: string;
  close: string;
};

export const CALLS_LABELS: CallsLabels = {
  segmentsLabel: "Filter calls",
  segments: { all: "Calls", answered: "Answered", unanswered: "Unanswered", needs_human: "Needs a human" },
  avgDuration: "Avg duration",
  periodSubs: { "7d": "last 7 days", "30d": "last 30 days", all: "all time" },
  answeredSub: "{percent}% of total",
  unansweredSub: "voicemail, hung up or no answer",
  avgSub: "over {count} answered",
  avgSubNone: "none answered yet",
  needsHumanSub: "waiting for a reply",
  needsHumanSubNone: "nobody waiting",
  countsApprox: "The counts cover the {count} most recent calls.",

  periodLabel: "Period",
  periods: { "7d": "7 days", "30d": "30 days", all: "All time" },
  directionLabel: "Direction",
  directions: { all: "All", inbound: "Incoming", outbound: "Outgoing" },
  clearFilters: "Clear filters",
  searchLabel: "Search calls",
  searchPlaceholder: "Search by name or number",
  clearSearch: "Clear",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  refreshFailed: "Couldn't refresh: {reason}",

  showingCount: "Showing {showing} of {total} calls",
  loadMore: "Load more",
  loadingMore: "Loading…",
  loadMoreFailed: "Couldn't load more: {reason}",

  emptyTitle: "No calls yet.",
  emptyHint: "Calls your AI agent makes or takes show up here as soon as they end.",
  emptyFilteredTitle: "No calls match these filters.",
  emptyFilteredHint: "Try another period or direction.",
  emptyAnsweredTitle: "No answered calls here.",
  emptyUnansweredTitle: "No unanswered calls here.",
  emptyNeedsHumanTitle: "Nobody is waiting for a person.",
  emptyNeedsHumanHint: "When a caller asks for a person, the call shows up here until someone marks it as attended.",
  noResultsTitle: "No call matches “{query}”.",
  noResultsHint: "The search looks at names and numbers, not at what was said.",
  loadFailedTitle: "Couldn't load the calls.",
  notConfiguredTitle: "Calls aren't connected to Kigaru on this site.",
  retry: "Try again",
  pickCall: "Pick a call to hear it and read what was said.",

  incoming: "Incoming call",
  outgoing: "Outgoing call",
  unknownCaller: "Unknown caller",
  hasRecording: "Has a recording",
  needsReply: "Needs a reply",
  attendedBy: "Attended by {by}",
  attended: "Attended",
  outcomes: {
    in_progress: "In progress",
    answered: "Answered",
    voicemail: "Voicemail",
    no_answer: "No answer",
    not_recipient: "Someone else answered",
    hung_up: "Hung up",
    failed: "Couldn't connect",
  },

  detailTitle: "Call",
  loadingCall: "Reading the call…",
  callFailed: "Couldn't open the call: {reason}",
  needsReplyNote: "Needs a reply: {note}",
  askedForPerson: "Asked for a person: {note}",
  noNote: "no note left",
  attendedByAt: "Attended by {by} · {when}",
  attendedAt: "Attended · {when}",
  markAttended: "Mark as attended",
  undoAttended: "Undo",
  saving: "Saving…",
  markFailed: "Couldn't save: {reason}",
  openMessages: "Open their messages",
  recordingLabel: "Call recording",
  recordingFailed: "Couldn't play the recording. Try again in a moment.",
  noRecording: "This call has no recording.",
  noRecordingVoicemail: "It went to voicemail: there was no conversation to record.",
  noRecordingNoAnswer: "Nobody picked up, so there's no recording.",
  noRecordingHungUp: "They hung up before anyone spoke, so there's no recording.",
  noRecordingInProgress: "The call hasn't ended yet.",
  noRecordingFailed: "The call didn't connect, so there's no recording.",
  noRecordingAnswered: "The call was answered, but its recording wasn't saved.",
  tabsLabel: "Call details",
  tabSummary: "Summary",
  tabTranscript: "Transcript",
  noSummary: "This call left no summary. The AI agent writes it when the call ends, and only when there was a conversation.",
  noTranscript: "This call has no transcript.",
  factDirection: "Direction",
  factWhen: "When",
  factDuration: "Duration",
  factLanguage: "Language",
  factReason: "Reason",
  optOut: "Asked not to be called again.",
  agent: "AI agent",
  close: "Close",
};

/** Los textos con los de quien monta encima; los mapas se funden, no se sustituyen. */
export function mergeCallLabels(overrides?: Partial<CallsLabels>): CallsLabels {
  const merged = { ...CALLS_LABELS, ...overrides };
  for (const key of ["segments", "periodSubs", "periods", "directions", "outcomes"] as const) {
    (merged as Record<string, unknown>)[key] = { ...CALLS_LABELS[key], ...overrides?.[key] };
  }
  return merged;
}

/** `"{count} calls"` → `"3 calls"`. Un hueco sin valor se queda visible: así se nota. */
export function fillCall(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

// -----------------------------------------------------------------------------
// Qué se dice de una llamada
// -----------------------------------------------------------------------------

/**
 * El color de cada resultado (§6.2): un solo mapa. Verde lo que se habló; ámbar lo
 * que no llegó a conversación (buzón, no contestó, colgó, contestó otra persona);
 * rojo lo que no se pudo hacer; azul lo que sigue en curso.
 *
 * 🪤 El texto manda y el tono refuerza: «no contestó» y «saltó el buzón» son dos
 * noticias distintas con el mismo ámbar.
 */
const OUTCOME_TONE: Record<string, StatusMeta["tone"]> = {
  in_progress: "blue",
  answered: "green",
  voicemail: "amber",
  no_answer: "amber",
  not_recipient: "amber",
  hung_up: "amber",
  failed: "red",
};

/** Un resultado que el kit no conoce se enseña tal cual, en gris: callarlo lo haría pasar por otro. */
export function outcomeMeta(outcome: string, labels: CallsLabels): StatusMeta {
  return { label: labels.outcomes[outcome] ?? outcome, tone: OUTCOME_TONE[outcome] ?? "gray" };
}

/** `1:14`. `—` cuando no hay duración: nunca `0:00`, que es un dato. */
export function formatDuration(secs: number | null | undefined): string {
  if (typeof secs !== "number" || !Number.isFinite(secs) || secs < 0) return "—";
  const total = Math.floor(secs);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Un teléfono, legible: los de Norteamérica (`+1` y diez dígitos) como se leen,
 * `+1 (787) 550-4795`; cualquier otro, tal cual, en vez de partirlo por donde no toca.
 */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

/** Quién está al otro lado: el nombre de la ficha, el teléfono bien escrito o «Unknown caller». */
export function callerName(call: Pick<CallItem, "name" | "phone">, labels: CallsLabels): string {
  if (call.name) return call.name;
  if (call.phone) return formatPhone(call.phone);
  return labels.unknownCaller;
}

/** «English», «Spanish»… con `Intl`; un código que no entiende se enseña tal cual. */
export function languageName(lang: string | null, locale = "en-US"): string | null {
  if (!lang) return null;
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(lang.replace(/_/g, "-")) ?? lang;
  } catch {
    return lang;
  }
}

/** «Attended by Dustin», o «Attended» si la marca no dice quién. */
export function attendedLine(attended: CallAttended, labels: CallsLabels): string {
  return attended.by ? fillCall(labels.attendedBy, { by: attended.by }) : labels.attended;
}

/**
 * ¿Hay que contestarle? Solo una llamada que pide a una persona, y mientras nadie
 * la marque: es la misma regla que «Needs a human» (las pendientes).
 */
export function waitingForPerson(call: Pick<CallItem, "needsHuman" | "attended">): boolean {
  return call.needsHuman && call.attended === null;
}

/**
 * Por qué no hay nada que escuchar; `null` = sí lo hay. El buzón va antes que «no
 * contestó» porque es la noticia más concreta, la que cambia si se vuelve a llamar.
 */
export function noRecordingReason(call: Pick<CallItem, "recording" | "outcome">, labels: CallsLabels): string | null {
  if (call.recording) return null;
  switch (call.outcome) {
    case "voicemail":
      return labels.noRecordingVoicemail;
    case "no_answer":
      return labels.noRecordingNoAnswer;
    case "hung_up":
      return labels.noRecordingHungUp;
    case "in_progress":
      return labels.noRecordingInProgress;
    case "failed":
      return labels.noRecordingFailed;
    case "answered":
      return labels.noRecordingAnswered;
    default:
      return labels.noRecording;
  }
}

/** El porcentaje de contestadas sobre el total, redondeado; `null` sin cuentas o sin llamadas. */
export function answeredPercent(counts: CallsData["counts"]): number | null {
  if (!counts || counts.all <= 0) return null;
  return Math.round((counts.answered / counts.all) * 100);
}

/**
 * Cuántas hay en la vista que se enseña: la cuenta de su corte si hay cuentas y, si
 * no, al menos las que se ven (una más si el hub dice que hay otra página).
 */
export function shownTotal(data: Pick<CallsData, "view" | "calls" | "nextCursor" | "counts">): number {
  const floor = data.calls.length + (data.nextCursor ? 1 : 0);
  if (!data.counts) return floor;
  return Math.max(data.counts[data.view.segment], floor);
}

/** El título (y la pista) de una lista vacía según la vista. */
export function emptyCallsTitle(view: CallView, labels: CallsLabels): { title: string; hint?: string } {
  if (view.query) return { title: fillCall(labels.noResultsTitle, { query: view.query }), hint: labels.noResultsHint };
  if (view.segment === "needs_human") return { title: labels.emptyNeedsHumanTitle, hint: labels.emptyNeedsHumanHint };
  const filtered = hasCallFilters(view);
  if (view.segment === "answered") return { title: labels.emptyAnsweredTitle, hint: filtered ? labels.emptyFilteredHint : undefined };
  if (view.segment === "unanswered") return { title: labels.emptyUnansweredTitle, hint: filtered ? labels.emptyFilteredHint : undefined };
  if (filtered) return { title: labels.emptyFilteredTitle, hint: labels.emptyFilteredHint };
  return { title: labels.emptyTitle, hint: labels.emptyHint };
}

// -----------------------------------------------------------------------------
// Fundir páginas
// -----------------------------------------------------------------------------

/**
 * El orden del registro: la más reciente primero, y el `id` desempata (de menor a
 * mayor). Es el orden del hub (`compararRegistro` en `senzai-v1`, su cursor es
 * `occurred_at|id`), y tiene que serlo: con él se decide qué
 * filas viejas siguen detrás de una página releída.
 */
export function compareCalls(a: Pick<CallItem, "id" | "at">, b: Pick<CallItem, "id" | "at">): number {
  if (a.at !== b.at) return a.at < b.at ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Un refresco (la primera página, otra vez, con tantas filas como se enseñan)
 * fundido con lo que ya se ve. Lo releído manda en su tramo; lo que se cargó MÁS
 * ALLÁ con «Load more» se queda detrás, con su cursor.
 *
 * 🪤 UNA FILA QUE CAERÍA DENTRO DEL TRAMO Y NO VINO, YA NO ES DEL CORTE: alguien la
 * marcó como atendida y salió de «Needs a human». Se quita; dejarla enseñaría
 * «Needs a reply» encima de una llamada que ya se atendió.
 */
export function mergeCallsRefresh(prev: CallsData, fresh: CallsData): CallsData {
  const last = fresh.calls[fresh.calls.length - 1];
  if (!fresh.nextCursor || !last) return fresh;
  const ids = new Set(fresh.calls.map((c) => c.id));
  const behind = prev.calls.filter((c) => !ids.has(c.id) && compareCalls(c, last) > 0);
  if (behind.length === 0) return fresh;
  return { ...fresh, calls: [...fresh.calls, ...behind], nextCursor: prev.nextCursor };
}

/** «Load more»: la página siguiente detrás de lo que ya se ve, sin repetir filas. */
export function appendCallsPage(prev: CallsData, next: CallsData): CallsData {
  const ids = new Set(prev.calls.map((c) => c.id));
  return {
    ...prev,
    calls: [...prev.calls, ...next.calls.filter((c) => !ids.has(c.id))],
    nextCursor: next.nextCursor,
    counts: next.counts ?? prev.counts,
    avgDurationSecs: next.counts ? next.avgDurationSecs : prev.avgDurationSecs,
    avgDurationOver: next.counts ? next.avgDurationOver : prev.avgDurationOver,
    countsExact: next.countsExact,
  };
}

/** Una fila al día con lo que devolvió marcar o desmarcar, sin esperar al refresco. */
export function withAttended(data: CallsData, result: CallAttendedResult): CallsData {
  if (!data.calls.some((c) => c.id === result.id)) return data;
  return {
    ...data,
    calls: data.calls.map((c) => (c.id === result.id ? { ...c, needsHuman: result.needsHuman, attended: result.attended } : c)),
  };
}

/** El enlace a su hilo de mensajería: la plantilla del proyecto con `{id}`. */
export function messagesLink(template: string, conversationId: string): string {
  return fillCall(template, { id: encodeURIComponent(conversationId) });
}
