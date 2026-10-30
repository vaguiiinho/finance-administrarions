"use client";

import { Button } from "@/components/ui/button";

/**
 * Erro fora de qualquer tela (ex.: o layout protegido nao conseguiu falar com a API). Fica DENTRO do layout raiz: tema e
 * gradiente ja nascem corretos. As telas tem o proprio `error.tsx`, que mantem navbar, menu e footer.
 */
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8">
      <div role="alert" className="card flex flex-col items-start gap-3 p-6">
        <h1 className="font-display text-xl font-semibold text-text">Algo deu errado</h1>
        <p className="text-muted">Não foi possível carregar a página. Tente novamente.</p>
        <Button variant="primary" onClick={() => retry()}>
          Tentar novamente
        </Button>
      </div>
    </main>
  );
}
