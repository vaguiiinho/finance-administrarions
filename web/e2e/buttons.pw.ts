import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./auth-support";
import { anaAuthorization, signInAsAna } from "./legacy-auth";
import { evaluateButton, snapshotOf, type ButtonState } from "./contrast";
import { forcePseudoState, type ForcedPseudo } from "./pseudo-state";
import { ENTRIES_URL, MONTH, STUB_URL, gotoReady, releaseMutations, setScenario, setThemeCookie, themeToggle } from "./support";

// ADR 0005 D10: o stub nao aceita requisicao sem Bearer; as telas protegidas pedem sessao (usuaria comum "ana").
test.beforeEach(async ({ page }) => {
  await signInAsAna(page);
});

/**
 * CA83 / CAF07 (design 13.3, ADR 0002 T2): botoes em TODOS os estados x 2 temas, medidos no navegador.
 * Variantes que existem no produto: primario, secundario, terciario, icone (inclui o alternador de tema), aba,
 * segmented e paginacao (links; cenario `many` do stub, > 20 despesas). NAO existe variante "perigo" (design 13.2, nota; spec CAF07 corrigido).
 * Pseudo-estados via CDP `CSS.forcePseudoState`; carregando via `holdMutations` do stub; desabilitado via estados reais.
 */
const THEMES = ["light", "dark"] as const;
const ENABLED = ':not([aria-disabled="true"]):not(:disabled)';

interface Variant {
  name: string;
  selector: string;
  tertiary?: boolean;
}
const VARIANTS: Variant[] = [
  { name: "primario", selector: `.btn-primary${ENABLED}` },
  { name: "secundario", selector: `.btn:not(.btn-primary):not(.btn-tertiary):not(.btn-icon)${ENABLED}` },
  { name: "terciario", selector: `.btn-tertiary:not(.btn-icon)${ENABLED}`, tertiary: true },
  { name: "icone", selector: `.btn-icon${ENABLED}` },
  { name: "aba", selector: `.tab` },
  { name: "segmented", selector: `.segmented > *:not([aria-disabled="true"])` },
  // pagina atual (aria-current) e setas Anterior/Proxima tambem sao links desta nav
  { name: "paginacao", selector: `nav[aria-label^="Paginação"] a` },
];

interface Screen {
  name: string;
  scenario: string;
  url: string;
  prepare?: (page: Page) => Promise<void>;
  /** Variantes que precisam existir nesta tela (evita falso verde por seletor vazio) */
  expects: string[];
}
const openDrawer = async (page: Page) => {
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  await page.getByRole("dialog").waitFor();
};
const SCREENS: Screen[] = [
  { name: "lancamentos / Despesas", scenario: "default", url: ENTRIES_URL, expects: ["primario", "secundario", "icone", "aba"] },
  { name: "lancamentos / Despesas paginadas (>20)", scenario: "many", url: ENTRIES_URL, expects: ["paginacao", "primario"] },
  { name: "lancamentos / Faturas", scenario: "default", url: `${ENTRIES_URL}&tab=invoices`, expects: ["primario", "aba"] },
  { name: "drawer de novo lancamento", scenario: "default", url: ENTRIES_URL, prepare: openDrawer, expects: ["primario", "secundario", "segmented"] },
  { name: "cartoes", scenario: "default", url: "/cards", expects: ["primario", "secundario", "terciario"] },
  { name: "dashboard", scenario: "default", url: `/dashboard?month=${MONTH}`, expects: ["icone"] },
];

async function audited(page: Page, screen: Screen, theme: string, state: ButtonState, pseudo: ForcedPseudo[]) {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const variant of VARIANTS) {
    const forced = await forcePseudoState(page, variant.selector, pseudo);
    try {
      if (forced.count > 0) seen.add(variant.name);
      const marked = page.locator("[data-pw-forced]");
      for (let i = 0; i < (await marked.count()); i++) {
        problems.push(...evaluateButton(await snapshotOf(marked.nth(i)), { state, expectUnderlineOnHover: variant.tertiary && state === "hover" }).map((p) => `${variant.name}: ${p}`));
      }
    } finally {
      await forced.release();
    }
  }
  for (const expected of screen.expects) expect(seen.has(expected), `${screen.name} [${theme}] deveria ter botoes da variante ${expected}`).toBe(true);
  expect(problems, `${screen.name} [${theme}] [${state}]`).toEqual([]);
}

