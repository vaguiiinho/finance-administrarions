import { EnsureShowcaseAccount } from './ensure-showcase-account.js';
import { ana } from '@test/support/identity-builders.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID, showcaseUser } from '@test/support/showcase-builders.js';
import { buildShowcaseHarness, type ShowcaseHarness } from '@test/support/showcase-harness.js';

let h: ShowcaseHarness;
beforeEach(() => {
  h = buildShowcaseHarness();
});
const run = (password: string | null) => h.ensureShowcase.execute({ password });

describe('EnsureShowcaseAccount: habilitada (RF36, CA49)', () => {
  it('conta nao existe -> created: SHOWCASE/USER/ativa, senha "demo" (curta) valida, evento publicado, uma transacao', async () => {
    expect(await run('demo')).toEqual({ status: 'created' });
    const u = h.users.get(SHOWCASE_ID)!;
    expect(u).toMatchObject({ kind: 'SHOWCASE', role: 'USER', status: 'ACTIVE', mustChangePassword: false });
    expect(u.email.value).toBe(SHOWCASE_EMAIL);
    expect(u.passwordHash?.value).toBe('$fake$demo');
    expect(h.publisher.names()).toContain('ShowcaseAccountProvisioned');
    expect(h.uow.runs).toBe(1);
  });

  it('idempotente: segunda execucao com a mesma senha -> unchanged, exatamente uma conta, sem escrita', async () => {
    await run('demo');
    const updates = h.users.calls.update;
    expect(await run('demo')).toEqual({ status: 'unchanged' });
    expect(h.users.all().filter((u) => u.kind === 'SHOWCASE')).toHaveLength(1);
    expect(h.users.calls.update).toBe(updates);
  });

  it('conta existente nao tem nivel nem dados alterados (role/nome/status)', async () => {
    h.users.seed(showcaseUser());
    await run('demo');
    expect(h.users.get(SHOWCASE_ID)).toMatchObject({ role: 'USER', status: 'ACTIVE' });
  });

  it('senha configurada mudou -> updated: regrava o hash e ENCERRA as sessoes da conta', async () => {
    h.users.seed(showcaseUser());
    h.openSession(showcaseUser());
    h.openSession(showcaseUser());
    expect(await run('nova')).toEqual({ status: 'updated' });
    expect(h.users.get(SHOWCASE_ID)!.passwordHash?.value).toBe('$fake$nova');
    expect(h.sessions.ofUser(SHOWCASE_ID)).toHaveLength(0);
    expect(h.publisher.names()).toContain('ShowcasePasswordReplaced');
  });

  it('senha divergente restaura "demo" mesmo se alguem conseguiu troca-la (rede de seguranca de B8)', async () => {
    h.users.seed(showcaseUser({ password: 'trocada-por-engano' }));
    expect(await run('demo')).toEqual({ status: 'updated' });
    expect(h.users.get(SHOWCASE_ID)!.passwordHash?.value).toBe('$fake$demo');
  });

  it('nao reativa conta inativa: unchanged e continua INACTIVE (reativar exige acao explicita)', async () => {
    h.users.seed(showcaseUser({ status: 'INACTIVE' }));
    expect(await run('demo')).toEqual({ status: 'unchanged' });
    expect(h.users.get(SHOWCASE_ID)!.status).toBe('INACTIVE');
  });

  it('S3: conta INACTIVE com senha DIFERENTE -> unchanged, senha e status intactos, aviso sem o valor da senha', async () => {
    h.users.seed(showcaseUser({ status: 'INACTIVE' }));
    const warnings: string[] = [];
    const useCase = new EnsureShowcaseAccount(h.uow, h.hasher, h.clock, h.publisher, (m) => warnings.push(m));
    const updates = h.users.calls.update;
    expect(await useCase.execute({ password: 'outra-senha' })).toEqual({ status: 'unchanged' });
    expect(h.users.get(SHOWCASE_ID)).toMatchObject({ status: 'INACTIVE' });
    expect(h.users.get(SHOWCASE_ID)!.passwordHash?.value).toBe('$fake$demo');
    expect(h.users.calls.update).toBe(updates);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('INACTIVE');
    expect(warnings[0]).not.toContain('outra-senha');
  });
});

describe('EnsureShowcaseAccount: conflito de e-mail', () => {
  it('REGULAR com o e-mail demo@showcase.invalid -> conflict: nao assume a conta e nao altera nada, sem lancar', async () => {
    h.users.seed(ana({ email: SHOWCASE_EMAIL }));
    const before = h.users.get(ana().id.value)!.toSnapshot();
    expect(await run('demo')).toEqual({ status: 'conflict' });
    expect(h.users.get(ana().id.value)!.toSnapshot()).toEqual(before);
    expect(h.users.get(SHOWCASE_ID)).toBeUndefined();
  });
});

describe('EnsureShowcaseAccount: desligada (interruptor, RF36)', () => {
  it('sem senha e conta ativa -> disabled: inativa e encerra as sessoes, sem apagar o usuario', async () => {
    h.users.seed(showcaseUser());
    h.openSession(showcaseUser());
    expect(await run(null)).toEqual({ status: 'disabled' });
    expect(h.users.get(SHOWCASE_ID)!.status).toBe('INACTIVE');
    expect(h.sessions.ofUser(SHOWCASE_ID)).toHaveLength(0);
  });

  it('sem senha e conta inexistente -> absent, nada criado', async () => {
    expect(await run(null)).toEqual({ status: 'absent' });
    expect(h.users.get(SHOWCASE_ID)).toBeUndefined();
  });

  it('desligar duas vezes e idempotente', async () => {
    h.users.seed(showcaseUser());
    await run(null);
    await expect(run(null)).resolves.toBeDefined();
    expect(h.users.get(SHOWCASE_ID)!.status).toBe('INACTIVE');
  });
});

describe('EnsureShowcaseAccount: configuracao invalida', () => {
  it('senha com mais de 72 code points -> erro de configuracao SEM o valor na mensagem', async () => {
    const secret = 'S'.repeat(80);
    const error = await run(secret).then(
      () => null,
      (e: Error) => e,
    );
    expect(error).not.toBeNull();
    expect(String(error!.message)).not.toContain(secret);
    expect(h.users.get(SHOWCASE_ID)).toBeUndefined();
  });

  it('nenhum evento carrega senha, hash ou e-mail', async () => {
    await run('demo');
    const text = JSON.stringify(h.publisher.published);
    expect(text).not.toContain('$fake$');
    expect(text).not.toContain(SHOWCASE_EMAIL);
  });
});
