// Por dónde llegó una conversación, con el logo de la red en vez de su nombre escrito.
//
// En el pie del hilo, junto al interruptor «AI agent» y a «Send», el nombre («Telegram»,
// «Messenger») se comía el sitio que en el teléfono no hay: el logo dice lo mismo en 20 px.
//
// 🪤 El nombre NO se pierde: va en `aria-label` para el lector de pantalla y en `title` para
// quien pasa el ratón. Un logo que no se reconoce, o un canal sin logo propio (webchat, SMS, uno
// nuevo), que cae a una burbuja genérica, sigue diciendo qué es.

import { CHAT_BUBBLE_PATH, channelLogo } from "./channelLogos";
import { channelName, type InboxLabels } from "./inbox";

export function ChannelGlyph({
  channel,
  labels,
}: {
  channel: string;
  /** Para el nombre del canal (`labels.channelNames`), el mismo de las pestañas. */
  labels: InboxLabels;
}) {
  const name = channelName(channel, labels);
  const brand = channelLogo(channel);
  return (
    <span role="img" aria-label={name} title={name} className="inline-flex shrink-0 items-center text-fg-2">
      {brand ? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
          <path d={brand} />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d={CHAT_BUBBLE_PATH} />
        </svg>
      )}
    </span>
  );
}
