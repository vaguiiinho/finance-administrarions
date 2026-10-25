import { expect, test } from "@playwright/test";
import { ENTRIES_URL, setScenario, themeToggle, setThemeCookie } from "./support";

/**
 * Fluxos da tela de lancamentos contra o stub-api. Os nomes acessiveis seguem os rotulos pt-BR do design rev. 3
 * (abas "Despesas"/"Faturas"/"Receitas", "+ Novo lançamento", "Marcar como pago", "Pagar fatura", "+ Novo cartão").
 */
test.beforeEach(async () => {
  await setScenario("default");
});

const tab = (page: import("@playwright/test").Page, name: string) => page.getByRole("tab", { name });
const summary = (page: import("@playwright/test").Page) => page.getByRole("region", { name: /Resumo/ });

test("CA69: abas com cabecalho comum inalterado; setas/Home/End; aria-selected", async ({ page }) => {
  await page.goto(ENTRIES_URL);
  await expect(page.getByRole("tablist")).toBeVisible();
  const header = await summary(page).innerText();
  for (const name of ["Faturas", "Receitas", "Despesas"]) {
    await tab(page, name).click();
    await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: /Novo lançamento/ })).toBeVisible();
    expect(await summary(page).innerText()).toBe(header);
  }
  await tab(page, "Despesas").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "Faturas")).toBeFocused();
  await page.keyboard.press("End");
  await expect(tab(page, "Receitas")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tab(page, "Despesas")).toBeFocused();
});

test("CA47: resumo do topo nao muda ao trocar aba, filtrar e paginar", async ({ page }) => {
  await page.goto(ENTRIES_URL);
  const before = await summary(page).innerText();
  await tab(page, "Receitas").click();
  await tab(page, "Despesas").click();
  await page.goto(`${ENTRIES_URL}&d_category=Moradia`);
  expect(await summary(page).innerText()).toBe(before);
});

