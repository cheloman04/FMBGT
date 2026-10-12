// La URL como estado de la vista (§4.7): filtros, periodo, pestaña, el registro
// abierto en un drawer.
//
// 🪤 Sin imports relativos: los tests lo cargan con Node tal cual (`.ts`).

export type SearchParamsInput = Record<string, string | string[] | undefined> | URLSearchParams;

function toParams(input: SearchParamsInput | undefined): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) for (const v of value) params.append(key, v);
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}

/**
 * La misma ruta con UN parámetro cambiado y los demás intactos. `null` lo quita
 * (el "todos", el drawer cerrado). Cambiar el filtro devuelve a la primera página:
 * `page` se quita salvo que sea el parámetro que se cambia.
 *
 *   withParam("/admin/bookings", { status: "confirmed", page: "3" }, "period", "90d")
 *   // → "/admin/bookings?status=confirmed&period=90d"
 */
export function withParam(
  pathname: string,
  searchParams: SearchParamsInput | undefined,
  key: string,
  value: string | null,
  { keepPage = false }: { keepPage?: boolean } = {},
): string {
  const params = toParams(searchParams);
  if (value === null) params.delete(key);
  else params.set(key, value);
  if (key !== "page" && !keepPage) params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
