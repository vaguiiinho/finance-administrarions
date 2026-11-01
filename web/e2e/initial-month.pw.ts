import { expect, test } from "./auth-support";
import { signInAsAna } from "./legacy-auth";
import { PAGE_BG_REGION, audit, gotoReady, setScenario, setThemeCookie } from "./support";
import { cardExpense, currentMonthSP, income, longMonth, monthFromNow, noticeText, pixExpense, stubCard, seedData } from "./entries-data";

/**
 * Mes inicial orientado a pendencias (ADR 0007; spec CA01-CA30). O stub devolve o mes da API (`GET /api/entries/initial-month`)
 * a partir dos dados do proprio teste. Dois relogios: o do stub (`now`, so o que a API decide) e o do servidor web (real,
 * usado em "Mes atual" e no fallback). Por isso a maioria dos cenarios e RELATIVA ao mes real (M = `currentMonthSP()`); so a
 * virada de ano e as fronteiras de fuso usam `now` fixo, e ai o teste afirma o mes vindo da API (limitacao do ADR secao 10).
 */
test.beforeEach(async ({ page }) => {
  await signInAsAna(page);
});

const M = () => currentMonthSP();
const azul = stubCard(1, "Azul", 10, 17);
const roxo = stubCard(2, "Roxo", 25, 5);
const panelTitle = (page: import("@playwright/test").Page, month: string) => page.getByRole("heading", { level: 2, name: `Despesas de ${longMonth(month)}` });
const monthOfUrl = (page: import("@playwright/test").Page) => new URL(page.url()).searchParams.get("month");
const notice = (page: import("@playwright/test").Page) => page.getByRole("note");

