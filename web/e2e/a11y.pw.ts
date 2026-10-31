import { type Page } from "@playwright/test";
import { expect, test } from "./auth-support";
import { signInAsAna } from "./legacy-auth";
import { ENTRIES_URL, MONTH, PAGE_BG_REGION, audit, auditPageGradient, releaseMutations, setScenario, setThemeCookie, showChartTooltip } from "./support";

// ADR 0005 D10: o stub nao aceita requisicao sem Bearer; as telas protegidas pedem sessao (usuaria comum "ana").
test.beforeEach(async ({ page }) => {
  await signInAsAna(page);
});

type ScreenDef = {
  name: string;
  scenario: string;
  url: string;
  prepare?: (page: Page) => Promise<void>;
  /** Estado "atualizando" seguro pelo stub (`holdQueries`): "Atualizando…" precisa continuar visivel depois do audit */
  holdsQueries?: boolean;
  /** Overlays opacos da tela (auditados por si so); ver `AuditOptions.overlays` */
  overlays?: string[];
};

/**
 * CA82 (camada 2, ADR 9.5): axe com wcag2a/wcag2aa + color-contrast em cada tela x {claro, escuro}.
 * Falha com qualquer violacao e com `incomplete` de color-contrast fora da allowlist (navbar com --glass-bar-bg,
 * coberta pela camada 1 - lib/theme/tokens.spec.ts - e por `auditPageGradient`).
 */
const THEMES = ["light", "dark"] as const;
/**
 * Estados que o CA82 exige e que faltavam (CAF06, design 13.3): "atualizando" (stub com `holdQueries`), banners 404/422 do
 * lote, painel "+ Novo cartao", drawer de cartao (criar, editar, 409), modais de confirmacao, folha de filtros mobile,
 * toasts, tooltip dos graficos e tabelas alternativas.
 */