for (const theme of THEMES) {
  test.describe(`CA83 - botoes por estado, tema ${theme}`, () => {
    for (const screen of SCREENS) {
      for (const [state, pseudo] of [
        ["default", []],
        ["hover", ["hover"]],
        ["focus-visible", ["focus-visible"]],
        ["active", ["active", "hover"]],
      ] as const) {
        test(`${screen.name} / ${state}`, async ({ context, page }) => {
          await setScenario(screen.scenario);
          await setThemeCookie(context, theme);
          await gotoReady(page, screen.url);
          await page.waitForLoadState("networkidle");
          await screen.prepare?.(page);
          await audited(page, screen, theme, state, [...pseudo]);
        });
      }
    }

    test("desabilitado: Pagar fatura (fatura paga), Marcar como pago (sem selecao), Salvar com painel de cartao aberto, seta do grafico na ponta, segmento Cartao com Receita", async ({ context, page }) => {
      await setScenario("default");
      await setThemeCookie(context, theme);
      await gotoReady(page, `${ENTRIES_URL}&tab=invoices`);
      const block = page.getByRole("group", { name: /Nubank/ });
      await block.getByRole("button", { name: "Pagar fatura" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: /Confirmar|Pagar fatura/ }).click();
      await checkDisabled(block.getByRole("button", { name: "Pagar fatura" }), theme);

      await gotoReady(page, ENTRIES_URL);
      await checkDisabled(page.getByRole("button", { name: "Marcar como pago" }), theme);

      await openDrawer(page);
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("radio", { name: "Receita" }).click();
      await checkDisabled(dialog.getByRole("radio", { name: "Cartão" }), theme);

      // Salvar lancamento com o painel "+ Novo cartao" aberto (CAF07): desabilitado, com a dica "Conclua ou cancele o novo cartão"
      await dialog.getByRole("radio", { name: "Despesa" }).click();
      await dialog.getByRole("radio", { name: "Cartão" }).click();
      await dialog.getByRole("button", { name: "+ Novo cartão" }).click();
      await expect(dialog.getByText("Conclua ou cancele o novo cartão")).toBeVisible();
      await checkDisabled(dialog.getByRole("button", { name: "Salvar lançamento" }), theme);

      await page.setViewportSize({ width: 360, height: 800 });
      await gotoReady(page, `/dashboard?month=${MONTH}`);
      await page.waitForLoadState("networkidle");
      await checkDisabled(page.getByRole("button", { name: "Meses recentes" }), theme);
    });

    test("carregando: Salvar lancamento, Criar cartao, confirmacao de lote e Pagar fatura mantem cor, aria-busy, gira o spinner e ignora novo clique", async ({ context, page }) => {
      await setThemeCookie(context, theme);
      try {
        await setScenario("default", { holdMutations: true });
        await gotoReady(page, ENTRIES_URL);
        await openDrawer(page);
        const dialog = page.getByRole("dialog");
        const save = await submitPadaria(page);
        await checkLoading(save, theme);
        await expect(save.locator(".spinner")).toHaveCSS("animation-name", "spin"); // sem reduced-motion o spinner gira
        await save.click({ force: true }); // novo clique ignorado: continua uma unica mutacao pendente
        await releaseMutations();
        await expect(dialog).toHaveCount(0);
        // exatamente UMA linha criada (na tela e no stub), nao duas
        await expect(page.getByRole("row", { name: /Padaria/ })).toHaveCount(1);
        expect(await countPadaria()).toBe(1);

        await setScenario("default", { holdMutations: true });
        await gotoReady(page, ENTRIES_URL);
        await page.getByRole("checkbox", { name: /Internet/ }).check();
        await page.getByRole("button", { name: "Marcar como pago" }).click();
        const confirm = page.getByRole("alertdialog").getByRole("button", { name: /Marcar como pago|Pagando/ });
        await confirm.click();
        await expect(confirm).toHaveAttribute("aria-busy", "true");
        await checkLoading(confirm, theme);
        await releaseMutations();

        await setScenario("default", { holdMutations: true });
        await gotoReady(page, `${ENTRIES_URL}&tab=invoices`);
        await page.getByRole("group", { name: /Nubank/ }).getByRole("button", { name: "Pagar fatura" }).click();
        const payInvoice = page.getByRole("alertdialog").getByRole("button", { name: /Confirmar|Pagar fatura|Pagando/ });
        await payInvoice.click();
        await expect(payInvoice).toHaveAttribute("aria-busy", "true");
        await checkLoading(payInvoice, theme);
        await releaseMutations();

        await setScenario("default", { holdMutations: true });
        await gotoReady(page, "/cards");
        await page.getByRole("button", { name: "Novo cartão" }).first().click();
        const drawer = page.getByRole("dialog");
        await drawer.getByLabel("Nome do cartão").fill("Inter");
        await drawer.getByLabel("Dia de fechamento").fill("3");
        await drawer.getByLabel("Dia de vencimento").fill("10");
        const create = drawer.getByRole("button", { name: /Criar cartão|Salvando/ });
        await create.click();
        await expect(create).toHaveAttribute("aria-busy", "true");
        await checkLoading(create, theme);
      } finally {
        await releaseMutations().catch(() => undefined); // nao mascara a falha original quando o stub nao suporta o hold
        await setScenario("default");
      }
    });
  });
}

