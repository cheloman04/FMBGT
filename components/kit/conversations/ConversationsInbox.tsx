"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createApiClient } from "../api";
import { Button } from "../Button";
import { cx } from "../cx";
import { EmptyState } from "../EmptyState";
import { Input } from "../Field";
import { LoadMore } from "../LoadMore";
import { MetricStrip } from "../MetricStrip";
import { RelativeTime } from "../RelativeTime";
import { StatusBadge } from "../StatusBadge";
import { withParam } from "../url";
import { ConversationThread } from "./ConversationThread";
import {
  INBOX_SEGMENTS,
  agentNotes,
  appendPage,
  archivedFromParam,
  channelName,
  contactName,
  emptyListTitle,
  fill,
  listChannels,
  mergeLabels,
  mergeRefresh,
  previewLine,
  queryFromParam,
  segmentCounts,
  segmentFromParam,
  segmentLabel,
  type InboxLabels,
} from "./inbox";
import type { InboxArchiveResult, InboxConversation, InboxData, InboxLoad, InboxPage, InboxSegment } from "./types";
import { useMediaQuery } from "./useMediaQuery";
import { usePolling } from "./usePolling";

type Props = {
  /** Lo que cargó la página con `loadInbox()` (servidor). Un fallo llega con su causa. */
  initial: InboxLoad;
  /** La ruta proxy del spoke (`/api/admin/conversations`), de `createInboxRoutes()`. */
  endpoint: string;
  /** El login del área: un 401 manda allí con `next` y `expired` (`createApiClient`). */
  loginPath: string;
  /** Zona IANA del NEGOCIO (§8.7), p. ej. `America/New_York`. */
  timeZone?: string;
  locale?: string;
  labels?: Partial<InboxLabels>;
  /** Cada cuánto se relee la bandeja y el hilo abierto. */
  pollMs?: number;
  /** El parámetro de la URL con el hilo abierto. */
  param?: string;
  /** El parámetro de la URL con el segmento (`all` no se escribe). */
  segmentParam?: string;
  /** El parámetro de la URL con la búsqueda. */
  queryParam?: string;
  /** El parámetro de la URL de la vista «Archived» (`?archived=1`). */
  archivedParam?: string;
  /**
   * Enseña «Delete forever» en una conversación archivada (contrato §2.4). Pásalo
   * solo cuando la conexión del spoke tenga el alcance `channels:delete`: sin él el
   * hub dice que no, y el botón solo serviría para enseñar ese error.
   */
  allowDelete?: boolean;
};

const ROW = "block w-full px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ac-500/60 max-sm:min-h-11";
const ROW_IDLE = "hover:bg-surface-muted";
const ROW_OPEN = "bg-surface-muted";

/** Lo que trae cada página, y lo más que se relee de una vez (el tope del hub). */
const PAGE = 50;
const MAX_REFRESH = 100;
/** Cuánto se espera a que se deje de escribir antes de buscar. */
const SEARCH_DEBOUNCE_MS = 350;

/** Qué se pide: un segmento, una búsqueda y si es la vista «Archived». Es lo que compara lo que se ve con la URL. */
const viewKey = (segment: InboxSegment, query: string | null, archived: boolean) =>
  `${segment}\n${query ?? ""}\n${archived ? "archived" : "inbox"}`;

function listUrl(
  endpoint: string,
  {
    segment,
    query,
    archived,
    cursor,
    limit,
  }: { segment: InboxSegment; query: string; archived: boolean; cursor?: string | null; limit?: number },
): string {
  const params = new URLSearchParams();
  if (segment !== "all") params.set("segment", segment);
  if (query) params.set("q", query);
  if (archived) params.set("archived", "1");
  if (cursor) params.set("cursor", cursor);
  if (limit && limit !== PAGE) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
}

