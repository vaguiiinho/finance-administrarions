"use client";

import { catchError, type ErrorInfo } from "next/error";
import { Button } from "./button";

interface FallbackProps {
  /** Ex.: "Não foi possível carregar o resumo do mês." */
  message: string;
  compact?: boolean;
}

function Fallback({ message, compact = false }: FallbackProps, { retry }: ErrorInfo) {
  return (
    <div role="alert" className={`card flex flex-wrap items-center gap-3 ${compact ? "p-3" : "p-6"}`}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-danger-text">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
      </svg>
      <p className="flex-1 text-text">{message}</p>
      <Button onClick={() => retry()}>Tentar novamente</Button>
    </div>
  );
}

/**
 * Fronteira de erro por bloco (resumo, painel da aba, bloco do dashboard): "Tentar novamente" refaz so o bloco (RF24, CA66).
 * `retry()` re-renderiza no servidor e preserva o estado do cliente fora da fronteira.
 */
export const BlockErrorBoundary = catchError(Fallback);
