import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { setFlash } from "@/lib/flash";

const nav = vi.hoisted(() => ({ pathname: "/account/password" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { FlashToast } from "./flash-toast";

beforeEach(() => window.sessionStorage.clear());

describe("FlashToast (design 4.4)", () => {
  it("mostra o aviso pendente quando a rota muda e nao repete", () => {
    const tree = () => (
      <ToastProvider>
        <FlashToast />
      </ToastProvider>
    );
    const { rerender } = render(tree());
    expect(screen.queryByText("Senha alterada.")).not.toBeInTheDocument();
    setFlash("Senha alterada.");
    nav.pathname = "/cards";
    rerender(tree());
    expect(screen.getByText("Senha alterada.")).toBeInTheDocument();
  });
  it("funciona sem ToastProvider (shell sem toasts)", () => {
    setFlash("x");
    expect(() => render(<FlashToast />)).not.toThrow();
  });
});
