import * as messages from '@/core/messages';

describe('messages (textos finais em pt-BR)', () => {
  it('RATE_LIMITED_TEXT inclui os minutos', () => {
    expect(messages.RATE_LIMITED_TEXT(5)).toBe('Muitas tentativas. Tente novamente em 5 min.');
    expect(messages.RATE_LIMITED_TEXT(1)).toContain('1 min');
  });
  it('textos principais do design', () => {
    expect(messages.SESSION_EXPIRED_TEXT).toBe('Sua sessão expirou. Entre novamente.');
    expect(messages.NETWORK_TEXT).toBe('Sem conexão. Verifique sua internet.');
    expect(messages.INVALID_CREDENTIALS_TEXT).toBe('E-mail ou senha inválidos.');
    expect(messages.GENERIC_ERROR_TEXT).toBe('Algo deu errado. Tente novamente.');
    expect(messages.DEMO_CLEANUP_TEXT).toContain('03:00');
  });
  it('DEMO_CLEANUP_TEXT (ADR 0013, design 4.2): conta compartilhada, redefinida todos os dias as 03:00, dados de exemplo voltam', () => {
    expect(messages.DEMO_CLEANUP_TEXT).toBe(
      'Esta conta de demonstração é compartilhada e redefinida todos os dias às 03:00 (horário de Brasília): o que for criado ou alterado é descartado e os dados de exemplo voltam.',
    );
    expect(messages.DEMO_CLEANUP_TEXT).not.toMatch(/são apagados/);
  });
  it('BATCH_LIMIT e 100', () => expect(messages.BATCH_LIMIT).toBe(100));
  it('todo texto e nao vazio, sem espacos nas pontas', () => {
    for (const [name, value] of Object.entries(messages)) {
      if (typeof value !== 'string') continue;
      expect(value.trim(), name).toBe(value);
      expect(value.length, name).toBeGreaterThan(0);
    }
  });
});
