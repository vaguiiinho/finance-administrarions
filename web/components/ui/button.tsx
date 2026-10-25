"use client";

import type { ButtonHTMLAttributes, MouseEvent, Ref } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Mostra spinner e marca `aria-busy`; ignora novos acionamentos. */
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn btn-primary",
  secondary: "btn",
  tertiary: "btn btn-tertiary",
};

/**
 * Desabilitado = `aria-disabled` (continua focavel e pode ser descrito por `aria-describedby`, ex.: "Fatura paga").
 * Cliques sao ignorados enquanto desabilitado ou carregando.
 */
export function Button({ variant = "secondary", loading = false, disabled = false, className = "", type = "button", onClick, children, ref, ...rest }: ButtonProps) {
  const inert = disabled || loading;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      ref={ref}
      type={type}
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ className = "", ...props }: Omit<ButtonProps, "variant"> & { "aria-label": string }) {
  return <Button variant="secondary" className={`btn-icon ${className}`.trim()} {...props} />;
}
