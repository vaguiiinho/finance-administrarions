import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { THEMES, VIEWPORTS, expect, focusRingVisible, menuButton, openAccountMenu, signIn, smallTargets, test, type StubUserKey } from "./auth-support";
import { PAGE_BG_REGION, audit, auditPageGradient, releaseMutations, setScenario, setThemeCookie } from "./support";

/**
 * CA46 (RNF09): axe nos temas claro e escuro, em 360 e 1280 px, nas telas novas e nos estados pedidos pela spec, mais alvos >= 44px
 * e foco visivel. Segue o formato de `a11y.pw.ts` (camada 2 do ADR 0003 5.5): contraste com `audit`/`auditPageGradient` e regras
 * WCAG A/AA do axe. Quem navega precisa da sessao do stub (`auth`).
 */
test.use({ actionTimeout: 5_000 });

interface Screen {
  name: string;
  /** Usuario do stub com sessao antes de abrir a tela (omitido = visitante). */
  auth?: StubUserKey;
  url: string;
  scenario?: string;
  prepare?: (page: Page) => Promise<void>;
  /** Estado que precisa continuar de pe durante a auditoria (ex.: "Entrando…"). */
  holds?: boolean;
  only?: keyof typeof VIEWPORTS;
  /** A tela certa esta de pe (evita auditar a pagina 404 e dar falso verde na fase RED). */
  h1?: string;
}

const dialog = (page: Page) => page.getByRole("dialog");
const row = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });
const fillLogin = async (page: Page, email: string, password: string) => {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
};

