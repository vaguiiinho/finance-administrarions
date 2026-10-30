import type { CurrentUserDto } from "@/lib/api/types";
import { DemoBannerAction } from "./demo-banner-action";
import { Icon } from "./ui/status";

/**
 * Aviso persistente da demo (design 2.5, RF32, RF36): regiao estatica (sem alert/status, sem fechar) com UMA acao por
 * variante: visitante -> "Entrar" (com `next` equivalente); logado -> "Ir para meus dados". `path` = caminho atual.
 */
export function DemoBanner({ user, path }: { user: CurrentUserDto | null; path: string }) {
  return (
    <section aria-labelledby="demo-banner-title" className="glass mt-4 flex flex-col gap-3 rounded-lg border border-l-[3px] border-border-strong border-l-accent p-3 text-text md:mt-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-accent">
          <Icon name="eye" size={20} />
        </span>
        <div className="flex flex-col gap-0.5 text-sm">
          <h2 id="demo-banner-title" className="text-sm font-semibold text-text">
            Você está vendo dados de exemplo.
          </h2>
          <p className="text-muted">{user ? "Seus lançamentos não aparecem aqui." : "Os dados são fictícios e não podem ser alterados."}</p>
        </div>
      </div>
      <DemoBannerAction loggedIn={user !== null} path={path} />
    </section>
  );
}
