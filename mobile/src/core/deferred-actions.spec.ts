import { DeferredActions } from '@/core/deferred-actions';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('exclusao adiada com Desfazer (DM14, CA40, CA55)', () => {
  it('envia somente depois de 5 s', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const q = new DeferredActions();
    q.schedule('e1', send);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('desfazer cancela sem nenhuma chamada', async () => {
    const send = vi.fn();
    const q = new DeferredActions();
    q.schedule('e1', send);
    q.undo('e1');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).not.toHaveBeenCalled();
  });
  it('flush (segundo plano / logout) envia imediatamente e uma unica vez', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const q = new DeferredActions();
    q.schedule('e1', send);
    await q.flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('nova exclusao enquanto outra pende: a anterior e enviada na hora', async () => {
    const a = vi.fn().mockResolvedValue(undefined);
    const q = new DeferredActions();
    q.schedule('e1', a);
    q.schedule('e2', vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(a).toHaveBeenCalledTimes(1);
  });
  it('falha no envio notifica (a linha volta)', async () => {
    const onFail = vi.fn();
    const q = new DeferredActions({ onFailure: onFail });
    q.schedule('e1', () => Promise.reject(new Error('x')));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onFail).toHaveBeenCalledWith('e1', expect.anything());
  });
});
