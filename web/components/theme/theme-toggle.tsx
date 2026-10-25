"use client";

import { useSyncExternalStore } from "react";
import { parseTheme, resolveEffectiveTheme, themeCookieString, type Theme } from "@/lib/theme/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

/** Tema efetivo no cliente: preferencia no <html data-theme> ou, sem ela, o sistema. */
function getSnapshot(): Theme {
  return resolveEffectiveTheme(parseTheme(document.documentElement.dataset.theme), window.matchMedia(DARK_QUERY).matches);
}

/** Aplica o tema sem recarregar nem tocar no estado React de outras arvores (CA84). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.themeSwitching = "";
  root.dataset.theme = theme;
  document.cookie = themeCookieString(theme, { secure: window.location.protocol === "https:" });
  requestAnimationFrame(() => requestAnimationFrame(() => delete root.dataset.themeSwitching));
}


/**
 * Botao sol/lua (design 2.2): `aria-label` fixo "Tema escuro" + `aria-pressed`. Os dois icones ficam no DOM e a
 * visibilidade e por CSS (icone certo no primeiro quadro). `initialTheme` e a preferencia lida no servidor.
 */
export function ThemeToggle({ initialTheme }: { initialTheme?: Theme }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => initialTheme ?? "light");
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="btn btn-icon"
      aria-label="Tema escuro"
      aria-pressed={dark}
      title={`Tema escuro: ${dark ? "ativado" : "desativado"}`}
      onClick={() => applyTheme(dark ? "light" : "dark")}
    >
      <svg className="theme-icon-sun" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="theme-icon-moon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" />
      </svg>
    </button>
  );
}
