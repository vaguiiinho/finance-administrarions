import AxeBuilder from "@axe-core/playwright";
import { incompleteVerdict, textContrastOf } from "./contrast";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

export const STUB_URL = "http://127.0.0.1:4010";
export const MONTH = "2026-11";
export const ENTRIES_URL = `/entries?month=${MONTH}`;

/** Valores computados esperados (design 1.2) em rgb(). */
export const BG = { light: "rgb(245, 247, 251)", dark: "rgb(11, 15, 26)" } as const;

/**
 * Opcoes do stub (ADR 0002 T5): `delayMs` atrasa os GETs /api/*; `holdQueries` segura os GETs ate `releaseMutations()`
 * ("atualizando" deterministico); `holdMutations` segura POST/PUT ate `releaseMutations()` ("carregando").
 */
export interface ScenarioOptions {
  delayMs?: number;
  holdMutations?: boolean;
  holdQueries?: boolean;
}

export async function setScenario(name: string, options: ScenarioOptions = {}) {
  const res = await fetch(`${STUB_URL}/__scenario`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, ...options }) });
  if (!res.ok) throw new Error(`falha ao definir cenario ${name}`);
}

/** Libera as requisicoes seguradas por `holdMutations`/`holdQueries` (POST /__release). */
export async function releaseMutations() {
  const res = await fetch(`${STUB_URL}/__release`, { method: "POST" });
  if (!res.ok) throw new Error("falha ao liberar requisicoes seguradas");
}

export async function setThemeCookie(context: BrowserContext, theme: "light" | "dark", baseURL = "http://localhost:3100") {
  await context.addCookies([{ name: "theme", value: theme, url: baseURL }]);
}

export const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
export const htmlTheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme ?? null);
export const themeToggle = (page: Page) => page.getByRole("button", { name: "Tema escuro" });

/**
 * CA82 (camada 2): axe wcag2a/aa + color-contrast. Falha com violacao e com `incomplete` que nao seja (a) da allowlist
 * (navbar com --header-bg, coberta pela camada 1) nem (b) RESOLVIDO pelo contraste computado, e so para os `messageKey`
 * conhecidos (texto SVG `imgNode`, `elmPartiallyObscured`/`elmPartiallyObscuring`; ver `incompleteVerdict`). Mesmo nesses,
 * falha com opacidade efetiva < 1, background-image na cadeia ou sobreposicao real. Devolve quantos nos foram resolvidos
 * (tambem registrado como anotacao do teste e no log) para a tela ficar auditavel.
 */
const INCOMPLETE_ALLOWLIST = [/^header\b/, /^nav\b/, /\[data-navbar\]/, /\bheader\b/];

export interface AuditOptions {
  /** Seletores de overlays opacos da propria tela (ex.: lista aberta do combobox): nos `bgOverlap` cobertos por eles nao tem o que ler e contam a parte */
  overlays?: string[];
}

export async function audit(page: Page, label: string, { overlays = [] }: AuditOptions = {}): Promise<number> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).withRules(["color-contrast"]).analyze();
  expect(results.violations, `${label}: violacoes`).toEqual([]);
  const pending = results.incomplete
    .filter((r) => r.id === "color-contrast")
    .flatMap((r) => r.nodes)
    .filter((n) => !n.target.some((t) => INCOMPLETE_ALLOWLIST.some((re) => re.test(String(t)))));
  const failures: string[] = [];
  let resolved = 0;
  let occluded = 0;
  for (const node of pending) {
    const selector = node.target.map(String).join(" ");
    const messageKey = [...node.any, ...node.all, ...node.none].map((c) => (c.data as { messageKey?: string } | null)?.messageKey).find(Boolean);
    try {
      const result = await textContrastOf(page.locator(selector).first(), overlays);
      const problem = incompleteVerdict(messageKey, result);
      if (problem) failures.push(`${selector} ("${result.text}"): ${problem}`);
      else {
        resolved++;
        if (result.coveredByOverlay) occluded++;
      }
    } catch {
      failures.push(`${selector}: nao foi possivel calcular o contraste (axe: ${messageKey ?? "incomplete"})`);
    }
  }
  expect(failures, `${label}: color-contrast 'incomplete' sem justificativa ou reprovado pelo contraste computado`).toEqual([]);
  if (resolved > 0) {
    test.info().annotations.push({ type: "axe-incomplete-resolvido", description: `${label}: ${resolved}${occluded ? ` (${occluded} sob overlay declarado)` : ""}` });
    console.log(`[axe] ${label}: ${resolved} no(s) incomplete resolvido(s) por contraste computado${occluded ? `, ${occluded} sob overlay declarado` : ""}`);
  }
  return resolved;
}

/** `goto` + espera de rede ociosa: o Next hidrata depois do HTML, e cliques antes disso sao perdidos. */
export async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Mostra o tooltip do grafico de barras com o ponteiro (rola o grafico para a vista antes: fora dela o mouse nao o alcanca). */
export async function showChartTooltip(page: Page) {
  const chart = page.getByRole("group", { name: /Gráfico de evolução mensal/ });
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 60, box.y + box.height / 2, { steps: 5 });
  await page.locator(".recharts-tooltip-wrapper").filter({ hasText: "Receitas" }).first().waitFor();
}
