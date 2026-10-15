"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { createApiClient } from "../api";
import { Button, buttonClasses } from "../Button";
import { cx } from "../cx";
import { EmptyState } from "../EmptyState";
import { LoadMore } from "../LoadMore";
import { notifyBadgesChanged } from "../nav";
import { RelativeTime } from "../RelativeTime";
import { StatusBadge } from "../StatusBadge";
import { usePolling } from "../conversations/usePolling";
import {
  appendPage,
  fillNotification,
  internalHref,
  mergeNotificationLabels,
  mergeRefresh,
  notificationChannel,
  openLabel,
  safeHref,
  withAllRead,
  withRead,
  type NotificationsLabels,
} from "./feed";
import type { NotificationItem, NotificationsData, NotificationsLoad, NotificationsReadAllResult } from "./types";

type Props = {
  /** Lo que cargó la página con `loadNotifications()` (servidor). Un fallo llega con su causa. */
  initial: NotificationsLoad;
  /** La ruta proxy del spoke (`/api/admin/notifications`), de `createNotificationRoutes()`. */
  endpoint: string;
  /** El login del área: un 401 manda allí con `next` y `expired` (`createApiClient`). */
  loginPath: string;
  /** Zona IANA del NEGOCIO (§8.7), p. ej. `America/New_York`. */
  timeZone?: string;
  locale?: string;
  labels?: Partial<NotificationsLabels>;
  /** Cada cuánto se relee la primera tanda. */
  pollMs?: number;
};

/**
 * La campanita del admin de un spoke: los avisos del dueño del negocio que hoy
 * también salen en su portal de Kigaru, empezando por «Your assistant passed a
 * conversation to you».
 *
 *   // app/admin/(panel)/notifications/page.tsx — servidor
 *   const initial = await loadNotifications(hubFromEnv());
 *   <PageShell>
 *     <PageHeader title="Notifications" />
 *     <NotificationsFeed initial={initial} endpoint="/api/admin/notifications" loginPath="/admin/login" timeZone="America/New_York" />
 *   </PageShell>
 *
 * - Se relee cada `pollMs` (30 s), en pausa con la pestaña oculta e inmediato al
 *   volver a ella. Lo cargado con «Load more» se conserva.
 * - Abrir un aviso lo marca como leído. Es la MISMA fila que la del portal: leerlo
 *   aquí lo apaga allí. Cada cambio avisa al menú (`notifyBadgesChanged`).
 * - «Mark all as read» marca hasta el aviso más nuevo que se ve: uno que entra
 *   mientras tanto se queda sin leer.
 */
