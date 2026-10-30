import { STUB_USERS, THEMES, VIEWPORTS, accountButton, banner, expect, menuButton, navbar, openAccountMenu, signIn, test } from "./auth-support";
import { setScenario, setThemeCookie } from "./support";

/**
 * Modo demonstracao, navbar e layout global (CA38-CA45; design 2, 7 e 17). Telas so de visualizacao, menu lateral fixo
 * a partir de 1280px e drawer abaixo, footer, "Entrar" e menu da conta.
 */
test.use({ actionTimeout: 5_000 });
test.beforeEach(async () => {
  await setScenario("default");
});
const WRITE_CONTROLS = [/Novo lançamento/, /Pagar selecionadas/, /Marcar como pago/, /Pagar fatura/, /Novo cartão/, /^Editar/, /^Pagar/];

test.describe("demo so de visualizacao (CA38, RF30-RF32)", () => {
  test("CA38: /demo/entries funciona (abas, mes, filtro, pagina, fatura) e NAO tem elementos de escrita no DOM", async ({ page }) => {
    await page.goto("/demo/entries?month=2026-11");
    await expect(page.getByText("Você está vendo dados de exemplo.")).toBeVisible();
    await expect(page.getByText("Os dados são fictícios e não podem ser alterados.")).toBeVisible();
    for (const re of WRITE_CONTROLS) await expect(page.getByRole("button", { name: re })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByText(/Demo/).first()).toBeVisible();
    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(page).toHaveURL(/\/demo\/entries\?.*tab=invoices/);
    const expand = page.getByRole("button", { name: /^Ver .* da fatura/ }).first();
    await expand.click();
    await expect(expand).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("tab", { name: "Receitas" }).click();
    await expect(page).toHaveURL(/\/demo\/entries/);
    await page.getByRole("button", { name: /Próximo mês/ }).click();
    await expect(page).toHaveURL(/month=2026-12/);
    for (const re of WRITE_CONTROLS) await expect(page.getByRole("button", { name: re })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("CA38: /demo/cards nao tem 'Novo cartão' nem 'Editar'; estado vazio sem CTA", async ({ page }) => {
    await page.goto("/demo/cards");
    await expect(page.getByText("Cartão Demo")).toBeVisible();
    await expect(page.getByRole("button", { name: /Novo cartão|Editar/ })).toHaveCount(0);
    await setScenario("empty");
    await page.goto("/demo/cards");
    await expect(page.getByRole("button", { name: /Novo cartão/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Novo cartão/ })).toHaveCount(0);
  });

  test("/demo/dashboard e leitura pura: graficos e totais aparecem", async ({ page }) => {
    await page.goto("/demo/dashboard?month=2026-11");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("group", { name: /Gráfico de evolução mensal/ })).toBeVisible();
  });

  test("CA38: nenhuma interacao na demo abre convite, dialogo ou drawer de escrita", async ({ page }) => {
    await page.goto("/demo/entries?month=2026-11");
    await page.getByRole("tab", { name: "Despesas" }).click();
    await page.locator("tbody tr").first().click().catch(() => undefined);
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("titulos das telas de demo: 'Lancamentos (demonstracao) | Financas' etc.", async ({ page }) => {
    await page.goto("/demo/entries");
    await expect(page).toHaveTitle("Lançamentos (demonstração) | Finanças");
    await page.goto("/demo/dashboard");
    await expect(page).toHaveTitle("Dashboard (demonstração) | Finanças");
    await page.goto("/demo/cards");
    await expect(page).toHaveTitle("Cartões (demonstração) | Finanças");
  });
});

test.describe("navegacao da demo (CA39, RF33)", () => {
  test("CA39: o menu lateral leva a /demo/*, 'Dashboard' tem aria-current em /demo/dashboard", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/demo/dashboard?month=2026-11");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link")).toHaveCount(3);
    await expect(nav.getByRole("link", { name: "Lançamentos" })).toHaveAttribute("href", "/demo/entries");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/demo/dashboard");
    await expect(nav.getByRole("link", { name: "Cartões" })).toHaveAttribute("href", "/demo/cards");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Cartões" }).click();
    await expect(page).toHaveURL(/\/demo\/cards/);
    await expect(nav.getByRole("link", { name: "Cartões" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe('"Entrar" e banner (CA43, RF37)', () => {
  for (const [label, size] of [["360", VIEWPORTS.mobile], ["1280", VIEWPORTS.desktop]] as const) {
    test(`CA43 (${label}px): visitante em /demo/cards ve 'Entrar' ao lado do tema -> /login?next=/cards, sem avatar nem 'Criar conta'`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/demo/cards");
      const signin = navbar(page).getByRole("link", { name: "Entrar" });
      await expect(signin).toBeVisible();
      await expect(signin).toHaveAttribute("href", "/login?next=/cards");
      await expect(navbar(page).getByRole("button", { name: "Tema escuro" })).toBeVisible();
      await expect(navbar(page).getByRole("button", { name: /Conta de/ })).toHaveCount(0);
      await expect(page.getByText(/Criar conta/i)).toHaveCount(0);
      const box = (await signin.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    });
  }

  test("banner do visitante: unica acao 'Entrar' com next equivalente (dashboard preserva so o caminho)", async ({ page }) => {
    await page.goto("/demo/dashboard?month=2026-10");
    const link = banner(page).getByRole("link");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText("Entrar");
    await expect(link).toHaveAttribute("href", "/login?next=/dashboard");
  });

  test("chip 'Demonstração' na navbar a partir de sm; marca leva a /demo/entries", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await page.goto("/demo/entries");
    await expect(navbar(page).getByText("Demonstração")).toBeVisible();
    await expect(navbar(page).getByRole("link", { name: "Finanças" })).toHaveAttribute("href", "/demo/entries");
  });
});

test.describe("menu da conta (CA44, CA45, RF38-RF40)", () => {
  test("CA44: avatar 'A' com nome acessivel; abre por clique com 1o item focado; Esc fecha e devolve o foco; clicar fora fecha", async ({ page }) => {
    await signIn(page, "ana");
    const avatar = accountButton(page, "Ana Souza");
    await expect(avatar).toHaveText("A");
    await expect(avatar).toHaveAttribute("aria-haspopup", "menu");
    await expect(avatar).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("link", { name: "Entrar" })).toHaveCount(0);
    const menu = await openAccountMenu(page, "Ana Souza");
    await expect(avatar).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("menuitem")).toHaveText(["Meu perfil", "Trocar senha", "Sair"]);
    await expect(page.locator("#account-menu-header")).toContainText("ana@exemplo.com");
    await expect(menu.getByRole("menuitem", { name: "Meu perfil" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(avatar).toBeFocused();
    await avatar.press("Enter");
    await expect(menu).toBeVisible();
    await page.mouse.click(10, 400);
    await expect(menu).toBeHidden();
  });

  test("CA44: administrador tem 'Usuarios' que leva a /admin/users", async ({ page }) => {
    await signIn(page, "vagner");
    const menu = await openAccountMenu(page, "Vagner");
    await expect(menu.getByRole("menuitem")).toHaveText(["Meu perfil", "Trocar senha", "Usuários", "Sair"]);
    await menu.getByRole("menuitem", { name: "Usuários" }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
  });

  test("teclado: setas com volta circular, Home/End, type-ahead e Tab fecha", async ({ page }) => {
    await signIn(page, "vagner");
    const avatar = accountButton(page, "Vagner");
    await avatar.focus();
    await page.keyboard.press("ArrowUp");
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Sair" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Meu perfil" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: "Sair" })).toBeFocused();
    await page.keyboard.press("u");
    await expect(menu.getByRole("menuitem", { name: "Usuários" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(menu).toBeHidden();
  });

  test("em 360px o menu cabe na tela (nao sai da viewport)", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await signIn(page, "ana");
    const menu = await openAccountMenu(page, "Ana Souza");
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
  });

  test("CA45: nome com acento e espacos mostra 'Á' (administrador renomeia pela gestao)", async ({ page }) => {
    await signIn(page, "vagner", "/admin/users");
    await page.getByRole("row").filter({ hasText: "Ana Souza" }).getByRole("button", { name: /Editar/ }).click();
    await page.getByRole("dialog").getByLabel("Nome", { exact: true }).fill("  álvaro lima");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();
    const ctx = await page.context().browser()!.newContext();
    const other = await ctx.newPage();
    await signIn(other, "ana");
    await expect(other.getByRole("button", { name: "Conta de álvaro lima" })).toHaveText("Á");
    await ctx.close();
  });
});

test.describe("layout global: menu lateral, drawer e footer (design 17)", () => {
  test("1280px: menu lateral fixo com 3 itens, sem botao de menu; item ativo com aria-current", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, "ana", "/dashboard?month=2026-11");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveText(["Lançamentos", "Dashboard", "Cartões"]);
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(menuButton(page)).toBeHidden();
    const box = (await nav.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(240 + 1);
    await expect(navbar(page).getByRole("navigation")).toHaveCount(0);
  });

  test("1279px: sem menu lateral; botao de menu visivel", async ({ page }) => {
    await page.setViewportSize({ width: 1279, height: 900 });
    await signIn(page, "ana", "/dashboard?month=2026-11");
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeHidden();
    await expect(menuButton(page)).toBeVisible();
  });

  test("360px: drawer abre com o item ativo focado, Esc devolve o foco ao botao, item navega e fecha", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await signIn(page, "ana", "/entries?month=2026-11");
    await menuButton(page).click();
    const drawer = page.getByRole("dialog", { name: "Menu de navegação" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Lançamentos" })).toBeFocused();
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
    await menuButton(page).click();
    await drawer.getByRole("link", { name: "Cartões" }).click();
    await expect(page).toHaveURL(/\/cards/);
    await expect(drawer).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });

  test("360px: tocar no scrim fecha sem navegar", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await signIn(page, "ana", "/entries?month=2026-11");
    await menuButton(page).click();
    await page.mouse.click(350, 400);
    await expect(page.getByRole("dialog", { name: "Menu de navegação" })).toBeHidden();
    await expect(page).toHaveURL(/\/entries/);
  });

  test("redimensionar para >= 1280px com o drawer aberto fecha e mostra o menu lateral", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await signIn(page, "ana", "/entries?month=2026-11");
    await menuButton(page).click();
    await expect(page.getByRole("dialog", { name: "Menu de navegação" })).toBeVisible();
    await page.setViewportSize({ width: 1300, height: 900 });
    await expect(page.getByRole("dialog", { name: "Menu de navegação" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
  });

  test("demo em 360px: drawer com chip 'Demonstracao' e itens /demo/*, sem itens de administracao", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/demo/cards");
    await menuButton(page).click();
    const drawer = page.getByRole("dialog", { name: "Menu de navegação" });
    await expect(drawer.getByText("Demonstração")).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Cartões" })).toHaveAttribute("aria-current", "page");
    await expect(drawer.getByRole("link")).toHaveCount(3);
  });

  test("navbar tem uma linha so em 360px: a faixa de links abaixo da navbar nao existe", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await signIn(page, "ana", "/entries?month=2026-11");
    await expect(page.getByRole("navigation", { name: "Principal (mobile)" })).toHaveCount(0);
    const box = (await navbar(page).boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(64);
  });

  test("footer: 'Finanças · © ano · Versão' em todos os shells; 'Ver demonstracao' so nas telas protegidas normais", async ({ page }) => {
    const year = String(new Date().getFullYear());
    await signIn(page, "ana", "/cards");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText(`© ${year}`);
    await expect(footer).toContainText(/Versão \d+\.\d+\.\d+/);
    await expect(footer.getByRole("link", { name: "Ver demonstração" })).toHaveAttribute("href", "/demo/entries");
    await page.goto("/demo/cards");
    await expect(page.getByRole("contentinfo").getByRole("link")).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toContainText("Versão");
  });

  test("footer fica fora do <main> e depois dele", async ({ page }) => {
    await signIn(page, "ana", "/cards");
    expect(await page.locator("main footer").count()).toBe(0);
    const order = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const footer = document.querySelector("footer")!;
      return Boolean(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });

  test("'Pular para o conteudo' leva ao <main>, pulando navbar, menu lateral e banner", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/demo/entries");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#conteudo")).toBeFocused();
  });

  test("ordem de foco a partir de xl: pular, marca, tema, Entrar, itens do menu lateral, banner, conteudo", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/demo/entries");
    const names: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      names.push(await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "").trim()));
    }
    const idx = (re: RegExp) => names.findIndex((n) => re.test(n));
    expect(idx(/Pular/)).toBe(0);
    expect(idx(/Finanças/)).toBeLessThan(idx(/Tema escuro/));
    expect(idx(/Tema escuro/)).toBeLessThan(idx(/^Entrar$/));
    expect(idx(/^Entrar$/)).toBeLessThan(idx(/Lançamentos/));
    expect(idx(/Cartões/)).toBeLessThan(names.lastIndexOf("Entrar"));
  });

  test("temas: menu lateral e drawer funcionam nos dois temas", async ({ page, context }) => {
    for (const theme of THEMES) {
      await setThemeCookie(context, theme);
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto("/demo/entries");
      await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    }
  });
});

test.describe("modo restrito e login sem navegacao (DL7, DA11)", () => {
  test("carla (troca obrigatoria): navbar sem botao de menu e sem menu lateral em 360 e 1280", async ({ page }) => {
    for (const size of [VIEWPORTS.mobile, VIEWPORTS.desktop]) {
      await page.setViewportSize(size);
      await page.context().clearCookies();
      await signIn(page, STUB_USERS.carla);
      await expect(menuButton(page)).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
    }
  });
});

