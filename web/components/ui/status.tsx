import { signOf } from "@/lib/money/decimal";
import type { EntryStatus } from "@/lib/api/types";

const ICONS = {
  check: <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" strokeLinecap="round" />
    </>
  ),
  arrowIn: <path d="M19 5 8 16m0 0V8m0 8h8" strokeLinecap="round" strokeLinejoin="round" />,
  arrowUp: <path d="M12 19V6m0 0-5 5m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />,
  arrowDown: <path d="M12 5v13m0 0-5-5m5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />,
  equal: <path d="M6 9h12M6 15h12" strokeLinecap="round" />,
} as const;

export function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      {ICONS[name]}
    </svg>
  );
}

const BADGES: Record<EntryStatus, { label: string; icon: keyof typeof ICONS; className: string }> = {
  PENDING: { label: "Pendente", icon: "clock", className: "text-warning-text" },
  PAID: { label: "Pago", icon: "check", className: "text-success-text" },
  RECEIVED: { label: "Recebida", icon: "arrowIn", className: "text-income" },
};

/** Pendente / Pago / Recebida: cor + icone + texto (nunca so cor). */
export function StatusBadge({ status }: { status: EntryStatus }) {
  const badge = BADGES[status];
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${badge.className}`}>
      <Icon name={badge.icon} />
      {badge.label}
    </span>
  );
}

/** Saldo: Positivo (seta p/ cima), Negativo (seta p/ baixo) ou Zerado ("="), sempre com texto. */
export function SignIndicator({ value }: { value: string }) {
  const sign = signOf(value);
  if (sign === "positive")
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-success-text">
        <Icon name="arrowUp" />
        Positivo
      </span>
    );
  if (sign === "negative")
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-danger-text">
        <Icon name="arrowDown" />
        Negativo
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted">
      <Icon name="equal" />
      Zerado
    </span>
  );
}

/** Indicador de legenda para Pago/Pendente (bolinha + texto sempre presente). */
export function StatusDot({ status, children }: { status: "PAID" | "PENDING"; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${status === "PAID" ? "bg-success" : "bg-warning"}`} />
      {children}
    </span>
  );
}
