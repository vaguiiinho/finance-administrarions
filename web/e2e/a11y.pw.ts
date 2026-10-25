import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ENTRIES_URL, MONTH, setScenario, setThemeCookie } from "./support";

/**
 * CA82 (camada 2, ADR 9.5): axe com wcag2a/wcag2aa + color-contrast em cada tela x {claro, escuro}.
 * Falha com qualquer violacao e com `incomplete` de color-contrast fora da allowlist (navbar com --header-bg,
 * coberta pela camada 1 - lib/theme/tokens.spec.ts).
 */
const THEMES = ["light", "dark"] as const;
const INCOMPLETE_ALLOWLIST = [/^header\b/, /^nav\b/, /\[data-navbar\]/, /\bheader\b/];

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).withRules(["color-contrast"]).analyze();
  expect(results.violations, `${label}: violacoes`).toEqual([]);
  const unexplained = results.incomplete
    .filter((r) => r.id === "color-contrast")
    .flatMap((r) => r.nodes)
    .filter((n) => !n.target.some((t) => INCOMPLETE_ALLOWLIST.some((re) => re.test(String(t)))));
  expect(unexplained.map((n) => n.target), `${label}: color-contrast 'incomplete' sem justificativa`).toEqual([]);
}

const SCREENS: { name: string; scenario: string; url: string; prepare?: (page: Page) => Promise<void> }[] = [
  { name: "lancamentos / Despesas com dados", scenario: "default", url: ENTRIES_URL },
  { name: "lancamentos / Despesas vazia", scenario: "empty", url: ENTRIES_URL },
  { name: "lancamentos / Despesas com erro", scenario: "error500", url: ENTRIES_URL },
  { name: "lancamentos / Faturas", scenario: "default", url: `${ENTRIES_URL}&tab=invoices` },
  {
    name: "lancamentos / Faturas com bloco expandido",
    scenario: "default",
    url: `${ENTRIES_URL}&tab=invoices`,
    prepare: async (page) => {
      await page.getByRole("button", { name: /Nubank|despesas/i }).first().click();
      await page.getByText("Mercado").waitFor();
    },
  },
  { name: "lancamentos / Faturas vazia", scenario: "empty", url: `${ENTRIES_URL}&tab=invoices` },
  { name: "lancamentos / Receitas", scenario: "default", url: `${ENTRIES_URL}&tab=income` },
  {
    name: "lancamentos / Despesas com selecao",
    scenario: "default",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await page.getByRole("checkbox").nth(1).check();
    },
  },
  {
    name: "drawer de novo lancamento",
    scenario: "default",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await page.getByRole("button", { name: /Novo lançamento/ }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    name: "drawer com erros de validacao",
    scenario: "default",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await page.getByRole("button", { name: /Novo lançamento/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: /Salvar/ }).click();
      await page.getByRole("dialog").getByRole("alert").first().waitFor();
    },
  },
  { name: "cartoes com dados", scenario: "default", url: "/cards" },
  { name: "cartoes vazia", scenario: "empty", url: "/cards" },
  { name: "dashboard com dados", scenario: "default", url: `/dashboard?month=${MONTH}` },
  { name: "dashboard vazio", scenario: "empty", url: `/dashboard?month=${MONTH}` },
  { name: "dashboard com erro", scenario: "error500", url: `/dashboard?month=${MONTH}` },
];

for (const theme of THEMES) {
  test.describe(`axe - tema ${theme}`, () => {
    for (const screen of SCREENS) {
      test(screen.name, async ({ context, page }) => {
        await setScenario(screen.scenario);
        await setThemeCookie(context, theme);
        await page.goto(screen.url);
        await page.waitForLoadState("networkidle");
        await screen.prepare?.(page);
        await audit(page, `${screen.name} [${theme}]`);
      });
    }
  });
}

test.describe("axe - 'sistema' via emulateMedia (sem cookie)", () => {
  for (const scheme of THEMES) {
    test(`/entries com sistema ${scheme}`, async ({ page }) => {
      await setScenario("default");
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(ENTRIES_URL);
      await page.waitForLoadState("networkidle");
      await audit(page, `/entries sistema ${scheme}`);
    });
  }
});
