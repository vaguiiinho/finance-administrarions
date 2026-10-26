import { expect, test } from "@playwright/test";
import { ENTRIES_URL, setScenario, gotoReady } from "./support";

/**
 * CAF11 / RF25 / CA05 (ADR 0002 T5): edicao de cartao de ponta a ponta contra o stub com `PUT /api/cards/:id`
 * (atualiza so os dados do cartao; nao retroage em lancamentos existentes).
 */
test.beforeEach(async () => {
  await setScenario("default");
});

const card = (page: import("@playwright/test").Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });

test("CAF11: editar Nubank (fecha 25, vence 5) para fecha 20 e vence 28 atualiza a lista, com aviso de nao retroatividade", async ({ page }) => {
  await gotoReady(page, "/cards");
  await expect(card(page, "Nubank")).toContainText("Fecha dia 25 · Vence dia 5");
  await page.getByRole("button", { name: "Editar Nubank" }).click();
  const drawer = page.getByRole("dialog", { name: "Editar cartão" });
  await expect(drawer).toContainText("Alterações valem só para novos lançamentos");
  await expect(drawer.getByLabel("Nome do cartão")).toHaveValue("Nubank");
  await drawer.getByLabel("Dia de fechamento").fill("20");
  await drawer.getByLabel("Dia de vencimento").fill("28");
  await drawer.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(card(page, "Nubank")).toContainText("Fecha dia 20 · Vence dia 28");
  await expect(page.getByText(/Cartão "Nubank" atualizado/)).toBeVisible();
});

test("CAF11: nome duplicado de OUTRO cartao mostra o 409 inline e mantem os dados digitados", async ({ page }) => {
  await gotoReady(page, "/cards");
  await page.getByRole("button", { name: "Editar Itaú" }).click();
  const drawer = page.getByRole("dialog", { name: "Editar cartão" });
  await drawer.getByLabel("Nome do cartão").fill("nubank"); // case-insensitive
  await drawer.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(drawer.getByText("Já existe um cartão com esse nome.")).toBeVisible();
  await expect(drawer.getByLabel("Nome do cartão")).toHaveValue("nubank");
  await expect(drawer.getByLabel("Nome do cartão")).toHaveAttribute("aria-invalid", "true");
  await expect(drawer).toBeVisible();
});

test("CAF11: trocar so a caixa do PROPRIO nome e permitido (sem 409)", async ({ page }) => {
  await gotoReady(page, "/cards");
  await page.getByRole("button", { name: "Editar Nubank" }).click();
  const drawer = page.getByRole("dialog", { name: "Editar cartão" });
  await drawer.getByLabel("Nome do cartão").fill("NUBANK");
  await drawer.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "NUBANK" })).toBeVisible();
});

test("CAF11: salvar sem mudar nada nao chama a API e avisa 'Nenhuma alteração.'", async ({ page }) => {
  await gotoReady(page, "/cards");
  await page.getByRole("button", { name: "Editar Nubank" }).click();
  await page.getByRole("dialog", { name: "Editar cartão" }).getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Nenhuma alteração.")).toBeVisible();
  await expect(card(page, "Nubank")).toContainText("Fecha dia 25 · Vence dia 5");
});

test("CA05: a edicao nao mexe nos lancamentos ja criados (continuam na fatura de novembro)", async ({ page }) => {
  await gotoReady(page, "/cards");
  await page.getByRole("button", { name: "Editar Nubank" }).click();
  const drawer = page.getByRole("dialog", { name: "Editar cartão" });
  await drawer.getByLabel("Dia de fechamento").fill("20");
  await drawer.getByLabel("Dia de vencimento").fill("28");
  await drawer.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(drawer).toHaveCount(0);
  await gotoReady(page, `${ENTRIES_URL}&tab=invoices`);
  const block = page.getByRole("group", { name: /Nubank/ });
  await expect(block).toContainText("Fecha 25/10/2026");
  await expect(block).toContainText("Vence 05/11/2026");
});

test("T5: lancamento novo no cartao usa o fechamento/vencimento ATUAIS do cartao (regra real do mes de referencia)", async ({ page }) => {
  await gotoReady(page, "/cards");
  await page.getByRole("button", { name: "Editar Nubank" }).click();
  const drawer = page.getByRole("dialog", { name: "Editar cartão" });
  await drawer.getByLabel("Dia de fechamento").fill("20");
  await drawer.getByLabel("Dia de vencimento").fill("28");
  await drawer.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(drawer).toHaveCount(0);
  // compra em 2026-11-12 com fecha 20 / vence 28: fecha 20/11, vence 28/11 -> fatura de novembro (nao a "2026-12" fixa do stub antigo)
  await gotoReady(page, ENTRIES_URL);
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  const entry = page.getByRole("dialog");
  await entry.getByLabel("Descrição").fill("Padaria");
  await entry.getByRole("combobox", { name: /Categoria/ }).fill("Alimentação");
  await entry.getByLabel("Data").fill("2026-11-12");
  await entry.getByLabel("Valor").fill("12,50");
  await entry.getByRole("radio", { name: "Cartão" }).click();
  await entry.getByLabel(/^Cartão/).selectOption({ label: "Nubank · fecha 20 · vence 28" });
  await entry.getByRole("button", { name: "Salvar lançamento" }).click();
  // com fecha 20 / vence 28 a compra de 12/11 cai na fatura de novembro: a linha aparece na lista de novembro (com o stub
  // antigo, "2026-12" fixo, ela nao apareceria). O chip "Fatura nov/26" so existe quando o mes da fatura difere do da compra.
  await expect(page.getByRole("row", { name: /Padaria/ })).toBeVisible();
  await expect(page.getByText(/vence 28\/11\/2026/).first()).toBeVisible(); // toast: "...fatura de nov/26 do Nubank, vence 28/11/2026."
});
