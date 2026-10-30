import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./auth-support";
import { signInAsAna } from "./legacy-auth";
import { BG, ENTRIES_URL, MONTH, PAGE_BG_REGION, audit, auditPageGradient, bodyBackground, emulateReducedTransparency, glassStackingProblems, gotoReady, htmlTheme, setScenario, setThemeCookie, showChartTooltip, themeToggle } from "./support";
import { resolveTokens } from "./tokens";

// ADR 0005 D10: o stub nao aceita requisicao sem Bearer; as telas protegidas pedem sessao (usuaria comum "ana").
test.beforeEach(async ({ page }) => {
  await signInAsAna(page);
});

/**
 * Vidro fosco (spec CA01-CA13, CA02, CA07, CA19; ADR 0004 9.3). Os papeis (`--card-bg`, `--bar-bg`, `--field-bg`, `--card-border`,
 * `--glass-filter`, `--item-filter`) sao lidos no navegador no tema atual e comparados com o computado de cada superficie.
 * O contraste no pior caso sobre vidro vem de `auditPageGradient` (e2e/support.ts): o axe nao enxerga o gradiente nem o desfoque.
 */
const THEMES = ["light", "dark"] as const;
const SCREENS = [ENTRIES_URL, "/cards", `/dashboard?month=${MONTH}`] as const;
const VIEWPORTS = [
  ["360x740", { width: 360, height: 740 }],
  ["1280x800", { width: 1280, height: 800 }],
] as const;

test.beforeEach(async () => {
  await setScenario("default");
});

interface Look {
  bg: string;
  filter: string;
  webkitFilter: string;
  borderTop: string;
  borderTopWidth: string;
  borderBottom: string;
  shadow: string;
}
const lookOf = (locator: Locator): Promise<Look[]> =>
  locator.evaluateAll((els) =>
    els
      .filter((el) => !el.closest("dialog"))
      .map((el) => {
        const s = getComputedStyle(el);
        return {
          bg: s.backgroundColor,
          filter: s.backdropFilter,
          webkitFilter: s.getPropertyValue("-webkit-backdrop-filter"),
          borderTop: s.borderTopColor,
          borderTopWidth: s.borderTopWidth,
          borderBottom: s.borderBottomColor,
          shadow: s.boxShadow,
        };
      }),
  );
const alphaOf = (color: string): number => {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (!m) throw new Error(`cor invalida: ${color}`);
  const parts = m[1].split(/[,/]\s*|\s+/).filter(Boolean);
  return parts.length >= 4 ? Number(parts[3]) : 1;
};
/** Resolve um papel que NAO e cor (ex.: --item-filter) para o valor computado de `backdrop-filter`. */
const resolveFilter = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement("div");
    document.body.append(probe);
    probe.style.setProperty("backdrop-filter", `var(${name})`);
    const value = getComputedStyle(probe).backdropFilter;
    probe.remove();
    return value;
  }, token);
const ROLE_TOKENS = ["--bar-bg", "--card-bg", "--card-bg-2", "--field-bg", "--card-border", "--surface", "--input-bg", "--border-strong"];

