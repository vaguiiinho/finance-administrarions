import { expect, test, type Page } from "@playwright/test";
import { ENTRIES_URL, MONTH, gotoReady, setScenario, setThemeCookie } from "./support";

/**
 * Resumo do mes sem card externo (spec CA15-CA17, CA20, CA21, CA22; ADR 0004 5.7, 9.3; design 5).
 * O jsdom nao aplica CSS: aqui se confere o COMPUTADO no navegador (fundo/borda/sombra do contêiner, vidro dos 3 cards,
 * arranjo por breakpoint, rolagem horizontal, aviso abaixo dos cards, troca skeleton -> dados sem salto).
 */
const SCREENS = [
  ["/entries", ENTRIES_URL],
  ["/dashboard", `/dashboard?month=${MONTH}`],
] as const;
const VIEWPORTS = [
  ["mobile 360", { width: 360, height: 740 }],
  ["desktop 1280", { width: 1280, height: 800 }],
] as const;

test.beforeEach(async () => {
  await setScenario("default");
});

const region = (page: Page) => page.getByRole("region", { name: /Resumo de/ });
const rectsOf = (page: Page, selector: string) =>
  region(page).locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );

for (const theme of ["light", "dark"] as const) {
  for (const [screen, url] of SCREENS) {
    for (const [vpName, viewport] of VIEWPORTS) {
      test(`CA15/CA16/CA21 ${screen} [${vpName}, ${theme}]: titulo visivel, 3 cards de vidro soltos e contêiner sem fundo, borda nem sombra`, async ({ context, page }) => {
        await setThemeCookie(context, theme);
        await page.setViewportSize(viewport);
        await gotoReady(page, url);
        const section = region(page);
        await expect(section).toHaveCount(1);

        // contêiner: nenhuma aparencia de card (computados)
        const box = await section.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            bg: s.backgroundColor,
            image: s.backgroundImage,
            borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
            shadow: s.boxShadow,
            filter: s.backdropFilter,
          };
        });
        expect(box.bg).toBe("rgba(0, 0, 0, 0)");
        expect(box.image).toBe("none");
        expect(box.borders).toEqual(["0px", "0px", "0px", "0px"]);
        expect(box.shadow).toBe("none");
        expect(box.filter).toBe("none");

        // titulo visivel em todos os breakpoints (B5), como texto simples acima dos cards
        const title = section.getByRole("heading", { level: 2, name: /Resumo de/ });
        await expect(title).toBeVisible();
        const titleBox = (await title.boundingBox())!;

        // 3 cards, cada um com o proprio vidro
        const cards = section.locator(".card");
        await expect(cards).toHaveCount(3);
        const tokens = await page.evaluate(() => {
          const probe = document.createElement("span");
          document.body.append(probe);
          probe.style.color = "var(--card-bg)";
          const bg = getComputedStyle(probe).color;
          probe.remove();
          return { bg };
        });
        const looks = await cards.evaluateAll((els) => els.map((el) => ({ bg: getComputedStyle(el).backgroundColor, filter: getComputedStyle(el).backdropFilter, border: getComputedStyle(el).borderTopWidth })));
        for (const l of looks) {
          expect(l.bg, "cada card tem o vidro (--card-bg)").toBe(tokens.bg);
          expect(l.filter).toContain("blur(");
          expect(l.border).toBe("1px");
        }

        const rects = await rectsOf(page, ".card");
        expect(rects[0].y, "titulo acima dos cards").toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
        if (viewport.width >= 768) {
          // 3 colunas: mesma linha, da esquerda para a direita, mesma altura
          expect(Math.abs(rects[0].y - rects[1].y)).toBeLessThan(2);
          expect(Math.abs(rects[1].y - rects[2].y)).toBeLessThan(2);
          expect(rects[1].x).toBeGreaterThan(rects[0].x + rects[0].w - 1);
          expect(rects[2].x).toBeGreaterThan(rects[1].x + rects[1].w - 1);
          expect(Math.abs(rects[0].h - rects[1].h)).toBeLessThan(2);
          expect(Math.abs(rects[1].h - rects[2].h)).toBeLessThan(2);
        } else {
          // empilhados: mesma coluna, mesma largura, um abaixo do outro (gap ~12px), sem rolagem horizontal
          expect(Math.abs(rects[0].x - rects[1].x)).toBeLessThan(1);
          expect(Math.abs(rects[0].w - rects[2].w)).toBeLessThan(1);
          expect(rects[1].y).toBeGreaterThanOrEqual(rects[0].y + rects[0].h);
          expect(rects[2].y).toBeGreaterThanOrEqual(rects[1].y + rects[1].h);
          expect(rects[1].y - (rects[0].y + rects[0].h)).toBeCloseTo(12, 0);
          const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
          expect(overflow.doc, "rolagem horizontal da pagina").toBeLessThanOrEqual(0);
          expect(await section.evaluate((el) => el.scrollWidth - el.clientWidth), "rolagem horizontal da regiao").toBeLessThanOrEqual(0);
        }
      });
    }
  }
}

