import type { ReactNode } from "react";
import { vi } from "vitest";
import { NavProvider } from "@/components/navigation";
import { ToastProvider } from "@/components/ui/toast";

/** Spies compartilhados do roteador do Next (mock de `next/navigation` nos testes). */
export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };

export function AllProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <NavProvider>{children}</NavProvider>
    </ToastProvider>
  );
}
