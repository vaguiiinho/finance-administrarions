import Link from "next/link";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme/theme";
import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme/theme-toggle";

/**
 * Navbar fixa (design 2.1): linha 1 fixa (marca, links >= sm, tema); abaixo de `sm` os links vao para uma
 * segunda linha que rola com a pagina (a faixa de abas gruda logo abaixo da linha 1).
 */
export async function AppHeader() {
  const initialTheme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:border focus:border-border-strong focus:bg-surface focus:px-4 focus:py-2 focus:text-text">
        Pular para o conteúdo
      </a>
      <header data-navbar className="sticky top-0 z-40 border-b border-border bg-header backdrop-blur-md">
        <div className="mx-auto flex h-[var(--navbar-h)] max-w-[1280px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/entries" className="font-display text-lg font-bold text-text no-underline">
              Finanças
            </Link>
            <MainNav className="hidden sm:block" />
          </div>
          <ThemeToggle initialTheme={initialTheme} />
        </div>
      </header>
      <div className="border-b border-border sm:hidden">
        <MainNav className="mx-auto max-w-[1280px] px-1" label="Principal (mobile)" />
      </div>
    </>
  );
}
