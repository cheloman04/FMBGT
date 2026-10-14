"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ApiClient } from "../api";
import { Button } from "../Button";
import { cx } from "../cx";
import { Drawer } from "../Drawer";
import { Textarea } from "../Field";
import { StatusBadge } from "../StatusBadge";
import { formatDateTime } from "../time";
import { useConfirm } from "../useConfirm";
import { AttachmentStrip } from "./AttachmentStrip";
import {
  authorOf,
  bubbleOf,
  channelName,
  contactName,
  deliveryStatus,
  fill,
  handBackWarning,
  readMessage,
  whatsappWindowOpen,
  type InboxLabels,
} from "./inbox";
import type { InboxChannel, InboxConversation, InboxHandlerResult, InboxSendResult, InboxThread } from "./types";
import { usePolling } from "./usePolling";

/**
 * Un hilo: los mensajes, responder y devolverlo al agente.
 *
 * 🪤 RESPONDER Y DEVOLVER VAN JUNTOS, en el mismo bloque. Contestar desde aquí
 * CEDE el hilo (el hub lo marca `human` y el agente se calla); el botón de
 * devolver es el camino de vuelta. Uno sin el otro es una puerta que no se puede
 * desandar.
 *
 * 🪤 SE MONTA CON `key={conversation.id}`. Sin ella, el «Sending…» o el borrador
 * de un hilo sobreviven al cambiar a otro, y una respuesta lenta del primero
 * pintaría sus mensajes en el segundo.
 */