for (const theme of THEMES) {
  for (const [vpName, viewport] of VIEWPORTS) {
    test.describe(`CA01/CA03 - vidro de barra e de card [${theme}, ${vpName}]`, () => {
      for (const url of SCREENS) {
        test(`${url}: navbar em vidro de barra, .card em vidro, sem problemas de empilhamento (G7/G8)`, async ({ context, page }) => {
          await setThemeCookie(context, theme);
          await page.setViewportSize(viewport);
          await gotoReady(page, url);
          const t = await resolveTokens(page, ROLE_TOKENS);

          // CA01: navbar
          const [nav] = await lookOf(page.locator("[data-navbar]"));
          expect(nav.bg, "fundo da navbar = papel --bar-bg").toBe(t["--bar-bg"]);
          expect(alphaOf(nav.bg), "navbar translucida (B1: 0,91 claro / 0,90 escuro)").toBeLessThan(1);
          expect(alphaOf(nav.bg)).toBeCloseTo(theme === "light" ? 0.91 : 0.9, 2);
          expect(nav.filter, "backdrop-filter da navbar").toContain("blur(");
          expect(nav.borderBottom, "borda inferior da navbar = papel --card-border").toBe(t["--card-border"]);

          // CA03: cards
          const cards = await lookOf(page.locator(".card"));
          expect(cards.length, `${url}: nenhum .card encontrado`).toBeGreaterThan(0);
          for (const c of cards) {
            expect(c.bg, ".card = papel --card-bg").toBe(t["--card-bg"]);
            expect(alphaOf(c.bg)).toBeCloseTo(0.7, 2);
            expect(c.filter).toContain("blur(");
            expect(c.borderTop).toBe(t["--card-border"]);
            expect(c.borderTopWidth).toBe("1px");
            expect(c.shadow, "sombra mantida (RNF04: a separacao nao depende so da borda)").not.toBe("none");
          }

          expect(await glassStackingProblems(page), "empilhamento/desfoque (G7/G8)").toEqual([]);
        });
      }

      test("/entries (cenario many): .glass-flat e .glass em vidro; itens/tabela usam --item-filter (vidro plano, sem desfoque por decisao TQ3)", async ({ context, page }) => {
        await setScenario("many");
        await setThemeCookie(context, theme);
        await page.setViewportSize(viewport);
        await gotoReady(page, ENTRIES_URL);
        const t = await resolveTokens(page, ROLE_TOKENS);
        const itemFilter = await resolveFilter(page, "--item-filter");
        const flat = await lookOf(page.locator(".glass-flat"));
        expect(flat.length, "nenhum .glass-flat (itens do mobile / contêiner da tabela)").toBeGreaterThan(0);
        for (const f of flat) {
          expect(f.bg).toBe(t["--card-bg"]);
          expect(f.filter).toBe(itemFilter);
          expect(f.borderTop).toBe(t["--card-border"]);
        }
        // o subtotal da aba e o unico .glass na variante 2 (design 4.2: --glass-bg-2); os demais .glass usam o papel --card-bg
        for (const g of await lookOf(page.locator(".glass:not([data-testid=subtotal])"))) {
          expect(g.bg).toBe(t["--card-bg"]);
          expect(g.filter).toContain("blur(");
        }
        for (const g of await lookOf(page.locator(".glass[data-testid=subtotal]"))) {
          expect(g.bg).toBe(t["--card-bg-2"]);
          expect(g.filter).toContain("blur(");
        }
        expect(await glassStackingProblems(page)).toEqual([]);
      });
    });
  }

  test(`CA04 [${theme}] - filtros de despesas em vidro; lista do select opaca`, async ({ context, page }) => {
    await setThemeCookie(context, theme);
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, ENTRIES_URL);
    const t = await resolveTokens(page, ROLE_TOKENS);
    const fields = page.locator("select.field, input.field");
    const looks = await lookOf(fields);
    expect(looks.length, "campos de filtro visiveis em >= md").toBeGreaterThan(0);
    for (const f of looks) {
      expect(f.bg, ".field sobre o fundo = papel --field-bg").toBe(t["--field-bg"]);
      expect(alphaOf(f.bg)).toBeCloseTo(0.7, 2);
      expect(f.filter).toContain("blur(");
      expect(f.borderTop, "borda do controle continua --border-strong (3:1)").toBe(t["--border-strong"]);
    }
    const optionBg = await page.locator("select.field option").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(optionBg, "lista aberta do <select> opaca").toBe(t["--surface"]);
    expect(alphaOf(optionBg)).toBe(1);
  });

  test(`checkbox [${theme}] - foco por teclado: um unico anel (no ::before), sem outline no input`, async ({ context, page }) => {
    await setScenario("many");
    await setThemeCookie(context, theme);
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, ENTRIES_URL);
    const box = page.getByRole("checkbox", { name: /Internet/ });
    await box.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(box).toBeFocused();
    const style = await box.evaluate((el) => {
      const own = getComputedStyle(el);
      const ring = getComputedStyle(el, "::before");
      return { outlineStyle: own.outlineStyle, ringStyle: ring.outlineStyle, ringWidth: ring.outlineWidth };
    });
    expect(style.outlineStyle, "input sem outline proprio").toBe("none");
    expect(style.ringStyle, "anel do ::before").not.toBe("none");
    expect(parseFloat(style.ringWidth)).toBeGreaterThanOrEqual(2);
  });

  test(`CA13 [${theme}] - faixa de abas continua opaca e sem backdrop-filter`, async ({ context, page }) => {
    await setScenario("many");
    await setThemeCookie(context, theme);
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, ENTRIES_URL);
    await page.evaluate(() => window.scrollTo(0, 700));
    const [bar] = await lookOf(page.locator(".page-bg-window"));
    expect(bar.filter).toBe("none");
    expect(alphaOf(bar.bg)).toBe(1);
    expect(bar.bg).toBe(BG[theme]);
  });
}

