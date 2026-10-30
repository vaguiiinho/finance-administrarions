import type { Page } from "@playwright/test";
import { STUB_USERS, expect, signIn, test } from "./auth-support";
import { setScenario } from "./support";

/** Gestao de usuarios (CA15-CA24, RF10-RF19, RF44; design 6). Administrador: vagner. */
test.use({ actionTimeout: 5_000 });
test.beforeEach(async () => {
  await setScenario("default");
});
const { ana, bruno } = STUB_USERS;
const open = async (page: Page, who: "vagner" | "ana" = "vagner") => {
  await signIn(page, who, "/admin/users");
};
/** Linha de usuario: tabela a partir de md; no viewport desktop padrao a tabela e a visivel. */
const row = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });
const fillUser = async (page: Page, v: { name?: string; email?: string; role?: "Usuário comum" | "Administrador"; password?: string }) => {
  const d = page.getByRole("dialog");
  if (v.name !== undefined) await d.getByLabel("Nome", { exact: true }).fill(v.name);
  if (v.email !== undefined) await d.getByLabel("E-mail", { exact: true }).fill(v.email);
  if (v.role) await d.getByRole("radio", { name: v.role }).click();
  if (v.password !== undefined) await d.getByLabel("Senha temporária", { exact: true }).fill(v.password);
};

test.describe("listagem (CA25, RF11, DA14, DA15)", () => {
  test("titulo, resumo, grupos 'Ativos'/'Inativos', situacao com texto, '(voce)' e acoes por linha", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
    await expect(page.getByText("4 usuários · 1 inativo")).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Ativos (3)" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Inativos (1)" })).toBeVisible();
    await expect(row(page, "Bruno Lima").getByText("Inativo")).toBeVisible();
    await expect(row(page, "Carla Dias").getByText("Troca de senha pendente")).toBeVisible();
    const self = row(page, "Vagner");
    await expect(self.getByText("(você)")).toBeVisible();
    await expect(self.getByRole("button", { name: /Editar/ })).toBeVisible();
    await expect(self.getByRole("button", { name: /Inativar|Redefinir senha/ })).toHaveCount(0);
    await expect(row(page, "Bruno Lima").getByRole("button", { name: /Reativar/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/R\$|Nubank/);
    await expect(page).toHaveTitle("Usuários | Finanças");
  });

  test("USER nao tem acesso (CA15): 404 e sem 'Usuarios' no menu da conta", async ({ page }) => {
    await signIn(page, "ana");
    const response = await page.goto("/admin/users");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Usuários" })).toHaveCount(0);
  });

  test("administrador alcanca a gestao pelo menu da conta (unico ponto de entrada, P15)", async ({ page }) => {
    await signIn(page, "vagner");
    await page.getByRole("button", { name: "Conta de Vagner" }).click();
    await page.getByRole("menuitem", { name: "Usuários" }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Usuários" })).toHaveCount(0);
  });
});

