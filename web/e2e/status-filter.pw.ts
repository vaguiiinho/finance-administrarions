import { type Page } from "@playwright/test";
import { expect, test } from "./auth-support";
import { signInAsAna } from "./legacy-auth";
import { PAGE_BG_REGION, audit, gotoReady, setScenario, setThemeCookie } from "./support";
import { cardExpense, currentMonthSP, income, longMonth, monthFromNow, pixExpense, stubCard, seedData } from "./entries-data";

/**
 * Status padrao "Pendente" em Despesas e Faturas (ADR 0007; spec CA31-CA61). Dados do cenario `custom` do stub, relativos ao
 * mes real M (a tela abre com `month` explicito, entao a regra do mes inicial nao interfere).
 */
test.beforeEach(async ({ page }) => {
  await signInAsAna(page);
});

const M = () => currentMonthSP();
const url = (extra = "", month = M()) => `/entries?month=${month}${extra}`;
const azul = stubCard(1, "Azul", 10, 17);
const roxo = stubCard(2, "Roxo", 25, 5);
const verde = stubCard(3, "Verde", 25, 20);
const param = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);
const radio = (page: Page, name: string) => page.getByRole("radio", { name });
const subtotal = (page: Page) => page.getByTestId("subtotal");
const panelTitle = (page: Page) => page.locator("#entries-panel-title");
/**
 * Linhas (tabela) ou cards (< md) VISIVEIS cuja descricao exibida casa com `re`. Conta uma vez por despesa: o `span.sr-only`
 * ": <descricao>" dentro do botao de pagar tambem casaria com getByText e dobraria a contagem (adendo de design 1.2).
 */
const rowsOf = (page: Page, re: RegExp) =>
  page
    .locator("tr[data-entry-id], li[data-entry-id]")
    .filter({ visible: true })
    .filter({ has: page.locator("span.truncate").filter({ hasText: re }) });
const MOBILE = { width: 360, height: 800 };

/** CA31: 3 despesas PENDENTES (R$ 300,00) e 2 PAGAS (R$ 200,00) em M. */
const despesas = () => [
  pixExpense(1, M(), { description: "Pendente A", amount: "100.00" }),
  pixExpense(2, M(), { description: "Pendente B", amount: "100.00" }),
  pixExpense(3, M(), { description: "Pendente C", amount: "100.00" }),
  pixExpense(4, M(), { description: "Paga A", amount: "100.00", status: "PAID" }),
  pixExpense(5, M(), { description: "Paga B", amount: "100.00", status: "PAID" }),
];

/** Cenario-base de Faturas: Azul parcial (1 PAGO + 1 PENDENTE), Roxo totalmente paga. */
const faturas = () => ({
  cards: [azul, roxo],
  entries: [
    cardExpense(11, azul, M(), { description: "Azul paga", amount: "100.00", status: "PAID" }),
    cardExpense(12, azul, M(), { description: "Azul pendente", amount: "60.00" }),
    cardExpense(13, roxo, M(), { description: "Roxo paga", amount: "70.00", status: "PAID" }),
  ],
});

