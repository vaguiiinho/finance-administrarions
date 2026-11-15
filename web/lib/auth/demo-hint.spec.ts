import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { demoHintFrom, isDemoHintEnabled } from "./demo-hint";

/** ADR 0013 9.3 (T2, B4): a dica so aparece com DEMO_ACCOUNT_HINT=on; a credencial e constante de codigo, nunca vem da env. */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demoHintFrom (B4, CA10, CA11)", () => {
  it("'on' liga: devolve a credencial fixa demo/demo", () => {
    expect(demoHintFrom({ DEMO_ACCOUNT_HINT: "on" })).toEqual({ username: "demo", password: "demo" });
  });

  it.each([undefined, "", "off", "ON", "On", "true", "1", "yes", " on", "on "])("%j desliga (so o valor exato 'on' liga)", (value) => {
    expect(demoHintFrom({ DEMO_ACCOUNT_HINT: value })).toBeNull();
  });

  it("sem a variavel no objeto -> desligada", () => {
    expect(demoHintFrom({})).toBeNull();
  });

  it("a credencial nao vem da env: a senha continua 'demo' mesmo com outras variaveis (nunca expor SHOWCASE_ACCOUNT_PASSWORD)", () => {
    const hint = demoHintFrom({ DEMO_ACCOUNT_HINT: "on", SHOWCASE_ACCOUNT_PASSWORD: "outra" } as never);
    expect(hint).toEqual({ username: "demo", password: "demo" });
  });
});

describe("isDemoHintEnabled: le process.env a cada chamada (por requisicao, sem build-time)", () => {
  it("acompanha a variavel entre chamadas", () => {
    vi.stubEnv("DEMO_ACCOUNT_HINT", "on");
    expect(isDemoHintEnabled()).toEqual({ username: "demo", password: "demo" });
    vi.stubEnv("DEMO_ACCOUNT_HINT", "off");
    expect(isDemoHintEnabled()).toBeNull();
    vi.stubEnv("DEMO_ACCOUNT_HINT", "");
    expect(isDemoHintEnabled()).toBeNull();
  });

  it("variavel ausente -> desligada", () => {
    vi.stubEnv("DEMO_ACCOUNT_HINT", undefined as never);
    expect(isDemoHintEnabled()).toBeNull();
  });
});
