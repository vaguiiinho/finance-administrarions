import type { Locator } from "@playwright/test";
import { composite, contrastRatio, parseColor, type Rgba } from "../lib/theme/contrast";

/**
 * Contraste calculado no navegador (ADR 0002 T2). O axe nao avalia elementos desabilitados nem bordas, entao lemos as
 * cores computadas, compomos o alfa subindo pelos ancestrais ate um fundo opaco e calculamos a razao WCAG com a mesma
 * matematica da camada 1 (`lib/theme/contrast.ts`).
 */
export const MIN_TEXT = 4.5;
export const MIN_COMPONENT = 3;

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/** Compoe a cadeia de `background-color` (do elemento para fora, mais interno primeiro) sobre um fundo opaco. */
export function resolveBackground(chain: readonly string[], fallback: Rgba = WHITE): Rgba {
  let bg: Rgba = { ...fallback, a: 1 };
  for (let i = chain.length - 1; i >= 0; i--) bg = composite(parseColor(chain[i]), bg);
  return bg;
}

export interface ButtonStyleSnapshot {
  label: string;
  /** `color` computado */
  color: string;
  /** `background-color` do botao e dos ancestrais (botao primeiro) */
  ownBackgrounds: string[];
  /** `background-color` dos ancestrais (pai primeiro): o "fundo ao redor" */
  surroundBackgrounds: string[];
  borderWidth: number;
  borderColor: string;
  outlineStyle: string;
  outlineWidth: number;
  outlineColor: string;
  textDecorationLine: string;
}

/** Le as cores computadas de um elemento no navegador. */
export async function snapshotOf(locator: Locator): Promise<ButtonStyleSnapshot> {
  return locator.evaluate((el) => {
    const css = getComputedStyle(el);
    const chain = (start: Element | null) => {
      const out: string[] = [];
      for (let node = start; node; node = node.parentElement) out.push(getComputedStyle(node).backgroundColor);
      return out;
    };
    const label = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40);
    return {
      label,
      color: css.color,
      ownBackgrounds: chain(el),
      surroundBackgrounds: chain(el.parentElement),
      borderWidth: parseFloat(css.borderTopWidth) || 0,
      borderColor: css.borderTopColor,
      outlineStyle: css.outlineStyle,
      outlineWidth: parseFloat(css.outlineWidth) || 0,
      outlineColor: css.outlineColor,
      textDecorationLine: css.textDecorationLine,
    };
  });
}

export type ButtonState = "default" | "hover" | "focus-visible" | "active" | "loading" | "disabled";

export interface EvaluateOptions {
  state: ButtonState;
  /** Terciario/link: no hover o sublinhado precisa estar presente (design 13.3) */
  expectUnderlineOnHover?: boolean;
  /** Elemento desabilitado em qualquer pseudo-estado (ex.: foco): texto >= 3:1 em vez de 4,5:1 */
  disabled?: boolean;
}

/**
 * Regras do design 13.3: texto/icone >= 4,5:1 contra o fundo do botao (>= 3:1 desabilitado, `--text-disabled`);
 * borda visivel >= 3:1 contra o fundo ao redor; anel de foco >= 3:1 contra o fundo ao redor, com >= 2px.
 * Devolve a lista de problemas (vazia = ok).
 */
export function evaluateButton(snap: ButtonStyleSnapshot, { state, expectUnderlineOnHover = false, disabled = false }: EvaluateOptions): string[] {
  const problems: string[] = [];
  const own = resolveBackground(snap.ownBackgrounds);
  const around = resolveBackground(snap.surroundBackgrounds);
  const where = `"${snap.label}" [${state}]`;

  const text = composite(parseColor(snap.color), own);
  const textRatio = contrastRatio(text, own);
  const textMin = state === "disabled" || disabled ? MIN_COMPONENT : MIN_TEXT;
  if (textRatio < textMin) problems.push(`${where}: texto ${textRatio.toFixed(2)}:1 < ${textMin}:1`);

  const border = parseColor(snap.borderColor);
  if (snap.borderWidth > 0 && border.a > 0) {
    const ratio = contrastRatio(composite(border, around), around);
    if (ratio < MIN_COMPONENT) problems.push(`${where}: borda ${ratio.toFixed(2)}:1 < ${MIN_COMPONENT}:1 contra o fundo ao redor`);
  }

  if (state === "focus-visible") {
    if (snap.outlineStyle === "none" || snap.outlineWidth < 2) {
      problems.push(`${where}: anel de foco ausente ou < 2px (${snap.outlineStyle} ${snap.outlineWidth}px)`);
    } else {
      const ring = contrastRatio(composite(parseColor(snap.outlineColor), around), around);
      if (ring < MIN_COMPONENT) problems.push(`${where}: anel de foco ${ring.toFixed(2)}:1 < ${MIN_COMPONENT}:1`);
    }
  }

  if (state === "hover" && expectUnderlineOnHover && !snap.textDecorationLine.includes("underline")) {
    problems.push(`${where}: terciario sem sublinhado no hover`);
  }
  return problems;
}

