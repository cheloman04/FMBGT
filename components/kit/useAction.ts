"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ApiResult } from "./api";
import { notifyBadgesChanged } from "./nav";

/**
 * Una mutación desde una isla, con el ciclo del estándar (§4.6): llamar a la API,
 * y si va bien `router.refresh()` para que el servidor repinte con los datos
 * nuevos; si va mal, el error para pintarlo INLINE junto al botón (§8.5).
 *
 *   const retry = useAction((id: string) => api.post("/api/admin/retry-charge", { bookingId: id }), {
 *     badges: true,
 *   });
 *   <Button loading={retry.pending} onClick={() => retry.run(booking.id)}>Retry charge</Button>
 *   {retry.error ? <p className="text-xs text-tone-red">{retry.error}</p> : null}
 *
 * `pending` sigue en `true` hasta que el refresco trae los datos nuevos: el botón
 * no se libera enseñando todavía el estado viejo.
 */
export function useAction<A extends unknown[], T>(
  action: (...args: A) => Promise<ApiResult<T>>,
  {
    refresh = true,
    badges = false,
    onSuccess,
  }: {
    /** `router.refresh()` al ir bien. Apágalo si la isla ya actualiza su propio estado. */
    refresh?: boolean;
    /** Avisa al shell de que los contadores del menú pueden haber cambiado. */
    badges?: boolean;
    onSuccess?: (data: T) => void;
  } = {},
) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 🪤 La acción y el callback van en refs: así `run` es estable aunque quien
  // llama pase flechas en línea, y se pueden poner en dependencias sin bucles.
  const actionRef = useRef(action);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    actionRef.current = action;
    onSuccessRef.current = onSuccess;
  });

  const run = useCallback(
    async (...args: A): Promise<ApiResult<T>> => {
      setRunning(true);
      setError(null);
      try {
        const result = await actionRef.current(...args);
        if (result.ok) {
          onSuccessRef.current?.(result.data);
          if (badges) notifyBadgesChanged();
          if (refresh) startTransition(() => router.refresh());
        } else if (result.status !== 401) {
          // El 401 ya redirige al login: no hay nada que enseñar aquí.
          setError(result.error);
        }
        return result;
      } finally {
        setRunning(false);
      }
    },
    [badges, refresh, router],
  );

  return {
    run,
    pending: running || refreshing,
    error,
    clearError: useCallback(() => setError(null), []),
  };
}