/** Opaco = alfa 1 e sem backdrop-filter (CA05). */
async function expectOpaque(label: string, locator: Locator, expectedBg: string) {
  const looks = await locator.evaluateAll((els) => els.map((el) => ({ bg: getComputedStyle(el).backgroundColor, filter: getComputedStyle(el).backdropFilter })));
  expect(looks.length, `${label}: elemento nao encontrado`).toBeGreaterThan(0);
  for (const l of looks) {
    expect(alphaOf(l.bg), `${label}: alfa`).toBe(1);
    expect(l.bg, `${label}: valor da rev. 6`).toBe(expectedBg);
    expect(l.filter, `${label}: sem backdrop-filter`).toBe("none");
  }
}

for (const theme of THEMES) {
  test.describe(`CA05 [${theme}] - overlays, popovers, toast e tooltip continuam opacos`, () => {
    test("drawer, campos do drawer, listbox do combobox e menu do seletor de mes", async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await page.setViewportSize({ width: 1280, height: 800 });
      await gotoReady(page, ENTRIES_URL);
      const t = await resolveTokens(page, ["--surface", "--input-bg", "--tooltip-bg", "--surface-2"]);

      await page.getByRole("button", { name: /Escolher mês|novembro de 2026/i }).first().click();
      await expectOpaque("menu do seletor de mes", page.locator('[role="group"][aria-label="Escolher mês"]'), t["--surface"]);
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: /Novo lançamento/ }).click();
      const dialog = page.getByRole("dialog");
      await expectOpaque("drawer", page.locator("dialog[open]"), t["--surface"]);
      await expectOpaque("campos dentro do drawer (--input-bg, PA2)", page.locator("dialog[open] .field"), t["--input-bg"]);
      await dialog.getByRole("combobox", { name: /Categoria/ }).focus();
      await page.keyboard.press("ArrowDown");
      await dialog.getByRole("listbox").waitFor();
      await expectOpaque("lista do combobox", page.locator('[role="listbox"]'), t["--surface"]);
      expect(await glassStackingProblems(page), "empilhamento com drawer e listbox abertos").toEqual([]);
    });

    test("toast e tooltip do grafico", async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await page.setViewportSize({ width: 1280, height: 800 });
      await gotoReady(page, ENTRIES_URL);
      const t = await resolveTokens(page, ["--surface-2", "--tooltip-bg"]);
      await page.getByRole("checkbox", { name: /Internet/ }).check();
      await page.getByRole("button", { name: "Marcar como pago" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: /Marcar como pago/ }).click();
      await page.getByRole("status").filter({ hasText: /pag/i }).first().waitFor();
      await expectOpaque("toast", page.getByTestId("toast").filter({ hasText: /pag/i }), t["--surface-2"]);

      await gotoReady(page, `/dashboard?month=${MONTH}`);
      await showChartTooltip(page);
      await expectOpaque("tooltip", page.locator(".recharts-tooltip-wrapper > div"), t["--tooltip-bg"]);
      expect(await glassStackingProblems(page), "tooltip inteiro dentro do card (G8)").toEqual([]);
    });
  });
}

