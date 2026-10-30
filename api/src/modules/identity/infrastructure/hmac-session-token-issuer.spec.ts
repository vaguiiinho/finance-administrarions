import { HmacSessionTokenIssuer } from './hmac-session-token-issuer.js';

const SECRET = 'x'.repeat(48);

describe('HmacSessionTokenIssuer (ADR D1, RNF02)', () => {
  it('issue: token opaco base64url (32 bytes = 43 caracteres), digest hex de 64 e tokens distintos', () => {
    const issuer = new HmacSessionTokenIssuer(SECRET);
    const a = issuer.issue();
    const b = issuer.issue();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.digest.value).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.digest.value).not.toBe(b.digest.value);
  });

  it('o digest nao contem o token e e reproduzivel a partir dele', () => {
    const issuer = new HmacSessionTokenIssuer(SECRET);
    const { token, digest } = issuer.issue();
    expect(digest.value).not.toContain(token);
    expect(issuer.digest(token)?.value).toBe(digest.value);
  });

  it('a chave faz parte do digest: outro segredo nao reconhece o token', () => {
    const { token, digest } = new HmacSessionTokenIssuer(SECRET).issue();
    expect(new HmacSessionTokenIssuer('y'.repeat(48)).digest(token)?.value).not.toBe(digest.value);
  });

  it.each(['', 'curto', 'a'.repeat(44), `${'a'.repeat(42)}!`, 'Bearer abc'])('formato invalido (%j) -> null', (token) => {
    expect(new HmacSessionTokenIssuer(SECRET).digest(token)).toBeNull();
  });
});
