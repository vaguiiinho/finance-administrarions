import type { BrowserContext, Page } from "@playwright/test";

export const STUB_URL = "http://127.0.0.1:4010";
export const MONTH = "2026-11";
export const ENTRIES_URL = `/entries?month=${MONTH}`;

/** Valores computados esperados (design 1.2) em rgb(). */
export const BG = { light: "rgb(245, 247, 251)", dark: "rgb(11, 15, 26)" } as const;

export async function setScenario(name: string) {
  const res = await fetch(`${STUB_URL}/__scenario`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error(`falha ao definir cenario ${name}`);
}

export async function setThemeCookie(context: BrowserContext, theme: "light" | "dark", baseURL = "http://127.0.0.1:3100") {
  await context.addCookies([{ name: "theme", value: theme, url: baseURL }]);
}

export const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
export const htmlTheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme ?? null);
export const themeToggle = (page: Page) => page.getByRole("button", { name: "Tema escuro" });
