import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { currentUrl } from "@/lib/auth/redirect-urls";
import { decideProtectedLayout } from "@/lib/auth/route-policy";
import { readSessionToken } from "@/lib/auth/session-cookie";

/**
 * Shell das telas protegidas (ADR 0005 9.4): sem usuario -> login (com `reason=expired` se havia cookie); troca obrigatoria
 * fora de `/account/password` -> la. Com a troca pendente o shell entra em modo restrito (design 2.7). Layouts nao
 * re-renderizam em navegacao no cliente: o redirect dos readers (403 da API) completa o comportamento.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const decision = decideProtectedLayout(user, (await currentUrl()) ?? "/entries", { hadSession: Boolean(await readSessionToken()) });
  if (decision.kind === "redirect") redirect(decision.to);
  if (decision.kind === "notFound" || !user) redirect("/login");
  const restricted = user.mustChangePassword;
  return (
    <AppShell user={user} restricted={restricted}>
      {children}
    </AppShell>
  );
}