const SCREENS: Screen[] = [
  { name: "login vazio", h1: "Entrar", url: "/login" },
  { name: "login com contexto next", h1: "Entrar", url: "/login?next=/cards" },
  { name: "login com erro de campo", h1: "Entrar", url: "/login", prepare: async (p) => { await p.getByRole("button", { name: "Entrar", exact: true }).click(); await p.getByText("Informe o e-mail ou usuário.").waitFor(); } },
  { name: "login com banner de credenciais", h1: "Entrar", url: "/login", prepare: async (p) => { await fillLogin(p, "ana@exemplo.com", "errada"); await p.getByRole("button", { name: "Entrar", exact: true }).click(); await p.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." }).waitFor(); } },
  { name: "login sessao expirada", h1: "Entrar", url: "/login?next=%2Fcards&reason=expired" },
  { name: "login 429", h1: "Entrar", url: "/login", scenario: "rate-limited", prepare: async (p) => { await fillLogin(p, "ana@exemplo.com", "x"); await p.getByRole("button", { name: "Entrar", exact: true }).click(); await p.getByRole("alert").filter({ hasText: "Muitas tentativas" }).waitFor(); } },
  { name: "login carregando", h1: "Entrar", url: "/login", holds: true, prepare: async (p) => { await setScenario("default", { holdMutations: true }); await fillLogin(p, "ana@exemplo.com", "segredo123"); await p.getByRole("button", { name: "Entrar", exact: true }).click(); await p.getByRole("button", { name: "Entrando…" }).waitFor(); } },
  { name: "trocar senha obrigatoria (modo restrito)", h1: "Trocar senha", auth: "carla", url: "/account/password?next=%2Fcards" },
  { name: "trocar senha opcional", h1: "Trocar senha", auth: "ana", url: "/account/password" },
  { name: "trocar senha com erro", h1: "Trocar senha", auth: "ana", url: "/account/password", prepare: async (p) => { await p.getByLabel("Senha atual", { exact: true }).fill("segredo123"); await p.getByLabel("Nova senha", { exact: true }).fill("MinhaSenha9"); await p.getByLabel("Confirmar nova senha", { exact: true }).fill("Outra12345"); await p.getByRole("button", { name: "Salvar nova senha" }).click(); await p.getByText("As senhas não conferem.").waitFor(); } },
  { name: "meu perfil", h1: "Meu perfil", auth: "ana", url: "/account" },
  { name: "usuarios: lista com inativo", h1: "Usuários", auth: "vagner", url: "/admin/users" },
  { name: "usuarios: formulario com erro", h1: "Usuários", auth: "vagner", url: "/admin/users", prepare: async (p) => { await p.getByRole("button", { name: "Novo usuário" }).click(); await dialog(p).getByRole("button", { name: "Criar usuário" }).click(); await dialog(p).getByText("Informe o nome.").waitFor(); } },
  { name: "usuarios: dialogo de inativar", h1: "Usuários", auth: "vagner", url: "/admin/users", prepare: async (p) => { await row(p, "Ana Souza").getByRole("button", { name: /Inativar/ }).click(); await p.getByRole("alertdialog").waitFor(); } },
  { name: "usuarios: dialogo de redefinir senha", h1: "Usuários", auth: "vagner", url: "/admin/users", prepare: async (p) => { await row(p, "Ana Souza").getByRole("button", { name: /Redefinir senha/ }).click(); await dialog(p).waitFor(); } },
  { name: "menu da conta aberto", h1: "Cartões", auth: "ana", url: "/cards", prepare: async (p) => { await openAccountMenu(p, "Ana Souza"); } },
  { name: "menu da conta do administrador aberto", h1: "Cartões", auth: "vagner", url: "/cards", prepare: async (p) => { await openAccountMenu(p, "Vagner"); } },
  { name: "tela protegida com menu lateral", h1: "Cartões", auth: "ana", url: "/cards", only: "desktop" },
  { name: "drawer de navegacao aberto", h1: "Cartões", auth: "ana", url: "/cards", only: "mobile", prepare: async (p) => { await menuButton(p).click(); await p.getByRole("dialog", { name: "Menu de navegação" }).waitFor(); } },
  { name: "pagina de nao encontrado (/register)", url: "/register" },
];

for (const theme of THEMES) {
  for (const [vpName, size] of Object.entries(VIEWPORTS) as [keyof typeof VIEWPORTS, { width: number; height: number }][]) {
    test.describe(`CA46 axe - ${theme} - ${vpName} (${size.width}px)`, () => {
      for (const screen of SCREENS.filter((s) => !s.only || s.only === vpName)) {
        test(screen.name, async ({ context, page }) => {
          const label = `${screen.name} [${theme} ${size.width}]`;
          await setScenario("default");
          await setThemeCookie(context, theme);
          await page.setViewportSize(size);
          if (screen.auth) await signIn(page, screen.auth);
          if (screen.scenario) await setScenario(screen.scenario);
          await page.goto(screen.url);
          await page.waitForLoadState("networkidle");
          try {
            if (screen.h1) await expect(page.getByRole("heading", { level: 1, name: screen.h1 })).toBeVisible();
            else await expect(page.getByRole("contentinfo"), "o not-found global usa o shell de autenticacao (marca, tema e footer)").toBeVisible();
            await screen.prepare?.(page);
            await audit(page, label, { gradients: [PAGE_BG_REGION] });
            await auditPageGradient(page, label);
            const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).disableRules(["color-contrast"]).analyze();
            expect(axe.violations, `${label}: violacoes axe`).toEqual([]);
            expect(await smallTargets(page), `${label}: alvos < 44px`).toEqual([]);
            for (let i = 0; i < 3; i++) {
              await page.keyboard.press("Tab");
              const visible = await page.evaluate(() => {
                const el = document.activeElement as HTMLElement | null;
                if (!el || el === document.body) return true;
                const s = getComputedStyle(el);
                return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
              });
              expect(visible, `${label}: foco visivel no ${i + 1}o Tab`).toBe(true);
            }
            if (screen.holds) await expect(page.getByRole("button", { name: "Entrando…" })).toBeVisible();
          } finally {
            if (screen.holds) await releaseMutations().catch(() => undefined);
          }
        });
      }
    });
  }
}

test.describe("CA46: foco visivel em controles-chave", () => {
  test("avatar e botao de menu mostram anel de foco ao receber foco por teclado", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await signIn(page, "ana");
    expect(await focusRingVisible(menuButton(page))).toBe(true);
    expect(await focusRingVisible(page.getByRole("button", { name: "Conta de Ana Souza" }))).toBe(true);
  });
});
