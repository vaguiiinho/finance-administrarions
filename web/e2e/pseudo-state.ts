import type { Page } from "@playwright/test";

/**
 * Forca pseudo-estados via CDP (`CSS.forcePseudoState`, ADR 0002 T2) em TODOS os elementos visiveis que casam com o
 * seletor, para que um unico `audit()`/leitura de cores cubra a tela inteira por estado. Chromium apenas (RF5).
 */
export type ForcedPseudo = "hover" | "focus" | "focus-visible" | "active";

const MARK = "data-pw-forced";

export interface ForcedStates {
  /** Quantos elementos visiveis foram forcados */
  count: number;
  /** Remove os estados forcados e a marcacao */
  release: () => Promise<void>;
}

export async function forcePseudoState(page: Page, selector: string, states: ForcedPseudo[]): Promise<ForcedStates> {
  const count = await page.evaluate(
    ({ selector, mark }) => {
      let n = 0;
      for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        const box = el.getBoundingClientRect();
        if (box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== "hidden") {
          el.setAttribute(mark, "");
          n++;
        }
      }
      return n;
    },
    { selector, mark: MARK },
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: `[${MARK}]` });
  for (const nodeId of nodeIds) await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: states });
  return {
    count,
    release: async () => {
      for (const nodeId of nodeIds) await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] }).catch(() => undefined);
      await page.evaluate((mark) => document.querySelectorAll(`[${mark}]`).forEach((el) => el.removeAttribute(mark)), MARK);
      await cdp.detach().catch(() => undefined);
    },
  };
}
