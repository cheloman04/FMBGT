"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import type { ApiClient } from "../api";
import { Button } from "../Button";
import { Drawer } from "../Drawer";
import { EmptyState } from "../EmptyState";
import { SkeletonText } from "../Skeleton";
import { StatusBadge } from "../StatusBadge";
import { TabPanel, Tabs } from "../Tabs";
import { IconAudioLines, IconCheck, IconMessageSquare, IconPhoneIncoming, IconPhoneOutgoing, IconUser } from "../_icons";
import { formatDateTime } from "../time";
import {
  callUrl,
  callerName,
  fillCall,
  formatDuration,
  languageName,
  messagesLink,
  noRecordingReason,
  outcomeMeta,
  recordingUrl,
  type CallsLabels,
} from "./calls";
import type { CallAttendedResult, CallDetail as CallDetailData, CallItem } from "./types";
import { usePolling } from "./usePolling";

type Props = {
  callId: string;
  /** La fila de la lista, si está: la cabecera sale sin esperar al detalle. */
  row: CallItem | null;
  endpoint: string;
  api: ApiClient;
  labels: CallsLabels;
  timeZone?: string;
  locale?: string;
  pollMs: number;
  /** El enlace al hilo de mensajería, con `{id}`. */
  messagesHref: string;
  /** `pane`: la columna del escritorio. `drawer`: el cajón a pantalla entera del teléfono. */
  layout: "pane" | "drawer";
  /** Se marcó o se desmarcó: la lista pone la fila al día y se relee. */
  onChanged: (result: CallAttendedResult) => void;
  onClose: () => void;
};

type Tab = "summary" | "transcript";

/**
 * Una llamada entera: el motivo y la marca arriba (es lo único que pide una acción
 * hoy), su hilo de mensajería, la grabación y las pestañas Summary / Transcript.
 *
 * Se pide al abrirla, no al listar: la transcripción no viaja en la lista. Se
 * relee cada `pollMs` mientras está abierta (una llamada en curso termina). Se
 * monta con `key` por llamada: nada de una se queda en la otra.
 *
 * 🪤 «Mark as attended» y «Undo» no piden confirmación: los dos se deshacen con el
 * otro. La marca es la misma que ve Kigaru, y la primera manda: si alguien la
 * marcó antes, la respuesta trae SU nombre y eso es lo que se enseña.
 */