export function ConversationThread({
  conversation,
  channel,
  endpoint,
  api,
  labels,
  timeZone,
  locale,
  pollMs,
  layout,
  onChanged,
  onClose,
}: {
  conversation: InboxConversation;
  /** El canal con su estado de agente. `undefined` si el canal ya no tiene cuentas. */
  channel: InboxChannel | undefined;
  endpoint: string;
  api: ApiClient;
  labels: InboxLabels;
  timeZone?: string;
  locale?: string;
  pollMs: number;
  /** `pane`: la columna del escritorio. `drawer`: el cajón a pantalla entera del teléfono. */
  layout: "pane" | "drawer";
  /** Algo cambió (se mandó, se devolvió): la lista se relee. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const url = `${endpoint}/${encodeURIComponent(conversation.id)}`;
  const contact = contactName(conversation, labels);
  const [thread, setThread] = useState<InboxThread | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [handingBack, setHandingBack] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const endRef = useRef<HTMLDivElement>(null);
  const seen = useRef(0);

  const load = useCallback(async () => {
    const res = await api.get<InboxThread>(url);
    if (res.ok) {
      setThread(res.data);
      setLoadError(null);
      setLoadedAt(Date.now());
    } else if (res.status !== 401) {
      // El 401 ya redirige al login. Cualquier otro fallo se dice: NO es un hilo vacío.
      setLoadError(res.error);
    }
  }, [api, url]);

  // El primero al montar: el hilo no viene del servidor, se pide al abrirlo.
  usePolling(load, { intervalMs: pollMs, immediate: true });

  // Lo último es lo que importa: al llegar el hilo, y cuando llega un mensaje
  // nuevo, se baja al final, como en cualquier chat.
  const count = thread?.messages.length ?? 0;
  useEffect(() => {
    if (count > seen.current) endRef.current?.scrollIntoView({ block: "end" });
    seen.current = count;
  }, [count]);

  // El hilo recién leído manda sobre la fila de la lista, que puede ir 15 s detrás.
  const handler = thread?.conversation.handler ?? conversation.handler;

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    setNotice(null);
    // 🪤 Solo es «enviado» si la ruta contesta 2xx, y la ruta solo lo hace cuando
    // el hub dijo `sent` o `queued_retry` en su `outcome`. Lo que no salió llega
    // como error, con el motivo del hub.
    const res = await api.post<InboxSendResult>(url, { text });
    if (res.ok) setDraft("");
    else if (res.status !== 401) setSendError(res.error);
    // Se relee pase lo que pase: si salió, para ver el mensaje y el hilo ya cedido;
    // si no, porque puede haberse anotado igual (como fallido).
    await load();
    onChanged();
    setSending(false);
  }

  async function handBack() {
    const warning = handBackWarning(channel?.agent, conversation.channel, labels);
    if (
      warning &&
      !(await confirm({
        title: labels.handBackConfirmTitle,
        description: warning,
        confirmLabel: labels.handBackConfirm,
        cancelLabel: labels.cancel,
        closeLabel: labels.close,
      }))
    ) {
      return;
    }
    setHandingBack(true);
    setSendError(null);
    setNotice(null);
    const res = await api.patch<InboxHandlerResult>(url, { handler: "agent" });
    if (res.ok) setNotice(labels.handedBack);
    else if (res.status !== 401) setSendError(res.error);
    await load();
    onChanged();
    setHandingBack(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  }

  const channelLabel = channelName(conversation.channel, labels);
  const windowClosed = conversation.channel === "whatsapp" && loadedAt > 0 && !whatsappWindowOpen(conversation.lastInboundAt, loadedAt);

  const meta = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
      <span>{channelLabel}</span>
      {handler === "human" ? <StatusBadge meta={{ label: labels.handledByYou, tone: "gray" }} size="sm" dot={false} /> : null}
    </div>
  );

  let body: ReactNode;
  if (!thread) {
    body = loadError ? (
      <div className="py-8 text-center">
        <p className="text-sm text-fg-muted">{labels.threadFailed}</p>
        <p className="mt-1 text-xs text-fg-muted">{loadError}</p>
      </div>
    ) : (
      <p className="py-8 text-center text-sm text-fg-muted">{labels.loadingThread}</p>
    );
  } else if (thread.messages.length === 0) {
    body = <p className="py-8 text-center text-sm text-fg-muted">{labels.emptyThread}</p>;
  } else {
    body = (
      <>
        {thread.truncated ? (
          <p className="mb-3 text-center text-xs text-fg-muted">{fill(labels.olderHidden, { count: thread.messages.length })}</p>
        ) : null}
        <ol className="space-y-2.5">
          {thread.messages.map((m) => {
            const reading = readMessage(m, labels);
            const delivery = deliveryStatus(m, labels);
            return (
              <li key={m.id} className={bubbleOf(m.sender)}>
                <p className="flex items-baseline justify-between gap-3 text-[11px] text-fg-muted">
                  <span className="font-medium text-fg-2">{authorOf(m.sender, contact, labels)}</span>
                  <time dateTime={m.at}>{formatDateTime(m.at, timeZone, locale)}</time>
                </p>
                <p
                  className={cx(
                    "mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed",
                    reading.muted ? "italic text-fg-muted" : "text-fg",
                  )}
                  // El SID de la plantilla, para quien venga a cotejarlo con la
                  // plataforma. En la burbuja ocuparía una línea sin decir nada.
                  title={m.template?.contentSid ?? undefined}
                >
                  {reading.text}
                </p>
                <AttachmentStrip
                  endpoint={endpoint}
                  conversationId={conversation.id}
                  messageId={m.id}
                  attachments={m.attachments}
                  labels={labels}
                />
                {delivery ? (
                  <div className="mt-1.5 flex justify-end">
                    <StatusBadge meta={delivery} size="sm" />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {loadError ? <p className="mt-3 text-xs text-tone-red">{fill(labels.refreshFailed, { reason: loadError })}</p> : null}
      </>
    );
  }

  const composer = (
    <div className="w-full space-y-2.5">
      {handler === "human" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-fg-muted">{labels.handledByYou}</span>
          <Button variant="secondary" size="sm" loading={handingBack} disabled={sending} onClick={() => void handBack()}>
            {handingBack ? labels.handingBack : labels.handBack}
          </Button>
        </div>
      ) : channel?.agent === "answering" ? (
        // Solo cuando contestar CAMBIA quién manda: repetido siempre, nadie lo lee.
        <p className="text-xs leading-relaxed text-fg-muted">{labels.takeoverWarning}</p>
      ) : null}
      {windowClosed ? <p className="text-xs leading-relaxed text-fg-muted">{labels.whatsappWindow}</p> : null}
      <Textarea
        label={labels.replyLabel}
        labelHidden
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        maxLength={4000}
        placeholder={labels.replyPlaceholder}
        disabled={sending || handingBack}
      />
      {sendError ? <p className="text-xs leading-relaxed text-tone-red">{sendError}</p> : null}
      {notice ? <p className="text-xs leading-relaxed text-fg-2">{notice}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-fg-muted">{draft.trim() ? `${draft.trim().length}/4000` : ""}</span>
        <Button loading={sending} disabled={!draft.trim() || handingBack} onClick={() => void send()}>
          {sending ? labels.sending : labels.send}
        </Button>
      </div>
    </div>
  );

  if (layout === "drawer") {
    return (
      <Drawer open title={contact} onClose={onClose} size="lg" closeLabel={labels.close} footer={composer}>
        <div className="mb-4">{meta}</div>
        {body}
        <div ref={endRef} />
        {dialog}
      </Drawer>
    );
  }

  return (
    <section aria-label={contact} className="flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-[14px] border border-hairline">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-fg">{contact}</h2>
          <div className="mt-0.5">{meta}</div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {body}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-hairline px-4 py-3">{composer}</div>
      {dialog}
    </section>
  );
}
