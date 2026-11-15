import { aUser, ana } from '@test/support/identity-builders.js';
import { SHOWCASE_ID, showcaseUser } from '@test/support/showcase-builders.js';
import { buildIdentityHarness } from '@test/support/identity-harness.js';
import { GetShowcaseAccountState } from './get-showcase-account-state.js';

/**
 * GetShowcaseAccountState (ADR 0013 5.3): consulta usada pelo seed e pela rotina da conta demo.
 * CONTRATO: `new GetShowcaseAccountState(users)` e `execute({})` -> `{ state: 'active' | 'inactive' | 'absent' }`.
 */
function setup() {
  const h = buildIdentityHarness();
  return { h, query: new GetShowcaseAccountState(h.users) };
}

describe('GetShowcaseAccountState (B4, RF14, CA28)', () => {
  it('conta demo ACTIVE -> active', async () => {
    const { h, query } = setup();
    h.users.seed(showcaseUser());
    expect(await query.execute({})).toEqual({ state: 'active' });
  });

  it('conta demo INACTIVE (env vazia) -> inactive', async () => {
    const { h, query } = setup();
    h.users.seed(showcaseUser({ status: 'INACTIVE' }));
    expect(await query.execute({})).toEqual({ state: 'inactive' });
  });

  it('sem a conta demo no banco -> absent', async () => {
    const { h, query } = setup();
    h.users.seed(ana());
    expect(await query.execute({})).toEqual({ state: 'absent' });
  });

  it('o id da conta demo ocupado por usuario de outro kind -> absent (nunca trata como conta demo)', async () => {
    const { h, query } = setup();
    h.users.seed(aUser({ id: SHOWCASE_ID, name: 'Intruso', email: 'intruso@exemplo.com' })); // kind REGULAR
    expect(await query.execute({})).toEqual({ state: 'absent' });
  });

  it('so le o usuario: nao escreve nada (consulta pura)', async () => {
    const { h, query } = setup();
    h.users.seed(showcaseUser());
    await query.execute({});
    expect(h.users.calls.insert + h.users.calls.update).toBe(0);
  });
});
