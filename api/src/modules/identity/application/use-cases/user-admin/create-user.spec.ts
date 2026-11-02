import { NOW, rejected } from '@test/support/builders.js';
import { actorOf, ana, bruno, demoUser, vagner } from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';

let h: IdentityHarness;
beforeEach(() => {
  h = buildIdentityHarness();
  h.users.seed(vagner());
  h.users.seed(ana());
  h.users.seed(bruno({ status: 'INACTIVE' }));
  h.users.seed(demoUser());
});
const create = (o: Record<string, unknown> = {}, actor = actorOf(vagner())) =>
  h.createUser.execute({ actor, name: 'Carla Dias', email: 'carla@exemplo.com', role: 'USER', password: 'Temp1234', ...o });

describe('CreateUser (RF12, CA16)', () => {
  it('CA16: normaliza, nasce ATIVO com troca obrigatoria e sem hash na resposta', async () => {
    const view = await create({ name: '  Carla   Dias ', email: ' Carla@Exemplo.com ' });
    expect(view).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Carla Dias',
      email: 'carla@exemplo.com',
      role: 'USER',
      status: 'ACTIVE',
      mustChangePassword: true,
      createdAt: NOW,
    });
    const stored = h.users.get(view.id)!;
    expect(stored.passwordHash?.value).toBe('$fake$Temp1234');
    expect(JSON.stringify(view)).not.toContain('Temp1234');
  });

  it('o id vem do IdGenerator (UUID v7) e o criador pode criar outro ADMIN', async () => {
    const view = await create({ role: 'ADMIN' });
    expect(view.id).toBe(h.users.all().find((u) => u.email.value === 'carla@exemplo.com')!.id.value);
    expect(view.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(view.role).toBe('ADMIN');
  });

  it('publica UserCreated e audita userCreated com actorId, userId e nivel (sem nome, e-mail nem senha)', async () => {
    const view = await create();
    expect(h.publisher.names()).toContain('UserCreated');
    const call = h.audit.of('userCreated')[0].payload;
    expect(call).toMatchObject({ actorId: vagner().id.value, userId: view.id, role: 'USER', clientIp: '203.0.113.9' });
    const text = JSON.stringify(h.audit.calls) + JSON.stringify(h.publisher.published);
    for (const secret of ['Temp1234', 'carla@exemplo.com', 'Carla Dias']) expect(text).not.toContain(secret);
  });

  it('o hash e calculado ANTES da transacao e do lock (ADR 5.4: argon2 fora do lock)', async () => {
    await create();
    expect(h.hasher.hashCalls).toBe(1);
    expect(h.log.indexOf('hash')).toBeGreaterThan(-1);
    expect(h.log.indexOf('hash')).toBeLessThan(h.log.indexOf('tx:begin'));
  });

  it('CA18: 400 acumulado nos quatro campos, nada criado, hash nem chega a ser calculado', async () => {
    const error = await rejected(create({ name: '', email: 'ana@', role: 'ROOT', password: '1234567' }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect((error.details.fields as { field: string; code: string }[]).map((f) => `${f.field}:${f.code}`).sort()).toEqual([
      'email:INVALID_FORMAT',
      'name:REQUIRED',
      'password:TOO_SHORT',
      'role:INVALID_VALUE',
    ]);
    expect(h.users.calls.insert).toBe(0);
    expect(h.hasher.hashCalls).toBe(0);
  });

  it.each([
    ['ativo (caixa diferente)', 'ANA@exemplo.com'],
    ['inativo', 'bruno@exemplo.com'],
  ])('CA17: e-mail de usuario %s -> 409 EMAIL_TAKEN com details.fields[0] = email', async (_l, email) => {
    const error = await rejected(create({ email }));
    expect(error).toMatchObject({ code: 'EMAIL_TAKEN', kind: 'conflict' });
    expect(error.details.fields[0]).toMatchObject({ field: 'email', code: 'EMAIL_TAKEN', message: expect.any(String) });
    expect(h.users.all().filter((u) => u.email.value === email.toLowerCase())).toHaveLength(1);
    expect(h.publisher.published).toEqual([]);
  });

  it.each(['demo@finance.invalid', 'demo@showcase.invalid'])('I4/D5: e-mail reservado %s -> 400 VALIDATION_ERROR (substitui o 409 antigo), nada criado', async (email) => {
    const before = h.users.all().length;
    const error = await rejected(create({ email }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(error.details.fields).toEqual([expect.objectContaining({ field: 'email', code: 'INVALID_FORMAT' })]);
    expect(h.users.all()).toHaveLength(before);
    expect(h.publisher.published).toEqual([]);
  });

  it('CA17: corrida de e-mail no insert (indice unico) tambem vira 409 e nao publica nada', async () => {
    h.users.failNextWriteWithEmailTaken = true;
    const error = await rejected(create());
    expect(error.code).toBe('EMAIL_TAKEN');
    expect(h.publisher.published).toEqual([]);
    expect(h.audit.of('userCreated')).toEqual([]);
  });

  it('precedencia 400 > 409', async () => {
    const error = await rejected(create({ email: 'ana@exemplo.com', role: 'ROOT' }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('ator USER -> 403; ator inativo -> 401', async () => {
    expect((await rejected(create({}, actorOf(ana())))).code).toBe('FORBIDDEN');
    h.users.seed(vagner({ status: 'INACTIVE' }));
    expect((await rejected(create({}, actorOf(vagner())))).code).toBe('UNAUTHENTICATED');
  });

  it('P11: o novo usuario nasce sem sessoes', async () => {
    const view = await create();
    expect(h.sessions.ofUser(view.id)).toEqual([]);
  });
});