// ---------------------------------------------------------------------------
// CA08 - fallback sem backdrop-filter (CSSOM do build, ADR 0004 5.6)
// ---------------------------------------------------------------------------
test.describe("CA08 - sem suporte a backdrop-filter", () => {
  for (const theme of THEMES) {
    test(`[${theme}] a regra @supports compilada, aplicada, deixa navbar, cards e campos opacos e todos os pares passam`, async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await page.setViewportSize({ width: 1280, height: 800 });
      await gotoReady(page, ENTRIES_URL);
      const compiled = await page.evaluate(() => {
        const found: { condition: string; roots: string[] }[] = [];
        const visit = (rules: CSSRuleList) => {
          for (const rule of rules) {
            if (rule instanceof CSSSupportsRule && /backdrop-filter/.test(rule.conditionText)) {
              const roots = [...rule.cssRules].filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && /:root/.test(r.selectorText)).map((r) => r.cssText);
              found.push({ condition: rule.conditionText, roots });
            }
            if ("cssRules" in rule && rule.cssRules) visit(rule.cssRules as CSSRuleList);
          }
        };
        for (const sheet of document.styleSheets) {
          try {
            visit(sheet.cssRules);
          } catch {
            /* folha de outra origem */
          }
        }
        return found;
      });
      const rule = compiled.find((c) => /-webkit-backdrop-filter/.test(c.condition) && /\bnot\b/.test(c.condition));
      expect(rule, `regra @supports not (...) com e sem prefixo nao encontrada no CSS compilado (achadas: ${JSON.stringify(compiled.map((c) => c.condition))})`).toBeDefined();
      expect(rule!.condition).toMatch(/(^|[^-])backdrop-filter/);
      expect(rule!.roots.length, "a regra precisa redefinir os papeis em :root").toBeGreaterThan(0);

      // aplica o cssText da PROPRIA regra compilada (nao uma copia escrita a mao) como se o navegador nao suportasse o desfoque
      await page.addStyleTag({ content: rule!.roots.join("\n") });
      const t = await resolveTokens(page, ["--surface", "--input-bg", "--border"]);
      const [nav] = await lookOf(page.locator("[data-navbar]"));
      expect(alphaOf(nav.bg), "navbar opaca").toBe(1);
      expect(nav.bg).toBe(t["--surface"]);
      expect(nav.filter).toBe("none");
      for (const c of await lookOf(page.locator(".card"))) {
        expect(alphaOf(c.bg), "card opaco").toBe(1);
        expect(c.bg).toBe(t["--surface"]);
        expect(c.filter).toBe("none");
        expect(c.borderTop).toBe(t["--border"]);
      }
      for (const f of await lookOf(page.locator("select.field"))) {
        expect(alphaOf(f.bg), "campo opaco").toBe(1);
        expect(f.bg).toBe(t["--input-bg"]);
        expect(f.filter).toBe("none");
      }
      await audit(page, `/entries sem backdrop-filter [${theme}]`, { gradients: [PAGE_BG_REGION] });
      await auditPageGradient(page, `/entries sem backdrop-filter [${theme}]`);
    });
  }
});

// ---------------------------------------------------------------------------
// CA09 / CA10 - preferencias do usuario
// ---------------------------------------------------------------------------
const SURFACES = "[data-navbar], .card, .glass, .glass-flat, .glass-bar, select.field, input.field";
async function expectNoGlass(page: Page, label: string) {
  const bad = await page.locator(SURFACES).evaluateAll((els) =>
    els
      .filter((el) => !el.closest("dialog"))
      .map((el) => {
        const s = getComputedStyle(el);
        const m = /rgba?\(([^)]+)\)/.exec(s.backgroundColor);
        const parts = m ? m[1].split(/[,/]\s*|\s+/).filter(Boolean) : [];
        const alpha = parts.length >= 4 ? Number(parts[3]) : 1;
        return { name: `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 2).join(".")}`, alpha, filter: s.backdropFilter };
      })
      .filter((x) => (x.alpha > 0 && x.alpha < 1) || x.filter !== "none"),
  );
  expect(bad, `${label}: superficie translucida ou com backdrop-filter`).toEqual([]);
}

