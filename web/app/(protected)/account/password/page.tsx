import type { Metadata } from "next";
import { ChangePasswordForm } from "@/features/account/change-password-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextLabel } from "@/lib/auth/next-param";

export const metadata: Metadata = { title: "Trocar senha" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Trocar senha (design 4, RF07, RF08, RF42): obrigatoria (modo restrito) com a troca pendente; opcional pelo menu da conta. */
export default async function PasswordPage(props: PageProps<"/account/password">) {
  const user = await getCurrentUser();
  if (!user) return null; // o layout ja redirecionou
  const next = first((await props.searchParams).next);
  return (
    <div className="flex max-w-[560px] flex-col gap-4 md:gap-6">
      <h1 className="font-display text-2xl font-bold text-text outline-none md:text-[32px]">Trocar senha</h1>
      <section className="card p-5 md:p-8" data-surface="opaque">
        <ChangePasswordForm mode={user.mustChangePassword ? "required" : "optional"} next={next} nextLabel={nextLabel(next)} />
      </section>
    </div>
  );
}
