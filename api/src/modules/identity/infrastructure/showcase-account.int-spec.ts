import type pg from 'pg';
import { createPool, expectCheckViolation, query } from '@test/support/db.js';
import { insertOwnedEntry, insertSession, insertUser, resetAll } from '@test/support/owned-db.js';
import { buildIdentityInfra, type IdentityInfra } from '@test/support/identity-infra.js';
import { NOW } from '@test/support/builders.js';
import { ana, demoUser, emailOf, firstAdminMarker, hashOf, vagner } from '@test/support/identity-builders.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID, showcaseUser } from '@test/support/showcase-builders.js';
import { SessionTokenDigest } from '@identity/domain/session/value-objects/session-token-digest.js';
import { Session } from '@identity/domain/session/session.js';
import { SessionId } from '@identity/domain/session/value-objects/session-id.js';
import { sessionUuid, userId } from '@test/support/identity-builders.js';
import { unwrap } from '@test/support/result.js';

let pool: pg.Pool;
let infra: IdentityInfra;
beforeAll(async () => {
  pool = createPool();
  infra = await buildIdentityInfra();
});
afterAll(async () => {
  await infra.close();
  await pool.end();
});
beforeEach(() => resetAll(pool));

const showcaseRow = (over: Record<string, unknown> = {}) => ({
  n: 50,
  id: SHOWCASE_ID,
  kind: 'SHOWCASE' as never,
  name: 'Conta de demonstração',
  email: SHOWCASE_EMAIL,
  role: 'USER' as const,
  passwordHash: '$argon2id$hash-qualquer',
  ...over,
});

describe('users_showcase_chk (ADR 0011 7.2): espelha as invariantes do dominio', () => {
  it('conta valida passa', async () => {
    await expect(insertUser(pool, showcaseRow())).resolves.toBe(SHOWCASE_ID);
  });
  it('sem hash de senha falha', async () => {
    await expectCheckViolation(insertUser(pool, showcaseRow({ passwordHash: null })));
  });
  it('role ADMIN falha', async () => {
    await expectCheckViolation(insertUser(pool, showcaseRow({ role: 'ADMIN' })));
  });
  it('outro id falha', async () => {
    await expectCheckViolation(insertUser(pool, showcaseRow({ id: '01900000-0000-7000-8000-0000000000d9' })));
  });
  it('outro e-mail falha', async () => {
    await expectCheckViolation(insertUser(pool, showcaseRow({ email: 'outro@showcase.invalid' })));
  });
  it('must_change_password = true falha', async () => {
    await expectCheckViolation(insertUser(pool, showcaseRow({ mustChangePassword: true })));
  });
  it('os CHECKs antigos seguem valendo (REGULAR sem hash, DEMO com hash)', async () => {
    await expectCheckViolation(insertUser(pool, { n: 1, kind: 'REGULAR', passwordHash: null }));
    await expectCheckViolation(insertUser(pool, { n: 2, kind: 'DEMO', passwordHash: 'x' }));
  });
});

describe('PrismaUserRepository com SHOWCASE', () => {
  it('insert + findById fazem round trip (entidade de dominio)', async () => {
    const u = showcaseUser();
    await infra.users.insert(u);
    const found = await infra.users.findById(u.id);
    expect(found!.toSnapshot()).toEqual(u.toSnapshot());
    expect(found!.kind).toBe('SHOWCASE');
  });

  it('findByEmail encontra a conta pelo e-mail canonico (login pelo fluxo comum)', async () => {
    await infra.users.insert(showcaseUser());
    expect((await infra.users.findByEmail(emailOf(' DEMO@Showcase.invalid ')))?.id.value).toBe(SHOWCASE_ID);
  });

  it('update persiste a nova senha e a inativacao', async () => {
    await infra.users.insert(showcaseUser());
    const u = (await infra.users.findById(showcaseUser().id))!;
    u.replaceShowcasePassword(hashOf('nova'), new Date(NOW.getTime() + 1000));
    u.deactivate(new Date(NOW.getTime() + 2000));
    await infra.users.update(u);
    const stored = (await infra.users.findById(u.id))!;
    expect(stored.status).toBe('INACTIVE');
    expect(stored.passwordHash?.value).toBe('$fake$nova');
  });

  it('a conta nao aparece na gestao: listManageable, countRegular e countActiveAdminsExcept a ignoram', async () => {
    for (const u of [showcaseUser(), ana(), vagner(), demoUser(), firstAdminMarker()]) await infra.users.insert(u);
    expect((await infra.users.listManageable()).map((u) => u.kind)).toEqual(['REGULAR', 'REGULAR']);
    expect(await infra.users.countRegular()).toBe(2);
    expect(await infra.users.countActiveAdminsExcept(ana().id)).toBe(1);
  });
});

describe('PrismaSessionPrincipalLookup com SHOWCASE', () => {
  it('devolve kind = SHOWCASE, role USER e ACTIVE para a sessao da conta', async () => {
    await infra.users.insert(showcaseUser());
    const digest = unwrap<SessionTokenDigest>(SessionTokenDigest.create('ab'.repeat(32)));
    await infra.sessions.insert(
      Session.open({ id: unwrap<SessionId>(SessionId.create(sessionUuid(1))), userId: userId(SHOWCASE_ID), tokenDigest: digest, now: NOW }),
    );
    const record = await infra.lookup.findByDigest(digest, NOW);
    expect(record).toMatchObject({ userId: SHOWCASE_ID, kind: 'SHOWCASE', role: 'USER', status: 'ACTIVE', mustChangePassword: false });
  });
});
