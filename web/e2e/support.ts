import AxeBuilder from "@axe-core/playwright";
import { MIN_COMPONENT, MIN_TEXT, incompleteVerdict, textContrastOf, type GradientRegion } from "./contrast";
import { parseColor } from "../lib/theme/contrast";
import { PAGE_BACKGROUND_TOKENS } from "../lib/theme/contrast-pairs";
import { samplesFromTokenColors, worstCaseRatio } from "../lib/theme/gradient";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

export const STUB_URL = "http://127.0.0.1:4010";
export const MONTH = "2026-11";
export const ENTRIES_URL = `/entries?month=${MONTH}`;

/** Valores computados esperados do `--bg` (cor base do fundo, design rev. 6: `#ECEEFC` / `#181E2A`) em rgb(). */
export const BG = { light: "rgb(236, 238, 252)", dark: "rgb(24, 30, 42)" } as const;

/** Tokens que compoem o fundo da pagina (design rev. 6): cor base + paradas + brilhos. */
export const PAGE_BG_TOKENS = PAGE_BACKGROUND_TOKENS;

/** Regiao que pinta o gradiente da pagina (faixa de abas, `.page-bg-window`): resolvida pelo pior caso (ADR 0003 5.5). */
export const PAGE_BG_REGION: GradientRegion = { selector: ".page-bg-window", tokens: PAGE_BG_TOKENS };

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
  /** Regioes que pintam um gradiente declarado (ADR 0003 5.5): `bgGradient`/`bgImage` dentro delas sao resolvidos pelo pior caso */
  gradients?: GradientRegion[];
}

export async function audit(page: Page, label: string, { overlays = [], gradients = [] }: AuditOptions = {}): Promise<number> {
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
      const result = await textContrastOf(page.locator(selector).first(), overlays, gradients);
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

/**
 * ADR 0003 5.5: o axe nao enxerga o `body::before` (pseudo-elemento `position: fixed`) e mede o texto contra `--bg`. Este
 * audit cobre o ponto cego: todo texto cuja cadeia de ancestrais ate o body e TRANSPARENTE (sem background-color nem
 * background-image) e medido no PIOR caso contra as amostras do gradiente (paradas, interpolacoes e brilhos compostos).
 * Devolve as falhas; `auditPageGradient` espera `[]`.
 */
export async function pageGradientFailures(page: Page, tokens: readonly string[] = PAGE_BG_TOKENS): Promise<string[]> {
  const data = await page.evaluate((names) => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const colors: Record<string, string> = {};
    for (const token of names) {
      probe.style.color = `var(${token})`;
      colors[token] = getComputedStyle(probe).color;
    }
    probe.remove();
    const texts: { text: string; color: string; size: number; weight: number; opacity: number; backgrounds: string[]; hasImage: boolean }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim()) continue;
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
      // `background-color` e `background-image` dos ancestrais ate o body (exclusive: o body pinta so a cor base)
      const backgrounds: string[] = [];
      let hasImage = false;
      let opacity = 1;
      for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
        const style = getComputedStyle(n);
        opacity *= Number(style.opacity);
        if (n === document.body) continue;
        backgrounds.push(style.backgroundColor);
        if (style.backgroundImage !== "none") hasImage = true;
      }
      const style = getComputedStyle(el);
      texts.push({ text: node.textContent.trim().slice(0, 30), color: style.color, size: parseFloat(style.fontSize) || 16, weight: Number(style.fontWeight) || 400, opacity, backgrounds, hasImage });
    }
    return { colors, texts };
  }, [...tokens]);
  const samples = samplesFromTokenColors(data.colors);
  return data.texts.flatMap((t) => {
    // so o texto sobre cadeia TRANSPARENTE enxerga o gradiente do body::before; os demais sao do axe
    if (t.hasImage || t.backgrounds.some((c) => parseColor(c).a !== 0)) return [];
    // opacidade < 1 em algum ancestral: a cor computada nao e a exibida (como em `incompleteVerdict`)
    if (t.opacity < 1) return [`"${t.text}": opacidade efetiva ${t.opacity.toFixed(2)} < 1: a cor computada nao e a exibida`];
    const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
    const required = large ? MIN_COMPONENT : MIN_TEXT;
    const worst = worstCaseRatio(parseColor(t.color), samples);
    return worst >= required ? [] : [`"${t.text}": ${worst.toFixed(2)}:1 < ${required}:1`];
  });
}

export async function auditPageGradient(page: Page, label: string) {
  expect(await pageGradientFailures(page), `${label}: texto sobre o fundo em gradiente abaixo do minimo no pior caso`).toEqual([]);
}
