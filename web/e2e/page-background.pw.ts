import { expect, test, type Page } from "@playwright/test";
import { BG, ENTRIES_URL, MONTH, PAGE_BG_REGION, PAGE_BG_TOKENS, audit, auditPageGradient, bodyBackground, gotoReady, setScenario, setThemeCookie, themeToggle } from "./support";
import { luminanceOf, resolveTokens } from "./tokens";

/**
 * Fase B (ADR 0003 9.2): fundo em gradiente aplicado, design rev. 6: Lavanda -> azul-gelo no claro,
 * Grafite com brilho ciano no escuro. CA10-CA13, CA16-CA19 e CA21.
 */
const THEMES = ["light", "dark"] as const;
const SCREENS = [ENTRIES_URL, "/cards", `/dashboard?month=${MONTH}`] as const;

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
/** Preset escolhido (design rev. 6): [claro, escuro] */
const DESIGN: Record<(typeof PAGE_BG_TOKENS)[number], [string, string]> = {
  "--bg": ["#ECEEFC", "#181E2A"],
  "--bg-stop-1": ["#EEEEFE", "#141A24"],
  "--bg-stop-2": ["#E8F0FC", "#181E2A"],
  "--bg-stop-3": ["#F0ECFC", "#12182A"],
  "--bg-glow-1": ["#E4F0FE", "#0C3044"],
  "--bg-glow-2": ["#F4ECFE", "#20244D"],
};

interface Layer {
  position: string;
  backgroundImage: string;
  width: number;
  height: number;
  animationName: string;
  transitionDuration: string;
  viewport: { w: number; h: number };
}
const layer = (page: Page): Promise<Layer> =>
  page.evaluate(() => {
    const s = getComputedStyle(document.body, "::before");
    return {
      position: s.position,
      backgroundImage: s.backgroundImage,
      width: parseFloat(s.width),
      height: parseFloat(s.height),
      animationName: s.animationName,
      transitionDuration: s.transitionDuration,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });

test.beforeEach(async () => {
  await setScenario("default");
});

for (const theme of THEMES) {
  test.describe(`CA10/CA11 - gradiente no tema ${theme}`, () => {
    for (const url of SCREENS) {
      test(`${url}: body::before pinta um gradiente, tokens do fundo = design rev. 6 e cards continuam separados`, async ({ context, page }) => {
        await setThemeCookie(context, theme);
        await gotoReady(page, url);
        expect((await layer(page)).backgroundImage).toContain("gradient");
        expect(await bodyBackground(page)).toBe(BG[theme]);

        const colors = await resolveTokens(page, [...PAGE_BG_TOKENS]);
        const idx = theme === "light" ? 0 : 1;
        for (const token of PAGE_BG_TOKENS) {
          expect(colors[token], token).toBe(hex(DESIGN[token][idx]));
          if (theme === "dark") {
            expect(colors[token], `${token} preto`).not.toBe("rgb(0, 0, 0)");
            expect(luminanceOf(colors[token]), `${token} fora de [0,005; 0,25)`).toBeGreaterThanOrEqual(0.005);
            expect(luminanceOf(colors[token])).toBeLessThan(0.25);
          } else {
            expect(colors[token], `${token} branco`).not.toBe("rgb(255, 255, 255)");
          }
        }

        const card = page.locator(".card").first();
        if ((await card.count()) > 0) {
          // rev. 7 (ADR 0004): o card e de vidro e a borda e a borda de vidro (papel --card-border); a sombra (--shadow-card ou a do vidro) continua
          const { border } = await resolveTokens(page, ["--card-border"]).then((r) => ({ border: r["--card-border"] }));
          const style = await card.evaluate((el) => ({ border: getComputedStyle(el).borderTopColor, shadow: getComputedStyle(el).boxShadow }));
          expect(style.border).toBe(border);
          expect(style.shadow).not.toBe("none");
        }
        await auditPageGradient(page, `${url} [${theme}]`);
      });
    }
  });
}

test.describe("CA12 - troca de tema", () => {
  test("o gradiente e a cor base trocam no mesmo quadro (sem transicao) e o recarregamento mantem o tema salvo", async ({ context, page }) => {
    await setThemeCookie(context, "light");
    await gotoReady(page, ENTRIES_URL);
    const before = await layer(page);
    expect(before.transitionDuration.split(",").every((d) => parseFloat(d) === 0), "sem transicao no fundo").toBe(true);
    await themeToggle(page).click();
    await expect.poll(() => bodyBackground(page)).toBe(BG.dark);
    const after = await layer(page);
    expect(after.backgroundImage).toContain("gradient");
    expect(after.backgroundImage, "o gradiente escuro difere do claro").not.toBe(before.backgroundImage);
    await page.reload();
    expect(await bodyBackground(page)).toBe(BG.dark);
    expect((await layer(page)).backgroundImage).toBe(after.backgroundImage);
  });

  test("primeiro quadro: no DOMContentLoaded a camada ja tem o gradiente do tema salvo", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "light" });
    await setThemeCookie(context, "dark");
    const page = await context.newPage();
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { __first: string }).__first = getComputedStyle(document.body, "::before").backgroundImage + "|" + getComputedStyle(document.body).backgroundColor;
      });
    });
    await page.goto(ENTRIES_URL, { waitUntil: "domcontentloaded" });
    const first = await page.evaluate(() => (window as unknown as { __first: string }).__first);
    expect(first).toContain("gradient");
    expect(first.endsWith(`|${BG.dark}`)).toBe(true);
    await context.close();
  });
});

