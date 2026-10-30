import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "@/test/helpers/providers";

vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { SessionExpiredAlert, SessionExpiredInline, useAuthRedirect } from "./session-expired";

beforeEach(() => {
  router.replace.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

describe("useAuthRedirect (design 8)", () => {
  it("SESSION_EXPIRED: espera 1,5 s antes de ir ao login", () => {
    renderHook(() => useAuthRedirect({ code: "SESSION_EXPIRED", redirectUrl: "/login?reason=expired" }));
    act(() => vi.advanceTimersByTime(1400));
    expect(router.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(router.replace).toHaveBeenCalledWith("/login?reason=expired");
  });
  it("PASSWORD_CHANGE_REQUIRED: vai para a troca na hora", () => {
    renderHook(() => useAuthRedirect({ code: "PASSWORD_CHANGE_REQUIRED", redirectUrl: "/account/password?next=%2Fcards" }));
    expect(router.replace).toHaveBeenCalledWith("/account/password?next=%2Fcards");
  });
  it("outros erros (ou sem redirectUrl) nao navegam", () => {
    renderHook(() => useAuthRedirect({ code: "NETWORK_ERROR", redirectUrl: "/x" }));
    renderHook(() => useAuthRedirect({ code: "SESSION_EXPIRED" }));
    renderHook(() => useAuthRedirect(null));
    act(() => vi.advanceTimersByTime(5000));
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("desmontar antes do prazo cancela a navegacao", () => {
    const { unmount } = renderHook(() => useAuthRedirect({ code: "SESSION_EXPIRED", redirectUrl: "/login" }));
    unmount();
    act(() => vi.advanceTimersByTime(3000));
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("avisos de sessao expirada", () => {
  it("SessionExpiredAlert: mensagem unica e 'Entrar novamente' navega na hora", async () => {
    render(<SessionExpiredAlert redirectUrl="/login?reason=expired" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sua sessão expirou. Entre novamente.");
    await userEvent.click(screen.getByRole("link", { name: "Entrar novamente" }));
    expect(router.replace).toHaveBeenCalledWith("/login?reason=expired");
  });
  it("sem redirectUrl nao oferece o atalho; SessionExpiredInline serve para dialogos", () => {
    const { rerender } = render(<SessionExpiredAlert />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(<p><SessionExpiredInline redirectUrl="/login" /></p>);
    expect(screen.getByRole("link", { name: "Entrar novamente" })).toBeInTheDocument();
  });
});
