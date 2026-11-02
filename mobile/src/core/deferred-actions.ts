/** Acoes adiadas com "Desfazer" (DM14, CA40, CA55): o envio so acontece ao fim do prazo, no flush ou quando outra entra. */
export const UNDO_WINDOW_MS = 5_000;

export interface DeferredActionsOptions {
  delayMs?: number;
  onFailure?: (id: string, error: unknown) => void;
  onChange?: (pendingIds: readonly string[]) => void;
  onSent?: (id: string) => void;
}

interface Pending {
  send: () => Promise<void>;
  timer: ReturnType<typeof setTimeout>;
}

export class DeferredActions {
  private readonly pending = new Map<string, Pending>();
  /** Em envio: a linha segue oculta ate o envio terminar (sem piscar de volta). */
  private readonly sending = new Set<string>();
  private readonly delayMs: number;

  constructor(private readonly options: DeferredActionsOptions = {}) {
    this.delayMs = options.delayMs ?? UNDO_WINDOW_MS;
  }

  ids(): readonly string[] {
    return [...this.pending.keys(), ...this.sending];
  }

  has(id: string): boolean {
    return this.pending.has(id) || this.sending.has(id);
  }

  /** Agenda o envio. Uma acao anterior que ainda pende e enviada na hora (so uma por vez). */
  schedule(id: string, send: () => Promise<void>): void {
    void this.flush();
    const timer = setTimeout(() => void this.dispatch(id), this.delayMs);
    this.pending.set(id, { send, timer });
    this.notify();
  }

  /** Desfazer: cancela sem nenhuma chamada. */
  undo(id: string): boolean {
    const item = this.pending.get(id);
    if (!item) return false;
    clearTimeout(item.timer);
    this.pending.delete(id);
    this.notify();
    return true;
  }

  /** Descarta sem enviar (401, troca de senha pendente, 426). */
  discardAll(): void {
    for (const item of this.pending.values()) clearTimeout(item.timer);
    this.pending.clear();
    this.notify();
  }

  /** Segundo plano / logout: envia agora, uma unica vez cada. */
  async flush(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((id) => this.dispatch(id)));
  }

  private async dispatch(id: string): Promise<void> {
    const item = this.pending.get(id);
    if (!item) return;
    clearTimeout(item.timer);
    this.pending.delete(id);
    this.sending.add(id);
    this.notify();
    try {
      await item.send();
      this.options.onSent?.(id);
    } catch (error) {
      this.options.onFailure?.(id, error);
    } finally {
      this.sending.delete(id);
      this.notify();
    }
  }

  private notify(): void {
    this.options.onChange?.(this.ids());
  }
}
