"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { FieldShell } from "./fields";
import { Icon } from "./status";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  /** Visivel por padrao (senha temporaria do administrador, PA6). */
  initiallyVisible?: boolean;
  /** Mostra "De 8 a 72 caracteres." com o indicador de tamanho. */
  lengthHint?: boolean;
  /** Ajuda adicional (ex.: "Informe-a fora do sistema."). */
  help?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

const MIN = 8;
const MAX = 72;

/**
 * Campo de senha (design 10.2): botao "Mostrar senha" (`aria-pressed`, nome fixo) dentro da borda, indicador de tamanho
 * opcional (sem anuncio ao vivo), aviso de Caps Lock com o campo focado. Sem medidor de forca nem trim (P02).
 */
export function PasswordField({ label, error, initiallyVisible = false, lengthHint = false, help, inputRef, className = "", onChange, onKeyDown, onKeyUp, onBlur, value, defaultValue, required, ...input }: PasswordFieldProps) {
  const [visible, setVisible] = useState(initiallyVisible);
  const [typed, setTyped] = useState(String(defaultValue ?? ""));
  const [capsLock, setCapsLock] = useState(false);
  const current = value !== undefined ? String(value) : typed;
  const size = [...current].length; // code points, como a API (P02)
  const lengthOk = size >= MIN && size <= MAX;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTyped(event.target.value);
    onChange?.(event);
  };
  const trackCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState("CapsLock"));

  const helpNode =
    lengthHint || capsLock || help ? (
      <>
        {lengthHint ? (
          <span data-length-ok={String(lengthOk)} className={`flex items-center gap-1.5 ${lengthOk ? "text-success-text" : "text-muted"}`}>
            <Icon name={lengthOk ? "check" : "circle"} />
            De 8 a 72 caracteres.
          </span>
        ) : null}
        {help ? <span className="block">{help}</span> : null}
        {capsLock ? (
          <span className="flex items-center gap-1.5 text-warning-text">
            <Icon name="capsLock" />
            Caps Lock está ativado.
          </span>
        ) : null}
      </>
    ) : undefined;

  return (
    <FieldShell label={label} error={error} help={helpNode}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            ref={inputRef}
            type={visible ? "text" : "password"}
            className={`field pr-12 ${className}`.trim()}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            required={required}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            onKeyDown={(event) => {
              trackCaps(event);
              onKeyDown?.(event);
            }}
            onKeyUp={(event) => {
              trackCaps(event);
              onKeyUp?.(event);
            }}
            onBlur={(event) => {
              setCapsLock(false);
              onBlur?.(event);
            }}
            {...input}
          />
          <button
            type="button"
            aria-label="Mostrar senha"
            aria-pressed={visible}
            aria-controls={id}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-lg text-text hover:bg-surface-2 active:bg-surface-active"
          >
            <Icon name={visible ? "eyeOff" : "eye"} size={20} />
          </button>
        </div>
      )}
    </FieldShell>
  );
}
