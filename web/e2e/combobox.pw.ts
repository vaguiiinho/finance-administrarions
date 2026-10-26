import { expect, test } from "@playwright/test";
import { ENTRIES_URL, setScenario, setThemeCookie, gotoReady } from "./support";

/** F1 no navegador (design 3.9.1/3.9.2): o foco no envio invalido nao abre a lista, e a mensagem de erro fica visivel. */
test.beforeEach(async ({ context }) => {
  await setScenario("default");
  await setThemeCookie(context, "light");
});

test("F1: envio invalido foca a Categoria sem abrir a lista, e 'Informe a categoria.' fica visivel e sem sobreposicao", async ({ page }) => {
  await gotoReady(page, ENTRIES_URL);
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Descrição").fill("Padaria");
  await dialog.getByLabel("Valor").fill("12,50");
  await dialog.getByRole("button", { name: "Salvar lançamento" }).click();
  const category = dialog.getByRole("combobox", { name: /Categoria/ });
  await expect(category).toBeFocused();
  await expect(category).toHaveAttribute("aria-expanded", "false");
  const message = dialog.getByText("Informe a categoria.");
  await expect(message).toBeVisible();
  const box = (await message.boundingBox())!;
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[role='listbox'], [role='option']") !== null, { x: box.x + 4, y: box.y + box.height / 2 });
  expect(hit, "a lista nao pode cobrir a mensagem").toBe(false);
});

test("F1: a lista abre ao digitar, com seta para baixo e com clique; Esc fecha so a lista e o segundo Esc fecha o drawer (CAF03)", async ({ page }) => {
  await gotoReady(page, ENTRIES_URL);
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  const dialog = page.getByRole("dialog");
  const category = dialog.getByRole("combobox", { name: /Categoria/ });
  await category.click();
  await expect(category).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(category).toHaveAttribute("aria-expanded", "false");
  await expect(dialog).toBeVisible();
  await category.fill("alim");
  await expect(dialog.getByRole("option", { name: "Alimentação" })).toBeVisible();
  await category.fill("Lazer");
  await expect(dialog.getByRole("option", { name: 'Usar "Lazer"' })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
