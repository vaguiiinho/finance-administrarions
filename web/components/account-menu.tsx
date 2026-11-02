"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/(auth)/actions";
import type { Capability, CurrentUserDto } from "@/lib/api/types";
import { Icon } from "./ui/status";
import { useOptionalToast } from "./ui/toast";
import { UserAvatar } from "./user-avatar";

const HEADER_ID = "account-menu-header";
const SIGN_OUT_ERROR = "Não foi possível sair. Verifique sua conexão e tente novamente.";
const ITEM = "relative flex min-h-11 w-full items-center gap-3 px-4 text-left text-base font-medium text-text no-underline hover:bg-surface-2 focus-visible:bg-surface-active focus-visible:[outline-offset:-2px]";
const CURRENT = "before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-sm before:bg-accent";

/** "Sair" (RNF08): botao submit de um <form> com Server Action, nunca um link GET. Carregando: "Saindo…" + `aria-busy`. */
function SignOutItem() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" role="menuitem" aria-busy={pending || undefined} onClick={(event) => pending && event.preventDefault()} className={ITEM}>
      {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="logout" size={20} />}
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}

/**
 * Avatar + menu da conta (design 2.3-2.4, APG *menu button*). O menu e um popover opaco na top layer (DA3, PA5); o
 * cabecalho (nome, e-mail) fica FORA do `role="menu"` e o descreve (DA4). Com troca obrigatoria so ha "Sair" (RF38).
 */
export function AccountMenu({ user }: { user: CurrentUserDto }) {
  const pathname = usePathname();
  const toast = useOptionalToast();
  const buttonId = useId();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 8 });
  const [lastPath, setLastPath] = useState(pathname);
  const initialItem = useRef<"first" | "last">("first");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const can = (capability: Capability) => user.capabilities?.includes(capability) ?? false;
  const restricted = user.mustChangePassword;
  const links = restricted
    ? []
    : [
        ...(can("UPDATE_OWN_PROFILE") ? [{ href: "/account", label: "Meu perfil", icon: "person" as const }] : []),
        ...(can("CHANGE_OWN_PASSWORD") ? [{ href: "/account/password", label: "Trocar senha", icon: "key" as const }] : []),
        ...(can("MANAGE_USERS") ? [{ href: "/admin/users", label: "Usuários", icon: "group" as const }] : []),
      ];

  // navegar fecha o menu (ajuste durante a renderizacao)
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
  };
  const show = (which: "first" | "last") => {
    initialItem.current = which;
    place();
    setOpen(true);
  };
  const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
  const closeToButton = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Popover na top layer + foco inicial (primeiro ou ultimo item)
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // top layer so onde ha Popover API; sem ela o menu fica como <div> fixo (z-index da navbar)
    if (panel && typeof panel.showPopover === "function") {
      panel.setAttribute("popover", "manual");
      panel.showPopover();
    }
    const list = items();
    (initialItem.current === "last" ? list.at(-1) : list[0])?.focus();
  }, [open]);

  // Fechar por clique/toque fora (sem mover o foco) e reposicionar no resize
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      show("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      show("last");
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      closeToButton();
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(-1);
        break;
      case "Escape":
        event.preventDefault();
        closeToButton();
        break;
      case "Tab":
        // fecha e deixa a ordem natural seguir a partir do botao
        buttonRef.current?.focus();
        setOpen(false);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const letter = event.key.toLocaleLowerCase("pt-BR");
          const ordered = [...list.slice(index + 1), ...list.slice(0, index + 1)];
          ordered.find((item) => item.textContent?.trim().toLocaleLowerCase("pt-BR").startsWith(letter))?.focus();
        }
    }
  };

  async function signOut() {
    try {
      await logoutAction();
    } catch {
      toast?.push({ kind: "error", message: SIGN_OUT_ERROR });
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-label={`Conta de ${user.name}`}
        title={`${user.name} (${user.email})`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? closeToButton() : show("first"))}
        onKeyDown={onButtonKeyDown}
        className={`inline-flex size-11 items-center justify-center rounded-full p-0 focus:[outline-offset:var(--focus-offset)] focus:[outline:var(--focus-ring)] ${open ? "outline outline-2 outline-offset-2 outline-primary-border" : ""}`}
      >
        <UserAvatar name={user.name} />
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          onKeyDown={onMenuKeyDown}
          style={{ top: position.top, right: position.right, left: "auto", bottom: "auto" }}
          className="fixed m-0 w-[min(288px,calc(100vw-16px))] overflow-hidden rounded-xl border border-border-strong bg-surface p-0 text-text shadow-[0_8px_24px_-8px_var(--shadow-color),0_2px_6px_var(--shadow-color)]"
        >
          <div id={HEADER_ID} className="flex items-center gap-3 p-4">
            <UserAvatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-text" title={user.name}>
                {user.name}
              </p>
              <p className="truncate text-sm text-muted" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>
          <ul role="menu" aria-labelledby={buttonId} aria-describedby={HEADER_ID} className="border-t border-border">
            {links.map((link) => (
              <li key={link.href} role="none">
                <Link href={link.href} role="menuitem" aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)} className={`${ITEM} ${pathname === link.href ? CURRENT : ""}`}>
                  <span className="text-muted">
                    <Icon name={link.icon} size={20} />
                  </span>
                  {link.label}
                </Link>
              </li>
            ))}
            {links.length > 0 ? <li role="separator" className="border-t border-border" /> : null}
            <li role="none">
              <form action={signOut}>
                <SignOutItem />
              </form>
            </li>
          </ul>
        </div>
      ) : null}
    </>
  );
}
