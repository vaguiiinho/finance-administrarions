/** Preferencia de tema (ADR 9.5): cookie `theme=light|dark`; valor invalido equivale a ausente (segue o sistema). */
export const THEME_COOKIE = "theme";
export type Theme = "light" | "dark";

const ONE_YEAR_SECONDS = 31_536_000;

export function parseTheme(value: string | null | undefined): Theme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

export function themeCookieString(theme: Theme, options: { secure?: boolean } = {}): string {
  const base = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  return options.secure ? `${base}; Secure` : base;
}

/** A preferencia vence o sistema; sem preferencia segue o sistema. */
export function resolveEffectiveTheme(preference: Theme | undefined, systemPrefersDark: boolean): Theme {
  return preference ?? (systemPrefersDark ? "dark" : "light");
}
