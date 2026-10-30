import { rejected } from '@test/support/builders.js';
import { actorOf, ana, bruno, carla, outroAdmin, userUuid, vagner } from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';

let h: IdentityHarness;
beforeEach(() => {
  h = buildIdentityHarness();
  h.users.seed(vagner());
  h.users.seed(ana());
  h.users.seed(bruno());
});
const update = (id: string, o: Record<string, unknown> = {}, actor = actorOf(vagner())) =>
  h.updateUser.execute({ actor, id, name: 'Ana Souza', email: 'ana@exemplo.com', role: 'USER', ...o });

describe('UpdateUser (RF13, CA19)', () => {
  it('CA19: altera nome, e-mail e nivel; devolve a view; evento e auditoria so com NOMES de campos', async () => {
    const view = await update(ana().id.value, { name: 'Ana Lima', email: 'ana.lima@exemplo.com', role: 'ADMIN' });
    expect(view).toMatchObject({ id: ana().id.value, name: 'Ana Lima', email: 'ana.lima@exemplo.com', role: 'ADMIN', status: 'ACTIVE' });
    const stored = h.users.get(ana().id.value)!;
    expect([stored.name.value, stored.email.value, stored.role]).toEqual(['Ana Lima', 'ana.lima@exemplo.com', 'ADMIN']);
    const audit = h.audit.of('userUpdated')[0].payload;
    expect(audit).toMatchObject({ actorId: vagner().id.value, userId: ana().id.value });
    expect([...(audit.changedFields as string[])].sort()).toEqual(['email', 'name', 'role']);
    const text = JSON.stringify(h.audit.calls) + JSON.stringify(h.publisher.published);
    expect(text).not.toContain('Ana Lima');
    expect(text).not.toContain('ana.lima@exemplo.com');
    expect(h.publisher.names()).toContain('UserUpdated');
  });

  it('P17: NAO encerra sessoes nem toca em senha ou troca obrigatoria', async () => {
    const s = h.openSession(ana());
    await update(ana().id.value, { name: 'Ana Lima', email: 'ana.lima@exemplo.com', role: 'ADMIN' });
    expect(h.sessions.calls.deleteAllOfUser).toBe(0);
    expect(h.sessions.ofUser(ana().id.value).map((x) => x.id.value)).toEqual([s.sessionId]);
    const stored = h.users.get(ana().id.value)!;
    expect(stored.passwordHash?.value).toBe('$fake$segredo123');
    expect(stored.mustChangePassword).toBe(false);
  });

  it('CA19/T16: o novo nivel vale na proxima autenticacao da sessao existente', async () => {
    const { token } = h.openSession(ana());
    await update(ana().id.value, { role: 'ADMIN' });
    expect(await h.authenticate.execute({ token })).toMatchObject({ role: 'ADMIN' });
    await update(ana().id.value, { role: 'USER' });
    expect(await h.authenticate.execute({ token })).toMatchObject({ role: 'USER' });
  });

  it('manter o proprio e-mail nao e EMAIL_TAKEN', async () => {
    await expect(update(ana().id.value, { name: 'Ana S.' })).resolves.toMatchObject({ name: 'Ana S.' });
  });

  it('sem mudanca efetiva: sem evento, sem auditoria, sem escrita', async () => {
    await update(ana().id.value);
    expect(h.users.calls.update).toBe(0);
    expect(h.publisher.published).toEqual([]);
    expect(h.audit.of('userUpdated')).toEqual([]);
  });

  it('CA17: e-mail de OUTRO usuario -> 409 EMAIL_TAKEN; nada muda', async () => {
    const error = await rejected(update(carlaId(), { email: 'ANA@exemplo.com' }));
    expect(error).toMatchObject({ code: 'EMAIL_TAKEN', kind: 'conflict' });
    expect(error.details.fields[0]).toMatchObject({ field: 'email', code: 'EMAIL_TAKEN' });
    expect(h.users.get(carlaId())!.email.value).toBe('carla@exemplo.com');
  });

  function carlaId() {
    h.users.seed(carla());
    return carla().id.value;
  }

  it('CA18: 400 acumulado (name, email, role)', async () => {
    const error = await rejected(update(ana().id.value, { name: '', email: 'ana@', role: 'ROOT' }));
    expect((error.details.fields as { field: string; code: string }[]).map((f) => `${f.field}:${f.code}`).sort()).toEqual([
      'email:INVALID_FORMAT',
      'name:REQUIRED',
      'role:INVALID_VALUE',
    ]);
  });

  it('campos desconhecidos como password nao existem no input (o schema HTTP devolve UNKNOWN_FIELD)', async () => {
    await update(ana().id.value, { name: 'Ana Lima', password: 'Hack1234' } as never);
    expect(h.users.get(ana().id.value)!.passwordHash?.value).toBe('$fake$segredo123');
  });
});

describe('UpdateUser: ultimo administrador ativo (RF17, CA24)', () => {
  it('CA24: unico admin ativo (a outra administradora esta inativa) rebaixar a si mesmo -> 422 LAST_ADMIN; nada muda', async () => {
    h.users.seed(outroAdmin({ status: 'INACTIVE' }));
    const error = await rejected(update(vagner().id.value, { name: 'Vagner', email: 'vagner@exemplo.com', role: 'USER' }));
    expect(error).toMatchObject({ code: 'LAST_ADMIN', kind: 'business_rule' });
    expect(h.users.get(vagner().id.value)!.role).toBe('ADMIN');
    expect(h.publisher.published).toEqual([]);
  });

  it('CA24: com dois administradores ativos, Vagner pode rebaixar a si mesmo', async () => {
    h.users.seed(outroAdmin());
    const view = await update(vagner().id.value, { name: 'Vagner', email: 'vagner@exemplo.com', role: 'USER' });
    expect(view.role).toBe('USER');
    expect(h.users.get(vagner().id.value)!.role).toBe('USER');
  });

  it('o unico administrador pode editar o proprio nome e e-mail (sem mudar o nivel)', async () => {
    await expect(update(vagner().id.value, { name: 'Vagner S.', email: 'novo@exemplo.com', role: 'ADMIN' })).resolves.toMatchObject({
      name: 'Vagner S.',
      role: 'ADMIN',
    });
  });

  it('administrador pode rebaixar OUTRO administrador ativo (o ator continua ativo)', async () => {
    h.users.seed(outroAdmin());
    const view = await update(outroAdmin().id.value, { name: 'Outro Admin', email: 'admin2@exemplo.com', role: 'USER' });
    expect(view.role).toBe('USER');
  });

  it('precedencias: 404 > 422 e 422 > 409', async () => {
    h.users.seed(outroAdmin({ status: 'INACTIVE' }));
    expect((await rejected(update(userUuid(99), { email: 'ana@exemplo.com' }))).code).toBe('USER_NOT_FOUND');
    const error = await rejected(update(vagner().id.value, { name: 'V', email: 'ana@exemplo.com', role: 'USER' }));
    expect(error.code).toBe('LAST_ADMIN');
  });
});
