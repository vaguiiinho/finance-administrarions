/**
 * Matriz de pares de contraste por tema (ADR 9.5, design 1.9). `tokens.spec.ts` recalcula cada par a partir de
 * `app/styles/tokens.css` nos dois temas. Todo par novo de UI deve entrar aqui.
 */
export type ContrastKind = "text" | "large-text" | "non-text" | "disabled";

export interface ContrastPair {
  /** Nome do token (`--...`); tipado como string para o teste poder consultar a matriz com nomes lidos do CSS. */
  fg: string;
  bg: string;
  /**
   * Fundos efetivos sob um `bg` com alfa (ex.: --glass-bg); o teste compoe e usa o PIOR caso. Uma entrada de `over` que
   * tambem tenha alfa (ex.: --glass-bg sob --glass-bg-2) e expandida: composta sobre CADA amostra do fundo (ADR 0004 5.3).
   */
  over?: readonly string[];
  kind: ContrastKind;
  /** Componente/estado, para mensagem de falha. */
  where: string;
}

/** Tokens que compoem o fundo da pagina (design rev. 6). Pares com bg "--bg" valem contra as amostras de todos eles. */
export const PAGE_BACKGROUND_TOKENS = ["--bg", "--bg-stop-1", "--bg-stop-2", "--bg-stop-3", "--bg-glow-1", "--bg-glow-2"] as const;

/**
 * O que pode passar sob um vidro de barra (ADR 0004 5.3, B1, R1): o fundo, superficies opacas e de vidro (translucidas sao
 * compostas sobre cada amostra do fundo) e os extremos de luminancia do primeiro plano nos dois temas.
 */
export const BAR_UNDER = [
  ...PAGE_BACKGROUND_TOKENS,
  "--surface",
  "--surface-2",
  "--glass-bg",
  "--glass-bg-2",
  "--glass-input-bg",
  "--text",
  "--on-primary",
  "--primary-strong",
] as const;

/** Fundos possiveis sob um vidro de CARD (a variante 2 e o campo tambem aparecem sobre o proprio vidro de card). */
const GLASS_UNDER = PAGE_BACKGROUND_TOKENS;
const GLASS_2_UNDER = [...PAGE_BACKGROUND_TOKENS, "--glass-bg"] as const;

