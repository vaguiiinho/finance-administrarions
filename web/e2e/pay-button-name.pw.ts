import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./auth-support";
import { signInAsAna } from "./legacy-auth";
import { ENTRIES_URL, gotoReady, setScenario } from "./support";

/**
 * CAF07 / B3 / WCAG 2.5.3 (label-content-name-mismatch): o nome acessivel do botao de pagamento individual COMECA pelo texto
 * visivel naquela largura e termina na descricao da despesa (adendo de design 1.2). Cobre as tres faixas, inclusive 768 px, onde
 * o texto visivel e "Pagar" (ADR 0008 V7). Abre direto com `month` (sem depender de corrida) e sem usar o axe das demais telas (T4).
 *
 * Nota: a regra axe so avalia elementos COM aria-label/aria-labelledby (em 360 px, so o "Limpar" com aria-label="Limpar filtros" da barra de
 * filtros mobile e avaliado; em 768/1280 px nada), por isso o teste de axe exige a prova direta no botao de linha, nao `passes > 0`.
 *
 * `getByRole({ name })` usa o calculo de nome acessivel do PROPRIO Playwright, que pode inserir um espaco em volta dos dois-pontos
 * quando o `span` sr-only nao e `inline` (adendo 1.3). Esse espaco e a unica variacao tolerada pelas regex, que ancoram as duas pontas.
 * Isto NAO prova a leitura real do leitor de tela: essa depende do Roteiro C (verificacao manual com NVDA/VoiceOver).
 *
 * "Sem mudanca visual": a unica diferenca de markup contra a base cad1728 e a troca de `aria-label` por `<span class="sr-only">`
 * (git diff). Entao a base e reproduzida em runtime removendo esse span e medindo o MESMO botao na mesma pagina/build; isso e mais
 * estavel que comparar com valores fixos de outro build (fontes, subpixel) e nao exige worktree nem portas extras. Tolerancia 0,01 px.
 */
const WIDTHS = [
  { width: 360, visible: "Marcar como pago", where: "card (< md)" },
  { width: 768, visible: "Pagar", where: "tabela (md a < lg)" },
  { width: 1280, visible: "Marcar como pago", where: "tabela (>= lg)" },
] as const;

test.beforeEach(async ({ page }) => {
  await signInAsAna(page);
  await setScenario("default"); // despesa pendente "Internet" em 2026-11
});

for (const { width, visible, where } of WIDTHS) {
  test.describe(`${width} px - ${where}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`CAF07: nome do botao da despesa e exatamente "${visible}: Internet" (espaco so em volta dos dois-pontos)`, async ({ page }) => {
      await gotoReady(page, ENTRIES_URL);
      await expect(page.getByRole("checkbox", { name: /Internet/ })).toBeVisible();
      const other = visible === "Pagar" ? "Marcar como pago" : "Pagar";
      await expect(page.getByRole("button", { name: new RegExp(`^${visible}\\s?:\\s?Internet$`) })).toHaveCount(1);
      // nome sem o texto visivel, ou com o texto da outra faixa, nao vale
      await expect(page.getByRole("button", { name: new RegExp(`^${other}\\s?:\\s?Internet$`) })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Marcar .+ como pago$/ })).toHaveCount(0);
    });

    test("CAF07: o botao de linha nao usa aria-label, seu nome comeca pelo texto visivel e o axe segue sem violacoes", async ({ page }) => {
      await gotoReady(page, ENTRIES_URL);
      await expect(page.getByRole("checkbox", { name: /Internet/ })).toBeVisible();
      // A regra label-content-name-mismatch do axe (4.14) so SELECIONA widgets com aria-label/aria-labelledby nao vazio (matches:
      // label-content-name-mismatch-matches). O botao de linha nao os tem de proposito, entao "passes > 0" seria contraditorio com a
      // correcao. A prova nao vazia equivalente e: o botao existe, sem aria-label/labelledby, nome calculado comeca pelo visivel.
      const button = page.getByRole("button", { name: new RegExp(`^${visible}\\s?:\\s?Internet$`) });
      await expect(button).toHaveCount(1);
      await expect(button).not.toHaveAttribute("aria-label", /.*/);
      await expect(button).not.toHaveAttribute("aria-labelledby", /.*/);
      // texto visivel REAL naquela largura: percorre os nos de texto, ignorando display:none e o span sr-only
      const shown = await button.evaluate((el) => {
        const parts: string[] = [];
        const walk = (n: Node) => {
          if (n.nodeType === Node.TEXT_NODE) parts.push(n.textContent ?? "");
          else if (n instanceof HTMLElement && getComputedStyle(n).display !== "none" && !n.classList.contains("sr-only")) n.childNodes.forEach(walk);
        };
        el.childNodes.forEach(walk);
        return parts.join("").replace(/\s+/g, " ").trim();
      });
      expect(shown, `${width}px: texto visivel do botao`).toBe(visible);
      // o nome calculado (regex acima, ancorada) comeca por esse texto; o axe nao pode reportar nada na pagina
      const results = await new AxeBuilder({ page }).withRules(["label-content-name-mismatch"]).analyze();
      expect(results.violations.map((v) => ({ id: v.id, alvos: v.nodes.map((n) => n.target) })), `${width}px: violacoes`).toEqual([]);
    });

    test("CAF07: sem mudanca visual - largura e altura do botao de linha iguais as da base (span sr-only removido)", async ({ page }, testInfo) => {
      await gotoReady(page, ENTRIES_URL);
      await expect(page.getByRole("checkbox", { name: /Internet/ })).toBeVisible();
      const button = page.getByRole("button", { name: new RegExp(`^${visible}\\s?:\\s?Internet$`) });
      await expect(button).toHaveCount(1);
      const handle = (await button.elementHandle())!; // o mesmo no, para medir depois da remocao (o nome muda)
      const withSpan = (await handle.boundingBox())!;
      expect(await button.locator(".sr-only").count(), "precondicao: ha um span sr-only a remover").toBe(1);
      await handle.evaluate((el) => el.querySelectorAll(".sr-only").forEach((n) => n.remove())); // = marcacao da base cad1728
      const base = (await handle.boundingBox())!;
      console.log(`[A-4] ${width}px atual=${withSpan.width}x${withSpan.height} base(sem sr-only)=${base.width}x${base.height}`);
      testInfo.annotations.push({ type: "medida", description: `${width}px ${withSpan.width}x${withSpan.height} vs ${base.width}x${base.height}` });
      expect(Math.abs(withSpan.width - base.width), `${width}px largura`).toBeLessThanOrEqual(0.01);
      expect(Math.abs(withSpan.height - base.height), `${width}px altura`).toBeLessThanOrEqual(0.01);
    });
  });
}

test.describe("1280 px - lote x linha (ADR 0008 V8)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("o botao de lote (nome inteiro) e unico e distinto dos botoes de linha, com e sem selecao", async ({ page }) => {
    await gotoReady(page, ENTRIES_URL);
    await expect(page.getByRole("checkbox", { name: /Internet/ })).toBeVisible();
    // precondicao: existe botao de linha com a descricao (senao a unicidade abaixo seria vacua)
    await expect(page.getByRole("button", { name: /^Marcar como pago\s?:\s?Internet$/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Marcar como pago( \(\d+\))?$/ })).toHaveCount(1);
    await page.getByRole("checkbox", { name: /Internet/ }).check();
    await expect(page.getByRole("button", { name: /^Marcar como pago \(1\)$/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Marcar como pago\s?:\s?Internet$/ })).toHaveCount(1);
  });
});
