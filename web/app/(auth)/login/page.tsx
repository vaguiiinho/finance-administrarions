import type { Metadata } from "next";
import { isDemoHintEnabled } from "@/lib/auth/demo-hint";
import { nextLabel } from "@/lib/auth/next-param";
import { AuthCard } from "../_components/auth-card";
import { DemoAccountHint } from "./demo-account-hint";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * `/login` (design 3, RF41): `next` so vira contexto se o servidor o aceitar (`safeNext`); `reason=expired` e banner no formulario.
 * A dica da conta demo e lida uma unica vez por requisicao (`DEMO_ACCOUNT_HINT`) e decide a nota e o rotulo do campo (RV1).
 */
export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = first(params.next);
  const label = nextLabel(next);
  const hint = isDemoHintEnabled();
  return (
    <AuthCard
      title="Entrar"
      subtitle={label ? `Entre para continuar em ${label}.` : "Acesse seus lançamentos, cartões e faturas."}
      footer={<p>Não tem acesso ou esqueceu a senha? Fale com um administrador.</p>}
    >
      <LoginForm next={next} reason={first(params.reason) === "expired" ? "expired" : undefined} demoHint={hint !== null} />
      {hint ? <DemoAccountHint hint={hint} /> : null}
    </AuthCard>
  );
}