async function submitPadaria(page: Page): Promise<Locator> {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Descrição").fill("Padaria");
  await dialog.getByRole("combobox", { name: /Categoria/ }).fill("Alimentação");
  await dialog.getByLabel("Data").fill("2026-11-12");
  await dialog.getByLabel("Valor").fill("12,50");
  const save = dialog.getByRole("button", { name: /Salvando|Salvar lançamento/ });
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  return save;
}

/** Quantos lancamentos "Padaria" existem no stub (independe da UI). */
async function countPadaria(): Promise<number> {
  const res = await fetch(`${STUB_URL}/api/entries/expenses?month=${MONTH}&pageSize=100`, { headers: await anaAuthorization() });
  const data = (await res.json()) as { items: { description: string }[] };
  return data.items.filter((e) => e.description === "Padaria").length;
}

async function checkDisabled(button: Locator, theme: string) {
  await expect(button).toHaveAttribute("aria-disabled", "true");
  const problems = evaluateButton(await snapshotOf(button), { state: "disabled" });
  expect(problems, `desabilitado [${theme}]`).toEqual([]);
  // continua focavel (aria-disabled) e tem anel de foco (estado forcado: o foco programatico apos um clique nao e :focus-visible)
  await button.focus();
  await expect(button).toBeFocused();
  await button.evaluate((el) => el.setAttribute("data-pw-target", ""));
  const page = button.page();
  const forced = await forcePseudoState(page, "[data-pw-target]", ["focus-visible"]);
  try {
    expect(evaluateButton(await snapshotOf(button), { state: "focus-visible", disabled: true }), `desabilitado focado [${theme}]`).toEqual([]);
  } finally {
    await forced.release();
    await button.evaluate((el) => el.removeAttribute("data-pw-target"));
  }
}

async function checkLoading(button: Locator, theme: string) {
  expect(evaluateButton(await snapshotOf(button), { state: "loading" }), `carregando [${theme}]`).toEqual([]);
}

test.describe("carregando com movimento reduzido", () => {
  for (const theme of THEMES) {
    test(`spinner parado (animation-name none) mas visivel, com aria-busy e cores da variante, tema ${theme}`, async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await setScenario("default", { holdMutations: true });
        await gotoReady(page, ENTRIES_URL);
        await openDrawer(page);
        const save = await submitPadaria(page);
        const spinner = save.locator(".spinner");
        await expect(spinner).toBeVisible();
        await expect(spinner).toHaveCSS("animation-name", "none");
        await checkLoading(save, theme);
      } finally {
        await releaseMutations().catch(() => undefined);
        await setScenario("default");
      }
    });
  }
});

/** Smoke de fidelidade (T2): o estado forcado via CDP precisa coincidir com a interacao real. */
test.describe("fidelidade do estado forcado x interacao real", () => {
  test("hover real do botao primario = hover forcado; foco por Tab = focus-visible forcado; mouse down = active", async ({ context, page }) => {
    await setScenario("default");
    await setThemeCookie(context, "dark");
    await gotoReady(page, ENTRIES_URL);
    const button = page.getByRole("button", { name: /Novo lançamento/ }).first();
    const colors = (l: Locator) => l.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, outline: getComputedStyle(el).outlineStyle + getComputedStyle(el).outlineColor }));

    await button.hover();
    const realHover = await colors(button);
    await page.mouse.move(0, 0);
    const forcedHover = await forcePseudoState(page, ".btn-primary", ["hover"]);
    const forcedValue = await colors(button);
    await forcedHover.release();
    expect(forcedValue.bg).toBe(realHover.bg);

    await page.mouse.move(0, 0);
    await page.keyboard.press("Tab");
    await button.focus();
    const realFocus = await colors(button);
    await button.evaluate((el) => (el as HTMLElement).blur());
    const forcedFocus = await forcePseudoState(page, ".btn-primary", ["focus-visible"]);
    const forcedFocusValue = await colors(button);
    await forcedFocus.release();
    expect(forcedFocusValue.outline).toBe(realFocus.outline);

    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const realActive = await colors(button);
    await page.mouse.up();
    await page.mouse.move(0, 0);
    const forcedActive = await forcePseudoState(page, ".btn-primary", ["active", "hover"]);
    const forcedActiveValue = await colors(button);
    await forcedActive.release();
    expect(forcedActiveValue.bg).toBe(realActive.bg);
  });
});

test("o alternador de tema (icone) esta na matriz: e um .btn-icon com nome 'Tema escuro'", async ({ page }) => {
  await setScenario("default");
  await gotoReady(page, ENTRIES_URL);
  await expect(themeToggle(page)).toHaveClass(/btn-icon/);
});
