"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createApiClient } from "../api";
import { Button } from "../Button";
import { cx } from "../cx";
import { EmptyState } from "../EmptyState";
import { Input } from "../Field";
import { LoadMore } from "../LoadMore";
import { MetricStrip, type Metric } from "../MetricStrip";
import { notifyBadgesChanged } from "../nav";
import { PeriodFilter } from "../PeriodFilter";
import { RelativeTime } from "../RelativeTime";
import { StatusBadge } from "../StatusBadge";
import { IconAudioLines, IconCheck, IconPhoneIncoming, IconPhoneOutgoing } from "../_icons";
import { withParam } from "../url";
import { CallDetail } from "./CallDetail";
import {
  CALL_DIRECTIONS,
  CALL_PARAMS,
  CALL_PERIODS,
  CALLS_MAX_REFRESH,
  CALLS_PAGE_SIZE,
  answeredPercent,
  appendCallsPage,
  attendedLine,
  callListUrl,
  callQueryFromParam,
  callViewKey,
  callerName,
  emptyCallsTitle,
  fillCall,
  formatDuration,
  hasCallFilters,
  mergeCallLabels,
  mergeCallsRefresh,
  outcomeMeta,
  parseCallView,
  sameCallCountsScope,
  shownTotal,
  waitingForPerson,
  withAttended,
  type CallParamNames,
  type CallsLabels,
} from "./calls";
import type { CallAttendedResult, CallDirection, CallItem, CallPeriod, CallSegment, CallsData, CallsLoad } from "./types";
import { useMediaQuery } from "./useMediaQuery";
import { usePolling } from "./usePolling";

type Props = {
  /** Lo que cargó la página con `loadCalls()` (servidor). Un fallo llega con su causa. */
  initial: CallsLoad;
  /** La ruta proxy del spoke (`/api/admin/calls`), de `createCallRoutes()`. */
  endpoint: string;
  /** El login del área: un 401 manda allí con `next` y `expired` (`createApiClient`). */
  loginPath: string;
  /** Zona IANA del NEGOCIO (§8.7), p. ej. `America/New_York`. */
  timeZone?: string;
  locale?: string;
  labels?: Partial<CallsLabels>;
  /** Cada cuánto se relee la lista (y la llamada abierta). */
  pollMs?: number;
  /** Los nombres de los parámetros de la URL, si chocan con otros de la página. */
  params?: Partial<CallParamNames>;
  /**
   * El enlace a su hilo de mensajería, con `{id}`: «Open their messages». Es una
   * plantilla y no una función porque viaja de una página de servidor a la isla.
   */
  messagesHref?: string;
};

const ROW =
  "block w-full px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ac-500/60 max-sm:min-h-11";
const ROW_IDLE = "hover:bg-surface-muted";
const ROW_OPEN = "bg-surface-muted";
/** Cuánto se espera a que se deje de escribir antes de buscar. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * El registro de llamadas de un spoke: las que hizo y le hicieron su agente de
 * voz, con «Needs a human» delante (decisión 12; contrato §2.3).
 *
 *   // app/admin/(panel)/calls/page.tsx — servidor
 *   const sp = await searchParams;
 *   const initial = await loadCalls(hubFromEnv(), { segment: sp.segment, period: sp.period, direction: sp.direction, query: sp.q });
 *   <PageShell fill>
 *     <PageHeader title="Calls" />
 *     <CallsLog initial={initial} endpoint="/api/admin/calls" loginPath="/admin/login" timeZone="America/New_York" />
 *   </PageShell>
 *
 * - Arriba, la tira: Calls · Answered · Unanswered · Avg duration · Needs a human.
 *   Las cuatro que filtran son los cortes del hub, con sus cuentas del CONJUNTO
 *   (no cambian al elegir uno). «Needs a human» son las PENDIENTES.
 * - Periodo y dirección, el buscador por nombre y número, «Refresh»: todo en la
 *   URL (`?segment=`, `?period=`, `?direction=`, `?q=`) y sin volver al servidor.
 * - «Load more» trae la página siguiente con el cursor del hub. Se relee cada
 *   `pollMs` (30 s), en pausa con la pestaña oculta, sin perder lo cargado.
 * - La llamada abierta vive en `?call=`: en escritorio (`lg`) al lado de la lista;
 *   en el teléfono, en un `Drawer` a pantalla entera. Atrás la cierra.
 * - Marcar como atendida pone la fila al día, relee la lista y avisa al menú.
 */
export function CallsLog(props: Props) {
  // `useSearchParams` pide un Suspense por encima.
  return (
    <Suspense fallback={null}>
      <Log {...props} />
    </Suspense>
  );
}

/** Un intento que falló, con la vista que pedía: el de otra vista no se enseña en esta. */
type Failure = { key: string; reason: "not_configured" | "hub_error"; error: string };

