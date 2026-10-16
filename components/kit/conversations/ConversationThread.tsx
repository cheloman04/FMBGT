"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ApiClient } from "../api";
import { Button } from "../Button";
import { cx } from "../cx";
import { Drawer } from "../Drawer";
import { Textarea } from "../Field";
import { StatusBadge } from "../StatusBadge";
import { Switch } from "../Switch";
import { formatDateTime } from "../time";
import { useConfirm } from "../useConfirm";
import { AttachmentStrip } from "./AttachmentStrip";
import { ChannelGlyph } from "./ChannelGlyph";
import {
  agentSwitchPlan,
  authorOf,
  bubbleOf,
  contactName,
  deliveryStatus,
  fill,
  readMessage,
  whatsappWindowOpen,
  type InboxLabels,
} from "./inbox";
import type { InboxChannel, InboxConversation, InboxHandlerResult, InboxSendResult, InboxThread } from "./types";
import { usePolling } from "./usePolling";

/** Lo más largo que se deja escribir en una respuesta. */
const REPLY_MAX = 4000;
/** Desde aquí se enseña la cuenta: antes no le dice nada a nadie. */
const REPLY_COUNT_FROM = 3600;

/**
 * Un hilo: los mensajes, responder, y el interruptor «AI agent».
 *
 * 🪤 RESPONDER Y EL INTERRUPTOR VAN JUNTOS. Contestar desde aquí CEDE el hilo (el
 * hub lo marca `human` y el agente se calla); el interruptor dice quién lo lleva y
 * es el camino de vuelta. Uno sin el otro es una puerta que no se puede desandar.
 * También funciona al revés: apagarlo toma el hilo sin escribir, para callar al
 * agente en ESE hilo.
 *
 * 🪤 Y POR ESO VAN EN EL PIE, al lado de «Send», no en la cabecera (v0.11.0). En
 * el cajón del teléfono la fila del canal y el interruptor iba DENTRO del scroll:
 * al subir por un hilo largo se iba con los mensajes, y para devolverle el hilo
 * al agente había que volver arriba del todo. El pie no se mueve nunca. El canal
 * se dice con su logo (`ChannelGlyph`), que deja sitio al interruptor en 375 px;
 * la etiqueta «You're handling it» sale del hilo porque «AI agent · Off» dice lo
 * mismo (en la fila de la lista se queda).
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
  const [switching, setSwitching] = useState(false);
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

  async function moveAgent(next: boolean) {
    const plan = agentSwitchPlan(next, channel?.agent, conversation.channel, labels);
    if (
      plan.confirm &&
      !(await confirm({
        title: labels.handBackConfirmTitle,
        description: plan.confirm,
        confirmLabel: labels.handBackConfirm,
        cancelLabel: labels.cancel,
        closeLabel: labels.close,
      }))
    ) {
      return;
    }
    setSwitching(true);
    setSendError(null);
    setNotice(null);
    const res = await api.patch<InboxHandlerResult>(url, { handler: plan.handler });
    if (res.ok) setNotice(plan.handler === "agent" ? labels.handedBack : labels.tookOver);
    else if (res.status !== 401) setSendError(res.error);
    await load();
    onChanged();
    setSwitching(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  }

  const windowClosed = conversation.channel === "whatsapp" && loadedAt > 0 && !whatsappWindowOpen(conversation.lastInboundAt, loadedAt);
  const length = draft.trim().length;

  // Quién lleva el hilo, en el pie: siempre a la vista y en los dos sentidos.
  const agentSwitch = (
    <Switch
      label={labels.agentSwitch}
      stateLabels={{ on: labels.agentOn, off: labels.agentOff }}
      checked={handler === "agent"}
      loading={switching}
      disabled={sending}
      onChange={(next) => void moveAgent(next)}
    />
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
            const delivery = deliveryStatus(m, conversation.channel, labels);
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
      {handler === "agent" && channel?.agent === "answering" ? (
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
        maxLength={REPLY_MAX}
        placeholder={labels.replyPlaceholder}
        disabled={sending || switching}
        // La cuenta solo cerca del tope: su sitio de antes, a la izquierda de
        // «Send», es ahora el del canal y el interruptor.
        hint={length >= REPLY_COUNT_FROM ? `${length}/${REPLY_MAX}` : undefined}
      />
      {sendError ? <p className="text-xs leading-relaxed text-tone-red">{sendError}</p> : null}
      {notice ? <p className="text-xs leading-relaxed text-fg-2">{notice}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-3">
          <ChannelGlyph channel={conversation.channel} labels={labels} />
          {agentSwitch}
        </div>
        {/* `ml-auto`: a 320 px la fila no cabe y «Send» baja a otra línea; así
            se queda a la derecha, donde el pulgar lo busca. */}
        <div className="ml-auto">
          <Button loading={sending} disabled={!draft.trim() || switching} onClick={() => void send()}>
            {sending ? labels.sending : labels.send}
          </Button>
        </div>
      </div>
    </div>
  );

  if (layout === "drawer") {
    return (
      <Drawer open title={contact} onClose={onClose} size="lg" closeLabel={labels.close} footer={composer}>
        {body}
        <div ref={endRef} />
        {dialog}
      </Drawer>
    );
  }

  return (
    <section aria-label={contact} className="flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-[14px] border border-hairline">
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline px-4 py-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">{contact}</h2>
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