test.describe("Despesas: padrao Pendente (CA31-CA44, CA60, CA61)", () => {
  test("CA31/CA32: 'Pendente' selecionado, 3 itens, subtotal do filtro; o resumo do mes continua com R$ 500,00", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await expect(radio(page, "Pendente")).toBeChecked();
    await expect(rowsOf(page, /Pendente [ABC]/)).toHaveCount(3);
    await expect(rowsOf(page, /Paga [AB]/)).toHaveCount(0);
    await expect(subtotal(page)).toContainText("com os filtros aplicados");
    await expect(subtotal(page)).toContainText("3 despesas");
    await expect(subtotal(page)).toContainText(/Total\s*R\$\s*300,00/);
    await expect(subtotal(page)).toContainText(/Pago\s*R\$\s*0,00/);
    await expect(subtotal(page)).toContainText(/Pendente\s*R\$\s*300,00/);
    await expect(page.getByRole("region", { name: /Resumo de/ })).toContainText(/R\$\s*500,00/);
    await expect(page.getByRole("region", { name: /Resumo de/ })).toContainText(/R\$\s*200,00/);
  });

  test("CA33: 'Todos' fica na URL e nao e sobrescrito ao recarregar, trocar de mes, de aba e voltar", async ({ page }) => {
    await seedData({ cards: [azul], entries: despesas() });
    await gotoReady(page, url());
    await radio(page, "Todos").click();
    await expect(page).toHaveURL(/d_status=ALL/);
    await expect(rowsOf(page, /Paga A/)).toHaveCount(1);
    await expect(rowsOf(page, /Pendente A/)).toHaveCount(1);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(radio(page, "Todos")).toBeChecked();
    await page.getByRole("button", { name: "Próximo mês" }).first().click();
    await expect(page).toHaveURL(/d_status=ALL/);
    await expect(radio(page, "Todos")).toBeChecked();
    await page.getByRole("button", { name: "Mês anterior" }).first().click();
    await page.getByRole("tab", { name: "Faturas" }).click();
    await page.getByRole("tab", { name: "Despesas" }).click();
    await expect(radio(page, "Todos")).toBeChecked();
    await expect(rowsOf(page, /Paga A/)).toHaveCount(1);
    await expect(rowsOf(page, /Pendente A/)).toHaveCount(1);
  });

  test("CA34: 'Pago' fica registrado e sobrevive a recarregar e a trocar de mes", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await radio(page, "Pago").click();
    await expect(page).toHaveURL(/d_status=PAID/);
    await expect(rowsOf(page, /Paga [AB]/)).toHaveCount(2);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(radio(page, "Pago")).toBeChecked();
    await page.getByRole("button", { name: "Próximo mês" }).first().click();
    await expect(radio(page, "Pago")).toBeChecked();
  });

  test("CA35: d_status=PAID abre em Pago; valor invalido (pending) vale Pendente", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url("&d_status=PAID"));
    await expect(radio(page, "Pago")).toBeChecked();
    await gotoReady(page, url("&d_status=pending"));
    await expect(radio(page, "Pendente")).toBeChecked();
  });

  test("CA36: 'Limpar filtros' (desktop) leva a Todos, lista tudo, o subtotal vira 'todas as despesas do mes', o botao some e o foco vai ao h2", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(radio(page, "Todos")).toBeChecked();
    await expect(rowsOf(page, /(Pendente|Paga) [ABC]/)).toHaveCount(5);
    await expect(subtotal(page)).toContainText("todas as despesas do mês");
    await expect(page.getByRole("button", { name: "Limpar filtros" })).toHaveCount(0);
    await expect(panelTitle(page)).toBeFocused();
  });

  test("CA37: folha no mobile - 'Filtros (1)', selecionar Todos e Aplicar -> 'Filtros' sem contador e lista completa", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await page.getByRole("button", { name: "Filtros (1)" }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByRole("radio", { name: "Todos" }).click();
    await sheet.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByRole("button", { name: "Filtros", exact: true })).toBeVisible();
    await expect(rowsOf(page, /(Pendente|Paga) [ABC]/).first()).toBeVisible();
    await expect(rowsOf(page, /(Pendente|Paga) [ABC]/)).toHaveCount(5);
  });

  test("CA37: folha no mobile - 'Limpar' + Aplicar tem o mesmo efeito", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await page.getByRole("button", { name: "Filtros (1)" }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByRole("button", { name: "Limpar" }).click();
    await expect(page).not.toHaveURL(/d_status=ALL/); // so o rascunho muda
    await sheet.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/d_status=ALL/);
    await expect(page.getByRole("button", { name: "Filtros", exact: true })).toBeVisible();
    await expect(rowsOf(page, /(Pendente|Paga) [ABC]/)).toHaveCount(5);
  });

  test("CA38: mes so com despesas pagas -> vazio com filtros; 'Limpar filtros' mostra as pagas", async ({ page }) => {
    await seedData({ cards: [], entries: [pixExpense(1, M(), { description: "Paga A", status: "PAID" })] });
    await gotoReady(page, url());
    await expect(page.getByText(`Nenhuma despesa para os filtros selecionados em ${longMonth(M())}`)).toBeVisible();
    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page.getByText("Paga A").filter({ visible: true })).toBeVisible();
  });

  test("CA39: mes sem despesas -> vazio com filtros e, depois de limpar, 'Nenhuma despesa em <mes>'", async ({ page }) => {
    await seedData({ cards: [], entries: [] });
    await gotoReady(page, url());
    await expect(page.getByText(`Nenhuma despesa para os filtros selecionados em ${longMonth(M())}`)).toBeVisible();
    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page.getByText(`Nenhuma despesa em ${longMonth(M())}`)).toBeVisible();
  });

  async function createPixPaid(page: Page, description: string, date: string) {
    await page.getByRole("button", { name: /Novo lançamento/ }).first().click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel("Descrição").fill(description);
    await drawer.getByRole("combobox", { name: /Categoria/ }).fill("Alimentação");
    await drawer.getByLabel("Data").fill(date);
    await drawer.getByLabel("Valor").fill("12,50");
    await drawer.getByRole("button", { name: /Salvar/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  test("CA40: criar despesa PIX paga sob o padrao -> toast 'nao aparece nos filtros atuais' + 'Limpar filtros' que a mostra", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await createPixPaid(page, "Padaria nova", `${M()}-12`);
    const toast = page.getByRole("status").filter({ hasText: "Ela não aparece nos filtros atuais" });
    await expect(toast).toBeVisible();
    await expect(page.getByText("Padaria nova")).toHaveCount(0); // sem destaque de recem-criado: ela nem esta na lista
    await toast.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page.getByText("Padaria nova").filter({ visible: true })).toBeVisible();
    expect(param(page, "d_status")).toBe("ALL");
  });

  test("CA41: sob o padrao em M+1, criar PIX paga de M -> toast com 'Ver <mes>' que abre M com a despesa visivel", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url("", monthFromNow(1)));
    await createPixPaid(page, "Padaria do mes anterior", `${M()}-12`);
    const first = longMonth(M()).split(" ")[0];
    await page.getByRole("status").getByRole("link", { name: `Ver ${first}` }).click();
    await page.waitForURL((u) => u.searchParams.get("month") === M());
    expect(param(page, "d_status")).toBe("ALL");
    await expect(page.getByText("Padaria do mes anterior").filter({ visible: true })).toBeVisible();
  });

  test("CA42: pagar uma despesa sob o padrao -> ela sai da lista e os totais se atualizam", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Pendente A$/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pago" }).click();
    await expect(page.getByText("Pendente A", { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expect(subtotal(page)).toContainText("2 despesas");
    await expect(subtotal(page)).toContainText(/Total\s*R\$\s*200,00/);
  });

  test("CA61: o foco vai para o h2 do painel apos pagar individualmente (nao em body), e tambem para a ULTIMA da lista", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Pendente A$/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pago" }).click();
    await expect(page.getByText("Pendente A", { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expect(panelTitle(page)).toBeFocused();

    await seedData({ cards: [], entries: [pixExpense(1, M(), { description: "Ultima" })] });
    await gotoReady(page, url());
    await page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Ultima$/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pago" }).click();
    await expect(page.getByText("Ultima", { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expect(panelTitle(page)).toBeFocused();
  });

  test("RF24: o pagamento em LOTE mantem o foco atual (h2 do painel)", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url());
    await page.getByRole("checkbox", { name: /Pendente A/ }).check();
    await page.getByRole("button", { name: /^Marcar como pago( \(\d+\))?$/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Marcar como pago/ }).click();
    await expect(page.getByText("Pendente A")).toHaveCount(0);
    await expect(panelTitle(page)).toBeFocused();
  });

  test("CA61 sob 'Todos': a linha permanece e o foco fica na propria linha/card (design 6.2)", async ({ page }) => {
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url("&d_status=ALL"));
    // por teclado: com clique de mouse o navegador nao aplica :focus-visible ao foco por codigo, e o anel nao apareceria
    const trigger = page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Pendente A$/ }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pago" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Pendente A").first()).toBeVisible();
    await expect(panelTitle(page)).not.toBeFocused();
    // design 6.2: sob "Todos" o foco fica na propria linha (alvo estavel), mesmo depois de o gatilho sumir na revalidacao
    const row = page.locator('tr[data-entry-id]').filter({ hasText: "Pendente A" });
    await expect(row).toBeFocused();
    await expect(page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Pendente A$/ })).toHaveCount(0);
    await expect(row).toBeFocused();
    // o anel nao pode ser cortado pelo overflow-clip do wrapper: fica por dentro da linha
    await expect(row).toHaveCSS("outline-offset", "-2px");
    await expect(row).not.toHaveCSS("outline-style", "none");
  });

  test("CA61 sob 'Todos' (mobile 360x800): o card permanece e fica focado antes e depois de o gatilho sumir", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedData({ cards: [], entries: despesas() });
    await gotoReady(page, url("&d_status=ALL"));
    await page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Pendente A$/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pago" }).click();
    const card = page.locator("li[data-entry-id]").filter({ hasText: "Pendente A" });
    await expect(card).toBeVisible();
    await expect(card).toBeFocused();
    await expect(page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Pendente A$/ })).toHaveCount(0);
    await expect(card).toBeFocused();
    await expect(panelTitle(page)).not.toBeFocused();
  });

  test("CA43: links sem status explicito (/cards 'Ver despesas', dashboard 'Ver lancamentos do mes') abrem com Pendente", async ({ page }) => {
    await seedData({ cards: [azul], entries: despesas() });
    await gotoReady(page, "/cards");
    await page.getByRole("link", { name: /^Ver despesas de Azul/ }).click();
    await page.waitForURL(/\/entries\?/);
    await expect(radio(page, "Pendente")).toBeChecked();
    await gotoReady(page, `/dashboard?month=${M()}`);
    await page.getByRole("link", { name: "Ver lançamentos do mês" }).click();
    await page.waitForURL(/\/entries\?/);
    await expect(radio(page, "Pendente")).toBeChecked();
  });

  test("CA44: Receitas nao tem filtro de status e lista todas as receitas", async ({ page }) => {
    await seedData({ cards: [], entries: [...despesas(), income(20, M(), { description: "Salario do mes" })] });
    await gotoReady(page, url("&tab=income"));
    await expect(page.getByText("Salario do mes").first()).toBeVisible();
    await expect(page.getByRole("radio", { name: "Pendente" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Pago" })).toHaveCount(0);
  });

  test("CA60: abaixo de md, 'Status: ...' aparece fora da folha nas duas abas e reflete so o status APLICADO; em >= md nao aparece", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedData({ ...faturas(), entries: [...faturas().entries, ...despesas()] });
    await gotoReady(page, url());
    await expect(page.getByText("Status: Pendente")).toBeVisible();
    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(page.getByText("Status: Pendente")).toBeVisible();

    await page.getByRole("button", { name: "Filtros (1)" }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByRole("radio", { name: "Pago" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Status: Pendente")).toBeVisible();

    await page.getByRole("tab", { name: "Despesas" }).click();
    await expect(page.getByText("Status: Pendente")).toBeVisible();
    await page.getByRole("button", { name: "Filtros (1)" }).click();
    await page.getByRole("dialog", { name: "Filtros" }).getByRole("radio", { name: "Todos" }).click();
    await page.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("Status: Todos")).toBeVisible();
    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(page.getByText("Status: Pendente")).toBeVisible(); // so a aba em que o filtro foi aplicado muda

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByText(/^Status: /)).toBeHidden();
  });
});

test.describe("Faturas: filtro de status (CA45-CA59)", () => {
  const invoicesUrl = (extra = "", month = M()) => url(`&tab=invoices${extra}`, month);
  const block = (page: Page, name: string) => page.getByRole("group", { name: new RegExp(name) });

  test("CA45: padrao 'Pendente' mostra so o Azul (parcial), contagem '1 fatura'", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl());
    await expect(radio(page, "Pendente")).toBeChecked();
    await expect(block(page, "Azul")).toBeVisible();
    await expect(block(page, "Roxo")).toHaveCount(0);
    await expect(page.getByText("1 fatura.")).toBeVisible();
  });

  test("CA46: a fatura parcial mantem o conteudo inteiro (2 despesas, totais da fatura) mesmo sob Pendente", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl());
    await expect(block(page, "Azul")).toContainText(/Total\s*R\$\s*160,00/);
    await block(page, "Azul").getByRole("button", { name: /^Ver 2 despesas/ }).click();
    await expect(block(page, "Azul").getByText("Azul paga")).toBeVisible();
    await expect(block(page, "Azul").getByText("Azul pendente")).toBeVisible();
  });

  test("CA47: 'Pago' mostra so o Roxo; 'Todos' mostra os dois, em ordem de vencimento", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl());
    await radio(page, "Pago").click();
    await expect(page).toHaveURL(/f_status=PAID/);
    await expect(block(page, "Roxo")).toBeVisible();
    await expect(block(page, "Azul")).toHaveCount(0);
    await radio(page, "Todos").click();
    await expect(page).toHaveURL(/f_status=ALL/);
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(["Roxo", "Azul"]); // Roxo vence dia 5, Azul dia 17
  });

  test("CA48: 'Todos' em Faturas nao e sobrescrito ao recarregar, trocar de mes, ir a Despesas e voltar", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl());
    await radio(page, "Todos").click();
    await expect(page).toHaveURL(/f_status=ALL/); // a troca de filtro e uma transicao: recarregar antes dela perderia o parametro
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(radio(page, "Todos")).toBeChecked();
    await page.getByRole("button", { name: "Próximo mês" }).first().click();
    await expect(radio(page, "Todos")).toBeChecked();
    await page.getByRole("button", { name: "Mês anterior" }).first().click();
    await page.getByRole("tab", { name: "Despesas" }).click();
    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(radio(page, "Todos")).toBeChecked();
  });

  test("CA49: filtros independentes - Despesas segue 'Pendente' e 'Pago' em Despesas nao altera o 'Todos' de Faturas", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl("&f_status=ALL"));
    await page.getByRole("tab", { name: "Despesas" }).click();
    await expect(radio(page, "Pendente")).toBeChecked();
    await radio(page, "Pago").click();
    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(radio(page, "Todos")).toBeChecked();
    expect(param(page, "d_status")).toBe("PAID");
  });

  test("CA50: f_status invalido -> Pendente, sem erro", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl("&f_status=lixo"));
    await expect(radio(page, "Pendente")).toBeChecked();
    await expect(block(page, "Azul")).toBeVisible();
    await expect(page.getByText("Não foi possível carregar as faturas.")).toHaveCount(0);
  });

  test("CA51: 'Limpar filtros' (desktop) leva a Todos, mostra os dois blocos, o botao some e mes/aba nao mudam", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl());
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(radio(page, "Todos")).toBeChecked();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Limpar filtros" })).toHaveCount(0);
    expect([param(page, "month"), param(page, "tab")]).toEqual([M(), "invoices"]);
    await expect(panelTitle(page)).toBeFocused();
  });

  test("CA51 (mobile): o botao 'Limpar' e a folha de filtros levam a Todos", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedData(faturas());
    await gotoReady(page, invoicesUrl());
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
    await gotoReady(page, invoicesUrl());
    await page.getByRole("button", { name: "Filtros (1)" }).click();
    await page.getByRole("dialog", { name: "Filtros" }).getByRole("radio", { name: "Todos" }).click();
    await page.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Filtros", exact: true })).toBeVisible();
  });

  test("CA52: com cartao e so faturas pagas, o padrao mostra o vazio com filtros; 'Limpar filtros' mostra as pagas", async ({ page }) => {
    await seedData({ cards: [roxo], entries: [cardExpense(13, roxo, M(), { status: "PAID" })] });
    await gotoReady(page, invoicesUrl());
    await expect(page.getByText(`Nenhuma fatura para os filtros selecionados em ${longMonth(M())}`)).toBeVisible();
    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(block(page, "Roxo")).toBeVisible();
  });

  test("CA53: mes sem faturas, com cartao -> vazio com filtros e, depois de limpar, 'Nenhuma fatura neste mes'", async ({ page }) => {
    await seedData({ cards: [roxo], entries: [] });
    await gotoReady(page, invoicesUrl());
    await expect(page.getByText(`Nenhuma fatura para os filtros selecionados em ${longMonth(M())}`)).toBeVisible();
    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page.getByText("Nenhuma fatura neste mês")).toBeVisible();
    await expect(page.getByRole("link", { name: "Cadastrar cartão" })).toHaveCount(0);
  });

  for (const viewport of [{ width: 1280, height: 800 }, MOBILE]) {
    for (const extra of ["", "&f_status=PAID", "&f_status=ALL"]) {
      test(`CA54: sem cartao (${viewport.width}px, ${extra || "sem f_status"}) -> sem filtro, sem 'Limpar', sem 'Filtros', sem 'Status:'`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await seedData({ cards: [], entries: [pixExpense(1, M())] });
        await gotoReady(page, invoicesUrl(extra));
        await expect(page.getByText("Nenhuma fatura neste mês")).toBeVisible();
        await expect(page.getByRole("link", { name: "Cadastrar cartão" })).toBeVisible();
        await expect(page.getByRole("radio")).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Limpar/ })).toHaveCount(0);
        await expect(page.getByRole("link", { name: /Limpar/ })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /^Filtros/ })).toHaveCount(0);
        await expect(page.getByText(/^Status:/)).toHaveCount(0);
        await expect(page.getByText(/para os filtros selecionados/)).toHaveCount(0);
      });
    }
  }

  async function payFirst(page: Page, name: string) {
    await block(page, name).getByRole("button", { name: /Pagar fatura/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Pagar fatura" }).click();
  }

  test("CA55: pagar sob 'Pendente' -> a fatura sai, a outra permanece, o toast aparece e o foco vai ao h2 do painel", async ({ page }) => {
    await seedData({
      cards: [azul, verde],
      entries: [cardExpense(11, azul, M(), { description: "Azul pendente", amount: "60.00" }), cardExpense(14, verde, M(), { description: "Verde pendente", amount: "30.00" })],
    });
    await gotoReady(page, invoicesUrl());
    await payFirst(page, "Azul");
    await expect(page.getByText(/Fatura Azul de .* paga/)).toBeVisible();
    await expect(block(page, "Azul")).toHaveCount(0);
    await expect(block(page, "Verde")).toBeVisible();
    await expect(panelTitle(page)).toBeFocused();
  });

  test("CA56: pagar sob 'Todos' -> o bloco permanece com 'Fatura paga' e o foco fica no titulo do bloco", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl("&f_status=ALL"));
    await payFirst(page, "Azul");
    await expect(block(page, "Azul")).toContainText("Fatura paga");
    await expect(block(page, "Azul").getByRole("heading", { level: 3, name: "Azul" })).toBeFocused();
  });

  test("CA57: sob 'Pago', criar compra no cartao com fatura em M -> toast 'nao aparece' + 'Limpar filtros' que leva a uma lista onde a fatura aparece", async ({ page }) => {
    await seedData({ cards: [roxo], entries: [cardExpense(13, roxo, M(), { description: "Antiga paga", status: "PAID" })] });
    await gotoReady(page, invoicesUrl("&f_status=PAID"));
    await expect(block(page, "Roxo")).toBeVisible();
    await page.getByRole("button", { name: /Novo lançamento/ }).first().click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel("Descrição").fill("Compra nova");
    await drawer.getByRole("combobox", { name: /Categoria/ }).fill("Alimentação");
    await drawer.getByLabel("Data").fill(`${monthFromNow(-1)}-10`); // fecha dia 25 / vence dia 5 -> fatura de M
    await drawer.getByLabel("Valor").fill("12,50");
    await drawer.getByRole("radio", { name: "Cartão" }).click();
    await drawer.getByLabel(/^Cartão/).selectOption({ label: "Roxo · fecha 25 · vence 5" });
    await drawer.getByRole("button", { name: /Salvar/ }).click();
    const toast = page.getByRole("status").filter({ hasText: "Ela não aparece nos filtros atuais" });
    await expect(toast).toBeVisible();
    await toast.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/f_status=ALL/);
    expect(param(page, "tab")).toBe("invoices");
    await expect(block(page, "Roxo")).toContainText(/Pendente\s*R\$\s*12,50/);
  });

  test("CA58: atalho do bloco para Despesas - fatura parcial mantem rotulo e status vigente; fatura paga abre em Todos com rotulo novo", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl("&f_status=ALL&d_status=PAID"));
    await block(page, "Azul").getByRole("button", { name: /^Ver 2 despesas/ }).click();
    await block(page, "Roxo").getByRole("button", { name: /^Ver 1 despesa/ }).click();
    const azulLink = block(page, "Azul").getByRole("link", { name: "Pagar despesas individualmente na aba Despesas" });
    const roxoLink = block(page, "Roxo").getByRole("link", { name: "Ver despesas do cartão na aba Despesas" });
    await expect(azulLink).toBeVisible();
    await expect(roxoLink).toBeVisible();
    await expect(block(page, "Roxo").getByRole("link", { name: /Pagar despesas/ })).toHaveCount(0);

    await azulLink.click();
    await page.waitForURL((u) => u.searchParams.get("d_card") === azul.id);
    expect([param(page, "month"), param(page, "d_status")]).toEqual([M(), "PAID"]);
    await expect(radio(page, "Pago")).toBeChecked();

    await page.goBack();
    await page.waitForLoadState("networkidle");
    await block(page, "Roxo").getByRole("button", { name: /^Ver 1 despesa/ }).click();
    await block(page, "Roxo").getByRole("link", { name: "Ver despesas do cartão na aba Despesas" }).click();
    await page.waitForURL((u) => u.searchParams.get("d_card") === roxo.id);
    expect(param(page, "d_status")).toBe("ALL");
    await expect(radio(page, "Todos")).toBeChecked();
    await expect(page.getByText("Roxo paga").filter({ visible: true })).toBeVisible();
    expect(param(page, "tab")).toBeNull();
  });

  test("CA58: ao pagar o Azul sob 'Todos', o atalho dele passa ao rotulo e ao destino da fatura paga", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, invoicesUrl("&f_status=ALL&d_status=PAID"));
    await block(page, "Azul").getByRole("button", { name: /^Ver 2 despesas/ }).click();
    await expect(block(page, "Azul").getByRole("link", { name: "Pagar despesas individualmente na aba Despesas" })).toBeVisible();
    await payFirst(page, "Azul");
    const link = block(page, "Azul").getByRole("link", { name: "Ver despesas do cartão na aba Despesas" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /d_status=ALL/);
  });

  test("CA59: demo - alternar Pendente / Pago / Todos segue o filtro e nao ha 'Pagar fatura'", async ({ page }) => {
    await setScenario("default");
    await gotoReady(page, `/demo/entries?month=${M()}&tab=invoices`);
    await expect(radio(page, "Pendente")).toBeChecked();
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible(); // a fatura demo tem pendencia
    await radio(page, "Pago").click();
    await expect(page.getByText(`Nenhuma fatura para os filtros selecionados em ${longMonth(M())}`)).toBeVisible();
    await radio(page, "Todos").click();
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Pagar fatura/ })).toHaveCount(0);
    await expect(page).toHaveURL(/\/demo\/entries/);
  });
});

