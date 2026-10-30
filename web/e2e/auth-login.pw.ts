import { STUB_USERS, banner, expect, openLogin, signIn, test } from "./auth-support";
import { releaseMutations, setScenario } from "./support";

/**
 * Login, sessao e redirecionamentos (CA01-CA07, CA40-CA42; ADR 0005 9.3-9.5, 11.5). Roda contra o stub com auth.
 * `actionTimeout` curto: na fase RED estes testes falham rapido em vez de esperar 30 s por localizador.
 */
test.use({ actionTimeout: 5_000 });
test.beforeEach(async () => {
  await setScenario("default");
});
const { ana, bruno, vagner } = STUB_USERS;

test.describe("tela /login (RF41, design 3)", () => {
  test("estrutura: h1 'Entrar', campos, orientacao, 'Ver demonstracao' e nenhum 'Criar conta'", async ({ page }) => {
    await openLogin(page);
    await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByText("Não tem acesso ou esqueceu a senha? Fale com um administrador.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver demonstração" }).first()).toHaveAttribute("href", "/demo/entries");
    await expect(page.getByText(/Criar conta/i)).toHaveCount(0);
    await expect(page).toHaveTitle("Entrar | Finanças");
  });

  test("shell do login: sem menu lateral, sem botao de menu e sem conta; com tema e footer sem link de demonstracao", async ({ page }) => {
    await openLogin(page);
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Abrir menu de navegação" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tema escuro" })).toBeVisible();
    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("Finanças");
    await expect(footer).toContainText("Versão");
    await expect(footer.getByRole("link")).toHaveCount(0);
  });

  test("contexto do destino: next=/cards mostra 'Entre para continuar em Cartoes.'; next invalido nao mostra contexto", async ({ page }) => {
    await openLogin(page, "?next=/cards");
    await expect(page.getByText("Entre para continuar em Cartões.")).toBeVisible();
    await openLogin(page, "?next=//evil.com");
    await expect(page.getByText(/Entre para continuar em/)).toHaveCount(0);
    await expect(page.getByText("Acesse seus lançamentos, cartões e faturas.")).toBeVisible();
  });

  test("validacao de presenca no envio vazio, com foco no e-mail", async ({ page }) => {
    await openLogin(page);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Informe o e-mail.")).toBeVisible();
    await expect(page.getByText("Informe a senha.")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeFocused();
  });

  test("carregando: 'Entrando…' enquanto a API segura a resposta, sem envio duplo", async ({ page }) => {
    await openLogin(page);
    await setScenario("default", { holdMutations: true });
    await page.getByLabel("E-mail").fill(ana.email);
    await page.getByLabel("Senha", { exact: true }).fill(ana.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    const busy = page.getByRole("button", { name: "Entrando…" });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await busy.click({ force: true });
    await releaseMutations();
    await page.waitForURL("**/entries");
  });
});

test.describe("login e next (CA01, CA02, RF35)", () => {
  test("CA01: entra por /login?next=/cards, vai para /cards e o cookie e httpOnly (invisivel ao JS)", async ({ page, context }) => {
    await signIn(page, "ana", "/cards");
    await expect(page).toHaveURL(/\/cards$/);
    const session = (await context.cookies()).find((c) => /fa_session/.test(c.name));
    expect(session, "cookie de sessao").toBeDefined();
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    const exposed = await page.evaluate(() => document.cookie);
    expect(exposed).not.toMatch(/fa_session/);
    expect(session!.expires * 1000 - Date.now()).toBeGreaterThan(23 * 3600_000);
  });

  for (const [label, next] of [["protocolo relativo", "//evil.com"], ["URL absoluta", "https://evil.com"], ["rota publica", "/demo/entries"]] as const) {
    test(`CA02: next malicioso (${label}) -> /entries`, async ({ page }) => {
      await signIn(page, "ana", next);
      await expect(page).toHaveURL(/\/entries(\?.*)?$/);
      expect(new URL(page.url()).origin).toBe("http://localhost:3100");
    });
  }

  test("sem next -> /entries com o menu da conta de quem entrou", async ({ page }) => {
    await signIn(page, "ana");
    await expect(page).toHaveURL(/\/entries/);
    await expect(page.getByRole("button", { name: "Conta de Ana Souza" })).toBeVisible();
  });
});

