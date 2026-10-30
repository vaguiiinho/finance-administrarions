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
  // Feature A: indicadores da lista de usuarios, menu da conta, navegacao e senha (design 1, 2.4, 17)
  shield: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" strokeLinejoin="round" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
    </>
  ),
  group: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M16 5.8a3 3 0 0 1 0 5.4M18 14.2c1.8.6 3 2.1 3 4.8" strokeLinecap="round" />
    </>
  ),
  slashCircle: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m6.3 6.3 11.4 11.4" strokeLinecap="round" />
    </>
  ),
  keyClock: (
    <>
      <circle cx="8" cy="9" r="4" />
      <path d="M11 12l8 8M16 17l2-2M14 15l2-2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15 12v2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  dash: <path d="M7 12h10" strokeLinecap="round" />,
  logout: <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9" strokeLinecap="round" strokeLinejoin="round" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.5 7.3A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="7" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />,
  chart: <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" strokeLinecap="round" strokeLinejoin="round" />,
  card: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h3" strokeLinecap="round" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l9 9-8 8-9-9Z" strokeLinejoin="round" />
      <circle cx="7.5" cy="8.5" r="1" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />,
  close: <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />,
  capsLock: <path d="M12 4 5 12h4v4h6v-4h4l-7-8ZM9 20h6" strokeLinecap="round" strokeLinejoin="round" />,
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
