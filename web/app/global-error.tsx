"use client";

import "./globals.css";

/**
 * Unico script inline do app (ADR 9.5, item 6): este arquivo substitui o layout raiz, entao o tema e aplicado
 * antes da primeira pintura a partir do cookie.
 */
const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);if(m){document.documentElement.dataset.theme=m[1]}}catch(e){}`;

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <main className="mx-auto flex max-w-xl flex-col items-start gap-4 p-8" role="alert">
          <h1 className="font-display text-2xl font-bold">Algo deu errado</h1>
          <p className="text-muted">Não foi possível carregar a página. Tente novamente.</p>
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