/**
 * La bandeja de conversaciones de un spoke: Instagram, Messenger, WhatsApp…
 *
 *   // app/admin/(panel)/conversations/page.tsx — servidor
 *   const sp = await searchParams;
 *   const initial = await loadInbox(hubFromEnv(), { segment: sp.segment, query: sp.q });
 *   <PageShell fill>
 *     <PageHeader title="Conversations" />
 *     <ConversationsInbox initial={initial} endpoint="/api/admin/conversations" loginPath="/admin/login" timeZone="America/New_York" />
 *   </PageShell>
 *
 * - Arriba, los cuatro segmentos de Kigaru (decisión 12) con sus cuentas: All ·
 *   Waiting · AI agent · Operator. Las cuentas son del conjunto, las da el hub.
 * - El buscador busca por nombre y número en el hub, sobre todo el conjunto.
 * - «Load more» trae la página siguiente con el cursor del hub.
 * - Se relee cada `pollMs` (15 s), en pausa con la pestaña oculta e inmediato al
 *   volver a ella, sin perder lo cargado con «Load more».
 * - El hilo abierto, el segmento y la búsqueda viven en la URL (`?c=`,
 *   `?segment=`, `?q=`): Atrás cierra el hilo en el teléfono y un enlace se
 *   puede compartir. Cambiar de segmento o buscar no recarga la página.
 * - «Archive» saca una conversación de la bandeja; «Archived · N» enseña las
 *   archivadas (`?archived=1`), desde donde se restauran o, con `allowDelete`, se
 *   borran para siempre. Vuelve sola a la bandeja si la persona escribe otra vez
 *   (contrato §2.4): archivar no puede servir para no enterarse.
 * - En escritorio (`lg`), lista y hilo lado a lado; en el teléfono, el hilo en un
 *   `Drawer` a pantalla entera. Se monta UNO de los dos: el hilo no se lee dos veces.
 * - Con `PageShell fill` la columna del hilo ocupa la altura y hace su propio scroll.
 */
export function ConversationsInbox(props: Props) {
  // `useSearchParams` pide un Suspense por encima; la página es dinámica y no se
  // llega a ver, pero así el componente no depende de que quien lo monta se acuerde.
  return (
    <Suspense fallback={null}>
      <Inbox {...props} />
    </Suspense>
  );
}

/** Un intento que falló, con la vista que pedía: el de otra vista no se enseña en esta. */
type Failure = { key: string; reason: "not_configured" | "hub_error"; error: string };

