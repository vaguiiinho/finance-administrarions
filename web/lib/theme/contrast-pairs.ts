/**
 * Matriz de pares de contraste por tema (ADR 9.5, design 1.9). `tokens.spec.ts` recalcula cada par a partir de
 * `app/styles/tokens.css` nos dois temas. Todo par novo de UI deve entrar aqui.
 */
export type ContrastKind = "text" | "large-text" | "non-text" | "disabled";

export interface ContrastPair {
  /** Nome do token (`--...`); tipado como string para o teste poder consultar a matriz com nomes lidos do CSS. */
  fg: string;
  bg: string;
  /** Fundos efetivos sob um `bg` com alfa (ex.: --header-bg); o teste compoe e usa o PIOR caso. */
  over?: readonly string[];
  kind: ContrastKind;
  /** Componente/estado, para mensagem de falha. */
  where: string;
}

const HEADER_UNDER = ["--bg", "--surface", "--surface-2", "--text"] as const;

const p = (fg: ContrastPair["fg"], bg: ContrastPair["bg"], kind: ContrastKind, where: string, over?: ContrastPair["over"]): ContrastPair =>
  over ? { fg, bg, kind, where, over } : { fg, bg, kind, where };

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  // texto sobre superficies
  p("--text", "--bg", "text", "texto principal, aba ativa, faixa de abas"),
  p("--text", "--surface", "text", "cards, tabela, drawer, modal"),
  p("--text", "--surface-2", "text", "hover, linha selecionada, toast, subtotal, painel de novo cartao"),
  p("--text", "--surface-active", "text", "botao secundario pressionado, aba pressionada"),
  p("--text", "--input-bg", "text", "texto digitado em campos"),
  p("--text", "--header-bg", "text", "navbar", HEADER_UNDER),
  p("--text-muted", "--bg", "text", "aba inativa, rotulos"),
  p("--text-muted", "--surface", "text", "rotulos e metadados em cards"),
  p("--text-muted", "--surface-2", "text", "rotulos do subtotal e do painel de cartao"),
  p("--text-muted", "--surface-active", "text", "texto secundario pressionado"),
  p("--text-muted", "--input-bg", "text", "placeholder"),
  p("--text-muted", "--header-bg", "text", "navbar - item inativo", HEADER_UNDER),
  p("--text-muted", "--tooltip-bg", "text", "tooltip - rotulos"),
  p("--text", "--tooltip-bg", "text", "tooltip - valores"),
  p("--accent", "--surface", "text", "links, disclosure"),
  p("--accent", "--bg", "text", "links sobre o fundo"),
  p("--accent", "--surface-2", "text", "links sobre superficie 2, toast com acao"),
  p("--accent-active", "--surface-active", "text", "botao terciario pressionado (:active)"),
  p("--accent", "--header-bg", "text", "navbar - item ativo", HEADER_UNDER),
  p("--on-primary", "--primary-strong", "text", "botao primario"),
  p("--on-primary", "--primary-strong-hover", "text", "botao primario em hover"),
  p("--on-primary", "--primary-strong-active", "text", "botao primario pressionado"),
  p("--success-text", "--surface", "text", "badge Pago, Fatura paga"),
  p("--success-text", "--surface-2", "text", "badge Pago em linha selecionada"),
  p("--warning-text", "--surface", "text", "badge Pendente, aviso de irreversibilidade"),
  p("--warning-text", "--surface-2", "text", "badge Pendente em linha selecionada"),
  p("--danger-text", "--surface", "text", "mensagens de erro"),
  p("--danger-text", "--surface-2", "text", "erro no painel de cartao"),
  p("--danger-text", "--bg", "text", "erro sobre o fundo"),
  p("--danger-text", "--input-bg", "text", "erro abaixo de campo"),
  p("--income", "--surface", "text", "rotulo Receita, badge Recebida"),
  p("--income", "--surface-2", "text", "rotulo Receita em linha selecionada"),
  p("--expense", "--surface", "text", "rotulo Despesa"),
  p("--expense", "--surface-2", "text", "rotulo Despesa em linha selecionada"),
  p("--chart-axis", "--surface", "text", "ticks dos eixos"),
  p("--chart-axis", "--tooltip-bg", "text", "texto auxiliar em tooltip"),

  // desabilitado
  p("--text-disabled", "--surface-2", "disabled", "botao/campo desabilitado"),
  p("--text-disabled", "--surface", "disabled", "texto desabilitado sobre card"),
  p("--text-disabled", "--bg", "disabled", "texto desabilitado sobre o fundo"),

  // bordas de controles, foco e estados
  p("--border-strong", "--surface", "non-text", "borda de controles e blocos de fatura"),
  p("--border-strong", "--bg", "non-text", "contorno do segmented e da faixa de abas"),
  p("--border-strong", "--surface-2", "non-text", "borda de input dentro do painel de cartao"),
  p("--border-strong", "--surface-active", "non-text", "borda de controle pressionado"),
  p("--border-strong", "--input-bg", "non-text", "borda de input"),
  p("--primary-border", "--surface", "non-text", "borda do botao primario / pagina atual"),
  p("--primary-border", "--bg", "non-text", "segmento ativo e checkbox marcado"),
  p("--primary-border", "--surface-2", "non-text", "botao primario no painel de cartao"),
  p("--focus-color", "--surface", "non-text", "anel de foco"),
  p("--focus-color", "--bg", "non-text", "anel de foco sobre o fundo / aba"),
  p("--focus-color", "--surface-2", "non-text", "anel de foco sobre superficie 2"),
  p("--focus-color", "--input-bg", "non-text", "anel de foco em campos"),
  p("--focus-color", "--header-bg", "non-text", "anel de foco na navbar", HEADER_UNDER),
  p("--accent", "--bg", "non-text", "indicador da aba ativa"),
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
