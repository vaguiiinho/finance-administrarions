import { thrown } from '@test/support/builders.js';
import { aUser, userUuid } from '@test/support/identity-builders.js';
import { CannotTargetSelfError, LastAdminError } from './errors/user-errors.js';
import { LastActiveAdminPolicy } from './last-active-admin.policy.js';
import { SelfTargetPolicy } from './self-target.policy.js';
import { userId } from '@test/support/identity-builders.js';

describe('LastActiveAdminPolicy (RF17, RNF15)', () => {
  const admin = (o: Parameters<typeof aUser>[0] = {}) => aUser({ n: 4, role: 'ADMIN', ...o });

  // alvo ANTES -> DEPOIS (fabricas lazy), outros administradores ativos, deve lancar?
  const row = (
    label: string,
    before: () => ReturnType<typeof aUser>,
    after: () => ReturnType<typeof aUser>,
    others: number,
    shouldThrow: boolean,
  ) => [label, before, after, others, shouldThrow] as const;
  it.each([
    row('admin ativo -> inativo, sem outros', () => admin(), () => admin({ status: 'INACTIVE' }), 0, true),
    row('admin ativo -> USER, sem outros', () => admin(), () => admin({ role: 'USER' }), 0, true),
    row('admin ativo -> inativo e USER, sem outros', () => admin(), () => admin({ role: 'USER', status: 'INACTIVE' }), 0, true),
    row('admin ativo -> inativo, com 1 outro', () => admin(), () => admin({ status: 'INACTIVE' }), 1, false),
    row('admin ativo -> USER, com 1 outro', () => admin(), () => admin({ role: 'USER' }), 1, false),
    row('admin ativo -> admin ativo (so renomeou), sem outros', () => admin(), () => admin({ name: 'Novo Nome' }), 0, false),
    row('admin inativo -> USER, sem outros (nao era admin ativo)', () => admin({ status: 'INACTIVE' }), () => admin({ status: 'INACTIVE', role: 'USER' }), 0, false),
    row('admin inativo -> ativo, sem outros', () => admin({ status: 'INACTIVE' }), () => admin(), 0, false),
    row('USER ativo -> inativo, sem outros', () => aUser({ n: 4 }), () => aUser({ n: 4, status: 'INACTIVE' }), 0, false),
    row('USER -> ADMIN, sem outros', () => aUser({ n: 4 }), () => admin(), 0, false),
  ])('%s', (_label, before, after, others, shouldThrow) => {
    const run = () => LastActiveAdminPolicy.assertKeepsAnActiveAdmin(before(), after(), others);
    if (shouldThrow) {
      const error = thrown(run);
      expect(error).toBeInstanceOf(LastAdminError);
      expect(error).toMatchObject({ code: 'LAST_ADMIN', kind: 'business_rule' });
    } else {
      expect(run).not.toThrow();
    }
  });
});

describe('SelfTargetPolicy (RF17)', () => {
  it('mesmo id -> CANNOT_TARGET_SELF', () => {
    const error = thrown(() => SelfTargetPolicy.assertNotSelf(userId(userUuid(1)), userId(userUuid(1))));
    expect(error).toBeInstanceOf(CannotTargetSelfError);
    expect(error).toMatchObject({ code: 'CANNOT_TARGET_SELF', kind: 'business_rule' });
  });

  it('ids diferentes -> ok', () => {
    expect(() => SelfTargetPolicy.assertNotSelf(userId(userUuid(1)), userId(userUuid(2)))).not.toThrow();
  });
});
