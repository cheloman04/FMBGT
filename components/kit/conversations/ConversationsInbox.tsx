"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { createApiClient } from "../api";
import { Button } from "../Button";
import { cx } from "../cx";
import { EmptyState } from "../EmptyState";
import { RelativeTime } from "../RelativeTime";
import { StatusBadge } from "../StatusBadge";
import { Tabs } from "../Tabs";
import { withParam } from "../url";
import { ConversationThread } from "./ConversationThread";
import {
  ALL_TAB,
  agentNotes,
  channelName,
  contactName,
  conversationsIn,
  fill,
  inboxTabs,
  listChannels,
  mergeLabels,
  previewLine,
  type InboxLabels,
} from "./inbox";
import type { InboxConversation, InboxData, InboxLoad } from "./types";
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
  /** El parámetro de la URL con la pestaña de canal. */
  channelParam?: string;
};

const ROW = "block w-full px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ac-500/60 max-sm:min-h-11";
const ROW_IDLE = "hover:bg-surface-muted";
const ROW_OPEN = "bg-surface-muted";

/**
 * La bandeja de conversaciones de un spoke: Instagram, Messenger, WhatsApp…
 *
 *   // app/admin/(panel)/conversations/page.tsx — servidor
 *   const initial = await loadInbox(hubFromEnv());
 *   <PageShell fill>
 *     <PageHeader title="Conversations" />
 *     <ConversationsInbox initial={initial} endpoint="/api/admin/conversations" loginPath="/admin/login" timeZone="America/New_York" />
 *   </PageShell>
 *
 * - Se relee cada `pollMs` (15 s), en pausa con la pestaña oculta e inmediato al
 *   volver a ella.
 * - El hilo abierto y la pestaña viven en la URL (`?c=`, `?channel=`): Atrás
 *   cierra el hilo en el teléfono y un enlace se puede compartir.
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

function Inbox({
  initial,
  endpoint,
  loginPath,
  timeZone,
  locale = "en-US",
  labels: overrides,
  pollMs = 15_000,
  param = "c",
  channelParam = "channel",
}: Props) {
  const labels = useMemo(() => mergeLabels(overrides), [overrides]);
  const api = useMemo(() => createApiClient({ loginPath }), [loginPath]);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const desktop = useMediaQuery("(min-width: 1024px)");

  const [load, setLoad] = useState<InboxLoad>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const res = await api.get<InboxData>(endpoint);
    setRefreshing(false);
    if (res.ok) {
      setLoad({ ok: true, data: res.data });
      setRefreshError(null);
    } else if (res.status !== 401) {
      // 🪤 Un fallo al RELEER no borra lo que ya se veía: se mantiene y se avisa.
      // Y un fallo sin nada que enseñar se queda como fallo, con su causa: nunca
      // una bandeja vacía que diga «nadie te ha escrito».
      setLoad((prev) =>
        prev.ok ? prev : { ok: false, reason: res.status === 503 ? "not_configured" : "hub_error", error: res.error },
      );
      setRefreshError(res.error);
    }
  }, [api, endpoint]);
  usePolling(refresh, { intervalMs: pollMs });

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

  if (!load.ok) {
    return (
      <EmptyState
        title={load.reason === "not_configured" ? labels.notConfiguredTitle : labels.loadFailedTitle}
        hint={load.error}
        action={
          <Button variant="secondary" loading={refreshing} onClick={() => void refresh()}>
            {labels.retry}
          </Button>
        }
      />
    );
  }

  const { channels, conversations, truncated } = load.data;
  if (channels.length === 0 && conversations.length === 0) {
    return <EmptyState title={labels.noChannelsTitle} hint={labels.noChannelsHint} />;
  }

  const tabs = inboxTabs(channels, conversations, labels);
  const requested = search.get(channelParam);
  const tab = requested && tabs.some((t) => t.key === requested) ? requested : ALL_TAB;
  const shown = conversationsIn(conversations, tab, channels);
  const waiting = shown.filter((c) => c.waiting).length;
  const notes = agentNotes(tab === ALL_TAB ? channels : channels.filter((c) => c.channel === tab), labels, locale);
  const openId = search.get(param);
  const open = openId ? (conversations.find((c) => c.id === openId) ?? null) : null;

  const list =
    shown.length === 0 ? (
      <EmptyState
        title={
          tab === ALL_TAB ? labels.emptyTitle : fill(labels.emptyChannelTitle, { channel: channelName(tab, labels) })
        }
        hint={tab === ALL_TAB && channels.length > 0 ? fill(labels.emptyHint, { channels: listChannels(channels, labels, locale) }) : undefined}
      />
    ) : (
      <>
        <ul className="divide-y divide-hairline border-y border-hairline">
          {shown.map((c) => (
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
        {truncated ? (
          <p className="mt-3 text-xs text-fg-muted">{fill(labels.truncated, { count: conversations.length })}</p>
        ) : null}
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
        onChanged={() => void refresh()}
        onClose={close}
      />
    ) : null;

  const content = (
    <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-6">
      <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto">{list}</div>
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
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {tabs.length > 0 ? (
        <Tabs
          items={tabs.map((t) => ({
            key: t.key,
            label: t.label,
            badge: t.waiting > 0 ? <span className="text-xs tabular-nums text-fg-muted">{t.waiting}</span> : undefined,
          }))}
          value={tab}
          onChange={(key) => navigate(channelParam, key === ALL_TAB ? null : key, "replace")}
          idBase="kit-inbox"
          ariaLabel={labels.tabsLabel}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-fg-2">{waiting > 0 ? fill(labels.waitingCount, { count: waiting }) : labels.nobodyWaiting}</p>
          {notes.map((note) => (
            <p key={note} className="text-xs text-fg-muted">
              {note}
            </p>
          ))}
        </div>
        <Button variant="ghost" size="sm" loading={refreshing} onClick={() => void refresh()}>
          {refreshing ? labels.refreshing : labels.refresh}
        </Button>
      </div>
      {refreshError ? <p className="text-xs text-tone-red">{fill(labels.refreshFailed, { reason: refreshError })}</p> : null}

      {tabs.length > 0 ? (
        // El panel de la pestaña, a mano y no con `TabPanel`: tiene que seguir la
        // columna flexible hasta abajo (`PageShell fill`) para que el hilo ocupe la
        // altura, y aquí solo hay UN panel —la misma lista, filtrada—.
        <div
          role="tabpanel"
          id={`kit-inbox-panel-${tab}`}
          aria-labelledby={`kit-inbox-tab-${tab}`}
          className="flex min-h-0 flex-1 flex-col"
        >
          {content}
        </div>
      ) : (
        content
      )}

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
