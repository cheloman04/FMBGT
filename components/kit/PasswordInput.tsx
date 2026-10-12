"use client";

import { useId, useState } from "react";
import { IconEye, IconEyeOff } from "./_icons";
import { cx } from "./cx";
import { FIELD_CLASSES, FieldShell, type FieldChrome } from "./Field";

/**
 * Un secreto (contraseña o clave de API) con su botón de mostrar/ocultar.
 *
 * `autoComplete` es "new-password" por defecto, no "off": Chromium ignora "off"
 * en campos de contraseña y trata el campo de texto anterior como el usuario de
 * un login (así acabó un email guardado dentro de un "Public Token"). Un login de
 * verdad pasa "current-password".
 */
export function PasswordInput({
  id: idProp,
  value,
  onChange,
  name,
  placeholder,
  autoComplete = "new-password",
  required = false,
  notACredential = false,
  showLabel = "Show",
  hideLabel = "Hide",
  label,
  labelHidden,
  error,
  hint,
  layout,
}: FieldChrome & {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  /**
   * Es una clave de API, no una credencial del usuario: los gestores de
   * contraseñas (1Password, LastPass, Bitwarden) hacen su propia detección e
   * ignoran `autoComplete`, así que necesitan estos avisos para no ofrecerse.
   */
  notACredential?: boolean;
  /** Nombre accesible del botón, ya traducido ("Show password", "Mostrar clave"). */
  showLabel?: string;
  hideLabel?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [visible, setVisible] = useState(false);
  const managerOptOut = notACredential
    ? { "data-1p-ignore": true, "data-lpignore": "true", "data-bwignore": true, "data-form-type": "other" }
    : {};
  return (
    <FieldShell {...{ id, label, labelHidden, error, hint, layout }}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cx(FIELD_CLASSES, "pr-11")}
          {...managerOptOut}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-fg-muted transition-colors duration-150 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60"
        >
          {visible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
        </button>
      </div>
    </FieldShell>
  );
}
