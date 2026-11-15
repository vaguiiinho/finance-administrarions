import { unwrap, violationOf } from '@test/support/result.js';
import { LoginIdentifier } from './login-identifier.js';

/** LoginIdentifier (ADR 0013 3.1, B1, T3): e-mail ou o alias `demo`; o alias resolve so para o e-mail canonico da conta demo. */
const CANONICAL = 'demo@showcase.invalid';

describe('LoginIdentifier.parse: alias da conta demo (CA12)', () => {
  it.each(['demo', 'Demo', 'DEMO', ' demo ', '\tdemo\n'])('%j resolve para o e-mail canonico, viaAlias = true', (raw) => {
    const id = unwrap<LoginIdentifier>(LoginIdentifier.parse(raw));
    expect(id.email.value).toBe(CANONICAL);
    expect(id.viaAlias).toBe(true);
  });
});

describe('LoginIdentifier.parse: e-mail (CA13)', () => {
  it('o e-mail canonico da conta demo segue valendo, viaAlias = false', () => {
    const id = unwrap<LoginIdentifier>(LoginIdentifier.parse(CANONICAL));
    expect(id.email.value).toBe(CANONICAL);
    expect(id.viaAlias).toBe(false);
  });

  it('normaliza o e-mail (trim + minusculas), como EmailAddress', () => {
    const id = unwrap<LoginIdentifier>(LoginIdentifier.parse('  Ana@Exemplo.COM '));
    expect(id.email.value).toBe('ana@exemplo.com');
    expect(id.viaAlias).toBe(false);
  });

  it('o alias e o e-mail canonico produzem o mesmo e-mail (mesma chave de limite, RF11)', () => {
    const a = unwrap<LoginIdentifier>(LoginIdentifier.parse('demo'));
    const b = unwrap<LoginIdentifier>(LoginIdentifier.parse(' DEMO@showcase.invalid '));
    expect(a.email.value).toBe(b.email.value);
  });
});

describe('LoginIdentifier.parse: outros identificadores sem @ continuam invalidos (CA14)', () => {
  it.each(['admin', 'ana', 'demo2', 'de mo', 'demo ana', 'showcase', 'demo.', 'demos', 'xdemo'])('%j -> INVALID_FORMAT', (raw) => {
    expect(violationOf(LoginIdentifier.parse(raw))).toBe('INVALID_FORMAT');
  });

  it('vazio ou so espacos -> REQUIRED', () => {
    expect(violationOf(LoginIdentifier.parse(''))).toBe('REQUIRED');
    expect(violationOf(LoginIdentifier.parse('   '))).toBe('REQUIRED');
  });

  it('e-mail com mais de 254 code points -> TOO_LONG', () => {
    expect(violationOf(LoginIdentifier.parse(`${'a'.repeat(250)}@x.com`))).toBe('TOO_LONG');
  });

  it('e-mail malformado continua INVALID_FORMAT', () => {
    expect(violationOf(LoginIdentifier.parse('ana@'))).toBe('INVALID_FORMAT');
    expect(violationOf(LoginIdentifier.parse('@exemplo.com'))).toBe('INVALID_FORMAT');
  });

  it('o alias nao vale dentro de um e-mail (ex.: demo@exemplo.com e um e-mail comum)', () => {
    const id = unwrap<LoginIdentifier>(LoginIdentifier.parse('demo@exemplo.com'));
    expect(id.email.value).toBe('demo@exemplo.com');
    expect(id.viaAlias).toBe(false);
  });
});
