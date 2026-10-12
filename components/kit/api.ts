// El cliente de las mutaciones de un área (§4.6): `fetch` a `/api/<area>/…`, el
// 401 tratado en UN sitio y una respuesta con una sola forma.
//
//   // lib/admin/api.ts
//   export const api = createApiClient({ loginPath: "/admin/login" });
//
//   // en una isla
//   const res = await api.post("/api/admin/retry-charge", { bookingId });
//   if (!res.ok) setError(res.error);
//
// En FMBGT había doce manejadores que repetían fetch + "si 401, al login" y solo
// dos pantallas lo hacían. Con esto la sesión caducada se trata igual en todas.
//
// 🪤 Sin imports relativos: los tests lo cargan con Node tal cual (`.ts`).

export type ApiResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export type ApiClientOptions = {
  /** Login del área. Un 401 manda allí con `?next=<ruta actual>&expired=1`. */
  loginPath: string;
  /** Mensaje cuando la respuesta no trae uno propio. Recibe el status (0 = sin red). */
  fallbackError?: (status: number) => string;
  /** Sustituye la redirección del 401 (tests, o un área que abre un diálogo de login). */
  onUnauthorized?: (loginUrl: string) => void;
  /** Sustituye a `fetch` (tests). */
  fetchImpl?: typeof fetch;
};

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

/** La URL del login con la vuelta a la ruta actual. Solo rutas propias: `next` nunca es un dominio. */
export function loginUrl(loginPath: string, current?: { pathname: string; search: string }): string {
  const params = new URLSearchParams();
  if (current && current.pathname.startsWith("/") && !current.pathname.startsWith("//")) {
    params.set("next", `${current.pathname}${current.search}`);
  }
  params.set("expired", "1");
  return `${loginPath}?${params.toString()}`;
}

/** El mensaje de error de una respuesta, venga como venga (`{error}`, `{error:{message}}`, `{message}`). */
export function errorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string") {
    return (error as Record<string, string>).message;
  }
  if (typeof record.message === "string" && record.message) return record.message;
  return null;
}

export function createApiClient({
  loginPath,
  fallbackError = (status) => (status === 0 ? "Network error. Check the connection and try again." : `Something went wrong (${status}).`),
  onUnauthorized,
  fetchImpl,
}: ApiClientOptions) {
  async function request<T = unknown>(method: string, url: string, body?: Body): Promise<ApiResult<T>> {
    const doFetch = fetchImpl ?? fetch;
    const init: RequestInit = { method, credentials: "same-origin", cache: "no-store", headers: {} };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)["content-type"] = "application/json";
    }

    let res: Response;
    try {
      res = await doFetch(url, init);
    } catch {
      return { ok: false, status: 0, error: fallbackError(0) };
    }

    if (res.status === 401) {
      const here = typeof window !== "undefined" ? window.location : undefined;
      const target = loginUrl(loginPath, here);
      if (onUnauthorized) onUnauthorized(target);
      else if (here) here.assign(target);
      return { ok: false, status: 401, error: fallbackError(401) };
    }

    let json: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!res.ok) return { ok: false, status: res.status, error: errorMessage(json) ?? fallbackError(res.status) };
    // `{ data }` es la forma del estándar; una ruta antigua que devuelve el objeto
    // a pelo también vale.
    const data =
      json && typeof json === "object" && "data" in (json as Record<string, unknown>)
        ? (json as { data: T }).data
        : (json as T);
    return { ok: true, status: res.status, data };
  }

  return {
    request,
    get: <T = unknown>(url: string) => request<T>("GET", url),
    post: <T = unknown>(url: string, body?: Body) => request<T>("POST", url, body),
    put: <T = unknown>(url: string, body?: Body) => request<T>("PUT", url, body),
    patch: <T = unknown>(url: string, body?: Body) => request<T>("PATCH", url, body),
    delete: <T = unknown>(url: string, body?: Body) => request<T>("DELETE", url, body),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
