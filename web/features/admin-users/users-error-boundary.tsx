"use client";

import { catchError, type ErrorInfo } from "next/error";
import { Button } from "@/components/ui/button";

/** Falha da lista (design 9): so o bloco da lista cai; titulo, navbar, menu e footer continuam. "Tentar novamente" refaz so o bloco. */
function Fallback(_props: object, { retry }: ErrorInfo) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Usuários</h1>
      <div role="alert" className="card flex flex-wrap items-center gap-3 p-6">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-danger-text">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
        </svg>
        <p className="flex-1 text-text">Não foi possível carregar os usuários.</p>
        <Button onClick={() => retry()}>Tentar novamente</Button>
      </div>
    </div>
  );
}

export const UsersErrorBoundary = catchError(Fallback);
