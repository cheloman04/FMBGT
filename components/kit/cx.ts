/**
 * Une clases y descarta las vacías.
 *
 * 🪤 NO es `tailwind-merge`. Dos utilidades de la misma propiedad (`mb-6` y
 * `mb-2`) no se resuelven aquí: gana la que va después en el CSS, no la que se
 * pasó la última. Por eso lo ajustable de una primitiva es una prop con valor
 * por defecto (`spacing="mb-3"`), nunca un `className` que intenta pisar la base
 * (KIGARU_DASHBOARD_STANDARD_V1.md §6.3).
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
