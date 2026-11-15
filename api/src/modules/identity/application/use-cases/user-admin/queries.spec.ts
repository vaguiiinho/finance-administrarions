import { rejected } from '@test/support/builders.js';
import { actorOf, ana, bruno, carla, firstAdminMarker, userUuid, vagner } from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';

let h: IdentityHarness;
beforeEach(() => {
  h = buildIdentityHarness();
  h.users.seed(vagner());
  h.users.seed(ana());
  h.users.seed(bruno({ status: 'INACTIVE' }));
  h.users.seed(carla());
  h.users.seed(firstAdminMarker());
});
const actor = () => actorOf(vagner());
const EXPECTED_KEYS = ['createdAt', 'email', 'id', 'mustChangePassword', 'name', 'role', 'status'];

describe('ListUsers (RF11, CA25, CA26)', () => {
  it('lista ativos e inativos, SEM o marcador; ativos primeiro, depois por nome', async () => {
    const items = await h.listUsers.execute({ actor: actor() });
    expect(items.map((u) => u.name)).toEqual(['Ana Souza', 'Carla Dias', 'Vagner', 'Bruno Lima']);
    expect(items.map((u) => u.status)).toEqual(['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']);
    expect(items.some((u) => u.email.endsWith('.invalid'))).toBe(false);
  });

  it('cada item traz so id, nome, e-mail, nivel, situacao, troca pendente e criacao: nenhum hash nem dado financeiro (CA25)', async () => {
    const items = await h.listUsers.execute({ actor: actor() });
    for (const item of items) expect(Object.keys(item).sort()).toEqual(EXPECTED_KEYS);
    expect(items.find((u) => u.name === 'Carla Dias')!.mustChangePassword).toBe(true);
    expect(JSON.stringify(items)).not.toContain('fake');
  });
});

describe('GetUser', () => {
  it('devolve a view administrativa do usuario', async () => {
    const view = await h.getUser.execute({ actor: actor(), id: ana().id.value });
    expect(Object.keys(view).sort()).toEqual(EXPECTED_KEYS);
    expect(view).toMatchObject({ id: ana().id.value, name: 'Ana Souza', status: 'ACTIVE' });
  });

  it('CA26: inexistente e marcador -> 404 USER_NOT_FOUND com details.id', async () => {
    for (const id of [userUuid(99), firstAdminMarker().id.value]) {
      const error = await rejected(h.getUser.execute({ actor: actor(), id }));
      expect(error).toMatchObject({ code: 'USER_NOT_FOUND', kind: 'not_found', details: { id } });
    }
  });

  it('id malformado -> 400 VALIDATION_ERROR (400 antes do 404)', async () => {
    expect((await rejected(h.getUser.execute({ actor: actor(), id: 'abc' }))).code).toBe('VALIDATION_ERROR');
  });
});