export function NotificationsFeed({
  initial,
  endpoint,
  loginPath,
  timeZone,
  locale = "en-US",
  labels: overrides,
  pollMs = 30_000,
}: Props) {
  const labels = useMemo(() => mergeNotificationLabels(overrides), [overrides]);
  const api = useMemo(() => createApiClient({ loginPath }), [loginPath]);

  const [load, setLoad] = useState<NotificationsLoad>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const update = useCallback((fn: (data: NotificationsData) => NotificationsData) => {
    setLoad((prev) => (prev.ok ? { ok: true, data: fn(prev.data) } : prev));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const res = await api.get<NotificationsData>(endpoint);
    setRefreshing(false);
    if (res.ok) {
      setLoad((prev) => ({ ok: true, data: prev.ok ? mergeRefresh(prev.data, res.data) : res.data }));
      setRefreshError(null);
    } else if (res.status !== 401) {
      // 🪤 Un fallo al RELEER no borra lo que ya se veía: se mantiene y se avisa.
      setLoad((prev) =>
        prev.ok ? prev : { ok: false, reason: res.status === 503 ? "not_configured" : "hub_error", error: res.error },
      );
      setRefreshError(res.error);
    }
  }, [api, endpoint]);
  usePolling(refresh, { intervalMs: pollMs });

  const setItemBusy = useCallback((id: string, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const mark = useCallback(
    async (item: NotificationItem, read: boolean) => {
      setItemBusy(item.id, true);
      setActionError(null);
      update((data) => withRead(data, item.id, read));
      const res = await api.patch<NotificationItem>(`${endpoint}/${item.id}`, { read });
      setItemBusy(item.id, false);
      if (res.ok) {
        notifyBadgesChanged();
      } else if (res.status !== 401) {
        update((data) => withRead(data, item.id, item.read));
        setActionError(fillNotification(labels.actionFailed, { reason: res.error }));
      }
    },
    [api, endpoint, labels.actionFailed, setItemBusy, update],
  );

  const markAll = useCallback(async () => {
    if (!load.ok) return;
    const until = load.data.items[0]?.at ?? null;
    setMarkingAll(true);
    setActionError(null);
    const res = await api.post<NotificationsReadAllResult>(`${endpoint}/read-all`, until ? { until } : {});
    setMarkingAll(false);
    if (res.ok) {
      update((data) => withAllRead(data, until));
      notifyBadgesChanged();
      void refresh();
    } else if (res.status !== 401) {
      setActionError(fillNotification(labels.actionFailed, { reason: res.error }));
    }
  }, [api, endpoint, labels.actionFailed, load, refresh, update]);

  const loadMore = useCallback(async () => {
    if (!load.ok || !load.data.nextBefore) return;
    setLoadingMore(true);
    const res = await api.get<NotificationsData>(`${endpoint}?before=${encodeURIComponent(load.data.nextBefore)}`);
    setLoadingMore(false);
    if (res.ok) {
      update((data) => appendPage(data, res.data));
      setRefreshError(null);
    } else if (res.status !== 401) {
      setRefreshError(res.error);
    }
  }, [api, endpoint, load, update]);

  if (!load.ok) {
    const title =
      load.reason === "not_configured"
        ? labels.notConfiguredTitle
        : load.reason === "not_enabled"
          ? labels.notEnabledTitle
          : labels.loadFailedTitle;
    return (
      <EmptyState
        title={title}
        hint={load.error}
        action={
          <Button variant="secondary" loading={refreshing} onClick={() => void refresh()}>
            {labels.retry}
          </Button>
        }
      />
    );
  }

  const { items, unread, total, nextBefore } = load.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-fg-2">{unread > 0 ? fillNotification(labels.unreadCount, { count: unread }) : labels.allCaughtUp}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" loading={refreshing} onClick={() => void refresh()}>
            {refreshing ? labels.refreshing : labels.refresh}
          </Button>
          <Button variant="secondary" size="sm" loading={markingAll} disabled={unread === 0} onClick={() => void markAll()}>
            {labels.markAllRead}
          </Button>
        </div>
      </div>
      {refreshError ? <p className="text-xs text-tone-red">{fillNotification(labels.refreshFailed, { reason: refreshError })}</p> : null}
      {actionError ? <p className="text-xs text-tone-red">{actionError}</p> : null}

      {items.length === 0 ? (
        <EmptyState title={labels.emptyTitle} hint={labels.emptyHint} />
      ) : (
        <>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {items.map((item) => (
              <li key={item.id}>
                <NotificationRow
                  item={item}
                  busy={busy.has(item.id)}
                  labels={labels}
                  timeZone={timeZone}
                  locale={locale}
                  onMark={(read) => void mark(item, read)}
                />
              </li>
            ))}
          </ul>
          <LoadMore
            showing={items.length}
            // Si el hub dice que hay más, el total no puede ser el de los que ya se ven.
            total={nextBefore ? Math.max(total, items.length + 1) : items.length}
            noun={labels.noun}
            onLoadMore={() => void loadMore()}
            loading={loadingMore}
          />
        </>
      )}
    </div>
  );
}

const noSubscription = () => () => {};

/**
 * El origen de la página, solo en el navegador.
 *
 * 🪤 Con `useSyncExternalStore` y no leyendo `window` en el render: el servidor
 * no lo tiene, y pintar un `<a>` en el servidor y un `<Link>` al hidratar es un
 * desajuste. Así el primer pintado es el del servidor y el enlace se afina después.
 */
function useOrigin(): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => null,
  );
}

function NotificationRow({
  item,
  busy,
  labels,
  timeZone,
  locale,
  onMark,
}: {
  item: NotificationItem;
  busy: boolean;
  labels: NotificationsLabels;
  timeZone?: string;
  locale?: string;
  onMark: (read: boolean) => void;
}) {
  const origin = useOrigin();
  const href = safeHref(item.href);
  const internal = origin ? internalHref(href, origin) : null;
  const channel = notificationChannel(item.channel, labels);
  // Abrir lo marca como leído. Sin esperar: la navegación propia no corta la
  // petición, y la de fuera se abre en otra pestaña.
  const onOpen = () => {
    if (!item.read) onMark(true);
  };

  // Sin leer = el badge y el peso. 🪤 Sin acento (§7.5: tiene cinco sitios y
  // ninguno es este) y sin fondo de tono (los tonos solo van en badges).
  return (
    <div className="px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className={cx("min-w-0 text-sm", item.read ? "font-medium text-fg-2" : "font-semibold text-fg")}>{item.title}</p>
        <span className="shrink-0 text-[11px] text-fg-muted">
          <RelativeTime iso={item.at} timeZone={timeZone} locale={locale} />
        </span>
      </div>
      {item.body ? <p className="mt-1 text-sm text-fg-2">{item.body}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.read ? null : <StatusBadge meta={{ label: labels.unread, tone: "amber" }} size="sm" />}
        {channel ? <span className="text-[11px] text-fg-muted">{channel}</span> : null}
        <span className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" loading={busy} onClick={() => onMark(!item.read)}>
            {item.read ? labels.markUnread : labels.markRead}
          </Button>
          {href ? (
            internal ? (
              <Link href={internal} onClick={onOpen} className={buttonClasses("secondary", "sm")}>
                {openLabel(item, labels)}
              </Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={onOpen} className={buttonClasses("secondary", "sm")}>
                {openLabel(item, labels)}
              </a>
            )
          ) : null}
        </span>
      </div>
    </div>
  );
}
