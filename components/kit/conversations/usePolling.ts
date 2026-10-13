"use client";

import { useEffect, useRef } from "react";

/**
 * Llama a `tick` cada `intervalMs` mientras la pestaña se ve.
 *
 * - Con la pestaña OCULTA no pregunta nada: una bandeja olvidada en segundo
 *   plano no gasta el límite de la conexión del spoke con el hub.
 * - Al VOLVER a ella pregunta en el acto, sin esperar al siguiente tick: es
 *   justo cuando el operador mira.
 * - Nunca se solapan dos: si un tick sigue en vuelo, el siguiente se salta.
 * - Con `immediate`, el primero va al montar (lo que no trae datos del servidor).
 *
 * `tick` va en un ref: quien llama puede pasar una flecha en línea sin reiniciar
 * el reloj en cada render.
 */
export function usePolling(
  tick: () => Promise<unknown>,
  { intervalMs, enabled = true, immediate = false }: { intervalMs: number; enabled?: boolean; immediate?: boolean },
) {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let stopped = false;

    const schedule = () => {
      clearTimeout(timer);
      if (!stopped && document.visibilityState === "visible") timer = setTimeout(run, intervalMs);
    };
    const run = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        await tickRef.current();
      } catch {
        // El tick enseña su propio error; aquí solo se sigue.
      } finally {
        inFlight = false;
        schedule();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void run();
      else clearTimeout(timer);
    };

    if (immediate) void run();
    else schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled, immediate]);
}
