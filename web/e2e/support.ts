import AxeBuilder from "@axe-core/playwright";
import { MIN_COMPONENT, MIN_TEXT, incompleteVerdict, textContrastOf, type GradientRegion } from "./contrast";
import { parseColor, type Rgba } from "../lib/theme/contrast";
import { BAR_UNDER, PAGE_BACKGROUND_TOKENS } from "../lib/theme/contrast-pairs";
import { samplesFromTokenColors } from "../lib/theme/gradient";
import { classifyChain, expandUnders, worstOverLayers, type ChainLayer } from "../lib/theme/glass";
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
 * (navbar com --glass-bar-bg, coberta pela camada 1) nem (b) RESOLVIDO pelo contraste computado, e so para os `messageKey`
 * conhecidos (texto SVG `imgNode`, `elmPartiallyObscured`/`elmPartiallyObscuring`; ver `incompleteVerdict`). Mesmo nesses,
 * falha com opacidade efetiva < 1, background-image na cadeia ou sobreposicao real. Devolve quantos nos foram resolvidos
 * (tambem registrado como anotacao do teste e no log) para a tela ficar auditavel.
 */
// ADR 0004 5.3: so a navbar (coberta pela camada 1 e por `pageGradientFailures`, classe `bar`). As regexes antigas `/^header\b/`, `/^nav\b/` e
// `/\bheader\b/` casavam TAMBEM EntriesHeader/DashboardHeader (onde mora o resumo) e escondiam qualquer `incomplete` ali. A lista NAO cresce.
const INCOMPLETE_ALLOWLIST = [/\[data-navbar\]/];

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

export interface WorstCaseOptions {
  pageTokens?: readonly string[];
  barUnder?: readonly string[];
}

/**
 * Auditoria de PIOR CASO do texto sobre o fundo em gradiente e sobre vidro (ADR 0003 5.5, ADR 0004 5.3, R1, R2). O axe nao enxerga o
 * `body::before` (gradiente) nem o conteudo que rola sob uma barra, e compoe o vidro translucido sobre `--bg`. Cada texto visivel tem a
 * cadeia de ancestrais classificada por `classifyChain` (lib/theme/glass.ts) e e medido no pior caso:
 *  - transparent: contra as amostras do gradiente;
 *  - glass: as camadas translucidas compostas sobre CADA amostra do gradiente;
 *  - bar: as camadas ate a barra (inclusive) compostas sobre `BAR_UNDER` (amostras, superficies, vidros e extremos de luminancia);
 *  - opaque / image: ficam com o axe e com a `GradientRegion`.
 * Opacidade efetiva < 1 reprova (a cor computada nao e a exibida). Devolve as falhas; `auditPageGradient` espera `[]`.
 */
export async function pageGradientFailures(page: Page, { pageTokens = PAGE_BG_TOKENS, barUnder = BAR_UNDER }: WorstCaseOptions = {}): Promise<string[]> {
  const names = [...new Set([...pageTokens, ...barUnder])];
  const data = await page.evaluate((tokens) => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const colors: Record<string, string> = {};
    for (const token of tokens) {
      probe.style.color = "";
      probe.style.color = `var(${token})`;
      colors[token] = getComputedStyle(probe).color;
    }
    probe.remove();
    const texts: { text: string; color: string; size: number; weight: number; opacity: number; chain: { background: string; image: boolean; position: string }[] }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim()) continue;
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
      // cadeia ate o body (exclusive: o body pinta so a cor base)
      const chain: { background: string; image: boolean; position: string }[] = [];
      let opacity = 1;
      for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
        const style = getComputedStyle(n);
        opacity *= Number(style.opacity);
        if (n === document.body) continue;
        chain.push({ background: style.backgroundColor, image: style.backgroundImage !== "none", position: style.position });
      }
      const style = getComputedStyle(el);
      texts.push({ text: node.textContent.trim().slice(0, 30), color: style.color, size: parseFloat(style.fontSize) || 16, weight: Number(style.fontWeight) || 400, opacity, chain });
    }
    return { colors, texts };
  }, names);

  const samples = samplesFromTokenColors(Object.fromEntries(pageTokens.map((t) => [t, data.colors[t]])));
  const underColors: Record<string, Rgba> = Object.fromEntries(barUnder.map((t) => [t, parseColor(data.colors[t])]));
  // BAR_UNDER expandido uma vez so (e o mesmo para todo texto de barra)
  let barBackgrounds: Rgba[] | null = null;

  return data.texts.flatMap((t) => {
    const chain: ChainLayer[] = t.chain;
    const cls = classifyChain(chain);
    if (cls.kind === "opaque" || cls.kind === "image") return [];
    if (t.opacity < 1) return [`"${t.text}": opacidade efetiva ${t.opacity.toFixed(2)} < 1: a cor computada nao e a exibida`];
    const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
    const required = large ? MIN_COMPONENT : MIN_TEXT;
    const fg = parseColor(t.color);
    let worst: number;
    if (cls.kind === "transparent") worst = worstOverLayers(fg, [], samples);
    else if (cls.kind === "glass") worst = worstOverLayers(fg, chain.slice(0, cls.depth).map((l) => l.background), samples);
    else {
      barBackgrounds ??= expandUnders(underColors, samples);
      worst = worstOverLayers(fg, chain.slice(0, cls.depth + 1).map((l) => l.background), barBackgrounds);
    }
    return worst >= required ? [] : [`"${t.text}" [${cls.kind}]: ${worst.toFixed(2)}:1 < ${required}:1`];
  });
}

