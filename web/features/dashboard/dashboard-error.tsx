"use client";

import { Button } from "@/components/ui/button";

export function DashboardError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 p-6">
      <h1 className="font-display text-xl font-semibold text-text">Não foi possível carregar o dashboard.</h1>
      <p className="text-muted">Tente novamente em instantes.</p>
      <Button variant="primary" onClick={() => retry()}>
        Tentar novamente
      </Button>
    </div>
  );
}