test.describe("acessibilidade do filtro de status (RNF06; design 14)", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`axe [${theme}] Despesas e Faturas, desktop e mobile (folha aberta e linha 'Status:')`, async ({ page, context }) => {
      await setThemeCookie(context, theme);
      await seedData({ ...faturas(), entries: [...faturas().entries, ...despesas()] });
      await gotoReady(page, url());
      await audit(page, `Despesas padrao ${theme}`, { gradients: [PAGE_BG_REGION] });
      await gotoReady(page, url("&tab=invoices"));
      await audit(page, `Faturas padrao ${theme}`, { gradients: [PAGE_BG_REGION] });
      await gotoReady(page, url("&tab=invoices&f_status=PAID"));
      await audit(page, `Faturas vazio com filtros ${theme}`, { gradients: [PAGE_BG_REGION] });
      await page.setViewportSize(MOBILE);
      await gotoReady(page, url("&tab=invoices"));
      await audit(page, `Faturas mobile Status ${theme}`, { gradients: [PAGE_BG_REGION] });
      await page.getByRole("button", { name: "Filtros (1)" }).click();
      await audit(page, `Faturas folha de filtros ${theme}`, { gradients: [PAGE_BG_REGION] });
    });
  }

  test("o controle de status e um radiogroup rotulado 'Status' e as setas movem e selecionam", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, url("&tab=invoices"));
    await expect(page.getByRole("radiogroup", { name: "Status" })).toBeVisible();
    await radio(page, "Pendente").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/f_status=PAID/);
    await expect(radio(page, "Pago")).toBeChecked();
  });

  test("a regiao polite do painel de Faturas anuncia a contagem filtrada, tambem no vazio", async ({ page }) => {
    await seedData(faturas());
    await gotoReady(page, url("&tab=invoices"));
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: `Mostrando 1 fatura de ${longMonth(M())}, pendentes` })).toHaveCount(1);
    await radio(page, "Todos").click();
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: `Mostrando 2 faturas de ${longMonth(M())}` })).toHaveCount(1);
    await seedData({ cards: [roxo], entries: [] });
    await gotoReady(page, url("&tab=invoices"));
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: `Nenhuma fatura de ${longMonth(M())}, pendentes` })).toHaveCount(1);
  });
});
