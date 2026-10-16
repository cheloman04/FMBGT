"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createApiClient } from "../api";
import { Button } from "../Button";
import { Drawer } from "../Drawer";
import { EmptyState } from "../EmptyState";
import { Input } from "../Field";
import { LoadMore } from "../LoadMore";
import { MetricStrip } from "../MetricStrip";
import { PeriodFilter } from "../PeriodFilter";
import { RelativeTime } from "../RelativeTime";
import { ResponsiveList, type Column } from "../ResponsiveList";
import { SelectMenu } from "../SelectMenu";
import { SkeletonText } from "../Skeleton";
import { StatusBadge } from "../StatusBadge";
import { resolveStatus } from "../status";
import { formatDateTime } from "../time";
import { withParam } from "../url";
import { usePolling } from "../conversations/usePolling";
import {
  EMAIL_PARAMS,
  EMAIL_PERIODS,
  EMAIL_SEGMENTS,
  EMAILS_PAGE_SIZE,
  appendPage,
  emailListUrl,
  emailStatusMeta,
  emailTypeName,
  emailViewKey,
  emptyTitle,
  fillEmail,
  isEmailAddress,
  mergeEmailLabels,
  mergeRefresh,
  parseEmailView,
  sameCountsScope,
  shownTotal,
  withItem,
  type EmailParamNames,
  type EmailsLabels,
} from "./log";
import type { EmailDetail, EmailItem, EmailsData, EmailsLoad } from "./types";

type Props = {
  /** Lo que cargó la página con `loadEmails(hubFromEnv(), parseEmailView(searchParams))`. Un fallo llega con su causa. */
  initial: EmailsLoad;
  /** La ruta proxy del spoke (`/api/admin/emails`), de `createEmailRoutes()`. */
  endpoint: string;
  /** El login del área: un 401 manda allí con `next` y `expired` (`createApiClient`). */
  loginPath: string;
  /** Zona IANA del NEGOCIO (§8.7), p. ej. `America/New_York`. */
  timeZone?: string;
  locale?: string;
  /** Los textos; `typeNames` nombra los `email_type` del proyecto y llena el selector de tipo. */
  labels?: Partial<EmailsLabels>;
  /** Cada cuánto se relee la primera página. */
  pollMs?: number;
  /** Los nombres de los parámetros de la URL, si chocan con otros de la página. */
  params?: Partial<EmailParamNames>;
  /** El parámetro del correo abierto en el cajón. */
  openParam?: string;
};

/**
 * Los correos que el negocio mandó a sus clientes por Kigaru (carril 5): qué salió,
 * qué llegó y qué no, con su línea de eventos.
 *
 *   // app/admin/(panel)/emails/page.tsx — servidor
 *   const view = parseEmailView(await searchParams);
 *   const initial = await loadEmails(hubFromEnv(), view);
 *   <PageShell>
 *     <PageHeader title="Emails" />
 *     <EmailsLog initial={initial} endpoint="/api/admin/emails" loginPath="/admin/login" timeZone="America/New_York"
 *       labels={{ typeNames: { booking_confirmed: "Booking confirmation" } }} />
 *   </PageShell>
 *
 * - Arriba, los segmentos con las cuentas del CONJUNTO (las da el hub): All ·
 *   Delivered · Sending · Problems · Not sent. No cambian al elegir uno.
 * - Segmento, tipo, periodo y dirección viven en la URL y cambian SIN volver al
 *   servidor: la isla pide la vista por la ruta proxy.
 * - Abrir un correo (`?email=<id>`) lo enseña en un `Drawer` con su línea de
 *   eventos. Atrás lo cierra.
 * - Se relee cada `pollMs` (60 s), en pausa con la pestaña oculta, sin perder lo
 *   cargado con «Load more».
 * - 🪤 Sin aperturas ni clics: el seguimiento va apagado (decisión E3).
 */
export function EmailsLog(props: Props) {
  // `useSearchParams` pide un Suspense por encima.
  return (
    <Suspense fallback={null}>
      <Log {...props} />
    </Suspense>
  );
}

/** Un intento que falló, con la vista que pedía: el de otra vista no se enseña en esta. */
type Failure = { key: string; reason: "not_configured" | "not_enabled" | "hub_error"; error: string };
type DetailState = { id: string; result: { ok: true; data: EmailDetail } | { ok: false; error: string } };

const MAX_REFRESH = 100;

