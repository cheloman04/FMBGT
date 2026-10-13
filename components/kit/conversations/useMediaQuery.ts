"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * ¿Casa esta media query? `null` mientras no se sabe (en el servidor y en la
 * hidratación): quien la usa no pinta nada que dependa de ella hasta saberlo, y
 * así un hilo abierto por la URL no aparece un instante en el cajón del teléfono
 * antes de saltar a la columna del escritorio.
 */
export function useMediaQuery(query: string): boolean | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore<boolean | null>(
    subscribe,
    () => window.matchMedia(query).matches,
    () => null,
  );
}