test.describe("CA09/CA10 - transparencia reduzida e alto contraste", () => {
  for (const theme of THEMES) {
    test(`[${theme}] prefers-reduced-transparency: reduce -> fallback opaco (aparencia da rev. 6)`, async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await page.setViewportSize({ width: 1280, height: 800 });
      await emulateReducedTransparency(page);
      await gotoReady(page, ENTRIES_URL);
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches), "o Chromium precisa honrar a emulacao via CDP").toBe(true);
      await expectNoGlass(page, "/entries");
      const t = await resolveTokens(page, ["--surface", "--border"]);
      const [nav] = await lookOf(page.locator("[data-navbar]"));
      expect(nav.bg).toBe(t["--surface"]);
      const [card] = await lookOf(page.locator(".card"));
      expect(card.bg).toBe(t["--surface"]);
      expect(card.borderTop, "borda da rev. 6").toBe(t["--border"]);
      for (const url of ["/cards", `/dashboard?month=${MONTH}`]) {
        await gotoReady(page, url);
        await expectNoGlass(page, url);
      }
    });

    test(`[${theme}] prefers-contrast: more -> fallback opaco, axe e pior caso passam`, async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ contrast: "more" });
      await gotoReady(page, ENTRIES_URL);
      await expectNoGlass(page, "/entries [contrast: more]");
      await audit(page, `/entries contrast:more [${theme}]`, { gradients: [PAGE_BG_REGION] });
      await auditPageGradient(page, `/entries contrast:more [${theme}]`);
    });

    test(`[${theme}] forced-colors: active -> fallback opaco`, async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ forcedColors: "active" });
      await gotoReady(page, ENTRIES_URL);
      await expectNoGlass(page, "/entries [forced-colors: active]");
    });
  }
});

// ---------------------------------------------------------------------------
// CA11 - troca de tema no mesmo quadro
// ---------------------------------------------------------------------------
test.describe("CA11 - troca de tema", () => {
  test("navbar, cards e campos trocam de valor no MESMO quadro (sem transicao) e o recarregamento mantem o tema", async ({ context, page }) => {
    await setThemeCookie(context, "light");
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, ENTRIES_URL);
    const result = await page.evaluate(async () => {
      const targets = [document.querySelector("[data-navbar]")!, document.querySelector(".card")!, document.querySelector("select.field")!];
      const read = () => targets.map((el) => getComputedStyle(el).backgroundColor);
      const before = read();
      const sameTask = new Promise<string[]>((resolve) => {
        const observer = new MutationObserver(() => {
          observer.disconnect();
          resolve(read());
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      });
      (document.querySelector('button[aria-label="Tema escuro"]') as HTMLButtonElement).click();
      const atMutation = await sameTask;
      await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      return { before, atMutation, after: read(), transition: targets.map((el) => getComputedStyle(el).transitionDuration) };
    });
    expect(result.atMutation, "no instante da troca o fundo ja e o do escuro").not.toEqual(result.before);
    expect(result.after, "dois quadros depois nada mudou (sem transicao)").toEqual(result.atMutation);
    for (const d of result.transition) expect(d.split(",").every((v) => parseFloat(v) === 0)).toBe(true);
    const dark = await resolveTokens(page, ["--bar-bg", "--card-bg", "--field-bg"]);
    expect(result.after).toEqual([dark["--bar-bg"], dark["--card-bg"], dark["--field-bg"]]);

    await page.reload();
    expect(await htmlTheme(page)).toBe("dark");
    expect(await bodyBackground(page)).toBe(BG.dark);
    const [nav] = await lookOf(page.locator("[data-navbar]"));
    expect(nav.bg).toBe(dark["--bar-bg"]);
  });

  test("sistema (sem preferencia salva): mudar claro -> escuro troca o vidro ao vivo", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: "light" });
    await gotoReady(page, ENTRIES_URL);
    const [before] = await lookOf(page.locator(".card").first());
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => bodyBackground(page)).toBe(BG.dark);
    const [after] = await lookOf(page.locator(".card").first());
    expect(after.bg).not.toBe(before.bg);
    expect(alphaOf(after.bg)).toBeCloseTo(0.7, 2);
    await themeToggle(page).waitFor();
  });
});

