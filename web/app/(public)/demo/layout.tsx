import { AppShell } from "@/components/app-shell";
import { DEMO_MODE } from "@/lib/app-mode";
import { DemoBanner } from "@/components/demo-banner";
import { getCurrentUser } from "@/lib/auth/current-user";
import { currentUrl } from "@/lib/auth/redirect-urls";

/** Shell da demonstracao (design 7, RF28-RF36): usuario opcional (so para a navbar e o aviso), aviso persistente, so leitura. */
export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  // a demo e publica: uma API fora do ar nao pode derrubar o aviso e a navbar
  const user = await getCurrentUser().catch(() => null);
  const path = ((await currentUrl()) ?? "/demo/entries").split("?")[0];
  return (
    <AppShell user={user} mode={DEMO_MODE} banner={<DemoBanner user={user} path={path} />}>
      {children}
    </AppShell>
  );
}
