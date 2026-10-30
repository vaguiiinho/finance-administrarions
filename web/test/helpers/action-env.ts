import { vi } from "vitest";

/** `redirect()` do Next lanca um erro com `digest`; o mock replica para os testes de Server Action. */
export const redirectError = (url: string) => Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;replace;${url};307;` });
export const redirectMock = vi.fn((url: string): never => {
  throw redirectError(url);
});
export const notFoundMock = vi.fn((): never => {
  throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
});

export function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

/** Destino do redirect: pathname e searchParams (independente de como o `next` foi codificado). */
export const target = (url: string) => {
  const u = new URL(url, "http://x");
  return { pathname: u.pathname, next: u.searchParams.get("next"), reason: u.searchParams.get("reason") };
};
