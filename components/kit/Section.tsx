import type { ReactNode } from "react";

/**
 * Una sección de página.
 *
 * `flat` (el defecto) es el registro de `/portal/impact`, la pantalla modelo del
 * hub: micro-etiqueta en mayúsculas sobre el lienzo, la acción a su derecha y un
 * filete que la separa del contenido. **Sin caja.**
 *
 * `panel` solo para los tres casos de §7.6: un objeto discreto sobre el que se
 * actúa como unidad (un formulario, el resumen de un registro), o dos estructuras
 * lado a lado que necesitan un límite. Una lista nunca es un panel.
 *
 * 🪤 En el hub el defecto es `panel` por herencia; aquí es `flat` porque un
 * proyecto que arranca con el kit no tiene esa herencia. Con `panel` el hijo pone
 * su propio relleno: el panel no tiene (así una tabla llega a los bordes).
 */
export function Section({
  title,
  subtitle,
  action,
  icon,
  id,
  variant = "flat",
  children,
}: {
  title: string;
  /** Nodo, no solo cadena: hay subtítulos con una cifra en negrita dentro. */
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  /** Ancla, para enlazar a la sección desde un índice (`#id`). */
  id?: string;
  variant?: "flat" | "panel";
  children: ReactNode;
}) {
  if (variant === "panel") {
    return (
      <Panel id={id}>
        <SectionHeader title={title} subtitle={subtitle} action={action} icon={icon} />
        {children}
      </Panel>
    );
  }
  return (
    <section id={id}>
      {/* 🪤 No es la tipografía de la cabecera de un panel: un `text-sm` sobre el
          lienzo sería un TERCER registro entre el título de página y la
          micro-etiqueta, que es justo la deriva que el estándar persigue. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-hairline pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <span className="flex-none text-fg-muted">{icon}</span> : null}
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{title}</h2>
        </div>
        {action ? <div className="flex-shrink-0">{action}</div> : null}
      </div>
      {/* El subtítulo va BAJO el filete: suele ser una frase que explica una
          política, y colgada de una etiqueta de 10px quedaría más grande que su
          propio título. */}
      {subtitle ? <p className="mb-4 max-w-3xl text-xs leading-relaxed text-fg-muted">{subtitle}</p> : null}
      {children}
    </section>
  );
}

/** El único contenedor con caja: relleno plano y un filete, sin sombra (§7.6). */
export function Panel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className="overflow-hidden rounded-[14px] border border-hairline bg-surface">
      {children}
    </div>
  );
}

/** La cabecera de UN panel, desde dentro de su caja. */
export function SectionHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-hairline px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-2">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  );
}