// ---------------------------------------------------------------------------
// CA12 - empilhamento
// ---------------------------------------------------------------------------
test.describe("CA12 - popover sobre cards de vidro", () => {
  for (const [vpName, viewport] of VIEWPORTS) {
    for (const url of [ENTRIES_URL, `/dashboard?month=${MONTH}`]) {
      test(`${url} ${vpName}: a grade do seletor de mes fica inteira por cima dos cards e e clicavel`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await gotoReady(page, url);
        await page.getByRole("button", { name: /Escolher mês|novembro de 2026/i }).first().click();
        const grid = page.getByRole("group", { name: "Escolher mês" });
        await grid.waitFor();
        const box = (await grid.boundingBox())!;
        const points = [
          [box.x + 6, box.y + 6],
          [box.x + box.width - 6, box.y + 6],
          [box.x + 6, box.y + box.height - 6],
          [box.x + box.width - 6, box.y + box.height - 6],
          [box.x + box.width / 2, box.y + box.height / 2],
        ];
        for (const [x, y] of points) {
          const inside = await grid.evaluate((el, p) => {
            const top = document.elementFromPoint(p[0], p[1]);
            return !!top && el.contains(top);
          }, [x, y]);
          expect(inside, `ponto (${Math.round(x)}, ${Math.round(y)}) coberto por outro elemento`).toBe(true);
        }
        expect(await glassStackingProblems(page)).toEqual([]);
        await grid.getByRole("button", { name: "dezembro de 2026" }).click();
        await expect(page).toHaveURL(/month=2026-12/);
      });
    }
  }

  test("o toast continua por cima de cards de vidro", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, ENTRIES_URL);
    await page.getByRole("checkbox", { name: /Internet/ }).check();
    await page.getByRole("button", { name: "Marcar como pago" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Marcar como pago/ }).click();
    const toast = page.getByRole("status").filter({ hasText: /pag/i }).first();
    await toast.waitFor();
    const onTop = await toast.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!top && el.contains(top);
    });
    expect(onTop).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CA02 / CA07 / CA19 - contraste no pior caso sobre vidro, no navegador
// ---------------------------------------------------------------------------
test.describe("CA07/CA19 - axe + pior caso sobre vidro nas telas principais", () => {
  for (const theme of THEMES) {
    for (const [vpName, viewport] of VIEWPORTS) {
      for (const url of SCREENS) {
        test(`${url} [${theme}, ${vpName}]`, async ({ context, page }) => {
          await setThemeCookie(context, theme);
          await page.setViewportSize(viewport);
          await gotoReady(page, url);
          await audit(page, `${url} [${theme}, ${vpName}]`, { gradients: [PAGE_BG_REGION] });
          await auditPageGradient(page, `${url} [${theme}, ${vpName}]`);
        });
      }
    }
    test(`mes vazio [${theme}]: titulo e aviso 'Sem lancamentos neste mes' sobre o fundo passam no pior caso (CA19)`, async ({ context, page }) => {
      await setScenario("empty");
      await setThemeCookie(context, theme);
      await page.setViewportSize({ width: 360, height: 740 });
      await gotoReady(page, ENTRIES_URL);
      await expect(page.getByText("Sem lançamentos neste mês")).toBeVisible();
      await audit(page, `/entries mes vazio [${theme}]`, { gradients: [PAGE_BG_REGION] });
      await auditPageGradient(page, `/entries mes vazio [${theme}]`);
    });
  }
});

