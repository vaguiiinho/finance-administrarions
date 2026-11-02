import { parseNewUser } from './parse-new-user.js';
import { parseUserDetails } from './parse-user-details.js';
import { parseFirstAdminConfig } from './parse-first-admin-config.js';
import { FirstAdminConfigError, UserValidationError } from './errors/user-errors.js';
import { thrown } from '@test/support/builders.js';

const codesOf = (error: { details?: any }) =>
  (error.details.fields as { field: string; code: string; message: string }[]).map((f) => `${f.field}:${f.code}`).sort();

describe('parseNewUser (RF12, CA16, CA18)', () => {
  it('normaliza e devolve value objects', () => {
    const parsed = parseNewUser({ name: '  Carla   Dias ', email: ' Carla@Exemplo.com ', role: 'USER', password: 'Temp1234' });
    expect(parsed.name.value).toBe('Carla Dias');
    expect(parsed.email.value).toBe('carla@exemplo.com');
    expect(parsed.role).toBe('USER');
    expect(parsed.password.reveal()).toBe('Temp1234');
  });

  it('CA18: acumula os quatro campos de uma vez', () => {
    const error = thrown(() => parseNewUser({ name: '', email: 'ana@', role: 'ROOT', password: '1234567' }));
    expect(error).toBeInstanceOf(UserValidationError);
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(codesOf(error)).toEqual(['email:INVALID_FORMAT', 'name:REQUIRED', 'password:TOO_SHORT', 'role:INVALID_VALUE']);
    for (const f of error.details.fields) expect(f.message).toEqual(expect.any(String));
  });

  it('CA18: senha de 73 caracteres -> password: TOO_LONG', () => {
    const error = thrown(() => parseNewUser({ name: 'Ana', email: 'ana@exemplo.com', role: 'USER', password: 'a'.repeat(73) }));
    expect(codesOf(error)).toEqual(['password:TOO_LONG']);
  });

  it('campos ausentes ou de tipo errado -> REQUIRED em cada um', () => {
    const error = thrown(() => parseNewUser({ name: undefined, email: 42, role: null, password: undefined }));
    expect(codesOf(error)).toEqual(['email:REQUIRED', 'name:REQUIRED', 'password:REQUIRED', 'role:REQUIRED']);
  });

  it.each(['demo@finance.invalid', 'demo@showcase.invalid', 'first-admin@finance.invalid'])('I4/D5: e-mail reservado %s -> email:INVALID_FORMAT', (email) => {
    const error = thrown(() => parseNewUser({ name: 'X', email, role: 'USER', password: 'Temp1234' }));
    expect(codesOf(error)).toEqual(['email:INVALID_FORMAT']);
  });

  it('a mensagem do erro nunca contem a senha', () => {
    const error = thrown(() => parseNewUser({ name: '', email: 'x@y.com', role: 'USER', password: 'curta' }));
    expect(JSON.stringify(error.details) + error.message).not.toContain('curta');
  });
});

describe('parseUserDetails (RF13)', () => {
  it('normaliza nome, e-mail e nivel', () => {
    const parsed = parseUserDetails({ name: ' Ana  Lima ', email: 'ANA.LIMA@exemplo.com', role: 'ADMIN' });
    expect([parsed.name.value, parsed.email.value, parsed.role]).toEqual(['Ana Lima', 'ana.lima@exemplo.com', 'ADMIN']);
  });

  it('acumula name, email e role', () => {
    const error = thrown(() => parseUserDetails({ name: '', email: 'ana@', role: 'ROOT' }));
    expect(error).toBeInstanceOf(UserValidationError);
    expect(codesOf(error)).toEqual(['email:INVALID_FORMAT', 'name:REQUIRED', 'role:INVALID_VALUE']);
  });

  it('I4/D5: e-mail reservado (.invalid) -> email:INVALID_FORMAT', () => {
    const error = thrown(() => parseUserDetails({ name: 'Ana', email: 'demo@showcase.invalid', role: 'USER' }));
    expect(codesOf(error)).toEqual(['email:INVALID_FORMAT']);
  });
});

describe('parseFirstAdminConfig (RF20, CA12, CA13)', () => {
  const valid = { ADMIN_NAME: 'Vagner', ADMIN_EMAIL: 'Admin@Exemplo.com', ADMIN_PASSWORD: 'Inicial123' };

  it('CA12: aplica as regras de nome, e-mail e senha', () => {
    const parsed = parseFirstAdminConfig(valid);
    expect([parsed.name.value, parsed.email.value, parsed.password.reveal()]).toEqual(['Vagner', 'admin@exemplo.com', 'Inicial123']);
  });

  it('CA13: variavel ausente -> FirstAdminConfigError apontando o NOME da variavel', () => {
    const error = thrown(() => parseFirstAdminConfig({ ADMIN_NAME: 'Vagner', ADMIN_EMAIL: 'a@b.com' }));
    expect(error).toBeInstanceOf(FirstAdminConfigError);
    expect(error.details.variables).toEqual([{ name: 'ADMIN_PASSWORD', code: 'REQUIRED' }]);
  });

  it('CA13: ADMIN_EMAIL="admin@" -> INVALID_FORMAT em ADMIN_EMAIL', () => {
    const error = thrown(() => parseFirstAdminConfig({ ...valid, ADMIN_EMAIL: 'admin@' }));
    expect(error.details.variables).toEqual([{ name: 'ADMIN_EMAIL', code: 'INVALID_FORMAT' }]);
  });

  it('acumula todas as variaveis ausentes ou invalidas', () => {
    const error = thrown(() => parseFirstAdminConfig({}));
    expect(error.details.variables.map((v: { name: string }) => v.name).sort()).toEqual(['ADMIN_EMAIL', 'ADMIN_NAME', 'ADMIN_PASSWORD']);
    const short = thrown(() => parseFirstAdminConfig({ ...valid, ADMIN_PASSWORD: 'curta' }));
    expect(short.details.variables).toEqual([{ name: 'ADMIN_PASSWORD', code: 'TOO_SHORT' }]);
  });

  it('.invalid so e recusado aqui: ADMIN_EMAIL reservado -> INVALID_FORMAT', () => {
    const error = thrown(() => parseFirstAdminConfig({ ...valid, ADMIN_EMAIL: 'x@finance.invalid' }));
    expect(error.details.variables).toEqual([{ name: 'ADMIN_EMAIL', code: 'INVALID_FORMAT' }]);
  });

  it('RNF01: o erro nunca contem o valor da senha (nem em details, nem na mensagem)', () => {
    const error = thrown(() => parseFirstAdminConfig({ ...valid, ADMIN_EMAIL: 'admin@', ADMIN_PASSWORD: 'curta' }));
    const text = JSON.stringify(error.details) + error.message + String(error.stack);
    expect(text).not.toContain('curta');
    expect(text).not.toContain('Inicial123');
  });
});
