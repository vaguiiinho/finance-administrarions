import type { Page } from "@playwright/test";

/** Resolve tokens CSS (`--chart-axis`, ...) para `rgb()` no tema ATUAL da pagina, via elemento sonda. */
export async function resolveTokens(page: Page, names: string[]): Promise<Record<string, string>> {
  return page.evaluate((tokens) => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const out: Record<string, string> = {};
    for (const token of tokens) {
      probe.style.color = "";
      probe.style.color = `var(${token})`;
      out[token] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  }, names);
}

/** Luminancia relativa (0 preto, 1 branco) de um `rgb()`/`rgba()` computado. */
export function luminanceOf(rgb: string): number {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