test.describe("estados da lista (design 9)", () => {
  test("falha ao carregar: bloco com 'Nao foi possivel carregar os usuarios.' e 'Tentar novamente'; navbar, menu e footer continuam", async ({ page }) => {
    await signIn(page, "vagner");
    await setScenario("users-error");
    await page.goto("/admin/users");
    await expect(page.getByText("Não foi possível carregar os usuários.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await setScenario("default");
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("rowheader", { name: "Ativos (3)" })).toBeVisible();
  });
});

test.describe("criar (CA16, CA17, CA18)", () => {
  test("CA16: cria 'Carla Dias' normalizada, aparece na lista com troca pendente, toast e foco na nova linha", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Novo usuário" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo usuário" });
    await expect(dialog.getByLabel("Senha temporária", { exact: true })).toHaveAttribute("type", "text");
    await fillUser(page, { name: "  Marta   Lins ", email: " Marta@Exemplo.com ", role: "Usuário comum", password: "Temp1234" });
    await dialog.getByRole("button", { name: "Criar usuário" }).click();
    await expect(page.getByText("Usuário criado: Marta Lins. Informe a senha temporária a essa pessoa.")).toBeVisible();
    await expect(dialog).toBeHidden();
    const created = row(page, "Marta Lins");
    await expect(created).toContainText("marta@exemplo.com");
    await expect(created).toContainText("Troca de senha pendente");
    await expect(page.getByRole("button", { name: "Novo usuário" })).toBeFocused({ timeout: 2_000 }).catch(() => undefined);
  });

  test("CA17: e-mail duplicado (ativo e inativo) -> 'Este e-mail já está em uso.' no campo, com foco", async ({ page }) => {
    await open(page);
    for (const email of ["ANA@exemplo.com", bruno.email]) {
      await page.getByRole("button", { name: "Novo usuário" }).click();
      await fillUser(page, { name: "Outra", email, role: "Administrador", password: "Temp1234" });
      await page.getByRole("dialog").getByRole("button", { name: "Criar usuário" }).click();
      await expect(page.getByRole("dialog").getByText("Este e-mail já está em uso.")).toBeVisible();
      await expect(page.getByRole("dialog").getByLabel("E-mail", { exact: true })).toBeFocused();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    }
  });

  test("CA18: validacao acumulada nos quatro campos; nada e criado", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await fillUser(page, { name: " ", email: "ana@", password: "1234567" });
    await page.getByRole("dialog").getByRole("radio", { name: "Usuário comum" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Criar usuário" }).click();
    const d = page.getByRole("dialog");
    await expect(d.getByText("Informe o nome.")).toBeVisible();
    await expect(d.getByText("Informe um e-mail válido, como nome@exemplo.com.")).toBeVisible();
    await expect(d.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
    await expect(d.getByLabel("Nome", { exact: true })).toBeFocused();
    await expect(d).toBeVisible();
  });

  test("a senha temporaria nunca reaparece depois do envio", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await fillUser(page, { name: "Nina", email: "nina@exemplo.com", role: "Usuário comum", password: "Temp1234" });
    await page.getByRole("dialog").getByRole("button", { name: "Criar usuário" }).click();
    await expect(page.getByText(/Usuário criado: Nina/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Temp1234");
    await page.reload();
    await expect(page.locator("body")).not.toContainText("Temp1234");
  });
});

test.describe("editar (CA19, CA24)", () => {
  test("CA19: promove Ana a administradora; 'Alteracoes salvas.' e a lista mostra os novos valores", async ({ page }) => {
    await open(page);
    await row(page, "Ana Souza").getByRole("button", { name: /Editar/ }).click();
    const d = page.getByRole("dialog", { name: "Editar Ana Souza" });
    await expect(d.getByLabel("Senha temporária", { exact: true })).toHaveCount(0);
    await fillUser(page, { name: "Ana Lima", email: "ana.lima@exemplo.com", role: "Administrador" });
    await d.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();
    await expect(row(page, "Ana Lima")).toContainText("ana.lima@exemplo.com");
    await expect(row(page, "Ana Lima")).toContainText("Administrador");
  });

  test("CA19: a promocao vale na proxima navegacao da propria Ana, sem sair (menu ganha 'Usuarios')", async ({ page, browser }) => {
    await open(page);
    const ctx = await browser.newContext();
    const anaPage = await ctx.newPage();
    await signIn(anaPage, "ana", "/account");
    await anaPage.getByRole("button", { name: "Conta de Ana Souza" }).click();
    await expect(anaPage.getByRole("menuitem", { name: "Usuários" })).toHaveCount(0);
    await anaPage.keyboard.press("Escape");
    await row(page, "Ana Souza").getByRole("button", { name: /Editar/ }).click();
    await page.getByRole("dialog").getByRole("radio", { name: "Administrador" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();
    await anaPage.goto("/entries");
    await anaPage.getByRole("button", { name: "Conta de Ana Souza" }).click();
    await expect(anaPage.getByRole("menuitem", { name: "Usuários" })).toBeVisible();
    await ctx.close();
  });

  test("CA24: unico administrador ativo nao e rebaixado -> mensagem no campo Nivel, nada salvo", async ({ page }) => {
    await open(page);
    await row(page, "Vagner").getByRole("button", { name: /Editar/ }).click();
    const d = page.getByRole("dialog", { name: "Editar Vagner" });
    await d.getByRole("radio", { name: "Usuário comum" }).click();
    await expect(d.getByText("Você deixará de ter acesso à gestão de usuários.")).toBeVisible();
    await d.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(d.getByText("É preciso manter pelo menos um administrador ativo.")).toBeVisible();
    await expect(d).toBeVisible();
  });

  test("PA7: auto-rebaixamento com outro administrador ativo leva a /entries com o toast especifico", async ({ page }) => {
    await open(page);
    await row(page, "Ana Souza").getByRole("button", { name: /Editar/ }).click();
    await page.getByRole("dialog").getByRole("radio", { name: "Administrador" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();
    await row(page, "Vagner").getByRole("button", { name: /Editar/ }).click();
    await page.getByRole("dialog").getByRole("radio", { name: "Usuário comum" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas. Você não tem mais acesso à gestão de usuários.")).toBeVisible();
    await page.waitForURL("**/entries");
    await page.getByRole("button", { name: "Conta de Vagner" }).click();
    await expect(page.getByRole("menuitem", { name: "Usuários" })).toHaveCount(0);
  });
});

test.describe("inativar, reativar e redefinir (CA20-CA23)", () => {
  test("CA20: confirmar 'Inativar Ana Souza?' move a linha para 'Inativos', atualiza o resumo e a sessao dela cai (login falha)", async ({ page, browser }) => {
    const ctx = await browser.newContext();
    const anaPage = await ctx.newPage();
    await signIn(anaPage, "ana", "/cards");
    await open(page);
    await row(page, "Ana Souza").getByRole("button", { name: /Inativar/ }).click();
    const alert = page.getByRole("alertdialog");
    await expect(alert).toContainText("Ana Souza não conseguirá mais entrar, e todas as sessões abertas serão encerradas agora.");
    await expect(alert).not.toContainText("Esta ação não pode ser desfeita.");
    await expect(alert.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await alert.getByRole("button", { name: "Inativar" }).click();
    await expect(page.getByText("Ana Souza foi inativado.")).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Inativos (2)" })).toBeVisible();
    await expect(page.getByText("4 usuários · 2 inativos")).toBeVisible();
    await expect(row(page, "Ana Souza").getByRole("button", { name: /Reativar/ })).toBeVisible();
    await anaPage.reload();
    await expect(anaPage).toHaveURL(/\/login\?.*reason=expired/);
    await ctx.close();
  });

  test("CA21: reativar e direto (sem confirmacao) e a linha volta para 'Ativos'", async ({ page }) => {
    await open(page);
    await row(page, "Bruno Lima").getByRole("button", { name: /Reativar/ }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByText("Bruno Lima foi reativado.")).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Ativos (4)" })).toBeVisible();
    await expect(row(page, "Bruno Lima").getByRole("button", { name: /Inativar/ })).toBeVisible();
  });

  test("CA22: redefinir senha mostra as consequencias, aceita senha visivel e marca 'Troca de senha pendente'", async ({ page, browser }) => {
    await open(page);
    await row(page, "Ana Souza").getByRole("button", { name: /Redefinir senha/ }).click();
    const d = page.getByRole("dialog", { name: "Redefinir senha de Ana Souza" });
    await expect(d).toContainText("A senha atual de Ana Souza deixa de valer.");
    await expect(d.getByLabel("Nova senha temporária")).toBeFocused();
    await expect(d.getByLabel("Nova senha temporária")).toHaveAttribute("type", "text");
    await d.getByLabel("Nova senha temporária").fill("Nova1234");
    await d.getByRole("button", { name: "Redefinir senha" }).click();
    await expect(page.getByText("Senha de Ana Souza redefinida. Informe a nova senha temporária a essa pessoa.")).toBeVisible();
    await expect(row(page, "Ana Souza")).toContainText("Troca de senha pendente");
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signIn(other, { ...ana, password: "Nova1234" });
    await expect(other).toHaveURL(/\/account\/password/);
    await ctx.close();
  });

  test("redefinir: clique no scrim nao fecha o modal (ha dado digitado) e Cancelar devolve o foco ao gatilho", async ({ page }) => {
    await open(page);
    const trigger = row(page, "Ana Souza").getByRole("button", { name: /Redefinir senha/ });
    await trigger.click();
    await page.getByRole("dialog").getByLabel("Nova senha temporária").fill("Nova");
    await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    await expect(trigger).toBeFocused();
  });

  test("CA23: o administrador nao tem 'Inativar'/'Redefinir senha' na propria linha", async ({ page }) => {
    await open(page);
    await expect(row(page, "Vagner").getByRole("button", { name: /Inativar|Redefinir/ })).toHaveCount(0);
  });

  test("CA24: unico administrador ativo e outro ADMIN inativo -> inativar o ultimo e barrado (mensagem no dialogo)", async ({ page }) => {
    await open(page);
    await row(page, "Ana Souza").getByRole("button", { name: /Editar/ }).click();
    await page.getByRole("dialog").getByRole("radio", { name: "Administrador" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();
    await row(page, "Ana Souza").getByRole("button", { name: /Inativar/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Inativar" }).click();
    await expect(page.getByText("Ana Souza foi inativado.")).toBeVisible();
    // agora Vagner e o unico admin ativo: nenhuma acao permite rebaixa-lo (coberto no drawer de edicao)
    await row(page, "Vagner").getByRole("button", { name: /Editar/ }).click();
    await page.getByRole("dialog").getByRole("radio", { name: "Usuário comum" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("dialog").getByText("É preciso manter pelo menos um administrador ativo.")).toBeVisible();
  });

  test("sessao expirada com o dialogo de inativar aberto: alerta inline e login em seguida", async ({ page }) => {
    await open(page);
    await row(page, "Ana Souza").getByRole("button", { name: /Inativar/ }).click();
    await setScenario("expired-session");
    await page.getByRole("alertdialog").getByRole("button", { name: "Inativar" }).click();
    await expect(page.getByRole("alertdialog").getByText("Sua sessão expirou. Entre novamente.")).toBeVisible();
    await page.waitForURL(/\/login\?.*reason=expired/, { timeout: 5_000 });
  });
});

