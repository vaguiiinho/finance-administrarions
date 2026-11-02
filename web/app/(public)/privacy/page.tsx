import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-text">
      <h1 className="text-2xl font-semibold">Política de privacidade</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Dados que coletamos</h2>
        <p>Coletamos apenas o seu nome e o seu e-mail, além dos lançamentos e cartões que você cadastra. Esses dados são usados somente para o funcionamento do aplicativo: entrar na sua conta e mostrar as suas finanças.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Rastreamento e publicidade</h2>
        <p>Não há rastreamento, não usamos ferramentas de análise de terceiros e não exibimos publicidade ou anúncios. Não vendemos nem compartilhamos os seus dados.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Exclusão da conta</h2>
        <p>Para excluir a sua conta e os dados associados, peça ao administrador pela página de suporte. Contas são criadas pelo administrador; não há cadastro aberto.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Conta de demonstração</h2>
        <p>Existe uma conta de demonstração compartilhada, usada para apresentar o aplicativo. Qualquer pessoa pode entrar nela, por isso não registre dados pessoais ali. Os lançamentos e cartões dessa conta são apagados todos os dias às 03:00 (horário de São Paulo).</p>
      </section>
    </main>
  );
}
