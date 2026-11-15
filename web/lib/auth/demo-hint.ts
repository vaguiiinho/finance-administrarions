import "server-only";

/** Credencial exibida na dica do login (ADR 0013 9.3): constante de codigo, nunca vem da env (nao expor SHOWCASE_ACCOUNT_PASSWORD). */
export interface DemoHint {
  username: "demo";
  password: "demo";
}

const HINT: DemoHint = { username: "demo", password: "demo" };

/** So o valor exato `on` liga a dica (B4). */
export function demoHintFrom(env: Record<string, string | undefined>): DemoHint | null {
  return env.DEMO_ACCOUNT_HINT === "on" ? HINT : null;
}

/** Le `process.env` a cada chamada (por requisicao, sem valor fixado no build). Variavel so de servidor, nunca NEXT_PUBLIC_. */
export function isDemoHintEnabled(): DemoHint | null {
  return demoHintFrom(process.env);
}
