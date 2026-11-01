"use client";

import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/states";
import { monthLongPtBR } from "@/lib/dates/format";
import { stripAdvanceSignal, type AdvanceSignal } from "@/lib/filters/initial-month";

const ANNOUNCE_DELAY_MS = 500;
const ANNOUNCE_CLEAR_MS = 10_000;

/** Textos aprovados (design 4.1): so modelos fixos, meses por extenso formatados; nada da URL e exibido. */
function noticeText(signal: AdvanceSignal, month: string): string {
  const from = monthLongPtBR(signal.from);
  const to = monthLongPtBR(month);
  return signal.advance === "NEXT_PENDING" ? `Sem pendências em ${from}. Mostrando ${to}, o próximo mês com pendências.` : `Sem pendências de ${from} em diante. Mostrando ${to}.`;
}

interface Held {
  signal: AdvanceSignal;
  month: string;
}

/**
 * Aviso de avanco de mes (RF05, design 4, ADR 0007 7.3). Fica sempre montado na mesma posicao: guarda o sinal em estado
 * local (as navegacoes seguintes chegam sem ele), some ao trocar de mes (CA25) e ao fechar. O banner e estatico
 * (`role="note"`); o anuncio vem de uma regiao polite oculta que nasce vazia (conteudo ja presente na carga nao e lido).
 */
export function MonthAdvanceNotice({ signal, month }: { signal: AdvanceSignal | null; month: string }) {
  const [held, setHeld] = useState<Held | null>(signal ? { signal, month } : null);
  const [lastProp, setLastProp] = useState(signal);
  const [announced, setAnnounced] = useState("");

  // Novo sinal (nova abertura sem `month`): reavalia (P03). A identidade do objeto muda a cada payload do servidor.
  let current = held;
  if (signal !== lastProp) {
    setLastProp(signal);
    if (signal) {
      current = { signal, month };
      setHeld(current);
    }
  }
  // Trocar de mes encerra o aviso para sempre (CA25)
  if (current && current.month !== month) {
    current = null;
    setHeld(null);
  }

  const text = current ? noticeText(current.signal, current.month) : null;

  // O sinal sai da URL na montagem (recarregar, Voltar e copiar o link nao repetem o aviso)
  useEffect(() => {
    if (!signal) return;
    const { pathname, search, hash } = window.location;
    const clean = stripAdvanceSignal(`${pathname}${search}`);
    // `null` (e nao `window.history.state`): o estado do Next carrega `__NA`, e o patch de replaceState do app-router
    // ignora a chamada nesse caso, deixando `adv` no canonicalUrl; uma Server Action (revalidatePath) o reaplicaria e reabriria o aviso.
    if (clean !== `${pathname}${search}`) window.history.replaceState(null, "", `${clean}${hash}`);
  }, [signal]);

  useEffect(() => {
    if (!text) return;
    const show = setTimeout(() => setAnnounced(text), ANNOUNCE_DELAY_MS);
    const hide = setTimeout(() => setAnnounced(""), ANNOUNCE_CLEAR_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      setAnnounced("");
    };
  }, [text]);

  if (!current || !text) return null;

  return (
    <div className="mb-4 md:mb-6">
      <InlineAlert
        tone="info"
        role="note"
        actions={
          <IconButton
            aria-label="Fechar aviso de mês"
            onClick={() => {
              setHeld(null);
              document.getElementById("conteudo")?.focus();
            }}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </IconButton>
        }
      >
        <p>{text}</p>
      </InlineAlert>
      <p className="sr-only" aria-live="polite">
        {announced}
      </p>
    </div>
  );
}