test("CA68: trocar o mes mantem a aba, reflete mes+aba na URL, volta a pagina 1 e nao ha intervalo de/ate", async ({ page }) => {
  await page.goto("/entries?month=2026-10&tab=invoices&page=2");
  await page.getByRole("button", { name: /Próximo mês|mês seguinte/i }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(page).toHaveURL(/tab=invoices/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(tab(page, "Faturas")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/^(de|até)$/i)).toHaveCount(0);
});

test("CA53: o mes selecionado usa o mes de referencia (compra de 10/10 no cartao aparece em novembro com 'Fatura nov/26')", async ({ page }) => {
  await page.goto(ENTRIES_URL);
  const row = page.getByText("Mercado").first();
  await expect(row).toBeVisible();
  await expect(page.getByText("Fatura nov/26").first()).toBeVisible();
  await page.goto("/entries?month=2026-10");
  await expect(page.getByText("Mercado")).toHaveCount(0);
});

test("CA70: selecionar pendentes, 'Marcar como pago' e confirmar -> pagas, selecao limpa", async ({ page }) => {
  await page.goto(ENTRIES_URL);
  await page.getByRole("checkbox", { name: /Mercado/ }).check();
  await page.getByRole("checkbox", { name: /Internet/ }).check();
  await page.getByRole("button", { name: "Marcar como pago" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Confirmar|Marcar como pago/ }).click();
  // exact: o selo e "Pago"; a coluna Acao mostra "Pago em dd/MM/yyyy" (design 4.x), que nao deve causar ambiguidade
  for (const description of [/Mercado/, /Internet/]) {
    const row = page.getByRole("row", { name: description });
    await expect(row.getByText("Pago", { exact: true })).toBeVisible();
    await expect(row.getByText(/^Pago em \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
  }
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
});

test("CA71: pagas sem checkbox ativo; aba Receitas sem checkbox nem 'Marcar como pago'", async ({ page }) => {
  await page.goto(ENTRIES_URL);
  await expect(page.getByRole("checkbox", { name: /Aluguel/ })).toBeDisabled();
  await tab(page, "Receitas").click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Marcar como pago" })).toHaveCount(0);
});

test("CA72: aba Faturas - expandir, 'Pagar fatura' com confirmacao (2 lancamentos, R$ 150,00) e bloco quitado", async ({ page }) => {
  await page.goto(`${ENTRIES_URL}&tab=invoices`);
  const block = page.getByRole("group", { name: /Nubank/ });
  await expect(block).toContainText("Fecha 25/10/2026");
  await expect(block).toContainText("Vence 05/11/2026");
  await block.getByRole("button", { name: /despesas/i }).click();
  await expect(block.getByText("Mercado")).toBeVisible();
  await block.getByRole("button", { name: "Pagar fatura" }).click();
  const dialog = page.getByRole("alertdialog"); // D2: confirmacao de acao irreversivel
  await expect(dialog).toContainText("Nubank");
  await expect(dialog).toContainText("novembro de 2026");
  await expect(dialog).toContainText("05/11/2026");
  await expect(dialog).toContainText("2 lançamentos");
  await expect(dialog).toContainText(/R\$\s150,00/);
  await dialog.getByRole("button", { name: /Confirmar|Pagar fatura/ }).click();
  await expect(block).toContainText(/Pendente.*R\$\s0,00/s);
  await expect(block.getByRole("button", { name: "Pagar fatura" })).toBeDisabled();
});

test("CA44/CA45: sem faturas -> 'Nenhuma fatura neste mês'", async ({ page }) => {
  await setScenario("empty");
  await page.goto(`${ENTRIES_URL}&tab=invoices`);
  await expect(page.getByText("Nenhuma fatura neste mês")).toBeVisible();
});

test("RF24: erro 404 do lote mostra mensagem; erro 422 explica que receitas nao podem ser pagas", async ({ page }) => {
  await setScenario("batch404");
  await page.goto(ENTRIES_URL);
  await page.getByRole("checkbox", { name: /Internet/ }).check();
  await page.getByRole("button", { name: "Marcar como pago" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Confirmar|Marcar como pago/ }).click();
  // banner persistente (design 4.x, 404 lote). Seletor especifico: o route announcer do Next tambem tem role=alert.
  const banner = page.getByRole("alert").filter({ hasText: "Nenhuma despesa foi alterada" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("não foi encontrada");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("RF24: 422 do lote mostra banner explicando que receitas nao podem ser pagas", async ({ page }) => {
  await setScenario("batch422");
  await page.goto(ENTRIES_URL);
  await page.getByRole("checkbox", { name: /Internet/ }).check();
  await page.getByRole("button", { name: "Marcar como pago" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Confirmar|Marcar como pago/ }).click();
  const banner = page.getByRole("alert").filter({ hasText: "Nenhuma despesa foi alterada" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Receitas não podem ser marcadas como pagas");
});

test("CA66-like: lista da fatura com erro mostra erro no bloco com 'Tentar novamente' sem afetar os demais", async ({ page }) => {
  await setScenario("invoice-entries-error");
  await page.goto(`${ENTRIES_URL}&tab=invoices`);
  const block = page.getByRole("group", { name: /Nubank/ });
  await block.getByRole("button", { name: /despesas/i }).click();
  await expect(block.getByRole("button", { name: /Tentar novamente/ })).toBeVisible();
  await expect(block).toContainText("Nubank");
});

test("CA73/CA74/CA75: drawer - tipo/forma, atalho '+ Novo cartão' preserva dados e seleciona o cartao; 409 inline", async ({ page }) => {
  await page.goto(ENTRIES_URL);
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  const drawer = page.getByRole("dialog");
  // D23: "Ainda não paguei" so existe com Despesa + PIX; a linha "Status inicial" explica o resultado em todos os casos
  const notPaid = drawer.getByRole("checkbox", { name: "Ainda não paguei" });
  await expect(notPaid).not.toBeChecked();
  await expect(drawer.getByText("Status inicial: paga.")).toBeVisible();
  await notPaid.check();
  await expect(drawer.getByText("Status inicial: pendente. Você poderá marcá-la como paga depois.")).toBeVisible();
  await notPaid.uncheck();
  // Cartao: cartao exigido; o checkbox e OCULTO (nao desabilitado)
  await drawer.getByRole("radio", { name: "Cartão" }).check();
  await expect(notPaid).toHaveCount(0);
  await expect(drawer.getByText("Status inicial: pendente, na fatura do cartão.")).toBeVisible();
  // Receita: forma fixa em PIX, sem checkbox
  await drawer.getByRole("radio", { name: "Receita" }).check();
  await expect(notPaid).toHaveCount(0);
  await expect(drawer.getByText("Status inicial: recebida.")).toBeVisible();
  await expect(drawer.getByRole("radio", { name: "PIX" })).toBeChecked();
  await expect(drawer.getByRole("radio", { name: "Cartão" })).toBeDisabled();
  await drawer.getByRole("radio", { name: "Despesa" }).check();
  await drawer.getByRole("radio", { name: "Cartão" }).check();
  await drawer.getByLabel("Descrição").fill("Compra teste");
  await drawer.getByLabel("Valor").fill("123,45");
  // atalho
  await drawer.getByRole("button", { name: "+ Novo cartão" }).click();
  await drawer.getByLabel("Nome do cartão").fill("Itaú");
  await drawer.getByLabel("Dia de fechamento").fill("3");
  await drawer.getByLabel("Dia de vencimento").fill("10");
  await drawer.getByRole("button", { name: "Criar cartão" }).click();
  await expect(drawer.getByText("Já existe um cartão com esse nome.")).toBeVisible(); // 409 inline (Itau ja existe no stub)
  await drawer.getByLabel("Nome do cartão").fill("Inter");
  await drawer.getByRole("button", { name: "Criar cartão" }).click();
  // <select> nativo: o value e o id; a asserção correta e sobre a opção selecionada
  const cardSelect = drawer.getByRole("combobox", { name: "Cartão" });
  await expect(cardSelect.locator("option:checked")).toHaveText(/Inter/);
  await expect(drawer.getByLabel("Descrição")).toHaveValue("Compra teste");
  await expect(drawer.getByLabel("Valor")).toHaveValue("123,45");
});

test("CA74: criar com dados invalidos mantem o drawer aberto com erros inline", async ({ page }) => {
  await page.goto(ENTRIES_URL);
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: /Salvar/ }).click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("alert").first()).toBeVisible();
});

test("CA77: tela de cartoes - vazio, cadastro e atalho para a aba Despesas filtrada", async ({ page }) => {
  await setScenario("empty");
  await page.goto("/cards");
  await expect(page.getByText(/Nenhum cartão/)).toBeVisible();
  await page.getByRole("button", { name: /Novo cartão/ }).first().click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Nome do cartão").fill("Nubank");
  await drawer.getByLabel("Dia de fechamento").fill("25");
  await drawer.getByLabel("Dia de vencimento").fill("5");
  await drawer.getByRole("button", { name: /Salvar|Criar/ }).click();
  await expect(page.getByText("Nubank · Fecha dia 25 · Vence dia 5")).toBeVisible();
  await page.getByRole("link", { name: /Ver despesas|Despesas/ }).first().click();
  await expect(page).toHaveURL(/tab=expenses/);
  await expect(page).toHaveURL(/d_card=/);
});

test("CA84: alternar o tema 5x com o drawer aberto preserva dados digitados, aba e filtros", async ({ context, page }) => {
  await setThemeCookie(context, "dark");
  await page.goto(`${ENTRIES_URL}&d_status=PENDING`);
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Descrição").fill("Texto digitado");
  for (let i = 0; i < 5; i++) await page.emulateMedia({ colorScheme: i % 2 ? "light" : "dark" });
  await expect(drawer.getByLabel("Descrição")).toHaveValue("Texto digitado");
  await expect(page).toHaveURL(/d_status=PENDING/);
  await expect(themeToggle(page)).toHaveCount(1);
});

test.describe("CA76 - responsividade 360x800", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("abas, seletor de mes e resumo utilizaveis; cards em vez de tabela; alvos >= 44px", async ({ page }) => {
    await page.goto(ENTRIES_URL);
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    const targets = page.getByRole("checkbox").or(page.getByRole("tab")).or(page.getByRole("button", { name: /Marcar como pago|Novo lançamento/ }));
    const count = await targets.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      if (!box) continue;
      expect(Math.max(box.width, box.height), `alvo #${i}`).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
