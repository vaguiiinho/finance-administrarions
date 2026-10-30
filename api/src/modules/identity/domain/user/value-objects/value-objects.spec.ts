import { UserName } from './user-name.js';
import { EmailAddress } from './email-address.js';
import { PlainPassword } from './plain-password.js';
import { parseRole } from './user-role.js';
import { UserId } from './user-id.js';

const okValue = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!r.ok) throw new Error(`esperava ok, veio ${String(r.error)}`);
  return r.value as T;
};
const errorOf = (r: { ok: boolean; error?: unknown }): unknown => {
  if (r.ok) throw new Error('esperava erro');
  return r.error;
};

describe('UserName (RF12)', () => {
  it('normaliza: trim, espacos colapsados e NFC', () => {
    expect(okValue(UserName.create('  Carla   Dias ')).value).toBe('Carla Dias');
    expect(okValue(UserName.create('José')).value).toBe('José');
  });

  it('CA11: preserva a caixa do que foi digitado', () => {
    expect(okValue(UserName.create('  ana   lima ')).value).toBe('ana lima');
  });

  it.each(['', '   ', '\t\n'])('vazio ou so espacos (%j) -> REQUIRED', (raw) => {
    expect(errorOf(UserName.create(raw))).toBe('REQUIRED');
  });

  it('60 code points ok; 61 -> TOO_LONG; emoji conta como 1', () => {
    expect(UserName.create('a'.repeat(60)).ok).toBe(true);
    expect(errorOf(UserName.create('a'.repeat(61)))).toBe('TOO_LONG');
    expect(UserName.create('\u{1F600}'.repeat(60)).ok).toBe(true);
    expect(errorOf(UserName.create('\u{1F600}'.repeat(61)))).toBe('TOO_LONG');
  });
});

describe('EmailAddress (RF12, P01)', () => {
  it('trim + minusculas', () => {
    expect(okValue(EmailAddress.create(' Carla@Exemplo.com ')).value).toBe('carla@exemplo.com');
  });

  it.each(['', '   '])('vazio (%j) -> REQUIRED', (raw) => {
    expect(errorOf(EmailAddress.create(raw))).toBe('REQUIRED');
  });

  it.each(['ana', 'ana@', '@exemplo.com', 'ana@exemplo', 'a b@exemplo.com', 'a@@exemplo.com', 'ana@exemplo..com.'])(
    '"%s" -> INVALID_FORMAT',
    (raw) => {
      expect(errorOf(EmailAddress.create(raw))).toBe('INVALID_FORMAT');
    },
  );

  it('parte local de 64 ok; de 65 -> INVALID_FORMAT', () => {
    expect(EmailAddress.create(`${'a'.repeat(64)}@exemplo.com`).ok).toBe(true);
    expect(errorOf(EmailAddress.create(`${'a'.repeat(65)}@exemplo.com`))).toBe('INVALID_FORMAT');
  });

  it('mais de 254 caracteres -> TOO_LONG', () => {
    const domain = `${'b'.repeat(63)}.`.repeat(3) + 'com';
    expect(errorOf(EmailAddress.create(`${'a'.repeat(64)}@${domain}`))).toBe('TOO_LONG');
  });

  it('isReserved: TLD .invalid (demo e marcador do primeiro administrador)', () => {
    expect(okValue(EmailAddress.create('demo@finance.invalid')).isReserved()).toBe(true);
    expect(okValue(EmailAddress.create('first-admin@finance.invalid')).isReserved()).toBe(true);
    expect(okValue(EmailAddress.create('ana@exemplo.com')).isReserved()).toBe(false);
  });

  it('equals compara o valor normalizado', () => {
    expect(okValue(EmailAddress.create('ANA@exemplo.com')).equals(okValue(EmailAddress.create(' ana@exemplo.com ')))).toBe(true);
  });
});

describe('PlainPassword (P02, RNF01)', () => {
  it('7 -> TOO_SHORT; 8 ok; 72 ok; 73 -> TOO_LONG', () => {
    expect(errorOf(PlainPassword.create('1234567'))).toBe('TOO_SHORT');
    expect(PlainPassword.create('12345678').ok).toBe(true);
    expect(PlainPassword.create('a'.repeat(72)).ok).toBe(true);
    expect(errorOf(PlainPassword.create('a'.repeat(73)))).toBe('TOO_LONG');
  });

  it('vazio -> REQUIRED', () => {
    expect(errorOf(PlainPassword.create(''))).toBe('REQUIRED');
  });

  it('sem trim: espacos contam e sao preservados', () => {
    expect(PlainPassword.create('        ').ok).toBe(true);
    expect(okValue(PlainPassword.create(' abc defg ')).reveal()).toBe(' abc defg ');
  });

  it('conta code points (emoji = 1)', () => {
    expect(PlainPassword.create('\u{1F600}'.repeat(8)).ok).toBe(true);
    expect(errorOf(PlainPassword.create('\u{1F600}'.repeat(7)))).toBe('TOO_SHORT');
  });

  it('RNF01: reveal() e o unico acesso; toString, template, JSON e util.inspect mascaram', async () => {
    const pw = okValue(PlainPassword.create('SuperSegredo9'));
    expect(pw.reveal()).toBe('SuperSegredo9');
    expect(pw.toString()).toBe('[REDACTED]');
    expect(`${pw}`).toBe('[REDACTED]');
    expect(JSON.stringify({ pw })).toBe('{"pw":"[REDACTED]"}');
    const { inspect } = await import('node:util');
    expect(inspect(pw)).not.toContain('SuperSegredo9');
  });
});

describe('parseRole', () => {
  it.each(['ADMIN', 'USER'])('aceita %s', (raw) => {
    expect(okValue(parseRole(raw))).toBe(raw);
  });
  it('CA18: "ROOT" -> INVALID_VALUE', () => {
    expect(errorOf(parseRole('ROOT'))).toBe('INVALID_VALUE');
  });
  it.each([undefined, null, ''])('%j -> REQUIRED', (raw) => {
    expect(errorOf(parseRole(raw))).toBe('REQUIRED');
  });
});

describe('UserId', () => {
  it('aceita UUID e rejeita lixo', () => {
    expect(UserId.create('0a000000-0000-7000-8000-000000000001').ok).toBe(true);
    expect(UserId.create('abc').ok).toBe(false);
  });
});
