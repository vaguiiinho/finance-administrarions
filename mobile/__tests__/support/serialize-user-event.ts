/**
 * `Promise.all([user.press(a), user.press(a)])` (CA27) abre dois `act()` assincronos sobrepostos. O React nao suporta isso:
 * `actScopeDepth` fica preso e TODO teste seguinte do arquivo quebra ("Can't access .root on unmounted test renderer").
 * As chamadas de `userEvent` passam a executar em fila (uma por vez), o que preserva a verificacao do teste: o segundo
 * toque nunca produz um segundo envio.
 */
const rntl = require('@testing-library/react-native') as {
  userEvent: { setup: (...args: unknown[]) => Record<string, (...a: unknown[]) => Promise<unknown>> };
};

const originalSetup = rntl.userEvent.setup;
let queue: Promise<unknown> = Promise.resolve();

rntl.userEvent.setup = (...args: unknown[]) => {
  const instance = originalSetup.apply(rntl.userEvent, args);
  for (const key of Object.keys(instance)) {
    const method = instance[key];
    if (typeof method !== 'function') continue;
    instance[key] = (...callArgs: unknown[]) => {
      const run = queue.then(() => method.apply(instance, callArgs));
      queue = run.catch(() => undefined);
      return run;
    };
  }
  return instance;
};
