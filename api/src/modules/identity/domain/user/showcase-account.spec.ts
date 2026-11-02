import { InvariantViolationError } from '@shared/domain/app-error.js';
import { NOW } from '@test/support/builders.js';
import { aUser, emailOf, hashOf, userName } from '@test/support/identity-builders.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID, SHOWCASE_NAME, showcaseUser } from '@test/support/showcase-builders.js';
import { User } from './user.js';

const LATER = new Date(NOW.getTime() + 60_000);
const eventNames = (u: User) => u.pullEvents().map((e) => e.constructor.name);

describe('User.showcase (ADR 0011 3.3)', () => {
  it('cria a conta com as constantes do dominio, ativa, USER, sem troca obrigatoria', () => {
    const u = User.showcase({ passwordHash: hashOf('demo'), now: NOW });
    expect(u.kind).toBe('SHOWCASE');
    expect(u.id.value).toBe(SHOWCASE_ID);
    expect(u.email.value).toBe(SHOWCASE_EMAIL);
    expect(u.name.value).toBe(SHOWCASE_NAME);
    expect(u.role).toBe('USER');
    expect(u.status).toBe('ACTIVE');
    expect(u.mustChangePassword).toBe(false);
    expect(u.passwordHash?.value).toBe('$fake$demo');
    expect(u.createdAt).toEqual(NOW);
  });

  it('registra ShowcaseAccountProvisioned sem senha, hash ou e-mail', () => {
    const u = User.showcase({ passwordHash: hashOf('demo'), now: NOW });
    const events = u.pullEvents();
    expect(events.map((e) => e.constructor.name)).toEqual(['ShowcaseAccountProvisioned']);
    expect(events[0]).toMatchObject({ userId: SHOWCASE_ID, occurredAt: NOW });
    const text = JSON.stringify(events);
    expect(text).not.toContain('demo@');
    expect(text).not.toContain('$fake$');
  });

  it('o id da conta e diferente do DEMO_USER_ID (dataset publico)', () => {
    expect(SHOWCASE_ID).not.toBe('01900000-0000-7000-8000-0000000000d1');
  });
});

describe('User.restore: invariantes de SHOWCASE (espelham o CHECK do banco)', () => {
  it('conta valida reidrata', () => {
    expect(() => showcaseUser()).not.toThrow();
  });

  it.each([
    ['sem hash de senha', { password: null }],
    ['role ADMIN', { role: 'ADMIN' as const }],
    ['id diferente', { id: '01900000-0000-7000-8000-0000000000d9' }],
    ['e-mail diferente', { email: 'outro@showcase.invalid' }],
    ['troca obrigatoria pendente', { mustChangePassword: true }],
  ])('rejeita SHOWCASE %s', (_label, over) => {
    expect(() => showcaseUser(over)).toThrow(InvariantViolationError);
  });
});

describe('SHOWCASE: elegibilidade e administracao', () => {
  it('canAuthenticate: REGULAR e SHOWCASE ativos sim', () => {
    expect(aUser().canAuthenticate()).toBe(true);
    expect(showcaseUser().canAuthenticate()).toBe(true);
  });

  it('canAuthenticate: inativos, DEMO e marcador do primeiro admin nao', () => {
    expect(aUser({ status: 'INACTIVE' }).canAuthenticate()).toBe(false);
    expect(showcaseUser({ status: 'INACTIVE' }).canAuthenticate()).toBe(false);
    expect(User.demo({ now: NOW }).canAuthenticate()).toBe(false);
    expect(
      aUser({ kind: 'PENDING_FIRST_ADMIN', id: '01900000-0000-7000-8000-0000000000a1', role: 'ADMIN', password: null, mustChangePassword: true }).canAuthenticate(),
    ).toBe(false);
  });

  it('isManageable e isActiveAdmin sao falsos para SHOWCASE (nunca conta como LAST_ADMIN)', () => {
    const u = showcaseUser();
    expect(u.isManageable()).toBe(false);
    expect(u.isActiveAdmin()).toBe(false);
  });
});

describe('SHOWCASE: replaceShowcasePassword', () => {
  it('troca o hash, nao mexe em status nem em mustChangePassword, e registra ShowcasePasswordReplaced', () => {
    const u = showcaseUser();
    u.replaceShowcasePassword(hashOf('nova-senha'), LATER);
    expect(u.passwordHash?.value).toBe('$fake$nova-senha');
    expect(u.status).toBe('ACTIVE');
    expect(u.mustChangePassword).toBe(false);
    expect(u.updatedAt).toEqual(LATER);
    expect(eventNames(u)).toEqual(['ShowcasePasswordReplaced']);
  });

  it('nao troca a senha de conta que nao e SHOWCASE (InvariantViolationError)', () => {
    expect(() => aUser().replaceShowcasePassword(hashOf('x1234567'), LATER)).toThrow(InvariantViolationError);
  });

  it('preserva conta inativa (nao reativa)', () => {
    const u = showcaseUser({ status: 'INACTIVE' });
    u.replaceShowcasePassword(hashOf('outra'), LATER);
    expect(u.status).toBe('INACTIVE');
  });
});

describe('SHOWCASE: defesa em profundidade (B8)', () => {
  it('changePassword lanca InvariantViolationError', () => {
    expect(() => showcaseUser().changePassword(hashOf('OutraSenha9'), LATER)).toThrow(InvariantViolationError);
  });
  it('rename lanca InvariantViolationError', () => {
    expect(() => showcaseUser().rename(userName('Nome Ofensivo'), LATER)).toThrow(InvariantViolationError);
  });
  it('REGULAR continua trocando senha e nome', () => {
    const u = aUser();
    expect(() => u.changePassword(hashOf('OutraSenha9'), LATER)).not.toThrow();
    expect(u.rename(userName('Outro Nome'), LATER)).toBe(true);
  });
  it('deactivate (interruptor da conta) continua funcionando', () => {
    const u = showcaseUser();
    expect(u.deactivate(LATER)).toBe(true);
    expect(u.status).toBe('INACTIVE');
  });
});

describe('e-mail da conta', () => {
  it('demo@showcase.invalid e um e-mail valido para o fluxo comum (TLD .invalid, sem alias)', () => {
    expect(emailOf('demo@showcase.invalid').value).toBe('demo@showcase.invalid');
  });
});