for (const [screen, url] of SCREENS) {
  test(`CA17 ${screen}: mes vazio - cards em R$ 0,00 e aviso como texto simples ABAIXO do ultimo card`, async ({ page }) => {
    await setScenario("empty");
    await page.setViewportSize({ width: 360, height: 740 });
    await gotoReady(page, url);
    const section = region(page);
    await expect(section.locator(".card")).toHaveCount(3);
    await expect(section.getByText("Zerado")).toHaveCount(2);
    const notice = section.getByText("Sem lançamentos neste mês");
    await expect(notice).toBeVisible();
    expect(await notice.evaluate((el) => !!el.closest(".card")), "aviso fora de qualquer card").toBe(false);
    const last = (await rectsOf(page, ".card")).at(-1)!;
    const n = (await notice.boundingBox())!;
    expect(n.y).toBeGreaterThanOrEqual(last.y + last.h);
    const style = await notice.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopWidth }));
    expect(style).toEqual({ bg: "rgba(0, 0, 0, 0)", border: "0px" });
  });

  test(`CA18 ${screen}: arvore de acessibilidade - regiao nomeada, heading nivel 2, seis pares dt/dd`, async ({ page }) => {
    await gotoReady(page, url);
    const section = region(page);
    await expect(section.getByRole("heading", { level: 2 })).toHaveCount(1);
    await expect(section.locator("dt")).toHaveCount(6);
    await expect(section.locator("dd")).toHaveCount(6);
    const invalid = await section.evaluate((el) => {
      const dl = el.querySelector("dl")!;
      return [...el.querySelectorAll("dt, dd")].filter((n) => n.parentElement !== dl && n.parentElement?.parentElement !== dl).length;
    });
    expect(invalid, "dt/dd fora de dl > div? > dt/dd").toBe(0);
  });
}

for (const [screen, url] of SCREENS) {
  for (const [vpName, viewport] of VIEWPORTS) {
    test(`CA20 ${screen} [${vpName}]: o skeleton ocupa o mesmo espaco que o resumo real (sem salto de layout)`, async ({ page }) => {
      await setScenario("default", { delayMs: 2000 });
      await page.setViewportSize(viewport);
      await page.goto(url, { waitUntil: "commit" });
      const marker = page.getByText("Carregando resumo do mês");
      await marker.first().waitFor();
      const skeleton = marker.first().locator("xpath=..");
      await expect(skeleton).toHaveAttribute("aria-busy", "true");
      const sk = await skeleton.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y + window.scrollY,
          w: r.width,
          h: r.height,
          cards: [...el.querySelectorAll(".card")].map((c) => {
            const cr = c.getBoundingClientRect();
            return { x: cr.x, y: cr.y + window.scrollY, w: cr.width, h: cr.height };
          }),
          nested: el.querySelectorAll(".card .card").length,
        };
      });
      expect(sk.cards, "skeleton com 3 cards soltos e titulo").toHaveLength(3);
      expect(sk.nested).toBe(0);

      await region(page).waitFor({ timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      const real = await region(page).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y + window.scrollY,
          w: r.width,
          h: r.height,
          cards: [...el.querySelectorAll(".card")].map((c) => {
            const cr = c.getBoundingClientRect();
            return { x: cr.x, y: cr.y + window.scrollY, w: cr.width, h: cr.height };
          }),
        };
      });
      // tolerancia de 2px = um salto <= ~0,001 de CLS; a spec exige <= 0,01
      expect(Math.abs(real.y - sk.y), "topo da regiao").toBeLessThanOrEqual(2);
      expect(Math.abs(real.h - sk.h), `altura: skeleton ${sk.h} x real ${real.h}`).toBeLessThanOrEqual(2);
      expect(Math.abs(real.w - sk.w)).toBeLessThanOrEqual(1);
      real.cards.forEach((c, i) => {
        expect(Math.abs(c.x - sk.cards[i].x), `card ${i} x`).toBeLessThanOrEqual(1);
        expect(Math.abs(c.y - sk.cards[i].y), `card ${i} y`).toBeLessThanOrEqual(2);
        expect(Math.abs(c.w - sk.cards[i].w), `card ${i} largura`).toBeLessThanOrEqual(1);
        expect(Math.abs(c.h - sk.cards[i].h), `card ${i} altura`).toBeLessThanOrEqual(2);
      });
    });
  }
}

for (const scenario of ["default", "short"] as const) {
  for (const [screen, url] of SCREENS) {
    for (const [vpName, viewport] of VIEWPORTS) {
      test(`CA20 CLS ${screen} [${vpName}, cenario ${scenario}]: troca skeleton -> dados soma layout-shift <= 0,01 (valores comuns e curtos)`, async ({ page }) => {
        await setScenario(scenario, { delayMs: 1500 });
        await page.setViewportSize(viewport);
        await page.addInitScript(() => {
          const w = window as unknown as { __cls: number };
          w.__cls = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
        await page.goto(url, { waitUntil: "commit" });
        await page.getByText("Carregando resumo do mês").first().waitFor();
        await region(page).waitFor({ timeout: 15_000 });
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);
        const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
        expect(cls, `CLS ${cls}`).toBeLessThanOrEqual(0.01);
      });
    }
  }
}

test("CA22: o resumo nao depende de aba, filtro nem pagina e o titulo acompanha o mes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoReady(page, ENTRIES_URL);
  const before = await region(page).innerText();
  expect(before).toContain("Resumo de novembro de 2026");
  await page.getByRole("tab", { name: "Receitas" }).click();
  await page.getByRole("tab", { name: "Despesas" }).click();
  await gotoReady(page, `${ENTRIES_URL}&d_category=Moradia`);
  expect(await region(page).innerText()).toBe(before);
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await expect(page).toHaveURL(/month=2026-12/);
  await expect(page.getByRole("heading", { level: 2, name: "Resumo de dezembro de 2026" })).toBeVisible();
});