const openEntryDrawer = async (page: Page) => {
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  await page.getByRole("dialog").waitFor();
};
const nextMonth = (page: Page) => page.getByRole("button", { name: "Próximo mês" }).click();
const confirmBatch = async (page: Page) => {
  await page.getByRole("checkbox", { name: /Internet/ }).check();
  await page.getByRole("button", { name: "Marcar como pago" }).click();
};
const fillEntry = async (page: Page, date: string) => {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Descrição").fill("Padaria");
  await dialog.getByRole("combobox", { name: /Categoria/ }).fill("Alimentação");
  await dialog.getByLabel("Data").fill(date);
  await dialog.getByLabel("Valor").fill("12,50");
};
const openNewCardPanel = async (page: Page) => {
  await openEntryDrawer(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Cartão" }).click();
  await dialog.getByRole("button", { name: "+ Novo cartão" }).click();
  await dialog.getByLabel("Nome do cartão").waitFor();
};

const G3_STATES: ScreenDef[] = [
  {
    name: "G3 atualizando / resumo e painel de Despesas (troca de mes)",
    scenario: "default",
    url: ENTRIES_URL,
    holdsQueries: true,
    prepare: async (page) => {
      await setScenario("default", { holdQueries: true });
      await nextMonth(page);
      await page.getByText("Atualizando…").first().waitFor();
    },
  },
  {
    name: "G3 atualizando / dashboard (troca de mes)",
    scenario: "default",
    url: `/dashboard?month=${MONTH}`,
    holdsQueries: true,
    prepare: async (page) => {
      await setScenario("default", { holdQueries: true });
      await nextMonth(page);
      await page.getByText("Atualizando…").first().waitFor();
    },
  },
  {
    name: "G3 banner 404 do lote",
    scenario: "batch404",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await confirmBatch(page);
      await page.getByRole("alertdialog").getByRole("button", { name: /Marcar como pago/ }).click();
      await page.getByRole("alert").filter({ hasText: "Nenhuma despesa foi alterada" }).waitFor();
    },
  },
  {
    name: "G3 banner 422 do lote",
    scenario: "batch422",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await confirmBatch(page);
      await page.getByRole("alertdialog").getByRole("button", { name: /Marcar como pago/ }).click();
      await page.getByRole("alert").filter({ hasText: /receita/i }).first().waitFor();
    },
  },
  { name: "G3 painel + Novo cartao aberto", scenario: "default", url: ENTRIES_URL, prepare: openNewCardPanel },
  {
    name: "G3 painel + Novo cartao com erro 409",
    scenario: "card-conflict",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await openNewCardPanel(page);
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Nome do cartão").fill("Nubank");
      await dialog.getByLabel("Dia de fechamento").fill("3");
      await dialog.getByLabel("Dia de vencimento").fill("10");
      await dialog.getByRole("button", { name: /Criar cartão|Salvar cartão/ }).click();
      await dialog.getByText("Já existe um cartão com esse nome.").waitFor();
    },
  },
  {
    name: "G3 drawer de cartao (criar)",
    scenario: "default",
    url: "/cards",
    prepare: async (page) => {
      await page.getByRole("button", { name: "Novo cartão" }).first().click();
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    name: "G3 drawer de cartao (editar, com aviso de nao retroatividade)",
    scenario: "default",
    url: "/cards",
    prepare: async (page) => {
      await page.getByRole("button", { name: "Editar Nubank" }).click();
      await page.getByRole("dialog", { name: "Editar cartão" }).waitFor();
    },
  },
  {
    name: "G3 drawer de cartao com erro 409",
    scenario: "card-conflict",
    url: "/cards",
    prepare: async (page) => {
      await page.getByRole("button", { name: "Novo cartão" }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Nome do cartão").fill("Nubank");
      await dialog.getByLabel("Dia de fechamento").fill("3");
      await dialog.getByLabel("Dia de vencimento").fill("10");
      await dialog.getByRole("button", { name: "Criar cartão" }).click();
      await dialog.getByText("Já existe um cartão com esse nome.").waitFor();
    },
  },
  {
    name: "G3 modal de confirmacao (lote)",
    scenario: "default",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await confirmBatch(page);
      await page.getByRole("alertdialog").waitFor();
    },
  },
  {
    name: "G3 modal de confirmacao (individual)",
    scenario: "default",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await page.getByRole("button", { name: "Marcar Internet como pago" }).click();
      await page.getByRole("alertdialog").waitFor();
    },
  },
  {
    name: "G3 modal de confirmacao (Pagar fatura)",
    scenario: "default",
    url: `${ENTRIES_URL}&tab=invoices`,
    prepare: async (page) => {
      await page.getByRole("group", { name: /Nubank/ }).getByRole("button", { name: "Pagar fatura" }).click();
      await page.getByRole("alertdialog").waitFor();
    },
  },
  {
    name: "G3 folha de filtros mobile (360px)",
    scenario: "default",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.getByRole("button", { name: /^Filtros/ }).click();
      await page.getByRole("dialog", { name: "Filtros" }).waitFor();
    },
  },
  {
    name: "G3 toast de sucesso",
    scenario: "default",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await confirmBatch(page);
      await page.getByRole("alertdialog").getByRole("button", { name: /Marcar como pago/ }).click();
      await page.getByRole("status").filter({ hasText: /pag/i }).first().waitFor();
    },
  },
  {
    name: "G3 toast com acao (lancamento fora da tela)",
    scenario: "default",
    url: ENTRIES_URL,
    prepare: async (page) => {
      await openEntryDrawer(page);
      await fillEntry(page, "2026-12-10");
      await page.getByRole("dialog").getByRole("button", { name: "Salvar lançamento" }).click();
      await page.getByRole("status").filter({ has: page.getByRole("link").or(page.getByRole("button")) }).first().waitFor();
    },
  },
  {
    name: "G3 dashboard com tooltip do grafico de barras aberto",
    scenario: "default",
    url: `/dashboard?month=${MONTH}`,
    prepare: async (page) => {
      await showChartTooltip(page);
    },
  },
  {
    name: "G3 dashboard com tabelas alternativas visiveis",
    scenario: "default",
    url: `/dashboard?month=${MONTH}`,
    prepare: async (page) => {
      for (const button of await page.getByRole("button", { name: "Tabela", exact: true }).all()) await button.click();
      await page.getByRole("group", { name: "Tabela da evolução mensal" }).waitFor();
    },
  },
];

