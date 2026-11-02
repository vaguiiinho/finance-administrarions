import { rejected } from '@test/support/builders.js';
import { ana, carla, demoUser, vagner } from '@test/support/identity-builders.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID, showcaseUser } from '@test/support/showcase-builders.js';
import { buildShowcaseHarness, type ShowcaseHarness } from '@test/support/showcase-harness.js';

let h: ShowcaseHarness;
beforeEach(() => {
  h = buildShowcaseHarness();
});

describe('AuthenticateSession: capacidades e elegibilidade (ADR 0011 5.3, S8)', () => {
  it('SHOWCASE autentica com MANAGE_EXPENSES e role USER', async () => {
    h.users.seed(showcaseUser());
    const { token } = h.openSession(showcaseUser());
    const principal = await h.authenticate.execute({ token });
    expect(principal).toMatchObject({ userId: SHOWCASE_ID, role: 'USER', capabilities: ['MANAGE_EXPENSES'] });
  });

  it('REGULAR USER recebe MANAGE_EXPENSES (B6)', async () => {
    h.users.seed(ana());
    const { token } = h.openSession(ana());
    const principal = await h.authenticate.execute({ token });
    expect(principal.capabilities).toContain('MANAGE_EXPENSES');
    expect(principal.capabilities).not.toContain('MANAGE_USERS');
  });

  it('REGULAR ADMIN recebe MANAGE_USERS e MANAGE_EXPENSES', async () => {
    h.users.seed(vagner());
    const { token } = h.openSession(vagner());
    const principal = await h.authenticate.execute({ token });
    expect(principal.capabilities).toEqual(expect.arrayContaining(['MANAGE_USERS', 'MANAGE_EXPENSES']));
  });

  it('DEMO (dataset publico) continua nao autenticando: UNAUTHENTICATED', async () => {
    h.users.seed(demoUser());
    const { token } = h.openSession(demoUser());
    expect((await rejected(h.authenticate.execute({ token }))).code).toBe('UNAUTHENTICATED');
  });

  it('SHOWCASE inativa -> UNAUTHENTICATED (a leitura e a cada chamada)', async () => {
    h.users.seed(showcaseUser({ status: 'INACTIVE' }));
    const { token } = h.openSession(showcaseUser());
    expect((await rejected(h.authenticate.execute({ token }))).code).toBe('UNAUTHENTICATED');
  });

  it('troca obrigatoria pendente continua refletida no principal', async () => {
    h.users.seed(carla());
    const { token } = h.openSession(carla());
    expect((await h.authenticate.execute({ token })).mustChangePassword).toBe(true);
  });
});

describe('GetCurrentUser: accountKind (P-ADR5)', () => {
  it('conta demo -> SHOWCASE com o e-mail digitado no login', async () => {
    h.users.seed(showcaseUser());
    const view = await h.currentUser.execute({ userId: SHOWCASE_ID } as never);
    expect(view).toMatchObject({ accountKind: 'SHOWCASE', email: SHOWCASE_EMAIL, capabilities: ['MANAGE_EXPENSES'] });
  });

  it('usuario comum -> REGULAR (mesmo que o e-mail seja demo@showcase.invalid, o tipo vem do kind, nao do e-mail)', async () => {
    h.users.seed(ana({ email: 'ana@exemplo.com' }));
    const view = await h.currentUser.execute({ userId: ana().id.value } as never);
    expect(view.accountKind).toBe('REGULAR');
  });

  it('capacidades vem ordenadas (estaveis para o cliente)', async () => {
    h.users.seed(vagner());
    const view = await h.currentUser.execute({ userId: vagner().id.value } as never);
    expect(view.capabilities).toEqual([...view.capabilities].sort());
  });
});
