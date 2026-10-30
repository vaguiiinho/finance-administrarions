/* eslint-disable react-hooks/rules-of-hooks -- `use` e o callback de fixtures do Playwright, nao um hook do React */
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { STUB_USERS, type StubUser, type StubUserKey } from "./stub-users";
import { STUB_URL, gotoReady, setScenario, setThemeCookie } from "./support";

/**
 * Suporte dos e2e com autenticacao (ADR 0005 9.8, T11): fixture `authenticatedPage(role)`, login pela interface e
 * garantia de que o navegador nunca chama a API diretamente (CA47).
 */
export { STUB_USERS, STUB_URL, setScenario, setThemeCookie, gotoReady };
export type { StubUser, StubUserKey };

/** Entra pela tela de login (nao grava cookie na mao: o nome do cookie muda entre dev e producao). */
export async function signIn(page: Page, user: StubUser | StubUserKey, next?: string): Promise<void> {
  const u = typeof user === "string" ? STUB_USERS[user] : user;
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

/** Mostra o formulario de login com o `next` indicado, sem enviar. */
export async function openLogin(page: Page, query = ""): Promise<void> {
  await gotoReady(page, `/login${query}`);
}

interface Fixtures {
  /** `await authenticatedPage("ana")`: devolve a `page` do teste ja logada como o usuario do stub. */
  authenticatedPage: (role: StubUserKey) => Promise<Page>;
  /** Requisicoes do navegador cuja origem e a da API (CA47): deve ficar vazio. */
  apiRequests: string[];
}

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await use(async (role) => {
      await setScenario("default");
      await signIn(page, role);
      return page;
    });
  },
  apiRequests: async ({ page }, use) => {
    const seen: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(STUB_URL) || new URL(request.url()).port === new URL(STUB_URL).port) seen.push(`${request.method()} ${request.url()}`);
    });
    await use(seen);
    expect(seen, "o navegador nao pode chamar a API diretamente (CA47)").toEqual([]);
  },
});
export { expect };

export const VIEWPORTS = { mobile: { width: 360, height: 800 }, desktop: { width: 1280, height: 900 } } as const;
export const THEMES = ["light", "dark"] as const;

export const banner = (page: Page) => page.getByRole("region", { name: /dados de exemplo/i }).or(page.getByRole("region").filter({ hasText: "Você está vendo dados de exemplo." }));
export const navbar = (page: Page) => page.getByRole("banner");
export const sidebarNav = (page: Page) => page.getByRole("navigation", { name: "Principal" });
export const accountButton = (page: Page, name: string) => page.getByRole("button", { name: `Conta de ${name}` });
export const menuButton = (page: Page) => page.getByRole("button", { name: "Abrir menu de navegação" });

export async function openAccountMenu(page: Page, name: string): Promise<Locator> {
  await accountButton(page, name).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

/** Cada alvo interativo visivel tem pelo menos 44px nos dois eixos (CA46); links dentro de texto corrido ficam de fora (WCAG 2.5.8). */
export async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]), select, textarea, [role=menuitem], [role=radio], [role=tab], [role=checkbox]");
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === "hidden" || style.display === "none") continue;
      if (el.closest("[inert], [hidden]")) continue;
      if (el.matches("a.sr-only, .sr-only") || el.matches("a[href]:not(.btn)") && el.closest("p")) continue;
      if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) continue;
      if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? ""}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
}

/** O elemento focado tem contorno visivel (anel de foco), CA46. */
export async function focusRingVisible(locator: Locator): Promise<boolean> {
  await locator.focus();
  return locator.evaluate((el) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    const shadow = s.boxShadow !== "none";
    return outline || shadow;
  });
}