test.describe("credenciais e bloqueio (CA03, CA04)", () => {
  for (const [label, email, password] of [
    ["senha errada", ana.email, "errada"],
    ["e-mail inexistente", "naoexiste@exemplo.com", "qualquer1"],
    ["usuario inativo com a senha correta", bruno.email, bruno.password],
  ] as const) {
    test(`CA03: ${label} -> banner unico 'E-mail ou senha inválidos.', e-mail mantido, senha limpa e com foco`, async ({ page }) => {
      await openLogin(page);
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." })).toBeVisible();
      await expect(page.getByLabel("E-mail")).toHaveValue(email);
      await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
      await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("CA04: 429 mostra quando tentar de novo e bloqueia o botao (aria-disabled), sem limpar a senha", async ({ page }) => {
    await setScenario("rate-limited");
    await openLogin(page);
    await page.getByLabel("E-mail").fill(ana.email);
    await page.getByLabel("Senha", { exact: true }).fill(ana.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(/Muitas tentativas\. Tente novamente em \d+ minutos?, às \d{2}:\d{2}\./);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByLabel("Senha", { exact: true })).toHaveValue(ana.password);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("logout e sessao (CA05, CA06)", () => {
  test("CA05: Sair leva a /demo/entries com 'Entrar' e DemoBanner; /entries pede login; voltar + recarregar tambem", async ({ authenticatedPage }) => {
    const page = await authenticatedPage("ana");
    await page.goto("/entries");
    await page.getByRole("button", { name: "Conta de Ana Souza" }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await page.waitForURL("**/demo/entries");
    await expect(page.getByRole("banner").getByRole("link", { name: "Entrar" })).toBeVisible();
    await expect(page.getByText("Você está vendo dados de exemplo.")).toBeVisible();
    await page.goto("/entries");
    await expect(page).toHaveURL(/\/login\?next=%2Fentries/);
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(/\/login\?next=%2Fentries|\/demo\/entries/);
    await expect(page.getByRole("heading", { name: /Lançamentos/ })).toHaveCount(0);
  });

  test("CA06: sessao expirada ao recarregar -> /login?next=<rota com query>&reason=expired e banner informativo", async ({ authenticatedPage }) => {
    const page = await authenticatedPage("ana");
    await page.goto("/dashboard?month=2026-10");
    await setScenario("expired-session");
    await page.reload();
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%3Fmonth%3D2026-10&reason=expired/);
    await expect(page.getByRole("status").filter({ hasText: "Sua sessão expirou. Entre novamente." })).toBeVisible();
  });

  test("CA06: sessao expira com o drawer 'Novo lancamento' aberto -> alerta no drawer, nada criado, depois vai ao login", async ({ authenticatedPage }) => {
    const page = await authenticatedPage("ana");
    await page.goto("/entries?month=2026-11");
    await page.getByRole("button", { name: /Novo lançamento/ }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Descrição").fill("Padaria");
    await dialog.getByRole("combobox", { name: /Categoria/ }).fill("Alimentação");
    await dialog.getByLabel("Data").fill("2026-11-12");
    await dialog.getByLabel("Valor").fill("12,50");
    await setScenario("expired-session");
    await dialog.getByRole("button", { name: /Salvar|Criar/ }).click();
    await expect(dialog.getByRole("alert")).toHaveText(/Sua sessão expirou\. Entre novamente\./);
    await page.waitForURL(/\/login\?.*reason=expired/, { timeout: 5_000 });
  });

  test("troca obrigatoria vence a expiracao nao: sessao invalida em /account/password tambem vai ao login", async ({ authenticatedPage }) => {
    const page = await authenticatedPage("ana");
    await page.goto("/account/password");
    await setScenario("expired-session");
    await page.reload();
    await expect(page).toHaveURL(/\/login\?.*reason=expired/);
  });
});

test.describe("rotas do web (CA07, CA40, CA41, CA42)", () => {
  test("CA07: logado em /login vai para /entries; carla (troca pendente) vai para /account/password", async ({ page }) => {
    await signIn(page, "ana");
    await page.goto("/login");
    await expect(page).toHaveURL(/\/entries/);
    await page.context().clearCookies();
    await signIn(page, "carla");
    await page.goto("/login");
    await expect(page).toHaveURL(/\/account\/password/);
  });

  test("CA07: /register e pagina de nao encontrado (404) para visitante e para logado, sem 'Criar conta'", async ({ page }) => {
    const visitor = await page.goto("/register");
    expect(visitor?.status()).toBe(404);
    await expect(page.getByText(/Criar conta/i)).toHaveCount(0);
    await signIn(page, "ana");
    const logged = await page.goto("/register");
    expect(logged?.status()).toBe(404);
    await expect(page.getByText(/Criar conta/i)).toHaveCount(0);
  });

  for (const path of ["/cards", "/account", "/admin/users"]) {
    test(`CA40: visitante em ${path} -> /login?next=${path}, sem o HTML de dados`, async ({ page }) => {
      const response = await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
      expect(response?.url()).toContain("/login");
      await expect(page.locator("body")).not.toContainText("Nubank");
    });
  }

  test("CA41: / leva visitante a /demo/entries e logado a /entries", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/demo\/entries/);
    await signIn(page, "vagner");
    await page.goto("/");
    await expect(page).toHaveURL(/\/entries/);
    expect(new URL(page.url()).pathname).toBe("/entries");
  });

  test("CA42: logada, /demo/entries mostra dados de exemplo (nao os dela), avatar e 'Ir para meus dados'", async ({ authenticatedPage }) => {
    const page = await authenticatedPage("ana");
    await page.goto("/demo/cards");
    await expect(page.getByText("Cartão Demo")).toBeVisible();
    await expect(page.getByText("Nubank")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Conta de Ana Souza" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Entrar" })).toHaveCount(0);
    const link = banner(page).getByRole("link", { name: "Ir para meus dados" });
    await expect(link).toHaveAttribute("href", "/entries");
    await expect(banner(page).getByRole("link", { name: "Entrar" })).toHaveCount(0);
  });

  test("CA15 + RF35: USER com next=/admin/users entra e ve nao encontrado (404), sem item 'Usuarios' no menu", async ({ page }) => {
    await signIn(page, "ana", "/admin/users");
    await expect(page.getByRole("heading", { name: "Usuários" })).toHaveCount(0);
    await page.getByRole("button", { name: "Conta de Ana Souza" }).click();
    await expect(page.getByRole("menuitem", { name: "Usuários" })).toHaveCount(0);
    const response = await page.goto("/admin/users");
    expect(response?.status()).toBe(404);
  });

  test("administrador abre /admin/users", async ({ page }) => {
    await signIn(page, vagner, "/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
  });

  test("CA47: o navegador nunca chama a API diretamente (login, telas protegidas e demo)", async ({ page, apiRequests }) => {
    await signIn(page, "ana");
    await page.goto("/dashboard?month=2026-11");
    await page.goto("/demo/entries");
    await page.goto("/cards");
    expect(apiRequests).toEqual([]);
  });
});

test.describe("sem requisicoes do navegador para a API em fluxos de gestao (CA47)", () => {
  test("login do administrador, lista e criacao de usuario", async ({ page, apiRequests }) => {
    await signIn(page, "vagner", "/admin/users");
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await page.getByRole("dialog").getByLabel("Nome").fill("Teste");
    expect(apiRequests).toEqual([]);
  });
});

