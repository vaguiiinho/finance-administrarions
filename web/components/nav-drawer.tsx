"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconButton } from "./ui/button";
import { ModalDialog } from "./ui/modal-dialog";
import { Icon } from "./ui/status";
import { MainNav, hasActiveNavItem } from "./main-nav";
import { DemoChip } from "./demo-chip";

const XL_QUERY = "(min-width: 1280px)";

/** Corpo do drawer: foco inicial no item ativo (ou no primeiro) e fechamento ao passar a `xl`. */
function DrawerBody({ basePath, demo, titleId, onClose, onWide }: { basePath: "" | "/demo"; demo: boolean; titleId: string; onClose: () => void; onWide: () => void }) {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(XL_QUERY);
    const listener = (event: { matches: boolean }) => {
      if (event.matches) onWide();
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [onWide]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4 md:h-16">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-text">Finanças</span>
          {demo ? <DemoChip /> : null}
        </div>
        <IconButton aria-label="Fechar menu de navegação" className="border-0" onClick={onClose}>
          <Icon name="close" size={20} />
        </IconButton>
      </div>
      <h2 id={titleId} className="sr-only">
        Menu de navegação
      </h2>
      <div className="flex-1 overflow-y-auto p-3 pt-4">
        <MainNav basePath={basePath} onNavigate={onClose} />
      </div>
    </div>
  );
}

/**
 * Botao de menu (abaixo de `xl`) + drawer de navegacao a esquerda (design 17.6): `<dialog>` modal montado so quando
 * aberto, foco no item ativo, Esc/scrim/"Fechar" fecham e devolvem o foco ao botao; navegar (mudanca de pathname)
 * fecha; passar a `xl` fecha e leva o foco ao item ativo do menu lateral.
 */
export function NavDrawer({ basePath = "", demo = false }: { basePath?: "" | "/demo"; demo?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const dialogId = useId();

  // voltar/avancar do navegador ou clicar num item: o pathname muda e o drawer fecha (ajuste durante a renderizacao)
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const closeBecauseWide = () => {
    setOpen(false);
    // o botao deixa de existir: o foco vai para o item ativo do menu lateral, que passa a existir
    document.querySelector<HTMLElement>("[data-sidebar] a[aria-current='page']")?.focus();
  };

  return (
    <>
      <IconButton
        ref={triggerRef}
        aria-label="Abrir menu de navegação"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        className="border-0 xl:hidden"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={24} />
      </IconButton>
      {open ? (
        <ModalDialog id={dialogId} variant="drawer-left" labelledBy={titleId} onClose={close} initialFocus={hasActiveNavItem(pathname, basePath) ? "a[aria-current='page']" : "nav a"}>
          <DrawerBody basePath={basePath} demo={demo} titleId={titleId} onClose={close} onWide={closeBecauseWide} />
        </ModalDialog>
      ) : null}
    </>
  );
}
