import type { Metadata } from "next";
import Link from "next/link";
import { nextLabel } from "@/lib/auth/next-param";
import { AuthCard } from "../_components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `/login` (design 3, RF41): `next` so vira contexto se o servidor o aceitar (`safeNext`); `reason=expired` e banner no formulario. */
export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = first(params.next);
  const label = nextLabel(next);
  return (
    <AuthCard
      title="Entrar"
      subtitle={label ? `Entre para continuar em ${label}.` : "Acesse seus lançamentos, cartões e faturas."}
      footer={
        <>
          <p>Não tem acesso ou esqueceu a senha? Fale com um administrador.</p>
          <Link href="/demo/entries" className="inline-flex min-h-11 items-center self-start font-medium text-accent underline">
            Ver demonstração
          </Link>
        </>
      }
    >
      <LoginForm next={next} reason={first(params.reason) === "expired" ? "expired" : undefined} />
    </AuthCard>
  );
}
