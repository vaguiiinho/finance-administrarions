"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Foco que so pode acontecer DEPOIS de o dialogo modal fechar (design 6.1, C3): um `<dialog>` modal deixa o resto da pagina
 * inerte, entao focar antes do commit falha. `schedule` guarda a acao; ela roda quando `open` passa a false. Se o componente
 * ja foi desmontado (a revalidacao tirou o bloco/lista junto com o dialogo), a acao roda na hora ou logo apos a desmontagem.
 */
export function useFocusAfterClose(open: boolean) {
  const pending = useRef<(() => void) | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const run = pending.current;
      pending.current = null;
      if (run) queueMicrotask(run);
    };
  }, []);

  useEffect(() => {
    if (open || !pending.current) return;
    const run = pending.current;
    pending.current = null;
    run();
  }, [open]);

  return useCallback((run: () => void) => {
    if (!mounted.current) run();
    else pending.current = run;
  }, []);
}
