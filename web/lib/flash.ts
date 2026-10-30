/**
 * Aviso "de passagem" entre telas (design 4.4): o toast de "Senha alterada." precisa aparecer no destino da navegacao
 * (a Server Action redireciona no servidor). Guardado no `sessionStorage` por poucos segundos e consumido uma vez.
 */
const KEY = "fa_flash";
const TTL_MS = 15_000;

export function setFlash(message: string): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ message, at: Date.now() }));
  } catch {
    // sem sessionStorage: so perde o aviso
  }
}

export function clearFlash(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // idem
  }
}

/** Devolve o aviso pendente (se recente) e o apaga. */
export function takeFlash(): string | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const { message, at } = JSON.parse(raw) as { message: string; at: number };
    return Date.now() - at <= TTL_MS ? message : null;
  } catch {
    return null;
  }
}
