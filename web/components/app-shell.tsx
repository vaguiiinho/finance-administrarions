import type { ReactNode } from "react";
import type { CurrentUserDto } from "@/lib/api/types";
import { currentYearMonthSP } from "@/lib/dates/format";
import { AppFooter } from "./app-footer";
import { AppHeader } from "./app-header";
import { FlashToast } from "./flash-toast";
import { PROTECTED_MODE, type AppMode } from "@/lib/app-mode";
import { AppModeProvider } from "./app-mode";
import { AppSidebar } from "./app-sidebar";
import { NavProvider } from "./navigation";
import { ToastProvider } from "./ui/toast";

interface AppShellProps {
  children: ReactNode;
  user?: CurrentUserDto | null;
  mode?: AppMode;
  /** `auth`: login e not-found global (so marca e tema, sem menu). */
  shell?: "app" | "auth";
  /** Modo restrito (troca obrigatoria): sem menu lateral, sem botao de menu, footer sem link (DA11, DL7). */
  restricted?: boolean;
  /** Aviso persistente acima do conteudo (DemoBanner). */
  banner?: ReactNode;
  /** "Ver demonstracao" no footer: so nas telas protegidas normais (PL3). */
  showDemoLink?: boolean;
  /** Centraliza o conteudo na vertical (login). */
  centered?: boolean;
}

const COLUMN = "mx-auto w-full max-w-[1280px] px-4 md:px-6 lg:px-8";

/**
 * Layout global (design 17): navbar de largura total, menu lateral fixo a partir de `xl` (fora do login e do modo restrito),
 * coluna de conteudo com `DemoBanner`, `<main id="conteudo">` e o footer no pe. O container nunca recebe filter/opacity/mask/
 * backdrop-filter (regras de vidro, 17.10).
 */
export function AppShell({ children, user = null, mode = PROTECTED_MODE, shell = "app", restricted = false, banner, showDemoLink = false, centered = false }: AppShellProps) {
  const navigation = shell === "app" && !restricted;
  const year = Number(currentYearMonthSP().slice(0, 4));
  return (
    <AppModeProvider mode={mode}>
      <ToastProvider>
        <NavProvider>
          <FlashToast />
          <AppHeader user={user} mode={mode} shell={shell} />
          <div className="xl:flex">
            {navigation ? <AppSidebar basePath={mode.basePath} /> : null}
            <div className="flex min-h-[calc(100dvh-var(--navbar-h))] min-w-0 flex-1 flex-col">
              {banner ? <div className={COLUMN}>{banner}</div> : null}
              <main id="conteudo" tabIndex={-1} className={`${COLUMN} py-4 outline-none md:py-6 ${centered ? "flex flex-1 flex-col justify-center" : ""}`}>
                {children}
              </main>
              <div className="mt-auto">
                <div className={COLUMN}>
                  <AppFooter year={year} version={process.env.APP_VERSION} showDemoLink={showDemoLink && !restricted} />
                </div>
              </div>
            </div>
          </div>
        </NavProvider>
      </ToastProvider>
    </AppModeProvider>
  );
}
