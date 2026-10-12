/**
 * Barra fina de avance (hitos, completitud de un formulario largo).
 *
 * El relleno es el acento, nunca verde: el verde dice "sano" en un badge, no
 * "avanza" en una barra (§7.5).
 *
 * 🪤 No uses la clase del botón primario para el relleno: arrastra el cambio de
 * brillo al pasar y el hundimiento al pulsar, y la barra promete un clic que no
 * existe.
 */
export function ProgressBar({
  value,
  label,
}: {
  /** 0–100. Se recorta a ese rango. */
  value: number;
  /** Nombre accesible: "Waiver completion". */
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
    >
      <div
        className="h-full rounded-full bg-ac-500 transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