export function CallDetail({
  callId,
  row,
  endpoint,
  api,
  labels,
  timeZone,
  locale,
  pollMs,
  messagesHref,
  layout,
  onChanged,
  onClose,
}: Props) {
  const url = callUrl(endpoint, callId);
  const [detail, setDetail] = useState<CallDetailData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [audioFailed, setAudioFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<CallDetailData>(url);
    if (res.ok) {
      setDetail(res.data);
      setLoadError(null);
    } else if (res.status !== 401) {
      // El 401 ya redirige al login. Cualquier otro fallo se dice, con su causa.
      setLoadError(res.error);
    }
  }, [api, url]);

  // El primero al montar: el detalle no viene del servidor, se pide al abrirlo.
  usePolling(load, { intervalMs: pollMs, immediate: true });

  // Lo que se enseña: el detalle si llegó; si no, la fila de la lista.
  const call: CallItem | null = detail ?? row;
  const title = call ? callerName(call, labels) : labels.detailTitle;

  async function setAttended(next: boolean) {
    if (marking) return;
    setMarking(true);
    setMarkError(null);
    const res = await api.patch<CallAttendedResult>(url, { attended: next });
    if (res.ok) {
      setDetail((d) => (d ? { ...d, needsHuman: res.data.needsHuman, attended: res.data.attended } : d));
      onChanged(res.data);
    } else if (res.status !== 401) {
      setMarkError(fillCall(labels.markFailed, { reason: res.error }));
      // Un 409 es que la llamada ya no pide a nadie: se relee para enseñar cómo está.
      if (res.status === 409) void load();
    }
    setMarking(false);
  }

  let body: ReactNode;
  if (!call) {
    body = loadError ? (
      <EmptyState
        title={fillCall(labels.callFailed, { reason: loadError })}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            {labels.retry}
          </Button>
        }
      />
    ) : (
      <div className="space-y-2">
        <p className="text-xs text-fg-muted">{labels.loadingCall}</p>
        <SkeletonText lines={5} />
      </div>
    );
  } else {
    const outcome = outcomeMeta(call.outcome, labels);
    const when = formatDateTime(call.at, timeZone, locale);
    const reason = call.label ?? call.purpose;
    const note = call.humanNote ?? call.summary ?? labels.noNote;
    const noRecording = noRecordingReason(call, labels);
    const messaging = detail?.messagingConversationId ?? null;
    const transcript = detail?.transcript ?? null;
    const language = languageName(call.lang, locale);
    const facts: [string, string | null][] = [
      [labels.factDirection, call.direction === "inbound" ? labels.incoming : labels.outgoing],
      [labels.factWhen, when],
      [labels.factDuration, call.durationSecs === null ? null : formatDuration(call.durationSecs)],
      [labels.factLanguage, language],
      [labels.factReason, reason],
    ];
    const idBase = `call-${call.id}`;

    body = (
      <div className="flex flex-col gap-4">
        {layout === "pane" ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge meta={outcome} size="sm" />
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
          {call.direction === "inbound" ? <IconPhoneIncoming className="h-3.5 w-3.5 flex-none" /> : <IconPhoneOutgoing className="h-3.5 w-3.5 flex-none" />}
          <span>
            {call.direction === "inbound" ? labels.incoming : labels.outgoing}
            {reason ? ` · ${reason}` : ""}
            {` · ${when}`}
          </span>
        </p>

        {/* Lo que deja a alguien pendiente va ARRIBA DEL TODO: es lo único del detalle
            que pide una acción hoy. */}
        {call.needsHuman ? (
          <div className="space-y-2 border-y border-hairline py-3">
            {call.attended ? (
              <>
                <p className="flex gap-1.5 text-sm text-fg-2">
                  <IconUser className="mt-0.5 h-3.5 w-3.5 flex-none text-fg-muted" />
                  <span>{fillCall(labels.askedForPerson, { note })}</span>
                </p>
                <p className="flex gap-1.5 text-xs text-fg-muted">
                  <IconCheck className="mt-px h-3.5 w-3.5 flex-none" />
                  <span>
                    {call.attended.by
                      ? fillCall(labels.attendedByAt, { by: call.attended.by, when: formatDateTime(call.attended.at, timeZone, locale) })
                      : fillCall(labels.attendedAt, { when: formatDateTime(call.attended.at, timeZone, locale) })}
                  </span>
                </p>
              </>
            ) : (
              <p className="flex gap-1.5 text-sm text-tone-amber">
                <IconUser className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>{fillCall(labels.needsReplyNote, { note })}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                variant={call.attended ? "ghost" : "primary"}
                size="sm"
                loading={marking}
                onClick={() => void setAttended(!call.attended)}
              >
                {marking ? labels.saving : call.attended ? labels.undoAttended : labels.markAttended}
              </Button>
              {markError ? <span className="text-xs text-tone-red">{markError}</span> : null}
            </div>
          </div>
        ) : null}

        {call.optOut ? <p className="text-xs text-tone-red">{labels.optOut}</p> : null}

        {messaging ? (
          <Link
            href={messagesLink(messagesHref, messaging)}
            className="inline-flex w-fit items-center gap-1.5 rounded text-xs font-medium text-ac-400 underline-offset-2 hover:text-ac-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60 max-sm:min-h-11"
          >
            <IconMessageSquare className="h-3.5 w-3.5 flex-none" />
            {labels.openMessages}
          </Link>
        ) : null}

        {/* La grabación, antes de las pestañas: escuchar es la tarea, y no depende de
            en qué pestaña estés. `preload="none"`: el hub firma la URL al pulsar play. */}
        <div>
          {noRecording ? (
            <p className="flex gap-1.5 text-xs text-fg-muted">
              <IconAudioLines className="mt-px h-3.5 w-3.5 flex-none" />
              <span>{noRecording}</span>
            </p>
          ) : (
            <>
              <audio
                key={call.id}
                controls
                preload="none"
                src={recordingUrl(endpoint, call)}
                aria-label={labels.recordingLabel}
                onError={() => setAudioFailed(true)}
                onPlay={() => setAudioFailed(false)}
                className="w-full"
              />
              {audioFailed ? <p className="mt-1 text-xs text-tone-red">{labels.recordingFailed}</p> : null}
            </>
          )}
        </div>

        <div>
          <Tabs
            items={[
              { key: "summary", label: labels.tabSummary },
              {
                key: "transcript",
                label: labels.tabTranscript,
                badge: call.transcriptTurns > 0 ? <span className="text-[11px] tabular-nums text-fg-muted">{call.transcriptTurns}</span> : undefined,
              },
            ]}
            value={tab}
            onChange={(key) => setTab(key as Tab)}
            idBase={idBase}
            ariaLabel={labels.tabsLabel}
          />
          <div className="pt-4">
            <TabPanel idBase={idBase} tabKey="summary" active={tab === "summary"}>
              <div className="space-y-4">
                <p className={call.summary ? "text-sm leading-relaxed text-fg-2" : "text-sm text-fg-muted"}>{call.summary ?? labels.noSummary}</p>
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
              </div>
            </TabPanel>
            <TabPanel idBase={idBase} tabKey="transcript" active={tab === "transcript"}>
              {transcript === null ? (
                <SkeletonText lines={4} />
              ) : transcript.length === 0 ? (
                <p className="text-sm text-fg-muted">{labels.noTranscript}</p>
              ) : (
                <ol className="space-y-3">
                  {transcript.map((t, i) => (
                    <li key={`${i}-${t.atSecs ?? ""}`}>
                      <p className="flex items-baseline gap-2 text-[11px] text-fg-muted">
                        <span className="font-semibold text-fg-2">{t.role === "agent" ? labels.agent : t.role === "user" ? title : t.role}</span>
                        {t.atSecs !== null ? <span className="tabular-nums">{formatDuration(t.atSecs)}</span> : null}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">{t.text}</p>
                    </li>
                  ))}
                </ol>
              )}
            </TabPanel>
          </div>
        </div>

        {/* El detalle ya pintado y un relectura que falla: se mantiene y se avisa. */}
        {detail && loadError ? <p className="text-xs text-tone-red">{fillCall(labels.refreshFailed, { reason: loadError })}</p> : null}
      </div>
    );
  }

  if (layout === "drawer") {
    return (
      <Drawer open title={title} onClose={onClose} size="lg" closeLabel={labels.close}>
        {body}
      </Drawer>
    );
  }

  return (
    <section aria-label={title} className="flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-[14px] border border-hairline">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hairline px-4 py-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">{title}</h2>
        {call ? <StatusBadge meta={outcomeMeta(call.outcome, labels)} size="sm" /> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{body}</div>
    </section>
  );
}
