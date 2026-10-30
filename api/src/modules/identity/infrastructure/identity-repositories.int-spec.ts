import type pg from 'pg';
import { createPool, expectCheckViolation, query } from '@test/support/db.js';
import { insertSession, insertUser, resetAll } from '@test/support/owned-db.js';
import { buildIdentityInfra, type IdentityInfra } from '@test/support/identity-infra.js';
import { NOW, rejected } from '@test/support/builders.js';
import { aUser, ana, bruno, carla, demoUser, emailOf, firstAdminMarker, outroAdmin, sessionUuid, userId, userUuid, vagner } from '@test/support/identity-builders.js';
import { Session } from '@identity/domain/session/session.js';
import { SessionId } from '@identity/domain/session/value-objects/session-id.js';
import { SessionTokenDigest } from '@identity/domain/session/value-objects/session-token-digest.js';
import { unwrap } from '@test/support/result.js';
import { DEMO_USER_ID, FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';

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

const H = 3_600_000;
const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
const digest = (n: number) => unwrap<SessionTokenDigest>(SessionTokenDigest.create(n.toString(16).padStart(64, '0')));

describe('PrismaUserRepository', () => {
  it('insert + findById fazem round trip de todos os campos (entidade de dominio, nao model do Prisma)', async () => {
    const user = vagner({ mustChangePassword: true });
    await infra.users.insert(user);
    const found = await infra.users.findById(user.id);
    expect(found).not.toBeNull();
    expect(found!.toSnapshot()).toEqual(user.toSnapshot());
  });

  it('timestamps em UTC e e-mail gravado normalizado', async () => {
    await infra.users.insert(ana());
    const [row] = await query<{ email: string; created_at: Date }>(pool, 'SELECT email, created_at FROM users');
    expect(row.email).toBe('ana@exemplo.com');
    expect(row.created_at.toISOString()).toBe(NOW.toISOString());
  });

  it('findById inexistente -> null; findByEmail acha por e-mail normalizado (inclusive inativo e demo)', async () => {
    await infra.users.insert(bruno({ status: 'INACTIVE' }));
    await infra.users.insert(demoUser());
    expect(await infra.users.findById(userId(userUuid(99)))).toBeNull();
    expect((await infra.users.findByEmail(emailOf(' BRUNO@exemplo.com ')))?.id.value).toBe(bruno().id.value);
    expect((await infra.users.findByEmail(emailOf('demo@finance.invalid')))?.id.value).toBe(DEMO_USER_ID);
    expect(await infra.users.findByEmail(emailOf('x@exemplo.com'))).toBeNull();
  });

  it('insert com e-mail repetido -> EmailTakenError (409), sem diferenciar caixa', async () => {
    await infra.users.insert(ana());
    const error = await rejected(infra.users.insert(aUser({ n: 9, email: 'ANA@exemplo.com' })));
    expect(error).toMatchObject({ code: 'EMAIL_TAKEN', kind: 'conflict' });
  });

  it('corrida: dois inserts simultaneos do mesmo e-mail -> exatamente um EmailTakenError', async () => {
    const results = await Promise.allSettled([
      infra.users.insert(aUser({ n: 7, email: 'corrida@exemplo.com' })),
      infra.users.insert(aUser({ n: 8, email: 'corrida@exemplo.com' })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('update persiste nome, e-mail, nivel, situacao, hash, troca obrigatoria e updatedAt; EmailTaken ao colidir', async () => {
    await infra.users.insert(ana());
    await infra.users.insert(bruno());
    const user = (await infra.users.findById(ana().id))!;
    const later = new Date(NOW.getTime() + 60_000);
    user.updateDetails({ name: user.name, email: emailOf('ana.lima@exemplo.com'), role: 'ADMIN' }, later);
    user.deactivate(later);
    await infra.users.update(user);
    const stored = (await infra.users.findById(ana().id))!;
    expect(stored).toMatchObject({ role: 'ADMIN', status: 'INACTIVE', updatedAt: later });
    expect(stored.email.value).toBe('ana.lima@exemplo.com');

    const clash = (await infra.users.findById(bruno().id))!;
    clash.updateDetails({ name: clash.name, email: emailOf('ana.lima@exemplo.com'), role: 'USER' }, later);
    expect((await rejected(infra.users.update(clash))).code).toBe('EMAIL_TAKEN');
  });

  it('listManageable: so REGULAR (sem demo nem marcador), ativos antes de inativos, depois por nome', async () => {
    for (const u of [bruno({ status: 'INACTIVE' }), vagner(), carla(), ana(), demoUser(), firstAdminMarker()]) await infra.users.insert(u);
    const list = await infra.users.listManageable();
    expect(list.map((u) => u.name.value)).toEqual(['Ana Souza', 'Carla Dias', 'Vagner', 'Bruno Lima']);
  });

  it('listManageable ordena nomes com acento pela collation pt-BR (Álvaro antes de Bruno)', async () => {
    await infra.users.insert(aUser({ n: 20, name: 'Bruno', email: 'b@exemplo.com' }));
    await infra.users.insert(aUser({ n: 21, name: 'Álvaro', email: 'a@exemplo.com' }));
    await infra.users.insert(aUser({ n: 22, name: 'Zelia', email: 'z@exemplo.com' }));
    expect((await infra.users.listManageable()).map((u) => u.name.value)).toEqual(['Álvaro', 'Bruno', 'Zelia']);
  });

  it('countActiveAdminsExcept: so REGULAR + ADMIN + ACTIVE, excluindo o id informado', async () => {
    await infra.users.insert(vagner());
    await infra.users.insert(outroAdmin());
    await infra.users.insert(aUser({ n: 6, role: 'ADMIN', status: 'INACTIVE', email: 'inativo@exemplo.com' }));
    await infra.users.insert(ana());
    await infra.users.insert(firstAdminMarker()); // ADMIN/ACTIVE mas PENDING: nao conta
    // fora de transacao com lock o repositorio real deve funcionar igual (o lock e do UnitOfWork)
    expect(await infra.users.countActiveAdminsExcept(vagner().id)).toBe(1);
    expect(await infra.users.countActiveAdminsExcept(ana().id)).toBe(2);
  });

  it('countRegular conta so REGULAR (demo e marcador nao contam)', async () => {
    await infra.users.insert(demoUser());
    await infra.users.insert(firstAdminMarker());
    expect(await infra.users.countRegular()).toBe(0);
    await infra.users.insert(ana());
    expect(await infra.users.countRegular()).toBe(1);
  });
});

describe('CHECKs de users (ADR 7.3)', () => {
  it('REGULAR sem hash falha', async () => {
    await expectCheckViolation(insertUser(pool, { n: 1, kind: 'REGULAR', passwordHash: null }));
  });
  it('DEMO com hash falha; DEMO com ADMIN falha', async () => {
    await expectCheckViolation(insertUser(pool, { n: 1, kind: 'DEMO', passwordHash: 'x' }));
    await expectCheckViolation(insertUser(pool, { n: 2, kind: 'DEMO', role: 'ADMIN', passwordHash: null }));
  });
  it('marcador do primeiro administrador com outro id ou com hash falha; com o id fixo e sem hash passa', async () => {
    await expectCheckViolation(insertUser(pool, { n: 1, kind: 'PENDING_FIRST_ADMIN', passwordHash: null }));
    await expectCheckViolation(insertUser(pool, { n: 2, id: FIRST_ADMIN_ID, kind: 'PENDING_FIRST_ADMIN', passwordHash: 'x', email: 'm@finance.invalid' }));
    await expect(insertUser(pool, { n: 3, id: FIRST_ADMIN_ID, kind: 'PENDING_FIRST_ADMIN', passwordHash: null, email: 'm2@finance.invalid' })).resolves.toBe(FIRST_ADMIN_ID);
  });
  it('e-mail com maiusculas falha (email = lower(email))', async () => {
    await expectCheckViolation(insertUser(pool, { n: 1, email: 'Ana@Exemplo.com' }));
  });
  it('updated_at anterior a created_at falha', async () => {
    await expectCheckViolation(insertUser(pool, { n: 1, createdAt: iso(H), updatedAt: iso(0) }));
  });
  it('indice unico de e-mail: duplicata falha com 23505', async () => {
    await insertUser(pool, { n: 1, email: 'a@exemplo.com' });
    await expect(insertUser(pool, { n: 2, email: 'a@exemplo.com' })).rejects.toMatchObject({ code: '23505' });
  });
  it('sessions.expires_at deve ser posterior a created_at', async () => {
    const id = await insertUser(pool, { n: 1 });
    await expectCheckViolation(insertSession(pool, { n: 1, userId: id, createdAt: iso(0), expiresAt: iso(0) }));
  });
});

describe('PrismaSessionRepository', () => {
  const open = (n: number, user: string, at = NOW) =>
    Session.open({ id: unwrap<SessionId>(SessionId.create(sessionUuid(n))), userId: userId(user), tokenDigest: digest(n), now: at });

  it('insert + findActiveByDigest: round trip; expira exatamente em 24 h', async () => {
    await infra.users.insert(ana());
    const s = open(1, ana().id.value);
    await infra.sessions.insert(s);
    const found = await infra.sessions.findActiveByDigest(digest(1), new Date(NOW.getTime() + 24 * H - 1));
    expect(found?.toSnapshot()).toEqual(s.toSnapshot());
    expect(await infra.sessions.findActiveByDigest(digest(1), new Date(NOW.getTime() + 24 * H))).toBeNull();
    expect(await infra.sessions.findActiveByDigest(digest(2), NOW)).toBeNull();
  });

  it('delete remove so a sessao indicada', async () => {
    await infra.users.insert(ana());
    await infra.sessions.insert(open(1, ana().id.value));
    await infra.sessions.insert(open(2, ana().id.value));
    await infra.sessions.delete(open(1, ana().id.value).id);
    expect((await query(pool, 'SELECT id FROM sessions')).length).toBe(1);
  });

  it('deleteAllOfUser (RF14, RF16): apaga todas do usuario, devolve a quantidade e preserva as de outros', async () => {
    await infra.users.insert(ana());
    await infra.users.insert(bruno());
    await infra.sessions.insert(open(1, ana().id.value));
    await infra.sessions.insert(open(2, ana().id.value));
    await infra.sessions.insert(open(3, bruno().id.value));
    expect(await infra.sessions.deleteAllOfUser(ana().id)).toBe(2);
    const left = await query<{ user_id: string }>(pool, 'SELECT user_id FROM sessions');
    expect(left.map((r) => r.user_id)).toEqual([bruno().id.value]);
  });

  it('deleteAllOfUserExcept (RF08): mantem a sessao atual', async () => {
    await infra.users.insert(ana());
    await infra.users.insert(bruno());
    await infra.sessions.insert(open(1, ana().id.value));
    await infra.sessions.insert(open(2, ana().id.value));
    await infra.sessions.insert(open(3, bruno().id.value));
    expect(await infra.sessions.deleteAllOfUserExcept(ana().id, open(2, ana().id.value).id)).toBe(1);
    const ids = (await query<{ id: string }>(pool, 'SELECT id FROM sessions ORDER BY id')).map((r) => r.id);
    expect(ids).toEqual([sessionUuid(2), sessionUuid(3)]);
  });

  it('deleteExpired apaga so as expiradas', async () => {
    await infra.users.insert(ana());
    await infra.sessions.insert(open(1, ana().id.value, new Date(NOW.getTime() - 48 * H)));
    await infra.sessions.insert(open(2, ana().id.value));
    expect(await infra.sessions.deleteExpired(NOW)).toBe(1);
    expect((await query<{ id: string }>(pool, 'SELECT id FROM sessions')).map((r) => r.id)).toEqual([sessionUuid(2)]);
  });
});

describe('PrismaSessionPrincipalLookup (T16, RNF14)', () => {
  it('une sessao e usuario e reflete UPDATEs diretos no banco na PROXIMA chamada (sem cache)', async () => {
    const id = await insertUser(pool, { n: 1, role: 'USER', status: 'ACTIVE', mustChangePassword: false });
    await insertSession(pool, { n: 1, userId: id, createdAt: iso(0), expiresAt: iso(24 * H) });
    const d = digest(1);
    expect(await infra.lookup.findByDigest(d, NOW)).toEqual({
      sessionId: sessionUuid(1),
      userId: id,
      kind: 'REGULAR',
      role: 'USER',
      status: 'ACTIVE',
      mustChangePassword: false,
    });
    await pool.query(`UPDATE users SET role = 'ADMIN', must_change_password = true WHERE id = $1`, [id]);
    expect(await infra.lookup.findByDigest(d, NOW)).toMatchObject({ role: 'ADMIN', mustChangePassword: true });
    await pool.query(`UPDATE users SET status = 'INACTIVE' WHERE id = $1`, [id]);
    expect(await infra.lookup.findByDigest(d, NOW)).toMatchObject({ status: 'INACTIVE' });
  });

  it('sessao expirada ou digest desconhecido -> null', async () => {
    const id = await insertUser(pool, { n: 1 });
    await insertSession(pool, { n: 1, userId: id, createdAt: iso(0), expiresAt: iso(24 * H) });
    expect(await infra.lookup.findByDigest(digest(1), new Date(NOW.getTime() + 24 * H))).toBeNull();
    expect(await infra.lookup.findByDigest(digest(2), NOW)).toBeNull();
  });

  it('as consultas de identity nao dependem de tabelas financeiras (RNF06)', async () => {
    await pool.query('ALTER TABLE entries RENAME TO entries_off');
    try {
      const id = await insertUser(pool, { n: 1 });
      await insertSession(pool, { n: 1, userId: id, createdAt: iso(0), expiresAt: iso(24 * H) });
      await expect(infra.lookup.findByDigest(digest(1), NOW)).resolves.not.toBeNull();
      await expect(infra.users.listManageable()).resolves.toHaveLength(1);
      await expect(infra.users.countActiveAdminsExcept(userId(userUuid(99)))).resolves.toBe(0);
    } finally {
      await pool.query('ALTER TABLE entries_off RENAME TO entries');
    }
  });
});
