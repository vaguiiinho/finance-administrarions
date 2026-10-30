import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRetryAfter } from "./use-retry-after";

// 14:29 em America/Sao_Paulo (TZ do vitest) = 17:29 UTC
const NOW = new Date("2026-11-02T17:29:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => vi.useRealTimers());

describe("useRetryAfter (design 3.5, CA04, CA10)", () => {
  it("180 s -> 'em 3 minutos, às 14:32'", () => {
    const { result } = renderHook(() => useRetryAfter(180, NOW));
    expect(result.current.text).toBe("em 3 minutos, às 14:32");
    expect(result.current.expired).toBe(false);
  });
  it("abaixo de 60 s -> segundos", () => {
    const { result } = renderHook(() => useRetryAfter(45, NOW));
    expect(result.current.text).toBe("em 45 segundos, às 14:29");
  });
  it("arredonda minutos para cima a partir de 60 s", () => {
    const { result } = renderHook(() => useRetryAfter(61, NOW));
    expect(result.current.text).toBe("em 2 minutos, às 14:30");
  });
  it("1 minuto no singular", () => {
    const { result } = renderHook(() => useRetryAfter(60, NOW));
    expect(result.current.text).toBe("em 1 minuto, às 14:30");
  });
  it("sem contagem ao vivo: o texto nao muda enquanto o prazo corre, e expired vira true no prazo", () => {
    const { result } = renderHook(() => useRetryAfter(180, NOW));
    const text = result.current.text;
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.text).toBe(text);
    expect(result.current.expired).toBe(false);
    act(() => vi.advanceTimersByTime(121_000));
    expect(result.current.expired).toBe(true);
  });
  it("sem retryAfterSeconds nao ha bloqueio", () => {
    const { result } = renderHook(() => useRetryAfter(undefined, NOW));
    expect(result.current.expired).toBe(true);
  });
});
