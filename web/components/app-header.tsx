import Link from "next/link";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme/theme";
import type { CurrentUserDto } from "@/lib/api/types";
import { PROTECTED_MODE, type AppMode } from "@/lib/app-mode";
import { AccountMenu } from "./account-menu";
import { DemoChip } from "./demo-chip";
import { NavDrawer } from "./nav-drawer";
import { SignInButton } from "./sign-in-button";
import { ThemeToggle } from "./theme/theme-toggle";

const BRAND = "font-display text-lg font-bold text-text no-underline";
// link da marca com alvo de 44px (CA46); a versao em texto (modo restrito) usa so `BRAND`
const BRAND_LINK = `${BRAND} inline-flex min-h-11 items-center`;

/**
 * Navbar de UMA linha em todos os breakpoints (design 2.1, 17.4, DL1, DL8): a esquerda botao de menu (abaixo de `xl`),
 * marca e chip da demo; a direita tema e conta (ou "Entrar"). Os links da navegacao principal vivem no menu lateral/drawer.
 * - `shell="auth"` (login, not-found): so marca (-> `/`) e tema.
 * - Modo restrito (`mustChangePassword`): sem botao de menu, marca como texto, menu da conta so com "Sair" (DA11).
 */
export async function AppHeader({ user = null, mode = PROTECTED_MODE, shell = "app" }: { user?: CurrentUserDto | null; mode?: AppMode; shell?: "app" | "auth" } = {}) {
  const initialTheme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const auth = shell === "auth";
  const restricted = !auth && user?.mustChangePassword === true;
  const demo = mode.kind === "demo";

  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:border focus:border-border-strong focus:bg-surface focus:px-4 focus:py-2 focus:text-text">
        Pular para o conteúdo
      </a>
      <header data-navbar className="sticky top-0 z-40 glass-bar border-b border-card-border">
        <div className="flex h-[var(--navbar-h)] items-center justify-between gap-2 px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            {auth || restricted ? null : <NavDrawer basePath={mode.basePath} demo={demo} />}
            {restricted ? (
              <span className={BRAND}>Finanças</span>
            ) : (
              <Link href={auth ? "/" : `${mode.basePath}/entries`} className={BRAND_LINK}>
                Finanças
              </Link>
            )}
            {!auth && demo ? <DemoChip className="hidden sm:inline-flex" /> : null}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle initialTheme={initialTheme} />
            {auth ? null : user ? <AccountMenu user={user} /> : <SignInButton />}
          </div>
        </div>
      </header>
    </>
  );
}