export interface TextContrastResult {
  ratio: number;
  /** Texto grande (>= 24px, ou >= 18,66px em negrito): limite de 3:1 em vez de 4,5:1 */
  large: boolean;
  required: number;
  ok: boolean;
  text: string;
  /** Produto da `opacity` do no e dos ancestrais: < 1 invalida o calculo (a cor efetiva nao e a computada) */
  opacity: number;
  /** Algum `background-image` na cadeia (gradiente, imagem): o fundo nao e uma cor so */
  backgroundImage: boolean;
  /** `elementFromPoint` no centro do no devolve algo que nao e o no nem descendente dele (e nao e um overlay declarado): sobreposicao real */
  covered: boolean;
  /** O que cobre o centro do no e (descendente de) um overlay declarado pela tela (ex.: lista aberta do combobox) */
  coveredByOverlay: boolean;
}

/**
 * Unicos `messageKey` do axe que o contraste computado pode resolver (ADR 0002 T2): texto SVG sem fundo legivel
 * (`imgNode`) e sobreposicao parcial (`elmPartiallyObscured`/`elmPartiallyObscuring`). Qualquer outro (`bgImage`,
 * `bgOverlap`, `fgAlpha`, `pseudoContent`, `outsideViewport`...) continua falhando.
 */
export const RESOLVABLE_MESSAGE_KEYS: readonly string[] = ["imgNode", "elmPartiallyObscured", "elmPartiallyObscuring"];

/** `null` = resolvido pelo contraste computado; senao, a razao da falha. */
export function incompleteVerdict(messageKey: string | undefined, result: TextContrastResult): string | null {
  // texto sob um overlay opaco declarado pela tela (e auditado por si so): nao ha o que ler ali; o mesmo no e auditado sem o overlay em outra tela
  if (messageKey === "bgOverlap" && result.coveredByOverlay) return null;
  if (!messageKey || !RESOLVABLE_MESSAGE_KEYS.includes(messageKey)) return `axe: ${messageKey ?? "incomplete"} nao e resolvivel por contraste computado`;
  if (result.opacity < 1) return `opacidade efetiva ${result.opacity.toFixed(2)} < 1: a cor computada nao e a exibida`;
  if (result.backgroundImage) return "background-image na cadeia de ancestrais: fundo nao e uma cor so";
  if (result.covered) return "sobreposicao real: outro elemento cobre o centro do no";
  if (!result.ok) return `${result.ratio.toFixed(2)}:1 < ${result.required}:1`;
  return null;
}

/**
 * Contraste de texto calculado pelas cores computadas: usado para RESOLVER os nos que o axe marca como `incomplete`
 * (ver `incompleteVerdict`). Alem da razao, mede o que invalida o calculo: opacidade efetiva, background-image na cadeia
 * e sobreposicao real. Mais forte que uma allowlist cega (PF04).
 */
export async function textContrastOf(locator: Locator, overlays: readonly string[] = []): Promise<TextContrastResult> {
  const data = await locator.evaluate((el, overlaySelectors) => {
    el.scrollIntoView({ block: "center", inline: "center" });
    const css = getComputedStyle(el);
    const chain: string[] = [];
    let opacity = 1;
    let backgroundImage = false;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      chain.push(style.backgroundColor);
      opacity *= Number(style.opacity);
      if (style.backgroundImage !== "none") backgroundImage = true;
    }
    const box = el.getBoundingClientRect();
    // `pointer-events: none` (ex.: legenda sobre o grafico) tira o no do hit-test; forca `auto` so durante a medicao
    const previous = (el as HTMLElement | SVGElement).style.pointerEvents;
    (el as HTMLElement | SVGElement).style.pointerEvents = "auto";
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    (el as HTMLElement | SVGElement).style.pointerEvents = previous;
    const covers = !top || !(top === el || el.contains(top));
    const coveredByOverlay = covers && !!top && overlaySelectors.some((sel) => top.closest(sel) !== null);
    const covered = covers && !coveredByOverlay;
    const svgFill = el instanceof SVGElement ? css.fill : null;
    return {
      color: svgFill && svgFill !== "none" ? svgFill : css.color,
      chain,
      size: parseFloat(css.fontSize) || 16,
      weight: Number(css.fontWeight) || 400,
      text: (el.textContent ?? "").trim().slice(0, 40),
      opacity,
      backgroundImage,
      covered,
      coveredByOverlay,
    };
  }, overlays);
  const bg = resolveBackground(data.chain);
  const ratio = contrastRatio(composite(parseColor(data.color), bg), bg);
  const large = data.size >= 24 || (data.size >= 18.66 && data.weight >= 700);
  const required = large ? MIN_COMPONENT : MIN_TEXT;
  return { ratio, large, required, ok: ratio >= required, text: data.text, opacity: data.opacity, backgroundImage: data.backgroundImage, covered: data.covered, coveredByOverlay: data.coveredByOverlay };
}