function Log({
  initial,
  endpoint,
  loginPath,
  timeZone,
  locale = "en-US",
  labels: overrides,
  pollMs = 30_000,
  params: paramOverrides,
  messagesHref = "/admin/conversations?c={id}",
}: Props) {
  const labels = useMemo(() => mergeCallLabels(overrides), [overrides]);
  const names = useMemo(() => ({ ...CALL_PARAMS, ...paramOverrides }), [paramOverrides]);
  const api = useMemo(() => createApiClient({ loginPath }), [loginPath]);
  const pathname = usePathname();
  const search = useSearchParams();
  const desktop = useMediaQuery("(min-width: 1024px)");

  // Lo que se PIDE vive en la URL; lo que se VE, en `data`, con su vista.
  const view = parseCallView(search, names);
  const wanted = callViewKey(view);

  const [data, setData] = useState<CallsData | null>(initial.ok ? initial.data : null);
  const [failure, setFailure] = useState<Failure | null>(
    initial.ok ? null : { key: callViewKey(initial.view), reason: initial.reason, error: initial.error },
  );
  const [pending, setPending] = useState(0);
  const [more, setMore] = useState<{ key: string; loading: boolean; error: string | null }>({ key: wanted, loading: false, error: null });
  const [draft, setDraft] = useState(view.query ?? "");

  const current = data && callViewKey(data.view) === wanted ? data : null;
  const viewFailure = failure && failure.key === wanted ? failure : null;
  // Cambiando de vista: lo de la anterior se ve atenuado hasta que llega la nueva.
  const switching = data !== null && current === null && viewFailure === null;

  // Lo último pedido y lo último visto, para lo que corre DESPUÉS del render.
  const latest = useRef({ view, wanted, data });
  useEffect(() => {
    latest.current = { view, wanted, data };
  });

  const refresh = useCallback(async () => {
    const { view, wanted, data: shown } = latest.current;
    // Releer lo que se ve pide tantas filas como se enseñan, hasta el tope del hub.
    const same = shown !== null && callViewKey(shown.view) === wanted;
    const limit = same ? Math.min(CALLS_MAX_REFRESH, Math.max(CALLS_PAGE_SIZE, shown.calls.length)) : CALLS_PAGE_SIZE;
    setPending((n) => n + 1);
    const res = await api.get<CallsData>(callListUrl(endpoint, view, { limit }));
    setPending((n) => n - 1);
    // Mientras volaba se pidió otra vista: su propia petición pintará lo suyo.
    if (latest.current.wanted !== wanted) return;
    if (res.ok) {
      setData((prev) => (prev && callViewKey(prev.view) === wanted ? mergeCallsRefresh(prev, res.data) : res.data));
      setFailure(null);
    } else if (res.status !== 401) {
      // 🪤 Un fallo al RELEER no borra lo que ya se veía: se mantiene y se avisa.
      setFailure({ key: wanted, reason: res.status === 503 ? "not_configured" : "hub_error", error: res.error });
    }
  }, [api, endpoint]);
  usePolling(refresh, { intervalMs: pollMs });

  // Otra vista en la URL: se pide en el acto, sin esperar al sondeo.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    if (switching) void refreshRef.current();
  }, [switching, wanted]);

  const loadMore = useCallback(async () => {
    const { view, wanted, data: shown } = latest.current;
    if (!shown || callViewKey(shown.view) !== wanted || !shown.nextCursor) return;
    setMore({ key: wanted, loading: true, error: null });
    const res = await api.get<CallsData>(callListUrl(endpoint, view, { cursor: shown.nextCursor }));
    if (latest.current.wanted !== wanted) return setMore({ key: wanted, loading: false, error: null });
    if (res.ok) {
      setData((prev) => (prev && callViewKey(prev.view) === wanted ? appendCallsPage(prev, res.data) : prev));
      setMore({ key: wanted, loading: false, error: null });
    } else {
      setMore({ key: wanted, loading: false, error: res.status === 401 ? null : res.error });
    }
  }, [api, endpoint]);

  // 🪤 Los filtros cambian la URL SIN volver al servidor: con `router.replace` la
  // página volvería a pedir la lista al hub para tirarla, porque la isla ya pide la
  // suya. Next sincroniza `useSearchParams` con `history.replaceState`.
  const setParam = useCallback(
    (key: string, value: string | null, mode: "replace" | "push" = "replace") => {
      const href = withParam(pathname, search, key, value, { keepPage: true });
      if (mode === "push") window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
    },
    [pathname, search],
  );

  // Buscar mientras se escribe, cuando se deja de escribir.
  const query = view.query ?? "";
  useEffect(() => {
    const next = callQueryFromParam(draft);
    if (next === query) return;
    const timer = setTimeout(() => setParam(names.query, next || null), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, query, names.query, setParam]);

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = callQueryFromParam(draft);
    if (next !== query) setParam(names.query, next || null);
  };
  const clearSearch = () => {
    setDraft("");
    if (query) setParam(names.query, null);
  };
  /** Periodo, dirección y búsqueda a la vez; el corte elegido se queda. */
  const clearFilters = () => {
    setDraft("");
    const params = new URLSearchParams(search.toString());
    for (const key of [names.period, names.direction, names.query]) params.delete(key);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  // La llamada abierta: vive en la URL (abrir apila una entrada; Atrás la cierra).
  const openId = search.get(names.open);
  const openCall = useCallback((id: string) => setParam(names.open, id, "push"), [names.open, setParam]);
  const closeCall = useCallback(() => setParam(names.open, null), [names.open, setParam]);

  const onChanged = useCallback(
    (result: CallAttendedResult) => {
      // La fila al día en el acto; la lista (y sus cuentas) y el menú, releídos.
      setData((prev) => (prev ? withAttended(prev, result) : prev));
      notifyBadgesChanged();
      void refresh();
    },
    [refresh],
  );

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

  // Las cuentas no dependen del corte, pero sí del periodo, la dirección y la
  // búsqueda: las de otro alcance no valen mientras llega la vista nueva.
  const scoped = sameCallCountsScope(data.view, view) ? data : null;
  const counts = scoped?.counts ?? null;
  const figure = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString(locale));
  const percent = answeredPercent(counts);
  const select = (s: CallSegment) => () => setParam(names.segment, s === "all" ? null : s);
  // Sin cuentas (la vista nueva aún en camino, o un hub que no las manda): «—»,
  // nunca un 0 que diga «nadie espera».
  const metrics: Metric[] = [
    { key: "all", label: labels.segments.all, value: figure(counts?.all), sub: labels.periodSubs[view.period], onSelect: select("all"), active: view.segment === "all" },
    {
      key: "answered",
      label: labels.segments.answered,
      value: figure(counts?.answered),
      sub: percent === null ? undefined : fillCall(labels.answeredSub, { percent }),
      onSelect: select("answered"),
      active: view.segment === "answered",
    },
    {
      key: "unanswered",
      label: labels.segments.unanswered,
      value: figure(counts?.unanswered),
      sub: labels.unansweredSub,
      onSelect: select("unanswered"),
      active: view.segment === "unanswered",
    },
    {
      key: "avg",
      label: labels.avgDuration,
      value: counts && scoped ? formatDuration(scoped.avgDurationSecs) : "—",
      sub:
        counts && scoped
          ? scoped.avgDurationOver > 0
            ? fillCall(labels.avgSub, { count: scoped.avgDurationOver.toLocaleString(locale) })
            : labels.avgSubNone
          : undefined,
    },
    {
      key: "needs_human",
      label: labels.segments.needs_human,
      value: figure(counts?.needs_human),
      sub: counts ? (counts.needs_human > 0 ? labels.needsHumanSub : labels.needsHumanSubNone) : undefined,
      onSelect: select("needs_human"),
      active: view.segment === "needs_human",
    },
  ];

  const rows = current?.calls ?? (switching ? data.calls : []);
  const moreState = more.key === wanted ? more : { loading: false, error: null };
  const empty = emptyCallsTitle(view, labels);
  const openRow = openId ? (data.calls.find((c) => c.id === openId) ?? null) : null;

  const list =
    !current && viewFailure ? null : current && rows.length === 0 ? (
      <EmptyState title={empty.title} hint={empty.hint} />
    ) : (
      <>
        <ul
          className={cx("divide-y divide-hairline border-y border-hairline transition-opacity", switching && "opacity-60")}
          aria-busy={switching || undefined}
        >
          {rows.map((c) => (
            <li key={c.id}>
              <CallRow
                call={c}
                open={c.id === openId}
                labels={labels}
                timeZone={timeZone}
                locale={locale}
                onSelect={() => (c.id === openId ? closeCall() : openCall(c.id))}
              />
            </li>
          ))}
        </ul>
        {current && rows.length > 0 ? (
          <LoadMore
            showing={rows.length}
            total={shownTotal(current)}
            onLoadMore={current.nextCursor ? () => void loadMore() : undefined}
            loading={moreState.loading}
            labels={{
              showing: (showing, total) =>
                fillCall(labels.showingCount, { showing: showing.toLocaleString(locale), total: total.toLocaleString(locale) }),
              more: labels.loadMore,
              loading: labels.loadingMore,
            }}
          />
        ) : null}
        {moreState.error ? <p className="mt-2 text-xs text-tone-red">{fillCall(labels.loadMoreFailed, { reason: moreState.error })}</p> : null}
      </>
    );

  const detail = (layout: "pane" | "drawer") =>
    openId ? (
      <CallDetail
        key={openId}
        callId={openId}
        row={openRow}
        endpoint={endpoint}
        api={api}
        labels={labels}
        timeZone={timeZone}
        locale={locale}
        pollMs={pollMs}
        messagesHref={messagesHref}
        layout={layout}
        onChanged={onChanged}
        onClose={closeCall}
      />
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div role="group" aria-label={labels.segmentsLabel}>
        <MetricStrip metrics={metrics} heaviest="needs_human" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <PeriodFilter
            ariaLabel={labels.periodLabel}
            value={view.period}
            options={CALL_PERIODS.map((p) => ({ value: p, label: labels.periods[p] }))}
            onChange={(p) => setParam(names.period, (p as CallPeriod) === "all" ? null : p)}
          />
          <PeriodFilter
            ariaLabel={labels.directionLabel}
            value={view.direction}
            options={CALL_DIRECTIONS.map((d) => ({ value: d, label: labels.directions[d] }))}
            onChange={(d) => setParam(names.direction, (d as CallDirection) === "all" ? null : d)}
          />
          {hasCallFilters(view) ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {labels.clearFilters}
            </Button>
          ) : null}
        </div>
        {/* `basis-72`: si al lado de los dos controles no le quedan 18rem, el buscador
            baja a su propia línea en vez de cortarse (1024 px con el menú abierto). */}
        <div className="flex min-w-0 flex-1 basis-72 items-center justify-end gap-2 max-sm:w-full">
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
          <Button variant="ghost" size="sm" loading={pending > 0} onClick={() => void refresh()}>
            {pending > 0 ? labels.refreshing : labels.refresh}
          </Button>
        </div>
      </div>

      {(current && !current.countsExact && counts) || (current && viewFailure) ? (
        <div className="space-y-1">
          {current && !current.countsExact && counts ? (
            <p className="text-xs text-fg-muted">{fillCall(labels.countsApprox, { count: counts.all.toLocaleString(locale) })}</p>
          ) : null}
          {current && viewFailure ? <p className="text-xs text-tone-red">{fillCall(labels.refreshFailed, { reason: viewFailure.error })}</p> : null}
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
            {detail("pane") ?? (
              <div className="flex min-h-[28rem] flex-1 items-center justify-center rounded-[14px] border border-dashed border-hairline">
                <p className="px-4 text-center text-sm text-fg-muted">{labels.pickCall}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {desktop === false ? detail("drawer") : null}
    </div>
  );
}

function CallRow({
  call,
  open,
  labels,
  timeZone,
  locale,
  onSelect,
}: {
  call: CallItem;
  open: boolean;
  labels: CallsLabels;
  timeZone?: string;
  locale?: string;
  onSelect: () => void;
}) {
  const waiting = waitingForPerson(call);
  const Direction = call.direction === "inbound" ? IconPhoneIncoming : IconPhoneOutgoing;
  return (
    <button type="button" onClick={onSelect} aria-current={open ? "true" : undefined} className={cx(ROW, open ? ROW_OPEN : ROW_IDLE)}>
      <span className="flex items-center gap-2">
        <Direction className="h-3.5 w-3.5 flex-none text-fg-muted" />
        <span className="sr-only">{call.direction === "inbound" ? labels.incoming : labels.outgoing}: </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{callerName(call, labels)}</span>
        {call.recording ? (
          <>
            <IconAudioLines className="h-3.5 w-3.5 flex-none text-fg-muted" />
            <span className="sr-only">{labels.hasRecording}</span>
          </>
        ) : null}
        {/* La duración a la derecha, en tabulares: la columna se lee de un vistazo. */}
        <span className="shrink-0 text-[11px] tabular-nums text-fg-muted">{formatDuration(call.durationSecs)}</span>
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5.5 text-[11px] text-fg-muted">
        <RelativeTime iso={call.at} timeZone={timeZone} locale={locale} />
        <StatusBadge meta={outcomeMeta(call.outcome, labels)} size="sm" />
        {/* «Needs a human» son las PENDIENTES: una ya atendida lo dice en gris. */}
        {waiting ? <StatusBadge meta={{ label: labels.needsReply, tone: "amber" }} size="sm" /> : null}
        {call.needsHuman && call.attended ? (
          <span className="inline-flex items-center gap-1">
            <IconCheck className="h-3 w-3 flex-none" />
            {attendedLine(call.attended, labels)}
          </span>
        ) : null}
      </span>
      {waiting && call.humanNote ? <span className="mt-1 block truncate pl-5.5 text-xs text-fg-2">{call.humanNote}</span> : null}
    </button>
  );
}