test.describe("CA02 - conteudo rolando sob a navbar e sob o thead sticky", () => {
  for (const theme of THEMES) {
    for (const [vpName, viewport] of VIEWPORTS) {
      test(`[${theme}, ${vpName}] cenario many rolado: navbar (e thead no desktop) sobre texto e cards, pior caso e axe passam`, async ({ context, page }) => {
        await setScenario("many");
        await setThemeCookie(context, theme);
        await page.setViewportSize(viewport);
        await gotoReady(page, ENTRIES_URL);
        for (const y of [500, 1100, 1700]) {
          await page.evaluate((to) => window.scrollTo(0, to), y);
          // a navbar esta grudada no topo e ha conteudo realmente passando por baixo dela
          const stuck = await page.evaluate(() => {
            const nav = document.querySelector("[data-navbar]")!.getBoundingClientRect();
            const under = document.elementsFromPoint(window.innerWidth / 2, nav.bottom + 2).filter((el) => !el.closest("[data-navbar]"));
            return { top: nav.top, hasContentUnder: under.length > 0, scrolled: window.scrollY };
          });
          expect(stuck.top).toBe(0);
          expect(stuck.scrolled).toBeGreaterThan(0);
          expect(stuck.hasContentUnder).toBe(true);
          if (viewport.width >= 768) {
            const thead = page.locator("thead").first();
            // thead grudado logo abaixo da navbar + faixa de abas, com linhas da tabela passando por baixo
            const pinned = await page.evaluate(() => {
              const css = getComputedStyle(document.documentElement);
              const offset = parseFloat(css.getPropertyValue("--navbar-h")) + parseFloat(css.getPropertyValue("--tabsbar-h"));
              const head = document.querySelector("thead")!.getBoundingClientRect();
              const rows = [...document.querySelectorAll("tbody tr")].filter((r) => {
                const b = r.getBoundingClientRect();
                return b.bottom > head.bottom && b.top < head.bottom + 40;
              });
              return { top: head.top, offset, rowsUnder: rows.length };
            });
            // nas rolagens menores a tabela ainda pode nao ter chegado ao topo; nunca passa acima do ponto de fixacao
            expect(pinned.top, "thead nunca acima de navbar-h + tabsbar-h").toBeGreaterThanOrEqual(pinned.offset - 1);
            if (y >= 1100) {
              expect(Math.abs(pinned.top - pinned.offset), "thead grudado em navbar-h + tabsbar-h").toBeLessThanOrEqual(1);
              expect(pinned.rowsUnder, "linhas da tabela passando por baixo do thead").toBeGreaterThan(0);
            }
            const [look] = await lookOf(thead);
            expect(look.filter, "thead sticky em vidro de barra").toContain("blur(");
            expect(alphaOf(look.bg)).toBeLessThan(1);
            expect(alphaOf(look.bg)).toBeGreaterThanOrEqual(0.9);
          }
          await audit(page, `/entries many rolado y=${y} [${theme}, ${vpName}]`, { gradients: [PAGE_BG_REGION] });
          await auditPageGradient(page, `/entries many rolado y=${y} [${theme}, ${vpName}]`);
        }
      });
    }
  }

  test("360px, lote selecionado: a barra de acoes fixa em vidro de barra passa no pior caso", async ({ context, page }) => {
    await setScenario("many");
    await setThemeCookie(context, "dark");
    await page.setViewportSize({ width: 360, height: 740 });
    await gotoReady(page, ENTRIES_URL);
    await page.getByRole("checkbox", { name: /Internet/ }).first().check();
    const bar = page.locator(".fixed.bottom-0");
    await bar.waitFor();
    const [look] = await lookOf(bar);
    expect(look.filter).toContain("blur(");
    expect(alphaOf(look.bg)).toBeLessThan(1);
    await auditPageGradient(page, "barra de lote mobile [dark]");
    await audit(page, "barra de lote mobile [dark]", { gradients: [PAGE_BG_REGION] });
  });
});
