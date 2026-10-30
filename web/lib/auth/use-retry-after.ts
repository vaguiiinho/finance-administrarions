"use client";

import { useEffect, useMemo, useState } from "react";

const HOUR_FORMAT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" });

/** "em 45 segundos" (< 60 s) ou "em N minutos" (arredondado para cima), sempre seguido de ", às HH:MM" em Sao Paulo. */
export function retryAfterText(seconds: number, from: Date): string {
  const minutes = Math.ceil(seconds / 60);
  const amount = seconds < 60 ? `${seconds} ${seconds === 1 ? "segundo" : "segundos"}` : `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  return `em ${amount}, às ${HOUR_FORMAT.format(new Date(from.getTime() + seconds * 1000))}`;
}

/**
 * 429 (design 3.5): texto calculado uma vez ("em 3 minutos, às 14:32"; sem contagem ao vivo) e `expired` quando o prazo
 * passa. `now` e o instante em que o bloqueio foi recebido (padrao: a montagem do componente).
 */
export function useRetryAfter(retryAfterSeconds: number | undefined, now?: Date): { text: string; expired: boolean } {
  const [mountedAt] = useState(() => new Date());
  const blocked = retryAfterSeconds !== undefined && retryAfterSeconds > 0;
  const from = (now ?? mountedAt).getTime();
  const deadline = blocked ? from + retryAfterSeconds * 1000 : 0;
  const [elapsedDeadline, setElapsedDeadline] = useState<number | null>(null);

  useEffect(() => {
    if (!blocked) return;
    const timer = setTimeout(() => setElapsedDeadline(deadline), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [blocked, deadline]);

  const text = useMemo(() => (blocked ? retryAfterText(retryAfterSeconds, new Date(from)) : ""), [blocked, retryAfterSeconds, from]);
  return { text, expired: !blocked || elapsedDeadline === deadline };
}
