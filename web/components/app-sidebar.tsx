import { MainNav } from "./main-nav";

/**
 * Menu lateral fixo a partir de `xl` (design 17.5): vidro de barra, 240px, sticky abaixo da navbar, sem z-index, sem
 * botao de recolher (DL3). Abaixo de `xl` e `display: none` (a navegacao fica no drawer), entao so ha uma <nav> Principal.
 */
export function AppSidebar({ basePath = "" }: { basePath?: "" | "/demo" }) {
  return (
    <div data-sidebar className="glass-bar sticky top-[var(--navbar-h)] hidden h-[calc(100dvh-var(--navbar-h))] w-60 shrink-0 self-start overflow-y-auto border-r border-card-border px-3 pt-4 xl:block">
      <MainNav basePath={basePath} />
    </div>
  );
}
