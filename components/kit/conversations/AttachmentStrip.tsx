"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { mediaUrl, type InboxLabels } from "./inbox";
import type { InboxAttachment } from "./types";

/**
 * Lo que un mensaje TRAE, debajo de lo que dice: la foto, la nota de voz, el PDF.
 *
 * El `src` es la ruta proxy del spoke, que exige la sesión del panel y redirige a
 * una URL firmada de una hora del bucket del hub. Aquí no se sabe nada de Meta ni
 * de Storage: solo se pinta lo que el hub dijo que hay.
 *
 * 🪤 `mirrored: false` NO es un error: el hub copia los bytes en diferido, y hasta
 * entonces no hay nada que servir. Se dice, en vez de pintar una imagen rota que
 * parece avería. Si la carga falla de verdad, `onError` lo dice también.
 */
export function AttachmentStrip({
  endpoint,
  conversationId,
  messageId,
  attachments,
  labels,
}: {
  endpoint: string;
  conversationId: string;
  messageId: string;
  attachments: InboxAttachment[];
  labels: InboxLabels;
}) {
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());
  const [open, setOpen] = useState<string | null>(null);
  if (attachments.length === 0) return null;
  const fail = (index: number) => setFailed((prev) => new Set(prev).add(index));

  return (
    <>
      <ul className="mt-2 flex flex-wrap gap-2">
        {attachments.map((a) => {
          const url = mediaUrl(endpoint, conversationId, messageId, a.index);
          if (!a.mirrored || failed.has(a.index)) {
            return (
              <li key={a.index} className="text-xs italic text-fg-muted">
                {a.mirrored ? labels.attachmentFailed : labels.attachmentPending}
              </li>
            );
          }
          if (a.kind === "image") {
            return (
              <li key={a.index}>
                <button
                  type="button"
                  onClick={() => setOpen(url)}
                  aria-label={labels.openPhoto}
                  title={labels.openPhoto}
                  className="block cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de otro origen: sin optimizador de imágenes */}
                  <img
                    src={url}
                    alt={labels.photo}
                    loading="lazy"
                    onError={() => fail(a.index)}
                    className="max-h-40 max-w-full rounded-lg border border-hairline object-cover"
                  />
                </button>
              </li>
            );
          }
          if (a.kind === "audio") {
            return (
              <li key={a.index} className="w-full space-y-1">
                <audio controls preload="none" src={url} onError={() => fail(a.index)} className="h-9 w-full" />
                {a.transcript ? (
                  <p className="text-xs leading-relaxed text-fg-2">
                    <span className="text-fg-muted">{labels.transcript} · </span>
                    {a.transcript}
                  </p>
                ) : null}
              </li>
            );
          }
          if (a.kind === "video") {
            return (
              <li key={a.index}>
                <video controls preload="none" src={url} onError={() => fail(a.index)} className="max-h-48 max-w-full rounded-lg" />
              </li>
            );
          }
          const subtype = a.mimeType?.split("/")[1];
          return (
            <li key={a.index}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-fg-2 underline underline-offset-2 hover:text-fg"
              >
                {labels.openDocument}
                {subtype ? ` (${subtype})` : ""}
              </a>
            </li>
          );
        })}
      </ul>
      <Modal open={open !== null} onClose={() => setOpen(null)} title={labels.photo} size="lg" closeLabel={labels.close}>
        {open ? (
          // eslint-disable-next-line @next/next/no-img-element -- ídem: URL firmada de otro origen
          <img src={open} alt={labels.photo} className="mx-auto max-h-[70dvh] max-w-full rounded-lg object-contain" />
        ) : null}
      </Modal>
    </>
  );
}
