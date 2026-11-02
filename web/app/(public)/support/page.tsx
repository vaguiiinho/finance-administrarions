import type { Metadata } from "next";

export const metadata: Metadata = { title: "Suporte" };

// Le SUPPORT_EMAIL a cada requisicao (so servidor, sem NEXT_PUBLIC_): sem isso o valor ficaria fixo no build.
export const dynamic = "force-dynamic";

export default function SupportPage() {
  const email = process.env.SUPPORT_EMAIL?.trim();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-text">
      <h1 className="text-2xl font-semibold">Suporte</h1>
      {email ? (
        <p>Precisa de ajuda? Fale com o administrador pelo e-mail <a className="underline" href={`mailto:${email}`}>{email}</a>.</p>
      ) : (
        <p>Precisa de ajuda? Entre em contato com o administrador do serviço.</p>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">O que o administrador pode fazer por você</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Pedir acesso: as contas são criadas pelo administrador.</li>
          <li>Redefinir a sua senha, caso você a tenha esquecido.</li>
          <li>Solicitar a exclusão da sua conta e dos seus dados.</li>
        </ul>
      </section>
    </main>
  );
}