/** Abre sem `month` e espera a tela no mes resolvido (redirecionamento + hidratacao + limpeza do sinal). */
async function openWithoutMonth(page: import("@playwright/test").Page, path = "/entries") {
  await page.goto(path);
  await page.waitForURL(/[?&]month=/, { timeout: 8_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("regra do mes inicial (CA01-CA17)", () => {
  test("CA01: fatura pendente em M -> fica em M, sem aviso", async ({ page }) => {
    await seedData({ cards: [azul], entries: [cardExpense(1, azul, M())] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(M());
    await expect(panelTitle(page, M())).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test("CA02/CA08: com cartao e sem pendencia -> M+1, com aviso 'nenhuma a frente'; cabecalho, resumo e abas mostram M+1", async ({ page }) => {
    await seedData({ cards: [azul, roxo], entries: [cardExpense(1, azul, M(), { status: "PAID" }), cardExpense(2, roxo, M(), { status: "PAID" })] });
    await openWithoutMonth(page);
    const next = monthFromNow(1);
    expect(monthOfUrl(page)).toBe(next);
    await expect(notice(page)).toHaveText(noticeText.noneAhead(M(), next));
    await expect(page.getByRole("region", { name: `Resumo de ${longMonth(next)}` })).toBeVisible();
    await expect(page.getByText(longMonth(next), { exact: true })).toBeVisible(); // seletor de mes do cabecalho
    for (const name of ["Faturas", "Receitas", "Despesas"]) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(`${name} de ${longMonth(next)}`) })).toBeVisible();
    }
  });

  test("CA08: cartao sem nenhuma despesa -> M+1 com aviso e estado vazio do mes", async ({ page }) => {
    await seedData({ cards: [azul], entries: [] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(monthFromNow(1));
    await expect(notice(page)).toBeVisible();
    await expect(page.getByText(/Nenhuma despesa/)).toBeVisible();
  });

  test("CA03: Azul paga e Roxo com pendencia em M -> M", async ({ page }) => {
    await seedData({ cards: [azul, roxo], entries: [cardExpense(1, azul, M(), { status: "PAID" }), cardExpense(2, roxo, M())] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);
  });

  test("CA04: pendencia do Roxo so em M+1 e do Azul em M -> M (usa o mes de referencia, nao o fechamento)", async ({ page }) => {
    await seedData({ cards: [azul, roxo], entries: [cardExpense(1, azul, M()), cardExpense(2, roxo, monthFromNow(1))] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(M());
  });

  test("CA06: sem pendencia em M e M+1, fatura pendente em M+2 -> salta direto para M+2 com aviso", async ({ page }) => {
    const target = monthFromNow(2);
    await seedData({ cards: [azul, roxo], entries: [cardExpense(1, azul, M(), { status: "PAID" }), cardExpense(2, roxo, target)] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(target);
    await expect(notice(page)).toHaveText(noticeText.nextPending(M(), target));
  });

  test("CA07: escolhe o PRIMEIRO mes com pendencia (M+1 antes de M+2)", async ({ page }) => {
    await seedData({ cards: [azul, roxo], entries: [cardExpense(1, azul, monthFromNow(1)), cardExpense(2, roxo, monthFromNow(2))] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(monthFromNow(1));
    await expect(notice(page)).toHaveText(noticeText.nextPending(M(), monthFromNow(1)));
  });

  test("CA09: PIX pendente em M impede o avanco, mesmo com fatura pendente so em M+1", async ({ page }) => {
    await seedData({ cards: [azul], entries: [pixExpense(1, M()), cardExpense(2, azul, monthFromNow(1))] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);
  });

  test("CA10: PIX pendente futuro conta como proxima pendencia", async ({ page }) => {
    await seedData({ cards: [azul], entries: [pixExpense(1, monthFromNow(2))] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(monthFromNow(2));
  });

  test("CA11: sem cartao e sem pendencia -> M, sem aviso (e a aba Faturas segue o CA54)", async ({ page }) => {
    await seedData({ cards: [], entries: [pixExpense(1, M(), { status: "PAID" })] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);
    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(page.getByText("Nenhuma fatura neste mês")).toBeVisible();
    await expect(page.getByRole("link", { name: "Cadastrar cartão" })).toBeVisible();
  });

  test("CA12: sem cartao com PIX pendente em M -> M", async ({ page }) => {
    await seedData({ cards: [], entries: [pixExpense(1, M())] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);
  });

  test("CA13: sem cartao com PIX pendente futuro -> avanca com aviso", async ({ page }) => {
    await seedData({ cards: [], entries: [pixExpense(1, monthFromNow(2))] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(monthFromNow(2));
    await expect(notice(page)).toHaveText(noticeText.nextPending(M(), monthFromNow(2)));
  });

  test("CA14: PIX pendente de mes anterior nao interfere -> M+1", async ({ page }) => {
    await seedData({ cards: [azul], entries: [pixExpense(2, monthFromNow(-1))] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(monthFromNow(1));
    await expect(notice(page)).toHaveText(noticeText.noneAhead(M(), monthFromNow(1)));
  });

  test("RFH01: fatura pendente mais antiga abre no mes de referencia, sem aviso de avanço", async ({ page }) => {
    const card = stubCard(3, "Fechamento 04", 4, 11);
    await seedData({ cards: [card], entries: [cardExpense(1, card, monthFromNow(-1)), cardExpense(2, card, M())] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(monthFromNow(-1));
    await expect(notice(page)).toHaveCount(0);
    await expect(panelTitle(page, monthFromNow(-1))).toBeVisible();
  });

  test("CA15: virada de ano com a proxima pendencia (hoje 15/12/2026 na API -> janeiro de 2027), lista mostra a fatura 2027-01", async ({ page }) => {
    await seedData({ now: "2026-12-15T15:00:00.000Z", cards: [roxo], entries: [cardExpense(1, roxo, "2027-01")] });
    await openWithoutMonth(page, "/entries?tab=invoices");
    expect(monthOfUrl(page)).toBe("2027-01");
    await expect(notice(page)).toHaveText(noticeText.nextPending("2026-12", "2027-01"));
    await expect(page.getByRole("group", { name: /Roxo/ })).toBeVisible();
  });

  test("CA16: virada de ano com salto de varios meses (hoje 20/11/2026 -> fevereiro de 2027)", async ({ page }) => {
    await seedData({ now: "2026-11-20T15:00:00.000Z", cards: [roxo], entries: [cardExpense(1, roxo, "2027-02")] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe("2027-02");
    await expect(notice(page)).toHaveText(noticeText.nextPending("2026-11", "2027-02"));
  });

  test("CA17: virada de ano sem pendencia (hoje 15/12/2026 -> janeiro de 2027)", async ({ page }) => {
    await seedData({ now: "2026-12-15T15:00:00.000Z", cards: [roxo], entries: [] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe("2027-01");
    await expect(notice(page)).toHaveText(noticeText.noneAhead("2026-12", "2027-01"));
  });

  test("RF03: /entries?tab=income sem month tambem passa pela regra e mantem a aba", async ({ page }) => {
    await seedData({ cards: [azul], entries: [cardExpense(1, azul, monthFromNow(2)), income(2, monthFromNow(2))] });
    await openWithoutMonth(page, "/entries?tab=income");
    expect(monthOfUrl(page)).toBe(monthFromNow(2));
    expect(new URL(page.url()).searchParams.get("tab")).toBe("income");
    await expect(page.getByRole("tab", { name: "Receitas" })).toHaveAttribute("aria-selected", "true");
  });

  test("P05: outros parametros (aba, cartao) nao impedem o avanco e sao mantidos", async ({ page }) => {
    await seedData({ cards: [azul], entries: [pixExpense(1, monthFromNow(1))] });
    await openWithoutMonth(page, "/entries?tab=invoices&f_status=ALL");
    const q = new URL(page.url()).searchParams;
    expect([q.get("month"), q.get("tab"), q.get("f_status")]).toEqual([monthFromNow(1), "invoices", "ALL"]);
  });
});

test.describe("fronteiras de fuso vindas da API (CA18-CA20; o relogio decisivo esta nos unitarios, ADR secao 10)", () => {
  test("CA18: 31/10 23:30 em SP (2026-11-01T02:30Z): com pendencia em outubro -> outubro; sem nenhuma -> novembro", async ({ page }) => {
    await seedData({ now: "2026-11-01T02:30:00.000Z", cards: [azul], entries: [cardExpense(1, azul, "2026-10")] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe("2026-10");
    await seedData({ now: "2026-11-01T02:30:00.000Z", cards: [azul], entries: [] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe("2026-11");
  });

  test("CA19: 01/11 00:30 em SP (2026-11-01T03:30Z): M = novembro; PIX pendente so em outubro -> dezembro", async ({ page }) => {
    await seedData({ now: "2026-11-01T03:30:00.000Z", cards: [azul], entries: [pixExpense(1, "2026-10")] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe("2026-12");
    await expect(notice(page)).toHaveText(noticeText.noneAhead("2026-11", "2026-12"));
  });

  test("CA20: 31/12 23:30 em SP (2027-01-01T02:30Z): dezembro com pendencia; sem nenhuma -> janeiro de 2027", async ({ page }) => {
    await seedData({ now: "2027-01-01T02:30:00.000Z", cards: [azul], entries: [pixExpense(1, "2026-12")] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe("2026-12");
    await seedData({ now: "2027-01-01T02:30:00.000Z", cards: [azul], entries: [] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe("2027-01");
  });
});

test.describe("falha da verificacao (CA22, RNF02)", () => {
  test("500 na leitura: abre em M (mes real, SP), sem aviso, sem ir ao login, com o restante da tela funcionando", async ({ page }) => {
    await seedData({ cards: [azul], entries: [pixExpense(1, M())] }, "initial-month-error");
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(M());
    expect(new URL(page.url()).pathname).toBe("/entries");
    await expect(notice(page)).toHaveCount(0);
    await expect(panelTitle(page, M())).toBeVisible();
  });

  test("API lenta (> 1,5 s): o web desiste e abre em M, sem aviso", async ({ page }) => {
    await seedData({ cards: [azul], entries: [pixExpense(1, monthFromNow(2))] }, "initial-month-slow");
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);
  });

  test("falha tambem fixa o mes: pagar nao reaplica a regra (RF07)", async ({ page }) => {
    await seedData({ cards: [azul], entries: [pixExpense(1, M(), { description: "Unica" })] }, "initial-month-error");
    await openWithoutMonth(page);
    await page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Unica$/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pago" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(monthOfUrl(page)).toBe(M());
  });
});

test.describe("escolha manual preservada (CA25-CA30)", () => {
  test("CA25: 'Mes atual' e 'Proximo mes' depois do avanco; recarregar nao volta ao mes avancado nem mostra aviso", async ({ page }) => {
    const far = monthFromNow(2);
    await seedData({ cards: [azul], entries: [cardExpense(1, azul, far)] });
    await openWithoutMonth(page);
    expect(monthOfUrl(page)).toBe(far);
    await expect(notice(page)).toBeVisible();

    await page.getByRole("button", { name: "Mês atual" }).click();
    await expect(page).toHaveURL(new RegExp(`month=${M()}`));
    await expect(notice(page)).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Próximo mês" }).first().click();
    await expect(page).toHaveURL(new RegExp(`month=${monthFromNow(1)}`));
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(monthOfUrl(page)).toBe(monthFromNow(1));
    await expect(notice(page)).toHaveCount(0);
  });

  test("CA26: month explicito nunca e alterado, mesmo sem nenhuma pendencia (inclusive links do dashboard e de /cards)", async ({ page }) => {
    await seedData({ cards: [azul], entries: [] });
    await gotoReady(page, `/entries?month=${M()}`);
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);

    await gotoReady(page, `/dashboard?month=${M()}`);
    await page.getByRole("link", { name: "Ver lançamentos do mês" }).click();
    await page.waitForURL(/\/entries\?/);
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);

    await gotoReady(page, "/cards");
    await page.getByRole("link", { name: /^Ver despesas de Azul/ }).click();
    await page.waitForURL(/\/entries\?/);
    expect(monthOfUrl(page)).toBe(M());
    await expect(notice(page)).toHaveCount(0);
  });

  test("CA27: month invalido mostra M com o toast atual e sem avanco", async ({ page }) => {
    await seedData({ cards: [azul], entries: [] });
    await gotoReady(page, "/entries?month=abc");
    await expect(panelTitle(page, M())).toBeVisible();
    await expect(page.getByText("Mês inválido na URL. Mostrando o mês atual.")).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("adv")).toBe(false);
  });

  test("CA28: pagar a ultima pendencia nao troca o mes; a fatura sai, o toast aparece e o foco vai ao h2 do painel", async ({ page }) => {
    await seedData({ cards: [azul], entries: [cardExpense(1, azul, M())] });
    await openWithoutMonth(page, "/entries?tab=invoices");
    expect(monthOfUrl(page)).toBe(M());
    await page.getByRole("group", { name: /Azul/ }).getByRole("button", { name: /Pagar fatura/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Pagar fatura" }).click();
    await expect(page.getByText(/Fatura Azul de .* paga/)).toBeVisible();
    await expect(page.getByRole("group", { name: /Azul/ })).toHaveCount(0);
    await expect(page.getByText(`Nenhuma fatura para os filtros selecionados em ${longMonth(M())}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Limpar filtros" }).first()).toBeVisible();
    expect(monthOfUrl(page)).toBe(M());
    await expect(page.locator("#entries-panel-title")).toBeFocused();
  });

  test("CA29: Voltar em navegacao no cliente (menu) nao reconduz a /entries", async ({ page }) => {
    await seedData({ cards: [azul], entries: [] });
    await gotoReady(page, "/cards");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Lançamentos" }).click();
    await page.waitForURL(/\/entries\?.*month=/);
    await expect(notice(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/cards$/);
    await page.waitForTimeout(1_500);
    await expect(page).toHaveURL(/\/cards$/);
  });

  test("CA29: Voltar depois de carga completa (meta refresh do streaming) nao prende em ciclo de redirecionamento", async ({ page }) => {
    await seedData({ cards: [azul], entries: [] });
    await gotoReady(page, "/cards");
    await page.goto("/entries");
    await page.waitForURL(/\/entries\?.*month=/);
    await page.waitForLoadState("networkidle");
    await page.goBack();
    await expect(page).toHaveURL(/\/cards$/);
    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL(/\/cards$/);
  });

  test("CA30: o menu 'Lancamentos' nao leva month e reabre pela regra (nova abertura)", async ({ page }) => {
    await seedData({ cards: [azul], entries: [] });
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/entries?month=2026-08");
    const link = page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Lançamentos" });
    await expect(link).toHaveAttribute("href", "/entries");
    await link.click();
    await page.waitForURL((url) => url.searchParams.get("month") === monthFromNow(1));
    await expect(notice(page)).toHaveText(noticeText.noneAhead(M(), monthFromNow(1)));
  });
});

test.describe("aviso de avanco: ciclo de vida e acessibilidade (RF05, RNF06; design 4)", () => {
  const advanced = async (page: import("@playwright/test").Page) => {
    await seedData({ cards: [azul], entries: [cardExpense(1, azul, monthFromNow(2))] });
    await openWithoutMonth(page);
  };

  test("o sinal sai da URL depois da montagem; recarregar nao repete o aviso", async ({ page }) => {
    await advanced(page);
    await expect(notice(page)).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.has("adv")).toBe(false);
    expect(new URL(page.url()).searchParams.has("adv_from")).toBe(false);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(notice(page)).toHaveCount(0);
  });

  test("o aviso permanece ao trocar de aba, filtrar e paginar; some ao trocar de mes", async ({ page }) => {
    await advanced(page);
    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(page.getByRole("heading", { level: 2, name: /Faturas de/ })).toBeVisible();
    await expect(notice(page)).toBeVisible();
    await page.getByRole("radio", { name: "Todos" }).first().click();
    await expect(notice(page)).toBeVisible();
    await page.getByRole("button", { name: "Mês anterior" }).first().click();
    await expect(notice(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Próximo mês" }).first().click();
    await expect(notice(page)).toHaveCount(0);
  });

  test("fechar: some, e o foco vai para <main id='conteudo'>; o proximo Tab chega a '+ Novo lancamento'", async ({ page }) => {
    await advanced(page);
    await page.getByRole("button", { name: "Fechar aviso de mês" }).click();
    await expect(notice(page)).toHaveCount(0);
    await expect(page.locator("main#conteudo")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /Novo lançamento/ }).first()).toBeFocused();
  });

  // B-1 (revisao ciclo 2): "Fechar | Some ate a proxima abertura com avanco" (design 4.3) tambem vale depois de pagar, que dispara
  // a Server Action com revalidatePath. O replaceState(window.history.state, ...) do aviso poderia deixar `adv` no canonicalUrl do Next.
  const payAlpha = async (page: import("@playwright/test").Page) => {
    await seedData({ cards: [azul], entries: [pixExpense(1, monthFromNow(2), { description: "Alpha" }), pixExpense(2, monthFromNow(2), { description: "Beta" })] });
    await openWithoutMonth(page);
    await expect(notice(page)).toBeVisible();
    return async () => {
      await page.getByRole("button", { name: /^(Marcar como pago|Pagar)\s?:\s?Alpha$/ }).first().click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Marcar como pago" }).click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      // conclusao: a lista foi revalidada (sob o padrao "Pendente" a despesa paga sai); "Beta" segue la
      await expect(page.getByRole("checkbox", { name: /Alpha/ })).toHaveCount(0);
      await expect(page.getByRole("checkbox", { name: /Beta/ })).toBeVisible();
      await page.waitForLoadState("networkidle");
    };
  };

  test("B-1: fechar o aviso e pagar uma despesa NAO reabre o aviso (nem recoloca adv na URL)", async ({ page }) => {
    const pay = await payAlpha(page);
    await page.getByRole("button", { name: "Fechar aviso de mês" }).click();
    await expect(notice(page)).toHaveCount(0);
    await pay();
    await page.waitForTimeout(1_000);
    await expect(notice(page)).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("adv")).toBe(false);
    expect(new URL(page.url()).searchParams.has("adv_from")).toBe(false);
  });

  test("B-1 (variante): sem fechar, pagar mantem o aviso (design 4.3: 'Pagar ou criar lancamento | Permanece')", async ({ page }) => {
    const pay = await payAlpha(page);
    await pay();
    await expect(notice(page)).toBeVisible();
    expect(new URL(page.url()).searchParams.has("adv")).toBe(false);
  });

  test("Esc nao fecha o aviso", async ({ page }) => {
    await advanced(page);
    await page.keyboard.press("Escape");
    await expect(notice(page)).toBeVisible();
  });

  test("DL1: o aviso e o primeiro elemento da tela, acima do h1; a regiao polite oculta recebe o texto (anuncio)", async ({ page }) => {
    await advanced(page);
    const noteBox = (await notice(page).boundingBox())!;
    const h1Box = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(noteBox.y).toBeLessThan(h1Box.y);
    const expected = noticeText.nextPending(M(), monthFromNow(2));
    await expect.poll(async () => (await page.locator('[aria-live="polite"]').allTextContents()).some((t) => t.trim() === expected), { timeout: 3_000 }).toBe(true);
    await expect(page.locator("main#conteudo")).not.toBeFocused(); // o foco nao e movido na carga
  });

  test("a regiao polite e esvaziada depois de ~10 s (nao e lida duas vezes)", async ({ page }) => {
    await advanced(page);
    const expected = noticeText.nextPending(M(), monthFromNow(2));
    await expect.poll(async () => (await page.locator('[aria-live="polite"]').allTextContents()).some((t) => t.trim() === expected), { timeout: 3_000 }).toBe(true);
    await expect.poll(async () => (await page.locator('[aria-live="polite"]').allTextContents()).some((t) => t.trim() === expected), { timeout: 14_000 }).toBe(false);
    await expect(notice(page)).toBeVisible(); // o banner visivel continua
  });

  test("360 px: o aviso quebra o texto, sem rolagem horizontal, com o alvo de fechar >= 44 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await advanced(page);
    await expect(notice(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = (await page.getByRole("button", { name: "Fechar aviso de mês" }).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  });

  for (const theme of ["light", "dark"] as const) {
    for (const variant of ["NEXT_PENDING", "NO_PENDING_AHEAD"] as const) {
      test(`axe [${theme}] ${variant}`, async ({ page, context }) => {
        await setThemeCookie(context, theme);
        await seedData(variant === "NEXT_PENDING" ? { cards: [azul], entries: [cardExpense(1, azul, monthFromNow(2))] } : { cards: [azul], entries: [] });
        await openWithoutMonth(page);
        await expect(notice(page)).toBeVisible();
        await audit(page, `aviso de avanco ${variant} ${theme}`, { gradients: [PAGE_BG_REGION] });
      });
    }
  }
});

test.describe("demo (CA24)", () => {
  test("abre no mes atual com 'Pendente' em Despesas e Faturas e sem escrita", async ({ page }) => {
    await setScenario("default");
    await openWithoutMonth(page, "/demo/entries");
    expect(new URL(page.url()).pathname).toBe("/demo/entries");
    expect(monthOfUrl(page)).toBe(M());
    await expect(page.getByRole("radio", { name: "Pendente" })).toBeChecked();
    await expect(page.getByRole("button", { name: /Novo lançamento|Pagar fatura|Marcar como pago/ })).toHaveCount(0);
    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(page.getByRole("radio", { name: "Pendente" })).toBeChecked();
    await expect(page.getByRole("button", { name: /Pagar fatura/ })).toHaveCount(0);
  });

  test("demo com falha na leitura do mes inicial: abre em M, nunca no login", async ({ page }) => {
    await seedData({ cards: [], entries: [] }, "initial-month-error", { demo: { cards: [], entries: [] } });
    await openWithoutMonth(page, "/demo/entries");
    expect(new URL(page.url()).pathname).toBe("/demo/entries");
    expect(monthOfUrl(page)).toBe(M());
  });
});