const SCREENS: ScreenDef[] = [
  { name: "lancamentos / Despesas com dados", scenario: "default", url: ENTRIES_URL },
  { name: "lancamentos / Despesas vazia", scenario: "empty", url: ENTRIES_URL },
  { name: "lancamentos / Despesas com erro", scenario: "error500", url: ENTRIES_URL },
  { name: "lancamentos / Faturas", scenario: "default", url: `${ENTRIES_URL}&tab=invoices` },
  {
    name: "lancamentos / Faturas com bloco expandido",
    scenario: "default",
    url: `${ENTRIES_URL}&tab=invoices`,
    prepare: async (page) => {
      await page.getByRole("group", { name: /Nubank/ }).getByRole("button", { name: /despesas/i }).click();
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
  {
    name: "drawer com combobox de categoria aberto",
    scenario: "default",
    url: ENTRIES_URL,
    overlays: ['[role="listbox"]'], // a lista cobre Data/Valor; esses campos sao auditados sem a lista em "drawer de novo lancamento"
    prepare: async (page) => {
      await page.getByRole("button", { name: /Novo lançamento/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("combobox", { name: /Categoria/ }).focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await dialog.getByRole("listbox").waitFor();
    },
  },
  {
    name: "lancamentos / linha recem-criada (destaque e selo Novo)",
    scenario: "default",
    url: `${ENTRIES_URL}&d_status=ALL`, // "Todos": a despesa recem-criada (paga) nao aparece sob o padrao Pendente
    prepare: async (page) => {
      await page.getByRole("button", { name: /Novo lançamento/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Descrição").fill("Padaria");
      await dialog.getByRole("combobox", { name: /Categoria/ }).fill("Alimentação");
      await dialog.getByLabel("Data").fill("2026-11-12");
      await dialog.getByLabel("Valor").fill("12,50");
      await dialog.getByRole("button", { name: /Salvar/ }).click();
      await page.locator('[data-recent="true"]').first().waitFor();
    },
  },
  { name: "dashboard com grafico estreito (360px)", scenario: "default", url: `/dashboard?month=${MONTH}`, prepare: async (page) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.waitForLoadState("networkidle");
    },
  },
  { name: "cartoes com dados", scenario: "default", url: "/cards" },
  { name: "cartoes vazia", scenario: "empty", url: "/cards" },
  { name: "dashboard com dados", scenario: "default", url: `/dashboard?month=${MONTH}` },
  { name: "dashboard vazio", scenario: "empty", url: `/dashboard?month=${MONTH}` },
  { name: "dashboard com erro", scenario: "error500", url: `/dashboard?month=${MONTH}` },
  ...G3_STATES,
];

for (const theme of THEMES) {
  test.describe(`axe - tema ${theme}`, () => {
    for (const screen of SCREENS) {
      test(screen.name, async ({ context, page }) => {
        await setScenario(screen.scenario);
        await setThemeCookie(context, theme);
        await page.goto(screen.url);
        await page.waitForLoadState("networkidle");
        try {
          await screen.prepare?.(page);
          // a faixa de abas de /entries pinta o gradiente (.page-bg-window): regiao declarada, resolvida pelo pior caso (ADR 0003 5.5)
          await audit(page, `${screen.name} [${theme}]`, { overlays: screen.overlays, gradients: [PAGE_BG_REGION] });
          await auditPageGradient(page, `${screen.name} [${theme}]`);
          if (screen.holdsQueries) await expect(page.getByText("Atualizando…").first(), "o estado atualizando deve durar ate o fim do audit").toBeVisible();
        } finally {
          if (screen.holdsQueries) await releaseMutations().catch(() => undefined);
        }
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
      await audit(page, `/entries sistema ${scheme}`, { gradients: [PAGE_BG_REGION] });
      await auditPageGradient(page, `/entries sistema ${scheme}`);
    });
  }
});