export async function auditPageGradient(page: Page, label: string) {
  expect(await pageGradientFailures(page), `${label}: texto sobre o fundo em gradiente abaixo do minimo no pior caso`).toEqual([]);
}

/**
 * TQ7 (ADR 0004 5.6): `prefers-reduced-transparency` so sai por CDP (o Playwright nao a expoe em `emulateMedia`).
 * Chamar DEPOIS de qualquer `page.emulateMedia(...)`: os dois usam `Emulation.setEmulatedMedia` e o ultimo substitui o anterior.
 */
export async function emulateReducedTransparency(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
}

/**
 * G7/G8 (ADR 0004 4.1, 5.4, R3): devolve os problemas de empilhamento/desfoque do DOM atual (vazio = ok).
 *  - G7: elemento com `backdrop-filter` nao pode ter ancestral com `backdrop-filter`, `filter`, `opacity < 1`, `mask`, `clip-path` ou
 *    `mix-blend-mode` (o desfoque so enxergaria a subarvore do ancestral, nao o gradiente).
 *  - G8: `position: fixed` fora do top layer nao pode ter ancestral com `backdrop-filter` (viraria bloco de contencao), e nenhum popover
 *    (`[role=listbox]`, grade do seletor de mes) pode ser descendente de superficie com `backdrop-filter`.
 *  - Tooltip do grafico visivel precisa ficar INTEIRO dentro do retangulo do card que o contem.
 */
export async function glassStackingProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""}`;
    const hasBackdrop = (el: Element) => {
      const s = getComputedStyle(el);
      return (s.backdropFilter && s.backdropFilter !== "none") || (s.getPropertyValue("-webkit-backdrop-filter") && s.getPropertyValue("-webkit-backdrop-filter") !== "none");
    };
    const rootsBackdrop = (el: Element): string | null => {
      const s = getComputedStyle(el);
      if (s.filter !== "none") return "filter";
      if (Number(s.opacity) < 1) return "opacity < 1";
      if (s.maskImage !== "none" && s.maskImage !== "") return "mask";
      if (s.clipPath !== "none") return "clip-path";
      if (s.mixBlendMode !== "normal") return "mix-blend-mode";
      if (hasBackdrop(el)) return "backdrop-filter";
      return null;
    };
    const inTopLayer = (el: Element) => !!el.closest("dialog[open]");
    for (const el of document.querySelectorAll("*")) {
      if (hasBackdrop(el)) {
        for (let a = el.parentElement; a; a = a.parentElement) {
          const reason = rootsBackdrop(a);
          if (reason) problems.push(`G7: ${name(el)} tem backdrop-filter e o ancestral ${name(a)} tem ${reason}`);
        }
      }
      const s = getComputedStyle(el);
      if (s.position === "fixed" && !inTopLayer(el)) {
        for (let a = el.parentElement; a; a = a.parentElement) if (hasBackdrop(a)) problems.push(`G8: ${name(el)} (fixed) preso ao bloco de contencao de ${name(a)}`);
      }
    }
    for (const pop of document.querySelectorAll('[role="listbox"], [role="group"][aria-label="Escolher mês"]')) {
      for (let a = pop.parentElement; a; a = a.parentElement) if (hasBackdrop(a)) problems.push(`G8: popover ${name(pop)} dentro de ${name(a)} com backdrop-filter`);
    }
    for (const tip of document.querySelectorAll(".recharts-tooltip-wrapper")) {
      const box = tip.getBoundingClientRect();
      const card = tip.closest(".card");
      if (card && box.width > 0 && box.height > 0 && getComputedStyle(tip).visibility !== "hidden") {
        const c = card.getBoundingClientRect();
        if (box.left < c.left - 1 || box.right > c.right + 1 || box.top < c.top - 1 || box.bottom > c.bottom + 1) problems.push("G8: tooltip do grafico sai do retangulo do card");
      }
    }
    return [...new Set(problems)];
  });
}
