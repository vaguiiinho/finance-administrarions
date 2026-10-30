"use client";

import { Button } from "@/components/ui/button";

export function EntriesError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 p-6">
      <h1 className="font-display text-xl font-semibold text-text">Não foi possível carregar os lançamentos.</h1>
      <p className="text-muted">Tente novamente em instantes.</p>
      <Button variant="primary" onClick={() => retry()}>
        Tentar novamente
      </Button>
    </div>
  );
}