function Inbox({
  initial,
  endpoint,
  loginPath,
  timeZone,
  locale = "en-US",
  labels: overrides,
  pollMs = 15_000,
  param = "c",
  segmentParam = "segment",
  queryParam = "q",
  archivedParam = "archived",
  allowDelete = false,
}: Props) {
  const labels = useMemo(() => mergeLabels(overrides), [overrides]);
  const api = useMemo(() => createApiClient({ loginPath }), [loginPath]);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const desktop = useMediaQuery("(min-width: 1024px)");

  // Lo que se PIDE vive en la URL; lo que se VE, en `data`, con su segmento y su
  // búsqueda. Cuando no coinciden, se está cambiando de vista.
  const segment = segmentFromParam(search.get(segmentParam));
  const query = queryFromParam(search.get(queryParam));
  const archived = archivedFromParam(search.get(archivedParam));
  const wanted = viewKey(segment, query, archived);

  // `data` es lo último que se cargó bien, de la vista que fuera: de ahí salen los
  // canales y la tira mientras llega la vista nueva. `failure`, el último intento.
  const [data, setData] = useState<InboxData | null>(initial.ok ? initial.data : null);
  const [failure, setFailure] = useState<Failure | null>(
    initial.ok ? null : { key: wanted, reason: initial.reason, error: initial.error },
  );
  const [pending, setPending] = useState(0);
  const [more, setMore] = useState<{ key: string; loading: boolean; error: string | null }>({ key: wanted, loading: false, error: null });
  const [draft, setDraft] = useState(query);
  /** Lo que acaba de pasar (archivada, devuelta, borrada), con «Undo» si se puede deshacer. */
  const [done, setDone] = useState<{ text: string; undo?: { id: string; name: string } } | null>(null);
  const [undoing, setUndoing] = useState(false);

  const current = data && viewKey(data.segment, data.query, data.archived) === wanted ? data : null;
  const viewFailure = failure && failure.key === wanted ? failure : null;
  // Cambiando de vista: lo de la vista anterior se ve atenuado hasta que llega la
  // nueva. Si la nueva falla, se dice, y no se queda atenuado para siempre.
  const switching = data !== null && current === null && viewFailure === null;

  // Lo último pedido y lo último visto, para lo que corre DESPUÉS del render: el
  // sondeo y las respuestas que llegan tarde.
  const latest = useRef({ segment, query, archived, wanted, data });
  useEffect(() => {
    latest.current = { segment, query, archived, wanted, data };
  });

  const refresh = useCallback(async () => {
    const { segment, query, archived, wanted, data: shown } = latest.current;
    // Releer lo que se ve pide tantas filas como se enseñan: lo cargado con «Load
    // more» se relee también, hasta el tope del hub.
    const same = shown !== null && viewKey(shown.segment, shown.query, shown.archived) === wanted;
    const limit = same ? Math.min(MAX_REFRESH, Math.max(PAGE, shown.conversations.length)) : PAGE;
    setPending((n) => n + 1);
    const res = await api.get<InboxData>(listUrl(endpoint, { segment, query, archived, limit }));
    setPending((n) => n - 1);
    // Mientras volaba se pidió otra vista: su propia petición pintará lo suyo.
    if (latest.current.wanted !== wanted) return;
    if (res.ok) {
      setData((prev) =>
        prev && viewKey(prev.segment, prev.query, prev.archived) === wanted
          ? { ...res.data, ...mergeRefresh(prev.conversations, prev.nextCursor, res.data) }
          : res.data,
      );
      setFailure(null);
    } else if (res.status !== 401) {
      // 🪤 Un fallo al RELEER no borra lo que ya se veía: se mantiene y se avisa.
      // Y un fallo sin nada que enseñar se queda como fallo, con su causa: nunca
      // una bandeja vacía que diga «nadie te ha escrito».
      setFailure({ key: wanted, reason: res.status === 503 ? "not_configured" : "hub_error", error: res.error });
    }
  }, [api, endpoint]);
  usePolling(refresh, { intervalMs: pollMs });

  // Otra vista en la URL (segmento o búsqueda): se pide en el acto, sin esperar al
  // sondeo. Por un ref, como el sondeo: el efecto solo dispara.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    if (switching) void refreshRef.current();
  }, [switching, wanted]);

  const loadMore = useCallback(async () => {
    const { segment, query, archived, wanted, data: shown } = latest.current;
    if (!shown || viewKey(shown.segment, shown.query, shown.archived) !== wanted || !shown.nextCursor) return;
    setMore({ key: wanted, loading: true, error: null });
    const res = await api.get<InboxPage>(listUrl(endpoint, { segment, query, archived, cursor: shown.nextCursor }));
    if (latest.current.wanted !== wanted) return setMore({ key: wanted, loading: false, error: null });
    if (res.ok) {
      setData((prev) =>
        prev && viewKey(prev.segment, prev.query, prev.archived) === wanted
          ? {
              ...prev,
              ...appendPage(prev.conversations, res.data),
              counts: res.data.counts ?? prev.counts,
              countsExact: res.data.countsExact,
              archivedCount: res.data.archivedCount ?? prev.archivedCount,
            }
          : prev,
      );
      setMore({ key: wanted, loading: false, error: null });
    } else {
      setMore({ key: wanted, loading: false, error: res.status === 401 ? null : res.error });
    }
  }, [api, endpoint]);

  const navigate = useCallback(
    (key: string, value: string | null, mode: "push" | "replace") => {
      const href = withParam(pathname, search, key, value, { keepPage: true });
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router, search],
  );
  // Abrir apila una entrada (Atrás vuelve a la lista); cerrar no apila otra.
  const openConversation = useCallback((id: string) => navigate(param, id, "push"), [navigate, param]);
  const close = useCallback(() => navigate(param, null, "replace"), [navigate, param]);

  // 🪤 El segmento y la búsqueda cambian la URL SIN volver al servidor: la isla
  // pide la vista por la ruta proxy. Con `router.replace` la página volvería a
  // cargar la bandeja entera (dos saltos al hub) para tirarla, porque la isla ya
  // tiene la suya. Next sincroniza `useSearchParams` con `history.replaceState`.
  const setViewParam = useCallback(
    (key: string, value: string | null) => {
      window.history.replaceState(null, "", withParam(pathname, search, key, value, { keepPage: true }));
    },
    [pathname, search],
  );

  // Buscar mientras se escribe, cuando se deja de escribir.
  useEffect(() => {
    const next = queryFromParam(draft);
    if (next === query) return;
    const timer = setTimeout(() => setViewParam(queryParam, next || null), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, query, queryParam, setViewParam]);

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = queryFromParam(draft);
    if (next !== query) setViewParam(queryParam, next || null);
  };
  const clearSearch = () => {
    setDraft("");
    if (query) setViewParam(queryParam, null);
  };

  // --- Archivar, devolver y borrar (contrato §2.4) ---------------------------
  // 🪤 LA FILA SE QUITA EN EL ACTO, a mano. Releer no basta: `mergeRefresh` deja
  // detrás lo que se cargó con «Load more», y una fila que ya no es de esta vista
  // se quedaría al final hasta recargar (pasó en el admin de Kigaru, 2026-10-17).
  const dropRow = useCallback((id: string) => {
    setData((prev) => (prev ? { ...prev, conversations: prev.conversations.filter((c) => c.id !== id) } : prev));
  }, []);

  const afterArchive = (c: InboxConversation, nowArchived: boolean) => {
    const name = contactName(c, labels);
    close();
    dropRow(c.id);
    setDone(
      nowArchived
        ? { text: fill(labels.archivedDone, { name }), undo: { id: c.id, name } }
        : { text: fill(labels.restoredDone, { name }) },
    );
    void refresh();
  };

  const afterDelete = (c: InboxConversation) => {
    close();
    dropRow(c.id);
    setDone({ text: fill(labels.deletedDone, { name: contactName(c, labels) }) });
    void refresh();
  };

  const undoArchive = async (undo: { id: string; name: string }) => {
    setUndoing(true);
    const res = await api.patch<InboxArchiveResult>(`${endpoint}/${encodeURIComponent(undo.id)}`, { archived: false });
    setUndoing(false);
    if (res.ok) setDone({ text: fill(labels.restoredDone, { name: undo.name }) });
    else if (res.status !== 401) setDone({ text: res.error });
    void refresh();
  };

  const showArchived = (yes: boolean) => {
    setDone(null);
    setViewParam(archivedParam, yes ? "1" : null);
  };

  // 🪤 EL HILO ABIERTO NO SE CIERRA PORQUE SU CONVERSACIÓN SALGA DE LA LISTA. En
  // «Waiting», contestar hace que deje de esperar y el sondeo la quita: sin esto,
  // el hilo se cerraría solo justo después de mandar. Se recuerda la última vista
  // de la conversación abierta mientras la URL la siga pidiendo.
  const openId = search.get(param);
  const found = openId && data ? (data.conversations.find((c) => c.id === openId) ?? null) : null;
  const [kept, setKept] = useState<InboxConversation | null>(null);
  if (found && found !== kept) setKept(found);
  const open = found ?? (kept && kept.id === openId ? kept : null);

  if (!data) {
    // Nunca se cargó nada: el fallo, con su causa y con qué reintentar.
    return (
      <EmptyState
        title={failure?.reason === "not_configured" ? labels.notConfiguredTitle : labels.loadFailedTitle}
        hint={failure?.error}
        action={
          <Button variant="secondary" loading={pending > 0} onClick={() => void refresh()}>
            {labels.retry}
          </Button>
        }
      />
    );
  }

  const { channels } = data;
  if (current && channels.length === 0 && current.conversations.length === 0 && segment === "all" && !query && !archived) {
    return <EmptyState title={labels.noChannelsTitle} hint={labels.noChannelsHint} />;
  }

  // Las cuentas no dependen del segmento, pero sí de la búsqueda: las de otra
  // búsqueda no valen mientras llega la nueva.
  const counts = (data.query ?? "") === query && data.archived === archived ? data.counts : null;
  // Cuántas archivadas hay, con la misma búsqueda: no depende de la vista.
  const archivedCount = (data.query ?? "") === query ? data.archivedCount : null;
  const figures = segmentCounts(counts);
  const notes = agentNotes(channels, labels, locale);
  const rows = current?.conversations ?? (switching ? data.conversations : []);
  const moreState = more.key === wanted ? more : { loading: false, error: null };

  const list =
    !current && viewFailure ? null : current && rows.length === 0 ? (
      <EmptyState
        title={emptyListTitle(segment, query, labels, archived)}
        hint={
          query
            ? labels.noResultsHint
            : archived
              ? segment === "all"
                ? labels.emptyArchivedHint
                : undefined
              : segment === "all" && channels.length > 0
                ? fill(labels.emptyHint, { channels: listChannels(channels, labels, locale) })
                : undefined
        }
      />
    ) : (
      <>
        <ul
          className={cx("divide-y divide-hairline border-y border-hairline transition-opacity", switching && "opacity-60")}
          aria-busy={switching || undefined}
        >
          {rows.map((c) => (
            <li key={c.id}>
              <ConversationRow
                conversation={c}
                open={c.id === open?.id}
                labels={labels}
                timeZone={timeZone}
                locale={locale}
                onSelect={() => (c.id === open?.id ? close() : openConversation(c.id))}
              />
            </li>
          ))}
        </ul>
        {current && counts ? (
          <LoadMore
            showing={rows.length}
            // El total del hub manda; si el cursor dice que hay más y las cuentas aún
            // no lo reflejan (llegaron antes que la última fila), el botón sigue.
            total={current.nextCursor ? Math.max(counts[segment], rows.length + 1) : Math.max(counts[segment], rows.length)}
            onLoadMore={current.nextCursor ? () => void loadMore() : undefined}
            loading={moreState.loading}
            labels={{
              showing: (showing, total) =>
                fill(labels.showingCount, { showing: showing.toLocaleString(locale), total: total.toLocaleString(locale) }),
              more: labels.loadMore,
              loading: labels.loadingMore,
            }}
          />
        ) : current?.nextCursor ? (
          <div className="border-t border-hairline px-1 py-3">
            <Button variant="ghost" size="sm" loading={moreState.loading} onClick={() => void loadMore()}>
              {moreState.loading ? labels.loadingMore : labels.loadMore}
            </Button>
          </div>
        ) : null}
        {moreState.error ? <p className="mt-2 text-xs text-tone-red">{fill(labels.loadMoreFailed, { reason: moreState.error })}</p> : null}
      </>
    );

  const thread = (layout: "pane" | "drawer") =>
    open ? (
      <ConversationThread
        key={open.id}
        conversation={open}
        channel={channels.find((c) => c.channel === open.channel)}
        endpoint={endpoint}
        api={api}
        labels={labels}
        timeZone={timeZone}
        locale={locale}
        pollMs={pollMs}
        layout={layout}
        allowDelete={allowDelete}
        onChanged={() => void refresh()}
        onArchived={(nowArchived) => afterArchive(open, nowArchived)}
        onDeleted={() => afterDelete(open)}
        onClose={close}
      />
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div role="group" aria-label={labels.segmentsLabel}>
        <MetricStrip
          metrics={INBOX_SEGMENTS.map((s) => {
            const value = figures[s];
            return {
              key: s,
              label: segmentLabel(s, labels),
              // Sin cuentas (un hub anterior, o la búsqueda nueva aún en camino), sin
              // cifra: «—», nunca un 0 que diga «nadie espera».
              value: value === null ? "—" : value.toLocaleString(locale),
              onSelect: () => setViewParam(segmentParam, s === "all" ? null : s),
              active: s === segment,
            };
          })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <form role="search" onSubmit={onSearch} className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
          <Input
            label={labels.searchLabel}
            labelHidden
            layout="min-w-0 flex-1"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={labels.searchPlaceholder}
            maxLength={100}
            autoComplete="off"
          />
          {draft ? (
            <Button variant="ghost" size="sm" type="button" onClick={clearSearch}>
              {labels.clearSearch}
            </Button>
          ) : null}
        </form>
        <div className="flex items-center gap-1">
          {/* «Archived» no es un quinto segmento: es OTRA lista, con sus cuatro
              segmentos. Por eso va aparte, como enlace; sin archivadas no sale. */}
          {!archived && archivedCount ? (
            <Button variant="ghost" size="sm" onClick={() => showArchived(true)}>
              {labels.archivedLink}
              <span className="tabular-nums text-fg-muted">{archivedCount.toLocaleString(locale)}</span>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" loading={pending > 0} onClick={() => void refresh()}>
            {pending > 0 ? labels.refreshing : labels.refresh}
          </Button>
        </div>
      </div>

      {/* La vista «Archived» se dice ARRIBA y con su salida: sin esto, una lista sin
          la conversación que se busca se leería como «no existe». */}
      {archived ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[14px] border border-hairline px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{labels.archivedTitle}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{labels.archivedHint}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => showArchived(false)}>
            {labels.backToInbox}
          </Button>
        </div>
      ) : null}

      {done ? (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-2">
          <span>{done.text}</span>
          {done.undo ? (
            <Button variant="ghost" size="sm" loading={undoing} onClick={() => void undoArchive(done.undo!)}>
              {labels.undo}
            </Button>
          ) : null}
        </div>
      ) : null}

      {notes.length > 0 || (current && viewFailure) || (current && !current.countsExact && counts) ? (
        <div className="space-y-1">
          {notes.map((note) => (
            <p key={note} className="text-xs text-fg-muted">
              {note}
            </p>
          ))}
          {current && !current.countsExact && counts ? (
            <p className="text-xs text-fg-muted">{fill(labels.countsApprox, { count: counts.all.toLocaleString(locale) })}</p>
          ) : null}
          {current && viewFailure ? <p className="text-xs text-tone-red">{fill(labels.refreshFailed, { reason: viewFailure.error })}</p> : null}
        </div>
      ) : null}

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-6">
        <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto">
          {list ?? (
            // La vista pedida falló y no hay nada suyo que enseñar: su causa, y reintentar.
            <EmptyState
              title={labels.loadFailedTitle}
              hint={viewFailure?.error}
              action={
                <Button variant="secondary" loading={pending > 0} onClick={() => void refresh()}>
                  {labels.retry}
                </Button>
              }
            />
          )}
        </div>
        {desktop ? (
          <div className="flex min-w-0 lg:min-h-0">
            {thread("pane") ?? (
              <div className="flex min-h-[28rem] flex-1 items-center justify-center rounded-[14px] border border-dashed border-hairline">
                <p className="px-4 text-center text-sm text-fg-muted">{labels.pickConversation}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {desktop === false ? thread("drawer") : null}
    </div>
  );
}

function ConversationRow({
  conversation: c,
  open,
  labels,
  timeZone,
  locale,
  onSelect,
}: {
  conversation: InboxConversation;
  open: boolean;
  labels: InboxLabels;
  timeZone?: string;
  locale?: string;
  onSelect: () => void;
}) {
  const preview = c.last ? previewLine(c.last, labels) : null;
  return (
    <button type="button" onClick={onSelect} aria-current={open ? "true" : undefined} className={cx(ROW, open ? ROW_OPEN : ROW_IDLE)}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-semibold text-fg">{contactName(c, labels)}</span>
        <span className="shrink-0 text-[11px] text-fg-muted">
          <RelativeTime iso={c.lastMessageAt} timeZone={timeZone} locale={locale} />
        </span>
      </span>
      {preview ? (
        <span className="mt-0.5 block truncate text-xs text-fg-2">
          {preview.prefix ? <span className="text-fg-muted">{preview.prefix}</span> : null}
          {preview.muted ? <span className="italic">{preview.text}</span> : preview.text}
        </span>
      ) : null}
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
        <span>{channelName(c.channel, labels)}</span>
        {c.waiting ? <StatusBadge meta={{ label: labels.waiting, tone: "amber" }} size="sm" /> : null}
        {c.handler === "human" ? <StatusBadge meta={{ label: labels.handledByYou, tone: "gray" }} size="sm" dot={false} /> : null}
      </span>
    </button>
  );
}
