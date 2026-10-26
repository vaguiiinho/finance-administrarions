"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from "react";

interface FieldShellProps {
  label: ReactNode;
  required?: boolean;
  error?: string;
  help?: ReactNode;
  /** Conteudo ao lado do rotulo (ex.: botao "+ Novo cartao") */
  aside?: ReactNode;
  counter?: ReactNode;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Rotulo, ajuda e erro ligados por `aria-describedby`; erro com `role="alert"` e icone (nao so cor). */
export function FieldShell({ label, required, error, help, aside, counter, children }: FieldShellProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {aside}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          {error ? (
            <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger-text">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
              </svg>
              {error}
            </p>
          ) : null}
          {help ? (
            <p id={helpId} className="text-sm text-muted">
              {help}
            </p>
          ) : null}
        </div>
        {counter}
      </div>
    </div>
  );
}

type TextFieldProps = Omit<FieldShellProps, "children"> & InputHTMLAttributes<HTMLInputElement> & { inputRef?: Ref<HTMLInputElement> };

export function TextField({ label, required, error, help, aside, counter, inputRef, className = "", ...input }: TextFieldProps) {
  return (
    <FieldShell label={label} required={required} error={error} help={help} aside={aside} counter={counter}>
      {({ id, describedBy, invalid }) => (
        <input id={id} ref={inputRef} className={`field ${className}`.trim()} aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-required={required || undefined} {...input} />
      )}
    </FieldShell>
  );
}

type SelectFieldProps = Omit<FieldShellProps, "children"> & SelectHTMLAttributes<HTMLSelectElement> & { selectRef?: Ref<HTMLSelectElement> };

export function SelectField({ label, required, error, help, aside, counter, selectRef, className = "", children, ...select }: SelectFieldProps) {
  return (
    <FieldShell label={label} required={required} error={error} help={help} aside={aside} counter={counter}>
      {({ id, describedBy, invalid }) => (
        <select id={id} ref={selectRef} className={`field ${className}`.trim()} aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-required={required || undefined} {...select}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}
