"use client";

import { useId } from "react";
import { cx } from "./cx";

// Clases completas por estado: sin tailwind-merge, dos utilidades del mismo prop
// en una cadena las resuelve el orden del CSS (§6.3).
const TRACK =
  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60 " +
  "disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";
const TRACK_ON = "border-ac-500 bg-ac-500";
const TRACK_OFF = "border-hairline bg-surface-muted";
const THUMB = "inline-block h-[18px] w-[18px] rounded-full transition-transform duration-150 motion-reduce:transition-none";
const THUMB_ON = "translate-x-[22px] bg-ac-contrast";
const THUMB_OFF = "translate-x-[2px] bg-fg-muted";

/**
 * Un interruptor: un estado que se enciende o se apaga, y que se ve siempre.
 *
 * Es para un ESTADO con dos valores y efecto inmediato («el agente contesta este
 * hilo»), no para una acción suelta (eso es un `Button`) ni para un campo de un
 * formulario que se guarda después.
 *
 * - `role="switch"` con `aria-checked`: el lector de pantalla dice «activado».
 * - La etiqueta va pegada y es parte del objetivo: tocarla también lo mueve, y en
 *   el teléfono la fila mide 44 px (§1).
 * - El estado encendido lleva el acento: es uno de sus sitios (§7.5).
 * - `stateLabels` añade «On / Off» al lado. El color no puede ser la única señal.
 */
export function Switch({
  checked,
  onChange,
  label,
  labelHidden = false,
  stateLabels,
  disabled = false,
  loading = false,
  id: idProp,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** El nombre del estado, ya traducido («AI agent»). */
  label: string;
  /** Esconde la etiqueta a la vista, pero la deja para el lector de pantalla. */
  labelHidden?: boolean;
  /** «On» / «Off» al lado del interruptor, ya traducidos. */
  stateLabels?: { on: string; off: string };
  disabled?: boolean;
  /** Mientras se guarda: deshabilitado y `aria-busy`. */
  loading?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <span className="inline-flex items-center gap-2.5 max-sm:min-h-11">
      <label htmlFor={id} className={labelHidden ? "sr-only" : "cursor-pointer select-none text-sm font-medium text-fg"}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        onClick={() => onChange(!checked)}
        className={cx(TRACK, checked ? TRACK_ON : TRACK_OFF)}
      >
        <span aria-hidden="true" className={cx(THUMB, checked ? THUMB_ON : THUMB_OFF)} />
      </button>
      {/* Solo a la vista: el lector de pantalla ya dice el estado por `aria-checked`,
          y con esto dentro del nombre leería «AI agent On, activado». */}
      {stateLabels ? (
        <span aria-hidden="true" className="min-w-[2rem] select-none text-xs text-fg-2">
          {checked ? stateLabels.on : stateLabels.off}
        </span>
      ) : null}
    </span>
  );
}