test.describe("CA13 - tema do sistema ao vivo", () => {
  test("sem cookie, mudar o sistema de escuro para claro troca o gradiente", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoReady(page, ENTRIES_URL);
    const dark = await layer(page);
    expect(dark.backgroundImage).toContain("gradient");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => bodyBackground(page)).toBe(BG.light);
    const light = await layer(page);
    expect(light.backgroundImage).toContain("gradient");
    expect(light.backgroundImage).not.toBe(dark.backgroundImage);
  });
});

test.describe("CA16 - faixas opacas", () => {
  for (const [name, viewport] of [["mobile 360x640", { width: 360, height: 640 }], ["desktop 1280x800", { width: 1280, height: 800 }]] as const) {
    for (const theme of THEMES) {
      test(`${name} [${theme}]: faixa de abas usa a janela de fundo e a 2a linha da navbar e transparente`, async ({ context, page }) => {
        await setScenario("many");
        await setThemeCookie(context, theme);
        await page.setViewportSize(viewport);
        await gotoReady(page, ENTRIES_URL);
        await page.evaluate(() => window.scrollTo(0, 700));
        const bar = page.locator(".page-bg-window");
        await expect(bar).toHaveCount(1);
        const style = await bar.evaluate((el) => ({ attachment: getComputedStyle(el).backgroundAttachment, image: getComputedStyle(el).backgroundImage, position: getComputedStyle(el).position, top: el.getBoundingClientRect().top }));
        expect(style.attachment.split(",").map((v) => v.trim()).every((v) => v === "fixed"), `background-attachment: ${style.attachment}`).toBe(true);
        expect(style.image, "mesma receita da camada fixa").toBe((await layer(page)).backgroundImage);
        expect(style.position).toBe("sticky");
        expect(style.top).toBeGreaterThan(0); // grudada abaixo da navbar
        expect(await bar.evaluate((el) => getComputedStyle(el).backgroundColor), "cor base opaca da janela").toBe(BG[theme]);

        if (viewport.width < 640) {
          const row = page.getByRole("navigation", { name: "Principal (mobile)" }).locator("xpath=..");
          const row2 = await row.evaluate((el) => ({ color: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage }));
          expect(row2.color).toBe("rgba(0, 0, 0, 0)");
          expect(row2.image).toBe("none");
          const tablist = await page.locator(".tablist").first().evaluate((el) => getComputedStyle(el).backgroundColor);
          expect(tablist).toBe("rgba(0, 0, 0, 0)");
        }
        await audit(page, `/entries rolada ${name} [${theme}]`, { gradients: [PAGE_BG_REGION] });
        await auditPageGradient(page, `/entries rolada ${name} [${theme}]`);
      });
    }
  }
});

test.describe("CA17 - paginas longas e rolagem", () => {
  test("360x640, cenario 'many': ao rolar ate o fim a camada continua fixa, com o tamanho da viewport", async ({ page }) => {
    await setScenario("many");
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoReady(page, ENTRIES_URL);
    const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(scrollable, "pagina longa para o teste fazer sentido").toBeGreaterThan(640);
    for (const y of [0, scrollable / 2, scrollable]) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      const l = await layer(page);
      expect(l.position).toBe("fixed");
      expect(l.backgroundImage).toContain("gradient");
      expect(Math.round(l.width)).toBe(l.viewport.w);
      expect(Math.round(l.height)).toBe(l.viewport.h);
    }
  });
});

test.describe("CA18 - carregamento e erro", () => {
  test("loading.tsx: skeleton sobre o mesmo gradiente", async ({ page }) => {
    await setScenario("default", { delayMs: 2500 });
    await page.goto(ENTRIES_URL, { waitUntil: "commit" });
    await page.locator('[aria-busy="true"]').first().waitFor();
    expect((await layer(page)).backgroundImage).toContain("gradient");
  });

  test("error.tsx (API 500): mesmo gradiente do tema efetivo", async ({ context, page }) => {
    await setScenario("error500");
    await setThemeCookie(context, "dark");
    await gotoReady(page, ENTRIES_URL);
    expect((await layer(page)).backgroundImage).toContain("gradient");
    expect(await bodyBackground(page)).toBe(BG.dark);
  });
});

test.describe("CA19 - movimento reduzido", () => {
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    test(`reducedMotion=${reducedMotion}: o fundo nao tem animacao`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await gotoReady(page, ENTRIES_URL);
      const l = await layer(page);
      expect(l.animationName).toBe("none");
      expect(l.transitionDuration.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
    });
  }
});

test.describe("CA21 - pre-visualizacao removida", () => {
  test("a rota temporaria responde a 404 padrao do Next", async ({ page }) => {
    const response = await page.goto(["/background", "preview"].join("-"));
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|could not be found|não foi encontrada/i).first()).toBeVisible();
  });
});