const p = (fg: ContrastPair["fg"], bg: ContrastPair["bg"], kind: ContrastKind, where: string, over?: ContrastPair["over"]): ContrastPair =>
  over ? { fg, bg, kind, where, over } : { fg, bg, kind, where };

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  // texto sobre superficies
  p("--text", "--bg", "text", "texto principal, aba ativa, faixa de abas (pior caso do gradiente)"),
  p("--text", "--surface", "text", "cards, tabela, drawer, modal"),
  p("--text", "--surface-2", "text", "hover, linha selecionada, toast, subtotal, painel de novo cartao"),
  p("--text", "--surface-active", "text", "botao secundario pressionado, aba pressionada"),
  p("--text", "--input-bg", "text", "texto digitado em campos"),
  p("--text-muted", "--bg", "text", "aba inativa, rotulos (pior caso do gradiente)"),
  p("--text-muted", "--surface", "text", "rotulos e metadados em cards"),
  p("--text-muted", "--surface-2", "text", "rotulos do subtotal e do painel de cartao"),
  p("--text-muted", "--surface-active", "text", "texto secundario pressionado"),
  p("--text-muted", "--input-bg", "text", "placeholder"),
  p("--text-muted", "--tooltip-bg", "text", "tooltip - rotulos"),
  p("--text", "--tooltip-bg", "text", "tooltip - valores"),
  p("--accent", "--surface", "text", "links, disclosure"),
  p("--accent", "--bg", "text", "links sobre o fundo (pior caso do gradiente)"),
  p("--accent", "--surface-2", "text", "links sobre superficie 2, toast com acao"),
  p("--accent-active", "--surface-active", "text", "botao terciario pressionado (:active)"),
  p("--on-primary", "--primary-strong", "text", "botao primario"),
  p("--on-primary", "--primary-strong-hover", "text", "botao primario em hover"),
  p("--on-primary", "--primary-strong-active", "text", "botao primario pressionado"),
  p("--success-text", "--surface", "text", "badge Pago, Fatura paga"),
  p("--success-text", "--surface-2", "text", "badge Pago em linha selecionada"),
  p("--warning-text", "--surface", "text", "badge Pendente, aviso de irreversibilidade"),
  p("--warning-text", "--surface-2", "text", "badge Pendente em linha selecionada"),
  p("--danger-text", "--surface", "text", "mensagens de erro"),
  p("--danger-text", "--surface-2", "text", "erro no painel de cartao"),
  p("--danger-text", "--bg", "text", "erro sobre o fundo (pior caso do gradiente)"),
  p("--danger-text", "--input-bg", "text", "erro abaixo de campo"),
  p("--income", "--surface", "text", "rotulo Receita, badge Recebida"),
  p("--income", "--surface-2", "text", "rotulo Receita em linha selecionada"),
  p("--expense", "--surface", "text", "rotulo Despesa"),
  p("--expense", "--surface-2", "text", "rotulo Despesa em linha selecionada"),
  p("--chart-axis", "--surface", "text", "ticks dos eixos"),
  p("--chart-axis", "--tooltip-bg", "text", "texto auxiliar em tooltip"),

  // ---- vidro fosco (design rev. 7, ADR 0004 5.3): o fundo efetivo e o vidro composto sobre CADA amostra do gradiente ----
  p("--text", "--glass-bg", "text", "vidro de card - texto principal", GLASS_UNDER),
  p("--text-muted", "--glass-bg", "text", "vidro de card - rotulos e metadados", GLASS_UNDER),
  p("--chart-axis", "--glass-bg", "text", "vidro de card - ticks dos eixos", GLASS_UNDER),
  p("--accent", "--glass-bg", "text", "vidro de card - links e indicadores", GLASS_UNDER),
  p("--danger-text", "--glass-bg", "text", "vidro de card - erros", GLASS_UNDER),
  p("--success-text", "--glass-bg", "text", "vidro de card - badge Pago", GLASS_UNDER),
  p("--warning-text", "--glass-bg", "text", "vidro de card - badge Pendente", GLASS_UNDER),
  p("--income", "--glass-bg", "text", "vidro de card - rotulo Receita", GLASS_UNDER),
  p("--expense", "--glass-bg", "text", "vidro de card - rotulo Despesa", GLASS_UNDER),
  p("--text-disabled", "--glass-bg", "disabled", "vidro de card - texto desabilitado", GLASS_UNDER),
  p("--border-strong", "--glass-bg", "non-text", "vidro de card - bloco de fatura e contornos", GLASS_UNDER),
  p("--tooltip-border", "--glass-bg", "non-text", "vidro de card - borda do tooltip de grafico", GLASS_UNDER),
  p("--primary-border", "--glass-bg", "non-text", "vidro de card - botao primario", GLASS_UNDER),
  p("--focus-color", "--glass-bg", "non-text", "vidro de card - anel de foco", GLASS_UNDER),
  p("--danger", "--glass-bg", "non-text", "vidro de card - borda de banner de erro", GLASS_UNDER),
  p("--success", "--glass-bg", "non-text", "vidro de card - indicador Pago", GLASS_UNDER),
  p("--warning", "--glass-bg", "non-text", "vidro de card - indicador Pendente", GLASS_UNDER),
  p("--chart-income", "--glass-bg", "non-text", "vidro de card - barra de receitas", GLASS_UNDER),
  p("--chart-paid", "--glass-bg", "non-text", "vidro de card - segmento pago", GLASS_UNDER),
  p("--chart-pending", "--glass-bg", "non-text", "vidro de card - segmento pendente", GLASS_UNDER),
  p("--chart-balance-realized", "--glass-bg", "non-text", "vidro de card - linha de saldo realizado", GLASS_UNDER),
  p("--chart-balance-projected", "--glass-bg", "non-text", "vidro de card - linha de saldo previsto", GLASS_UNDER),
  p("--chart-zero-line", "--glass-bg", "non-text", "vidro de card - linha do zero", GLASS_UNDER),
  ...[1, 2, 3, 4, 5, 6].map((n) => p(`--chart-${n}`, "--glass-bg", "non-text", `vidro de card - donut ${n}`, GLASS_UNDER)),

  p("--text", "--glass-bg-2", "text", "vidro variante 2 - hover, selecao, subtotal", GLASS_2_UNDER),
  p("--text-muted", "--glass-bg-2", "text", "vidro variante 2 - rotulos do subtotal", GLASS_2_UNDER),
  p("--accent", "--glass-bg-2", "text", "vidro variante 2 - links e barra da linha selecionada", GLASS_2_UNDER),
  p("--success-text", "--glass-bg-2", "text", "vidro variante 2 - badge Pago em linha selecionada", GLASS_2_UNDER),
  p("--warning-text", "--glass-bg-2", "text", "vidro variante 2 - badge Pendente em linha selecionada", GLASS_2_UNDER),
  p("--danger-text", "--glass-bg-2", "text", "vidro variante 2 - erro", GLASS_2_UNDER),
  p("--income", "--glass-bg-2", "text", "vidro variante 2 - rotulo Receita em linha selecionada", GLASS_2_UNDER),
  p("--expense", "--glass-bg-2", "text", "vidro variante 2 - rotulo Despesa em linha selecionada", GLASS_2_UNDER),
  p("--text-disabled", "--glass-bg-2", "disabled", "vidro variante 2 - texto desabilitado", GLASS_2_UNDER),
  p("--border-strong", "--glass-bg-2", "non-text", "vidro variante 2 - borda de controle", GLASS_2_UNDER),
  p("--primary-border", "--glass-bg-2", "non-text", "vidro variante 2 - botao primario", GLASS_2_UNDER),
  p("--focus-color", "--glass-bg-2", "non-text", "vidro variante 2 - anel de foco", GLASS_2_UNDER),
  p("--danger", "--glass-bg-2", "non-text", "vidro variante 2 - borda de erro", GLASS_2_UNDER),
  p("--success", "--glass-bg-2", "non-text", "vidro variante 2 - indicador Pago", GLASS_2_UNDER),
  p("--warning", "--glass-bg-2", "non-text", "vidro variante 2 - indicador Pendente", GLASS_2_UNDER),

  p("--text", "--glass-input-bg", "text", "vidro de campo - texto digitado", GLASS_2_UNDER),
  p("--text-muted", "--glass-input-bg", "text", "vidro de campo - placeholder", GLASS_2_UNDER),
  p("--border-strong", "--glass-input-bg", "non-text", "vidro de campo - borda do controle", GLASS_2_UNDER),
  p("--focus-color", "--glass-input-bg", "non-text", "vidro de campo - anel de foco", GLASS_2_UNDER),
  p("--danger", "--glass-input-bg", "non-text", "vidro de campo - borda com erro", GLASS_2_UNDER),
  p("--danger-text", "--glass-input-bg", "text", "vidro de campo - mensagem de erro", GLASS_2_UNDER),

  p("--text", "--glass-bar-bg", "text", "vidro de barra - navbar, valores da barra de lote, thead", BAR_UNDER),
  p("--text-muted", "--glass-bar-bg", "text", "vidro de barra - item inativo da navbar e thead", BAR_UNDER),
  p("--accent", "--glass-bar-bg", "text", "vidro de barra - item ativo da navbar", BAR_UNDER),
  p("--focus-color", "--glass-bar-bg", "non-text", "vidro de barra - anel de foco na navbar", BAR_UNDER),
  p("--border-strong", "--glass-bar-bg", "non-text", "vidro de barra - linha do thead e borda da barra de lote", BAR_UNDER),
  p("--primary-border", "--glass-bar-bg", "non-text", "vidro de barra - botao primario na barra de lote", BAR_UNDER),

  // desabilitado
  p("--text-disabled", "--surface-2", "disabled", "botao/campo desabilitado"),
  p("--text-disabled", "--surface", "disabled", "texto desabilitado sobre card"),
  p("--text-disabled", "--bg", "disabled", "texto desabilitado sobre o fundo (pior caso do gradiente)"),

  // bordas de controles, foco e estados
  p("--border-strong", "--surface", "non-text", "borda de controles e blocos de fatura"),
  p("--border-strong", "--bg", "non-text", "contorno do segmented e da faixa de abas (pior caso do gradiente)"),
  p("--border-strong", "--surface-2", "non-text", "borda de input dentro do painel de cartao"),
  p("--border-strong", "--surface-active", "non-text", "borda de controle pressionado"),
  p("--border-strong", "--input-bg", "non-text", "borda de input"),
  p("--primary-border", "--surface", "non-text", "borda do botao primario / pagina atual"),
  p("--primary-border", "--bg", "non-text", "segmento ativo e checkbox marcado (pior caso do gradiente)"),
  p("--primary-border", "--surface-2", "non-text", "botao primario no painel de cartao"),
  p("--focus-color", "--surface", "non-text", "anel de foco"),
  p("--focus-color", "--bg", "non-text", "anel de foco sobre o fundo / aba (pior caso do gradiente)"),
  p("--focus-color", "--surface-2", "non-text", "anel de foco sobre superficie 2"),
  p("--focus-color", "--input-bg", "non-text", "anel de foco em campos"),
  p("--accent", "--bg", "non-text", "indicador da aba ativa (pior caso do gradiente)"),
  p("--accent", "--surface-2", "non-text", "barra da linha selecionada, progresso"),
  p("--danger", "--input-bg", "non-text", "borda de campo com erro"),
  p("--danger", "--surface", "non-text", "borda de banner de erro"),
  p("--danger", "--surface-2", "non-text", "borda de toast de erro"),
  p("--success", "--surface", "non-text", "indicador Pago"),
  p("--success", "--surface-2", "non-text", "indicador Pago sobre superficie 2"),
  p("--warning", "--surface", "non-text", "indicador Pendente"),
  p("--warning", "--surface-2", "non-text", "indicador Pendente sobre superficie 2"),
  p("--tooltip-border", "--surface", "non-text", "borda do tooltip"),
  p("--scrollbar-thumb", "--scrollbar-track", "non-text", "barra de rolagem"),

  // graficos
  p("--chart-income", "--surface", "non-text", "barra de receitas"),
  p("--chart-paid", "--surface", "non-text", "segmento pago"),
  p("--chart-pending", "--surface", "non-text", "segmento pendente"),
  p("--chart-balance-realized", "--surface", "non-text", "linha de saldo realizado"),
  p("--chart-balance-projected", "--surface", "non-text", "linha de saldo previsto"),
  p("--chart-zero-line", "--surface", "non-text", "linha do zero"),
  p("--chart-1", "--surface", "non-text", "donut - 1a categoria"),
  p("--chart-2", "--surface", "non-text", "donut - 2a categoria"),
  p("--chart-3", "--surface", "non-text", "donut - 3a categoria"),
  p("--chart-4", "--surface", "non-text", "donut - 4a categoria"),
  p("--chart-5", "--surface", "non-text", "donut - 5a categoria"),
  p("--chart-6", "--surface", "non-text", "donut - Outras"),
  p("--chart-income", "--tooltip-bg", "non-text", "marcador de receitas no tooltip"),
  p("--chart-paid", "--tooltip-bg", "non-text", "marcador de pagas no tooltip"),
  p("--chart-pending", "--tooltip-bg", "non-text", "marcador de pendentes no tooltip"),
  p("--chart-balance-realized", "--tooltip-bg", "non-text", "marcador de saldo realizado no tooltip"),
  p("--chart-balance-projected", "--tooltip-bg", "non-text", "marcador de saldo previsto no tooltip"),
];

/** Pares abaixo do minimo aceitos por estarem cobertos por outro par (ex.: preenchimento coberto por borda). */
export const DECORATIVE_PAIRS: readonly (ContrastPair & { coveredBy: ContrastPair })[] = [
  {
    ...p("--primary-strong", "--surface", "non-text", "preenchimento do botao primario no escuro (2,81:1)"),
    coveredBy: p("--primary-border", "--surface", "non-text", "borda obrigatoria de tudo que usa --primary-strong"),
  },
];
