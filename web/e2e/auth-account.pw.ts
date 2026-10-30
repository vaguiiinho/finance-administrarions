import { STUB_USERS, expect, menuButton, navbar, signIn, test } from "./auth-support";
import { releaseMutations, setScenario } from "./support";

/** Troca de senha e meu perfil (CA08-CA11, RF07-RF09, RF42, RF43; design 4 e 5). */
test.use({ actionTimeout: 5_000 });
test.beforeEach(async () => {
  await setScenario("default");
});
const { ana, carla } = STUB_USERS;
const current = (page: import("@playwright/test").Page) => page.getByLabel("Senha atual", { exact: true });
const novo = (page: import("@playwright/test").Page) => page.getByLabel("Nova senha", { exact: true });
const confirm = (page: import("@playwright/test").Page) => page.getByLabel("Confirmar nova senha", { exact: true });
const save = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Salvar nova senha" });

test.describe("troca obrigatoria (CA08, CA09)", () => {
  test("CA08: carla entra por /login?next=/cards e cai em /account/password em modo restrito", async ({ page }) => {
    await signIn(page, "carla", "/cards");
    await expect(page).toHaveURL(/\/account\/password/);
    await expect(page.getByText("Defina uma nova senha para continuar.")).toBeVisible();
    await expect(page.getByText("Você entrou com uma senha temporária. Depois de salvar, você segue para Cartões.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Cancelar" })).toHaveCount(0);
    // modo restrito: sem menu lateral, sem botao de menu, marca sem link, menu da conta so com Sair, footer sem link
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
    await expect(menuButton(page)).toHaveCount(0);
    await expect(navbar(page).getByRole("link", { name: "Finanças" })).toHaveCount(0);
    await page.getByRole("button", { name: "Conta de Carla Dias" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Sair"]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("contentinfo").getByRole("link")).toHaveCount(0);
  });

  for (const path of ["/entries", "/cards", "/dashboard", "/account", "/admin/users"]) {
    test(`CA08: com a troca pendente, abrir ${path} volta para /account/password`, async ({ page }) => {
      await signIn(page, "carla");
      await page.goto(path);
      await expect(page).toHaveURL(/\/account\/password/);
    });
  }

  test("CA09: trocar a senha mostra 'Senha alterada.', vai ao next preservado e a navbar/menu/footer voltam ao modo completo SEM recarregar", async ({ page }) => {
    await signIn(page, "carla", "/cards");
    await current(page).fill(carla.password);
    await novo(page).fill("MinhaSenha9");
    await confirm(page).fill("MinhaSenha9");
    await save(page).click();
    await expect(page.getByText("Senha alterada.")).toBeVisible();
    await page.waitForURL("**/cards");
    await expect(page.getByRole("navigation", { name: "Principal" }).or(menuButton(page)).first()).toBeVisible();
    await page.getByRole("button", { name: "Conta de Carla Dias" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Meu perfil", "Trocar senha", "Sair"]);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Ver demonstração" })).toBeVisible();
  });

  test("CA09: depois, o login com a senha temporaria falha e com a nova entra sem troca obrigatoria", async ({ page, context }) => {
    await signIn(page, "carla");
    await current(page).fill(carla.password);
    await novo(page).fill("MinhaSenha9");
    await confirm(page).fill("MinhaSenha9");
    await save(page).click();
    await page.waitForURL((u) => u.pathname !== "/account/password");
    await page.getByRole("button", { name: "Conta de Carla Dias" }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await context.clearCookies();
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(carla.email);
    await page.getByLabel("Senha", { exact: true }).fill(carla.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(/E-mail ou senha inválidos\./);
    await page.getByLabel("Senha", { exact: true }).fill("MinhaSenha9");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/entries");
  });

  test("mostrar a nova senha: botao 'Mostrar senha' alterna sem perder o valor", async ({ page }) => {
    await signIn(page, "carla");
    await novo(page).fill("abc12345");
    await page.getByRole("button", { name: "Mostrar senha" }).nth(1).click();
    await expect(novo(page)).toHaveAttribute("type", "text");
    await expect(novo(page)).toHaveValue("abc12345");
  });
});

test.describe("erros e modo opcional (CA10)", () => {
  test("modo opcional: sem explicacao obrigatoria, com Cancelar -> /account e menu lateral/botao de menu presentes", async ({ page }) => {
    await signIn(page, "ana", "/account/password");
    await expect(page.getByRole("heading", { level: 1, name: "Trocar senha" })).toBeVisible();
    await expect(page.getByText("Defina uma nova senha para continuar.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", "/account");
    await expect(page.getByRole("navigation", { name: "Principal" }).or(menuButton(page)).first()).toBeVisible();
  });

  test("CA10: confirmacao diferente -> 'As senhas não conferem.' no web; senha atual errada, igual e curta -> mensagens do servidor", async ({ page }) => {
    await signIn(page, "ana", "/account/password");
    await current(page).fill(ana.password);
    await novo(page).fill("MinhaSenha9");
    await confirm(page).fill("Outra12345");
    await save(page).click();
    await expect(page.getByText("As senhas não conferem.")).toBeVisible();
    await expect(confirm(page)).toBeFocused();

    await current(page).fill("errada123");
    await confirm(page).fill("MinhaSenha9");
    await save(page).click();
    await expect(page.getByText("Senha atual incorreta.")).toBeVisible();
    await expect(current(page)).toHaveValue("");
    await expect(current(page)).toBeFocused();
    await expect(novo(page)).toHaveValue("MinhaSenha9");

    await current(page).fill(ana.password);
    await novo(page).fill(ana.password);
    await confirm(page).fill(ana.password);
    await save(page).click();
    await expect(page.getByText("A nova senha deve ser diferente da atual.")).toBeVisible();

    await novo(page).fill("1234567");
    await confirm(page).fill("1234567");
    await save(page).click();
    await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
  });

  test("CA10: 429 na troca de senha -> aviso com horario e botao aria-disabled", async ({ page }) => {
    await signIn(page, "ana", "/account/password");
    await setScenario("rate-limited");
    await current(page).fill("errada123");
    await novo(page).fill("MinhaSenha9");
    await confirm(page).fill("MinhaSenha9");
    await save(page).click();
    await expect(page.getByRole("alert")).toHaveText(/Muitas tentativas\. Tente novamente em \d+ minutos?, às \d{2}:\d{2}\./);
    await expect(save(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("sucesso no modo opcional: campos limpos, toast 'Senha alterada.' e a pessoa continua na tela", async ({ page }) => {
    await signIn(page, "ana", "/account/password");
    await current(page).fill(ana.password);
    await novo(page).fill("MinhaSenha9");
    await confirm(page).fill("MinhaSenha9");
    await save(page).click();
    await expect(page.getByText("Senha alterada.")).toBeVisible();
    await expect(current(page)).toHaveValue("");
    await expect(page).toHaveURL(/\/account\/password/);
  });

  test("carregando: 'Salvando…' com a API segurando a resposta", async ({ page }) => {
    await signIn(page, "ana", "/account/password");
    await setScenario("default", { holdMutations: true });
    await current(page).fill(ana.password);
    await novo(page).fill("MinhaSenha9");
    await confirm(page).fill("MinhaSenha9");
    await save(page).click();
    await expect(page.getByRole("button", { name: "Salvando…" })).toHaveAttribute("aria-busy", "true");
    await releaseMutations();
  });
});

test.describe("meu perfil (CA11, RF09, RF40, RF43)", () => {
  test("estrutura: nome editavel, e-mail e nivel em texto, atalho 'Trocar senha'", async ({ page }) => {
    await signIn(page, "ana", "/account");
    await expect(page.getByRole("heading", { level: 1, name: "Meu perfil" })).toBeVisible();
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Ana Souza");
    await expect(page.getByText("ana@exemplo.com")).toBeVisible();
    await expect(page.getByText("Usuário comum")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveCount(0);
    await expect(page.getByText("Para alterar, fale com um administrador.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Trocar senha" }).last()).toHaveAttribute("href", "/account/password");
  });

  test("CA11: '  ana   lima ' vira 'ana lima', toast 'Perfil atualizado.', inicial 'A' e nome 'ana lima' no menu", async ({ page }) => {
    await signIn(page, "ana", "/account");
    await page.getByLabel("Nome", { exact: true }).fill("  ana   lima ");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Perfil atualizado.")).toBeVisible();
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("ana lima");
    const avatar = page.getByRole("button", { name: "Conta de ana lima" });
    await expect(avatar).toHaveText("A");
    await avatar.click();
    await expect(page.locator("#account-menu-header")).toContainText("ana lima");
  });

  test("nome vazio -> 'Informe seu nome.' sem chamar a API", async ({ page }) => {
    await signIn(page, "ana", "/account");
    await page.getByLabel("Nome", { exact: true }).fill("");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Informe seu nome.")).toBeVisible();
  });
});