function Log({
  initial,
  endpoint,
  loginPath,
  timeZone,
  locale = "en-US",
  labels: overrides,
  pollMs = 60_000,
  params: paramOverrides,
  openParam = "email",
}: Props) {
  const labels = useMemo(() => mergeEmailLabels(overrides), [overrides]);
  const names = useMemo(() => ({ ...EMAIL_PARAMS, ...paramOverrides }), [paramOverrides]);
  const api = useMemo(() => createApiClient({ loginPath }), [loginPath]);
  const statusMeta = useMemo(() => emailStatusMeta(labels), [labels]);
  const pathname = usePathname();
  const search = useSearchParams();

  // Lo que se PIDE vive en la URL; lo que se VE, en `data`, con su vista.
  const view = parseEmailView(search, names);
  const wanted = emailViewKey(view);

  const [data, setData] = useState<EmailsData | null>(initial.ok ? initial.data : null);
  const [failure, setFailure] = useState<Failure | null>(
    initial.ok ? null : { key: emailViewKey(initial.view), reason: initial.reason, error: initial.error },
  );
  const [pending, setPending] = useState(0);
  const [more, setMore] = useState<{ key: string; loading: boolean; error: string | null }>({ key: wanted, loading: false, error: null });
  const [draft, setDraft] = useState(view.to ?? "");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);

  const current = data && emailViewKey(data.view) === wanted ? data : null;
  const viewFailure = failure && failure.key === wanted ? failure : null;
  const switching = data !== null && current === null && viewFailure === null;

  const latest = useRef({ view, wanted, data });
  useEffect(() => {
    latest.current = { view, wanted, data };
  });

  const refresh = useCallback(async () => {
    const { view, wanted, data: shown } = latest.current;
    // Releer lo que se ve pide tantas filas como se enseñan, hasta el tope del hub.
    const same = shown !== null && emailViewKey(shown.view) === wanted;
    const limit = same ? Math.min(MAX_REFRESH, Math.max(EMAILS_PAGE_SIZE, shown.items.length)) : EMAILS_PAGE_SIZE;
    setPending((n) => n + 1);
    const res = await api.get<EmailsData>(emailListUrl(endpoint, view, { limit }));
    setPending((n) => n - 1);
    if (latest.current.wanted !== wanted) return;
    if (res.ok) {
      setData((prev) => (prev && emailViewKey(prev.view) === wanted ? mergeRefresh(prev, res.data) : res.data));
      setFailure(null);
    } else if (res.status !== 401) {
      // 🪤 Un fallo al RELEER no borra lo que ya se veía: se mantiene y se avisa.
      setFailure({ key: wanted, reason: res.status === 503 ? "not_configured" : "hub_error", error: res.error });
    }
  }, [api, endpoint]);
  usePolling(refresh, { intervalMs: pollMs });

  // Otra vista en la URL: se pide en el acto.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    if (switching) void refreshRef.current();
  }, [switching, wanted]);

  const loadMore = useCallback(async () => {
    const { view, wanted, data: shown } = latest.current;
    if (!shown || emailViewKey(shown.view) !== wanted || !shown.nextCursor) return;
    setMore({ key: wanted, loading: true, error: null });
    const res = await api.get<EmailsData>(emailListUrl(endpoint, view, { cursor: shown.nextCursor }));
    if (latest.current.wanted !== wanted) return setMore({ key: wanted, loading: false, error: null });
    if (res.ok) {
      setData((prev) => (prev && emailViewKey(prev.view) === wanted ? appendPage(prev, res.data) : prev));
      setMore({ key: wanted, loading: false, error: null });
    } else {
      setMore({ key: wanted, loading: false, error: res.status === 401 ? null : res.error });
    }
  }, [api, endpoint]);

  // 🪤 Los filtros cambian la URL SIN volver al servidor: con `router.replace` la
  // página volvería a pedir la lista al hub para tirarla, porque la isla ya pide
  // la suya. Next sincroniza `useSearchParams` con `history.replaceState`.
  const setParam = useCallback(
    (key: string, value: string | null, mode: "replace" | "push" = "replace") => {
      const href = withParam(pathname, search, key, value, { keepPage: true });
      if (mode === "push") window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
    },
    [pathname, search],
  );

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = draft.trim().toLowerCase();
    if (next && !isEmailAddress(next)) return setDraftError(labels.badAddress);
    setDraftError(null);
    if (next !== (view.to ?? "")) setParam(names.to, next || null);
  };
  const clearSearch = () => {
    setDraft("");
    setDraftError(null);
    if (view.to) setParam(names.to, null);
  };

  // El correo abierto: vive en la URL (abrir apila una entrada; Atrás lo cierra).
  const openId = search.get(openParam);
  const openEmail = useCallback((id: string) => setParam(openParam, id, "push"), [openParam, setParam]);
  const closeEmail = useCallback(() => setParam(openParam, null), [openParam, setParam]);

  const loadDetail = useCallback(
    async (id: string) => {
      const res = await api.get<EmailDetail>(`${endpoint}/${encodeURIComponent(id)}`);
      if (res.ok) {
        setDetail({ id, result: { ok: true, data: res.data } });
        // La fila de la lista, al día con lo que trajo el detalle.
        setData((prev) => (prev ? withItem(prev, res.data) : prev));
      } else if (res.status !== 401) {
        setDetail({ id, result: { ok: false, error: res.error } });
      }
    },
    [api, endpoint],
  );
  const loadDetailRef = useRef(loadDetail);
  useEffect(() => {
    loadDetailRef.current = loadDetail;
  });
  useEffect(() => {
    if (openId) void loadDetailRef.current(openId);
  }, [openId]);
  const shownDetail = openId && detail?.id === openId ? detail.result : null;

  if (!data) {
    // Nunca se cargó nada: el fallo, con su causa y con qué reintentar.
    const title =
      failure?.reason === "not_configured"
        ? labels.notConfiguredTitle
        : failure?.reason === "not_enabled"
          ? labels.notEnabledTitle
          : labels.loadFailedTitle;
    return (
      <EmptyState
        title={title}
        hint={failure?.error}
        action={
          <Button variant="secondary" loading={pending > 0} onClick={() => void refresh()}>
            {labels.retry}
          </Button>
        }
      />
    );
  }

  // Las cuentas no dependen del segmento, pero sí del tipo, el periodo y la
  // dirección: las de otro alcance no valen mientras llega la vista nueva.
  const counts = sameCountsScope(data.view, view) ? data.counts : null;
  const rows = current?.items ?? (switching ? data.items : []);
  const moreState = more.key === wanted ? more : { loading: false, error: null };
  const typeOptions = Object.entries(labels.typeNames);

  const columns: Column<EmailItem>[] = [
    {
      key: "to",
      header: labels.colTo,
      mobile: "primary",
      interactive: true,
      cell: (e) => (
        <button
          type="button"
          onClick={() => openEmail(e.id)}
          aria-label={fillEmail(labels.openEmail, { to: e.to })}
          className="min-w-0 max-w-full truncate rounded text-left font-semibold text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60"
        >
          {e.to}
        </button>
      ),
    },
    { key: "subject", header: labels.colSubject, mobile: "secondary", cell: (e) => <span className="text-fg-2">{e.subject}</span> },
    {
      key: "type",
      header: labels.colType,
      mobile: "meta",
      cell: (e) => (
        <span className="text-fg-muted">
          {emailTypeName(e.type, labels)}
          {e.category === "marketing" ? ` · ${labels.categories.marketing}` : ""}
        </span>
      ),
    },
    { key: "when", header: labels.colWhen, mobile: "meta", cell: (e) => <RelativeTime iso={e.queuedAt} timeZone={timeZone} locale={locale} /> },
    {
      key: "status",
      header: labels.colStatus,
      mobile: "status",
      align: "right",
      cell: (e) => <StatusBadge meta={resolveStatus(statusMeta, e.status)} size="sm" />,
    },
  ];

  const empty = emptyTitle(view, labels);
  const list =
    !current && viewFailure ? (
      <EmptyState
        title={labels.loadFailedTitle}
        hint={viewFailure.error}
        action={
          <Button variant="secondary" loading={pending > 0} onClick={() => void refresh()}>
            {labels.retry}
          </Button>
        }
      />
    ) : (
      <div className={switching ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={switching || undefined}>
        <ResponsiveList
          rows={rows}
          columns={columns}
          rowKey={(e) => e.id}
          caption={labels.caption}
          tableFrom="md"
          empty={<EmptyState title={empty.title} hint={empty.hint} />}
        />
        {current && rows.length > 0 ? (
          <div className="mt-3">
            <LoadMore
              showing={rows.length}
              total={shownTotal(current)}
              noun={labels.noun}
              onLoadMore={current.nextCursor ? () => void loadMore() : undefined}
              loading={moreState.loading}
            />
            {moreState.error ? <p className="mt-1 text-xs text-tone-red">{fillEmail(labels.loadMoreFailed, { reason: moreState.error })}</p> : null}
          </div>
        ) : null}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={labels.segmentsLabel}>
        <MetricStrip
          metrics={EMAIL_SEGMENTS.map((s) => ({
            key: s,
            label: labels.segments[s],
            // Sin cuentas (un hub que no las manda, o la vista nueva aún en camino):
            // «—», nunca un 0 que diga «no hubo problemas».
            value: counts ? counts[s].toLocaleString(locale) : "—",
            onSelect: () => setParam(names.segment, s === "all" ? null : s),
            active: s === view.segment,
          }))}
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {typeOptions.length > 0 ? (
            <SelectMenu
              ariaLabel={labels.typeLabel}
              value={view.type ?? ""}
              onChange={(value) => setParam(names.type, value || null)}
              options={[{ value: "", label: labels.allTypes }, ...typeOptions.map(([value, label]) => ({ value, label }))]}
            />
          ) : null}
          <PeriodFilter
            ariaLabel={labels.periodLabel}
            value={view.period}
            options={EMAIL_PERIODS.map((p) => ({ value: p, label: labels.periods[p] }))}
            onChange={(p) => setParam(names.period, p)}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-end gap-2">
          <form role="search" onSubmit={onSearch} className="flex min-w-0 flex-1 items-start gap-2 sm:max-w-sm">
            <Input
              label={labels.searchLabel}
              labelHidden
              layout="min-w-0 flex-1"
              type="search"
              inputMode="email"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={labels.searchPlaceholder}
              maxLength={254}
              autoComplete="off"
              error={draftError ?? undefined}
            />
            <Button variant="secondary" size="sm" type="submit">
              {labels.search}
            </Button>
            {draft || view.to ? (
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

      {current && viewFailure ? <p className="text-xs text-tone-red">{fillEmail(labels.refreshFailed, { reason: viewFailure.error })}</p> : null}

      {list}

      <Drawer open={Boolean(openId)} title={labels.detailTitle} onClose={closeEmail} closeLabel={labels.close}>
        {shownDetail === null ? (
          <SkeletonText lines={6} />
        ) : shownDetail.ok ? (
          <EmailDetailView email={shownDetail.data} labels={labels} statusMeta={statusMeta} timeZone={timeZone} locale={locale} />
        ) : (
          <EmptyState
            title={fillEmail(labels.detailFailed, { reason: shownDetail.error })}
            action={
              <Button variant="secondary" onClick={() => openId && void loadDetail(openId)}>
                {labels.retry}
              </Button>
            }
          />
        )}
      </Drawer>
    </div>
  );
}

function EmailDetailView({
  email,
  labels,
  statusMeta,
  timeZone,
  locale,
}: {
  email: EmailDetail;
  labels: EmailsLabels;
  statusMeta: ReturnType<typeof emailStatusMeta>;
  timeZone?: string;
  locale?: string;
}) {
  const when = (iso: string | null) => (iso ? formatDateTime(iso, timeZone, locale) : null);
  const facts: [string, string | null][] = [
    [labels.detailTo, email.to],
    [labels.detailType, `${emailTypeName(email.type, labels)}${email.category ? ` · ${labels.categories[email.category]}` : ""}`],
    [labels.detailQueued, when(email.queuedAt)],
    [labels.detailSent, when(email.sentAt)],
    [labels.detailDelivered, when(email.deliveredAt)],
    [labels.detailReason, email.failureReason],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-fg">{email.subject}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge meta={resolveStatus(statusMeta, email.status)} size="sm" />
        </div>
        {labels.statusHints[email.status] ? <p className="mt-2 text-sm text-fg-2">{labels.statusHints[email.status]}</p> : null}
      </div>

      <dl className="divide-y divide-hairline border-y border-hairline">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="shrink-0 text-xs text-fg-muted">{label}</dt>
              <dd className="min-w-0 break-words text-right text-sm text-fg">{value}</dd>
            </div>
          ))}
      </dl>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{labels.timeline}</p>
        <ol className="mt-2 flex flex-col gap-2">
          {email.events.map((ev, i) => (
            <li key={`${ev.type}-${ev.at}-${i}`} className="flex flex-col">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-fg">{labels.events[ev.type] ?? ev.type}</span>
                <span className="shrink-0 text-[11px] text-fg-muted">{formatDateTime(ev.at, timeZone, locale)}</span>
              </span>
              {ev.detail ? <span className="text-xs text-fg-2">{ev.detail}</span> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-fg-muted">{labels.noBodyNote}</p>
      </div>
    </div>
  );
}
