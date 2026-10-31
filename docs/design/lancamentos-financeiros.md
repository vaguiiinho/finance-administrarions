# Design: Lançamentos financeiros (receitas e despesas), cartões, faturas, pagamento em lote e dashboard mensal

- **Spec:** `docs/specs/lancamentos-financeiros.md` (revisão 3; RF19-RF27, RNF08-RNF11, CA43-CA87; seção 11). Fechamento: `docs/specs/lancamentos-financeiros-fechamento.md` (seção 13 deste documento).
- **ADR:** `docs/adr/0001-lancamentos-financeiros.md` (em revisão em paralelo para a rev. 3). Este documento não nomeia endpoints: as fontes de dados são citadas pelo requisito da spec (ex.: "resumo do mês, RF10"). Nomes de campos citados (`referenceMonth`) são os usados na resposta da criação; códigos de erro seguem a sugestão T2 da spec e devem ser confirmados pelo ADR.
- **Design system:** `docs/design/design-system.md` (breakpoints sm 640 / md 768 / lg 1024 / xl 1280)
- **Tokens:** `web/app/styles/tokens.css`, cada token declarado uma única vez com `light-dark(<claro>, <escuro>)`. O caminho no `design-system.md` foi corrigido e a tabela de tokens da seção 1.2 foi copiada para lá.
- **Autor:** ui-designer
- **Superação parcial (2026-10-30):** as seções 3.1, 3.3 (mês padrão), 3.5, 3.6, 3.7, 3.9.2, 3.10 e 3.12 e a decisão D6 deixam de valer como escritas para `/entries` e `/demo/entries`, nos pontos indicados por uma nota "Superado" em cada uma. Valem `docs/design/listagem-mes-e-status-padrao.md` (seção 12, C10), `docs/specs/listagem-mes-e-status-padrao.md` (rev. 3) e `docs/adr/0007-listagem-mes-e-status-padrao.md`.
- **Status:** Implementado (rev. 3) + revisão 4 de fechamento; desvio 2 da seção 12 aprovado (B1 da spec de fechamento, 2026-10-25). Revisão 5 (paleta suavizada) aprovada pelo usuário em 2026-10-25; valores ainda a aplicar em `tokens.css` pelo frontend-dev.

### Histórico

| Revisão | Mudança |
|---|---|
| 1 | Versão inicial: tudo é despesa, sem cartões, só tema escuro. Aprovados D1-D4, a pasta `web/components/` e o fechamento do drawer sem confirmação. |
| 2 | Tipo Receita/Despesa, meio conta/cartão, mês de referência, tela `/cards`, filtros e totais com saldos, "Pagar fatura" em barra acima da lista, dashboard revisto (DR3), tratamento de 404/409/422, navbar com três destinos, tema claro e escuro com valores de tokens e tabela de contraste. |
| 3 | Spec rev. 3. `/entries` reestruturada em **cabeçalho comum** (seletor de mês, "+ Novo lançamento", resumo do mês inteiro) + **abas Despesas / Faturas / Receitas** (D16-D21). Removidos: filtro de período (intervalo de/até e "Todos"), filtro de tipo, status "Recebida" no filtro, barra de fatura (D14) e regra de filtros incompatíveis (D13). Formas de pagamento **PIX e Cartão** (sai "Conta"); "Ainda não paguei" (D23); atalho **"+ Novo cartão" embutido** no drawer (D22). Mês da fatura = **mês do vencimento**; datas de fechamento/vencimento em `dd/MM/yyyy` na aba Faturas. Atalho de `/cards` para a aba Despesas filtrada (DR8). Dashboard só com seletor de mês. Tokens, contraste, D1-D5 mantidos; novos pares de contraste para abas, subtotal, blocos de fatura e painel de novo cartão (sem tokens novos). CAs renumerados conforme a spec rev. 3. |
| 4 | Fechamento (sem tela nova). Ajustados ao código conferido: combobox de categoria (3.9.1), destaque estático de recém-criado (3.9.2), gráfico estreito e movimento reduzido (5.5), destaque do donut pela legenda (5.6). Desvio 2 (tema com diálogo aberto) em 12, aprovado. Seção 13: divergências para o frontend-dev e matriz de verificação CA82/CA83/CA86. |
| 5 | **Paleta suavizada** (aprovada pelo usuário em 2026-10-25; sem tela nem componente novo). Escuro: fundos azul-ardósia (`--bg` `#151B26`, `--surface` `#1C2330`, `--surface-2` `#252D3C`) no lugar do quase-preto, texto `#E3E7EE`, `--text-muted` `#9BA5B7` e `--accent` `#5CC8DB`. Claro: fundo `#EEF1F5` com cartões brancos, borda `#D9DEE6`, texto `#1E293B`, `--text-muted` `#4B5567`. Tokens dependentes derivados (`--surface-active`, `--input-bg`, `--header-bg`, `--border-strong`, `--text-disabled`, `--skeleton`, `--scrim`, `--tooltip-*`, `--scrollbar-*`, `--chart-axis/grid/zero-line/cursor`, `--chart-1`, `--chart-6`, `--focus-color`, `--accent-active`). Novos tokens `--shadow-color` e `--shadow-card` (sombra sutil dos cartões). Tokens semânticos e séries de gráfico sem mudança de valor, conferidos contra os novos fundos: nenhum par abaixo do mínimo. Atualizadas 1.2, 1.3, 1.9 e 13.3; `design-system.md` sincronizado. |

Este documento define estrutura visual, hierarquia, componentes, estados e interação. Não contém código. Nomes de componentes são sugestões para o frontend-dev.

---

## 0. Decisões de design

| # | Decisão | Status | Motivo |
|---|---|---|---|
| D1 | Formulários de criação/edição (lançamento e cartão) em **drawer**: lateral direita em >= `md`, folha em tela cheia abaixo de `md` | Aprovada | Lista e resumo continuam visíveis; no mobile, tela cheia evita teclado cobrindo campos. |
| D2 | Confirmações (pagar individual, lote e fatura) em **modal de alerta** (`alertdialog`) | Aprovada | Ação irreversível (sem estorno, CA28). |
| D3 | Barras do dashboard: despesas empilhadas (pago na base, pendente em cima) + receitas ao lado + duas linhas de saldo (DR3) | Aprovada | Compara receita x despesa; a linha em relação ao zero responde "o saldo foi positivo?". |
| D4 | Donut com até 5 categorias + "Outras"; a tabela alternativa lista todas | Aprovada | Mais de 6 cores categóricas perdem distinção e contraste. |
| D5 | **Tema claro e escuro** com botão sol/lua na navbar; valores próprios por tema (P28) | Decisão do usuário (mantida) | Spec D5/RF27. Seções 1 e 2.2. |
| D6 | Filtros aplicam ao mudar (>= `md`) e pelo botão "Aplicar" na folha de filtros (< `md`, só aba Despesas; *superado: a aba Faturas também tem filtro de status e folha, ver design `listagem-mes-e-status-padrao.md`, DL5*) | Mantida | No mobile, cada mudança é uma navegação; aplicar em lote evita várias. |
| D7 | Primitivos próprios; modal/drawer/folha sobre `<dialog>` nativo com `showModal()` | Mantida | Foco preso, `Esc` e fundo inerte nativos. |
| D8 | Toast próprio com regiões `aria-live` | Mantida | |
| D9 | Navbar com links Lançamentos, Dashboard, Cartões + alternador de tema; sem tab bar inferior | Mantida | Rodapé do mobile fica livre para a barra de seleção em lote. Abaixo de `sm`, duas linhas (2.1). |
| D10 | Resumo em **3 grupos**: Receitas; Despesas (total + pago + pendente); Saldo (realizado + previsto) | Mantida, com variante compacta (D20) | Agrupa o que se lê junto. |
| D11 | Estado "atualizando" **sem opacidade**: cores normais + barra de progresso + "Atualizando…" + `aria-busy` | Mantida | Opacidade derrubava o contraste abaixo de AA. |
| D12 | No drawer, o campo **Cartão só aparece** com Tipo Despesa + Forma Cartão; com Receita, o segmento "Cartão" fica desabilitado com explicação | Mantida (texto "Meio" -> "Forma") | Campo só tem significado nesse caso. |
| D13 | ~~Filtros incompatíveis não se ajustam sozinhos~~ | **Removida** | Sem filtro de tipo e com abas por tipo, as combinações incompatíveis deixaram de existir. |
| D14 | ~~Barra de fatura acima da lista~~ | **Substituída por D17** | "Pagar fatura" migrou para a aba Faturas (RF20, RF21). |
| D15 | Gráfico de barras em contêiner estreito (< 560px úteis) vira **rolagem horizontal** com eixo Y fixo, aberto no mês selecionado | Mantida | DR3: 12 meses sempre disponíveis. |
| D16 | **Cabeçalho comum persistente + faixa de abas fixa (sticky)**. O cabeçalho (título, seletor de mês, "+ Novo lançamento", resumo) fica no fluxo, acima das abas, e não é re-renderizado ao trocar de aba. Ao rolar, só a **faixa de abas** gruda abaixo da navbar; em >= `md` ela também mostra o mês compacto com setas e um botão "+ Novo lançamento" | Nova | "Topo fixo" da spec (RF19) entendido como "comum a todas as abas e sempre igual". Fixar o cabeçalho inteiro ocuparia ~250px (>= 30% da altura em notebook e ~45% no mobile). A faixa de abas fixa mantém a orientação (aba e mês) e a ação principal sem roubar área de leitura. |
| D17 | **Aba Faturas em blocos de largura total, um por cartão**, em coluna única em todas as larguras; lista de despesas da fatura em **disclosure** (recolhida por padrão), carregada ao expandir | Nova | Blocos em grade ficariam desalinhados ao expandir; coluna única mantém a ordem por vencimento legível de cima para baixo. Carregar ao expandir evita buscar até 20 listas que o usuário talvez não abra (DR7, R17). |
| D18 | Abas com semântica `tablist` e **ativação manual** (setas movem o foco, `Enter`/`Espaço` ativam); cada aba é um link real (URL). Em >= `md`, abas sublinhadas; abaixo de `md`, **segmented de 3 colunas iguais** que vira rolagem horizontal só se não couber (zoom/texto grande) | Nova | Trocar de aba é uma navegação com busca de dados; ativação automática dispararia uma navegação por tecla de seta (padrão WAI-APG para painéis com latência). Links permitem abrir em nova aba e voltar/avançar. Em 360px, 3 colunas de ~109px cabem "Despesas"/"Faturas"/"Receitas" sem truncar. |
| D19 | **Filtros de cada aba guardados na URL com prefixo por aba**; trocar de aba mantém o mês e os filtros de todas as abas, e a aba destino abre na página 1; trocar o mês mantém aba e filtros, volta à página 1, limpa a seleção e recolhe os blocos de fatura | Nova | P34 ("cada aba guarda seus próprios filtros"): voltar de Faturas para Despesas reencontra o filtro "Nubank". Filtros não dependem do mês, então sobrevivem à troca de mês (CA68 só exige página 1 e seleção limpa). |
| D20 | **Resumo compacto abaixo de `md`**: um único card com 5 linhas (Receitas; Despesas + linha pago/pendente; Saldo realizado; Saldo previsto), valores 16px, sem esconder nenhum número | Nova | Os 3 cards empilhados da rev. 2 ocupavam ~330px antes das abas; o compacto ocupa ~170px e mostra os mesmos 6 valores (RF19 exige todos). |
| D21 | **Subtotal da aba em faixa discreta** logo acima da lista (fundo `--surface-2`, texto 14px, rótulo "Subtotal"), visualmente distinta do resumo; sempre visível, com rótulo "Todas as despesas do mês" sem filtros e "Com os filtros aplicados" com filtros | Nova | DR6: o resumo responde "como está meu mês?", o subtotal "quanto soma o que vejo". Tamanho e forma diferentes evitam ler um pelo outro (CA47, CA50). Manter a faixa sem filtros evita que o layout salte ao filtrar. |
| D22 | **Atalho "+ Novo cartão" embutido** no drawer: painel inline que se abre logo abaixo do campo Cartão, dentro do mesmo drawer | Nova (P35 deixa a forma ao ui-designer) | Justificativa em 3.9.3. Resumo: uma única camada de diálogo (sem modal sobre drawer, sem scrim duplo, sem armadilha de foco aninhada, compatível com D7 e com a regra de feedback inline em diálogos), dados digitados continuam visíveis (o usuário vê que nada se perdeu), e o formulário tem só 3 campos. |
| D23 | **"Ainda não paguei" só aparece com Despesa + PIX**; nos outros casos é substituído por uma linha fixa "Status inicial" que diz como o lançamento nasce (pago / pendente / pendente na fatura / recebida) | Nova | Mesmo raciocínio de D12: um checkbox desabilitado permanente em compras no cartão e receitas seria ruído. A linha de status inicial atende "indisponível com explicação" (RF23, CA73) e deixa explícito que PIX nasce pago (R9). |
| D24 | **Aviso não bloqueante para PIX com data futura**: com Despesa + PIX + data posterior a hoje (SP) e "Ainda não paguei" desmarcado, ajuda `--text-muted` "Data futura: ela será registrada como paga hoje. Marque "Ainda não paguei" se o PIX ainda não saiu." Nada é marcado automaticamente | Nova (depende de B8) | Mitiga R9 sem mudar a regra sugerida em B8 (nasce paga, sem exceção). Não calcula fatura nem mês de referência (P24). |
| D25 | **Feedback pós-criação orientado ao mês e à aba**: o toast usa `referenceMonth` e as datas da fatura **da resposta**; se o lançamento não pertence ao mês selecionado ou à aba ativa, oferece uma ação que leva ao lugar onde ele aparece | Nova | Com o mês da fatura = mês do vencimento, quase toda compra no cartão cai no mês seguinte e "some" da tela atual; o toast explica onde ela está (CA74). |

---

## 1. Fundamentos visuais e tema

### 1.1 Mecanismo de tema (do ponto de vista visual)

- Cada token é declarado **uma vez** em `web/app/styles/tokens.css` com `light-dark(<claro>, <escuro>)`. O tema ativo é o `color-scheme` do `<html>`: sem preferência, segue o sistema (ao vivo); com preferência, atributo de tema no `<html>` renderizado pelo servidor (mecanismo do ADR, T15).
- **Nenhum componente usa cor literal**: só `var(--token)`, inclusive em SVG (Recharts) e pseudo-elementos.
- Troca de tema instantânea (sem transição de cor) para todos os usuários (CA87). Transições de layout (drawer, expandir fatura) seguem `prefers-reduced-motion`.
- Como as cores vêm de variáveis CSS, a troca não exige re-render: drawer aberto, painel de novo cartão aberto, texto digitado, seleção, aba, filtros e blocos expandidos permanecem (CA84). **Proibido** ler cores com `getComputedStyle` e guardá-las em estado JS.

### 1.2 Tokens: valores por tema

**Rev. 5 (paleta suavizada, aprovada pelo usuário em 2026-10-25).** O escuro deixa de ser "preto bruto": fundo e superfícies em azul-ardósia, com degraus de luminância maiores entre `--bg`, `--surface`, `--surface-2` e `--surface-active`; texto e `--accent` menos estridentes. O claro ganha fundo cinza-azulado suave com cartões brancos, o que aumenta a separação entre fundo e cartões (`--surface` sobre `--bg`: 1,13:1, reforçada por `--border` e `--shadow-card`). Valores marcados com **(rev. 5)** mudaram; os demais estão iguais à rev. 4. Tokens novos: `--shadow-color` e `--shadow-card`.

Um token de preenchimento (`--success`, `--warning`, `--danger`) **nunca** é cor de texto: para texto existem as variantes `*-text`. `light-dark()` só aceita cores: tokens compostos (`--shadow-card`, `--focus-ring`) são declarados uma vez, fora de `light-dark()`, e referenciam o token de cor que varia por tema.

**Superfícies, texto e profundidade**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` (rev. 5) | `#EEF1F5` | `#151B26` | Fundo da página; **fundo opaco da faixa de abas fixa** |
| `--surface` (rev. 5) | `#FFFFFF` | `#1C2330` | Cards, resumo, tabela, blocos de fatura, drawer, modal, folha, menus |
| `--surface-2` (rev. 5) | `#F4F6F9` | `#252D3C` | Hover, linha selecionada, toast, tooltip (escuro), desabilitados, **faixa de subtotal**, **painel de novo cartão** |
| `--surface-active` (rev. 5) | `#E4E8EE` | `#303A4C` | Pressionado de botões secundários/ícone, itens de menu e abas, opção ativa do combobox, `::selection`. Um degrau acima de `--surface-2`; no escuro, limitado para manter `--text-muted` (4,60) e `--border-strong` (3,03) dentro do mínimo |
| `--input-bg` (rev. 5) | `#FFFFFF` | `#151B26` | Fundo de inputs, selects, combobox, date picker. No escuro = `--bg` (campo "rebaixado" em relação ao cartão) |
| `--header-bg` (rev. 5) | `rgb(255 255 255 / 0.95)` | `rgb(28 35 48 / 0.95)` | Navbar fixa (blur 12px); `--surface` com alfa 0.95, que mantém AA com conteúdo rolando por baixo |
| `--border` (rev. 5) | `#D9DEE6` | `#2E3747` | Bordas decorativas (cards não interativos, divisórias, base da faixa de abas) |
| `--border-strong` (rev. 5) | `#6F798C` | `#7A8497` | Borda de controles, blocos de fatura, painel de novo cartão, drawer/modal (>= 3:1) |
| `--text` (rev. 5) | `#1E293B` | `#E3E7EE` | Texto principal, valores monetários, aba ativa |
| `--text-muted` (rev. 5) | `#4B5567` | `#9BA5B7` | Texto secundário, rótulos, placeholders, ticks, aba inativa |
| `--text-disabled` (rev. 5) | `#6F798C` | `#7A8497` | Texto e ícone de controles desabilitados (= `--border-strong`; >= 3:1 sobre `--surface-2`) |
| `--skeleton` (rev. 5) | `#E4E8EE` | `#303A4C` | Blocos de skeleton (decorativo; = `--surface-active`) |
| `--scrim` (rev. 5 no escuro) | `rgb(15 23 42 / 0.45)` | `rgb(8 11 17 / 0.72)` | Fundo atrás de drawer/modal/folha |
| `--shadow-color` (rev. 5, novo) | `rgb(15 23 42 / 0.06)` | `rgb(0 0 0 / 0.3)` | Cor da sombra dos cartões. Único token de sombra com `light-dark()` |
| `--shadow-card` (rev. 5, novo) | `0 1px 2px var(--shadow-color)` | idem | Sombra sutil de todo `--surface` apoiado em `--bg` (regra 7 da 1.3). Declarado sem `light-dark()` |

**Ação, foco e links**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--primary` | `#6366F1` | `#6366F1` | Apenas glow decorativo; nunca texto nem fundo de texto |
| `--primary-strong` | `#4F46E5` | `#4F46E5` | Botão primário, segmento selecionado (inclusive abas no mobile), checkbox marcado, página atual |
| `--primary-strong-hover` | `#4338CA` | `#4338CA` | Hover do primário |
| `--primary-strong-active` | `#3730A3` | `#3730A3` | Pressionado do primário |
| `--primary-border` | `#4F46E5` | `#818CF8` | Borda 1px de tudo que é preenchido com `--primary-strong` (no escuro o preenchimento sozinho tem 2,50:1 sobre `--surface`) |
| `--on-primary` | `#FFFFFF` | `#FFFFFF` | Texto/ícone sobre `--primary-strong` e variantes |
| `--accent` (rev. 5 no escuro) | `#0E7490` | `#5CC8DB` | Links, terciário, item de navegação ativo, **indicador da aba ativa**, barra de linha selecionada, barra de progresso |
| `--accent-active` (rev. 4; rev. 5 no escuro) | `#0C6980` | `#5CC8DB` | Texto do botão terciário pressionado (`:active`), sobre `--surface-active`. No claro, `--accent` tem 4,35 sobre `--surface-active` (abaixo de 4,5); `#0C6980` dá 5,10. No escuro, `--accent` já tem 5,85 e o valor é o mesmo |
| `--focus-color` (rev. 5 no escuro) | `#0E7490` | `#5CC8DB` | Cor do anel de foco (= `--accent`) |
| `--focus-ring` | contorno 2px `--focus-color`, afastamento 2px | idem | Anel de foco; forma em sombra dupla só para elementos com `overflow: hidden` |

**Semântica de status e tipo** (sem mudança de valor; conferidos contra os novos fundos na 1.9)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--success` | `#059669` | `#34D399` | Preenchimento/borda: Pago, toast de sucesso |
| `--success-text` | `#047857` | `#34D399` | Texto/ícone: badge "Pago", "Positivo", "Fatura paga" |
| `--warning` | `#B45309` | `#FBBF24` | Preenchimento/borda: Pendente |
| `--warning-text` | `#92400E` | `#FBBF24` | Texto/ícone: badge "Pendente", "Esta ação não pode ser desfeita." |
| `--danger` | `#DC2626` | `#F87171` | Borda: campo com erro, banner/toast de erro |
| `--danger-text` | `#B91C1C` | `#F87171` | Texto/ícone: erros, "Negativo", contador acima do limite |
| `--income` | `#1D4ED8` | `#60A5FA` | Ícone/rótulo "Receita", badge "Recebida" |
| `--expense` | `#BE123C` | `#FB7185` | Ícone/rótulo "Despesa" |

**Gráficos, tooltip e barras de rolagem**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--chart-income` | `#1D4ED8` | `#60A5FA` | Barra de receitas |
| `--chart-paid` | `#059669` | `#34D399` | Segmento "Despesas pagas" |
| `--chart-pending` | `#B45309` | `#FBBF24` | Segmento "Despesas pendentes" (com hachura) |
| `--chart-balance-realized` | `#6D28D9` | `#A78BFA` | Linha contínua "Saldo realizado" |
| `--chart-balance-projected` | `#BE185D` | `#F472B6` | Linha tracejada "Saldo previsto" |
| `--chart-axis` (rev. 5) | `#4B5567` | `#9BA5B7` | Ticks dos eixos (= `--text-muted`) |
| `--chart-grid` (rev. 5) | `#D9DEE6` | `#343E51` | Grade (decorativa). Claro = `--border`; escuro um pouco acima de `--border` para continuar visível sobre `--surface` |
| `--chart-zero-line` (rev. 5) | `#4B5567` | `#9BA5B7` | Linha do zero (1,5px; = `--text-muted`) |
| `--chart-cursor` (rev. 5) | `#EEF1F5` | `#252D3C` | Faixa de hover/foco e do mês selecionado. Claro = `--bg` (com `--surface-2` a faixa ficaria quase invisível, 1,08:1); escuro = `--surface-2` |
| `--chart-1` .. `--chart-5` (rev. 5: `--chart-1` no escuro) | `#0E7490` `#4F46E5` `#BE185D` `#4D7C0F` `#C2410C` | `#5CC8DB` `#818CF8` `#F472B6` `#A3E635` `#FB923C` | Donut, 1a a 5a categoria (`--chart-1` = `--accent`) |
| `--chart-6` (rev. 5 no escuro) | `#64748B` | `#9BA5B7` | Donut, "Outras" (escuro = `--text-muted`) |
| `--tooltip-bg` (rev. 5 no escuro) | `#FFFFFF` | `#252D3C` | Fundo dos tooltips (opaco; escuro = `--surface-2`) |
| `--tooltip-border` (rev. 5) | `#6F798C` | `#7A8497` | Borda dos tooltips (= `--border-strong`) |
| `--scrollbar-thumb` (rev. 5) | `#6F798C` | `#7A8497` | Polegar da barra de rolagem (inclusive faixa de abas rolável; = `--border-strong`) |
| `--scrollbar-track` (rev. 5) | `#F4F6F9` | `#252D3C` | Trilho (= `--surface-2`) |

`--primary-strong`, `--on-primary`, `--surface-2`, `--scrim`, `--focus-ring` e `--chart-1..6` foram aprovados na rev. 1. Os tokens introduzidos na rev. 2 (`--surface-active`, `--input-bg`, `--header-bg`, `--primary-strong-hover`, `--primary-strong-active`, `--primary-border`, `--focus-color`, `--tooltip-border`, variantes `*-text`, `--income`, `--expense`, `--chart-*` semânticos) continuam pendentes de aprovação formal (seção 11, item 12). Os valores de base da rev. 5 (`--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent` escuro, `--border-strong` e a sombra) foram aprovados pelo usuário em 2026-10-25; os dependentes foram derivados deles pelo ui-designer.

### 1.3 Regras de uso das cores (válidas nos dois temas)

1. **Texto só com tokens de texto**: `--text`, `--text-muted`, `--text-disabled`, `--accent`, `--accent-active`, `--on-primary`, `--success-text`, `--warning-text`, `--danger-text`, `--income`, `--expense`.
2. **Sem opacidade em texto ou controles**: desabilitado usa `--surface-2` + `--text-disabled`; atualizando segue D11; destaque do donut usa contorno; despesas pagas e faturas pagas não são "apagadas".
3. **Transparência só em**: `--scrim`, `--header-bg` (0.95) e sombras (`--shadow-color`). Conteúdo de diálogos sempre sobre `--surface` opaco.
4. **Sobreposição**: elementos fixos/sticky (navbar, **faixa de abas**, cabeçalho de tabela, toolbar de seleção, barra de seleção mobile, rodapé do drawer) têm fundo opaco (ou `--header-bg`) e reservam espaço, para que nenhum texto ou botão fique por cima de outro conteúdo. O cabeçalho sticky da tabela gruda **abaixo** da faixa de abas, não abaixo da navbar.
5. **Controles nativos**: herdam o tema por `color-scheme` e recebem tokens explícitos: `input`/`select`/`textarea` com `--input-bg`, `--text`, `--border-strong`; `option` com `--surface`/`--text`; placeholder `--text-muted` com opacidade 1; autofill forçado para `--input-bg`/`--text`; date/month picker segue `color-scheme`; `scrollbar-color` com `--scrollbar-*` em toda região rolável; `::selection` com `--surface-active`/`--text`.
6. **Recharts**: `fill`/`stroke` sempre de `var(--token)`; tooltip e legenda próprios; sem rótulos padrão da lib; `cursor` com `--chart-cursor`.
7. **Profundidade (rev. 5)**: todo `--surface` apoiado diretamente em `--bg` (cards do resumo e do dashboard, cards de lista, tabela, blocos de fatura, cards de `/cards`, gráficos) usa borda 1px (`--border`, ou `--border-strong` nos blocos de ação) **e** `--shadow-card`. A sombra é reforço: a separação nunca depende só dela (o contorno continua). Não se aplica a elementos dentro de cartões (faixa de subtotal, painel de novo cartão, linhas) nem a diálogos sobre o scrim. Sombra não muda no hover nem no tema durante a troca (troca instantânea, CA87).

### 1.4 Semântica de cor

| Conceito | Cor | Sinal não cromático (obrigatório) |
|---|---|---|
| Despesa PENDENTE | `--warning` / `--warning-text` | Ícone relógio + "Pendente"; hachura no gráfico |
| Despesa PAGO | `--success` / `--success-text` | Ícone check + "Pago" |
| Receita RECEBIDA | `--income` | Ícone seta-para-dentro + "Recebida" |
| Tipo Receita / Despesa (drawer, resumo) | `--income` / `--expense` | Ícone de seta + texto |
| Fatura sem pendências | `--success-text` | Ícone check + "Fatura paga" (descreve o botão desabilitado) |
| Saldo positivo / negativo / zerado | `--success-text` / `--danger-text` / `--text-muted` | Seta para cima + "Positivo" / sinal "-" + seta para baixo + "Negativo" / "=" + "Zerado" |
| Forma PIX / Cartão | sem cor (`--text-muted`) | Texto "PIX" ou nome do cartão |
| Erro | `--danger` / `--danger-text` | Ícone de alerta + mensagem |
| Saldo realizado x previsto (gráfico) | `--chart-balance-realized` x `--chart-balance-projected` | Linha contínua + círculo cheio x tracejada + losango vazado |

Valores monetários sempre em `--text`; a cor fica no rótulo/indicador ao lado.

### 1.5 Tipografia

| Uso | Fonte | Tamanho/peso |
|---|---|---|
| Título de página (`h1`) | Space Grotesk | 24 mobile / 32 >= `md`, 700 |
| Título de bloco / painel de aba (`h2`) | Space Grotesk | 20, 600 |
| Nome do cartão no bloco de fatura (`h3`) | Space Grotesk | 18, 600 |
| Valor grande (resumo >= `md`, dashboard) | Space Grotesk, `tabular-nums` | 32 / 24 / 20 conforme a largura do card (consulta de contêiner) |
| Valor no resumo compacto (< `md`) e totais do bloco de fatura | Space Grotesk, `tabular-nums` | 16-18, 600 |
| Valor secundário (pago, pendente, previsto) | Space Grotesk, `tabular-nums` | 16-20, 600 |
| Abas | Inter | 16, 500 (inativa) / 600 (ativa) |
| Corpo, células, inputs | Inter | inputs 16 (evita zoom no iOS); células 14 |
| Rótulos, metadados, subtotal | Inter | 12-14, 500, `--text-muted` (valores do subtotal em `--text`) |
| Valores na tabela/cards de lista | JetBrains Mono, `tabular-nums` | 14 desktop / 16 mobile, à direita |

Valores nunca são truncados. Se não couberem, quebram só entre "R$" (com sinal) e os dígitos.

### 1.6 Grid e container

- Container: máx. 1280px; padding lateral 16 / 24 (`md`) / 32 (`lg`).
- Grid: 4 colunas (< `md`), 8 (`md`), 12 (>= `lg`); gap 16 / 16 / 24.
- Espaçamento vertical entre blocos: 16 mobile, 24 >= `md`.

### 1.7 Formatação pt-BR

| Dado | Origem | Exibição | Regra |
|---|---|---|---|
| Valor | `"1234.56"` | `R$ 1.234,56` | Formatação por string; NBSP após `R$`; nunca `Number` |
| Saldo negativo | `"-150.00"` | `-R$ 150,00` | Sinal antes do `R$` (CA67) |
| Zero | `"0.00"` | `R$ 0,00` | Saldo zero: "Zerado" (nunca `-R$ 0,00`) |
| Soma dos selecionados | strings | `R$ 150,00` | Centavos inteiros (`BigInt`) |
| Data civil (lançamento, fechamento, vencimento) | `"2026-11-05"` | `05/11/2026` | Split de string, sem fuso (CA23) |
| Instante (`paidAt`) | ISO UTC | `24/10/2026 às 10:00` | `Intl.DateTimeFormat` com `America/Sao_Paulo` |
| Mês por extenso (seletor, títulos, confirmação) | `"2026-11"` | `novembro de 2026` | Tabela fixa |
| Mês abreviado (faixa de abas, eixo, chip, toast) | `"2026-11"` | `nov/26` | P17 |
| Chip de fatura na lista | mês de referência != mês da data | `Fatura nov/26` | Só quando difere (RF20); texto acessível "Fatura de novembro de 2026" |
| Datas do bloco de fatura | datas da fatura (RF09) | `Fecha 25/10/2026 · Vence 05/11/2026` | `dd/MM/yyyy` |
| Dias do cartão (`/cards`) | `25`, `5` | `Fecha dia 25 · Vence dia 5` | |
| Percentual | `"75.00"` / `"33.33"` | `75%` / `33,33%` | |
| Contagem | 1 / 3 | `1 despesa` / `3 despesas`; `1 receita`; `1 fatura` | Plural explícito |
| Ticks do eixo Y | escala | `R$ 0`, `R$ 1,5 mil`, `-R$ 500` | Só nos ticks gerados |

### 1.8 Estados dos controles (mesma regra nos dois temas)

| Controle | Padrão | Hover | Pressionado | Foco | Carregando | Desabilitado |
|---|---|---|---|---|---|---|
| Botão primário | fundo `--primary-strong`, texto `--on-primary`, borda `--primary-border` | `--primary-strong-hover` | `--primary-strong-active` | + `--focus-ring` | spinner + texto `--on-primary` ("Salvando…"), `aria-disabled` | fundo `--surface-2`, texto/ícone `--text-disabled`, borda `--border-strong` |
| Botão secundário | transparente, texto `--text`, borda `--border-strong` | `--surface-2` | `--surface-active` | + `--focus-ring` | spinner `--text` | igual ao primário desabilitado |
| Terciário / link | texto `--accent` | `--surface-2` + sublinhado | `--surface-active` + texto `--accent-active` (rev. 4) | + `--focus-ring` | spinner `--accent` | `--text-disabled`, sem sublinhado |
| Botão ícone (inclui sol/lua) | ícone `--text` | `--surface-2` | `--surface-active` | + `--focus-ring` | - | ícone `--text-disabled` |
| Input / select / combobox | `--input-bg`, `--text`, borda `--border-strong` | borda `--text-muted` | - | + `--focus-ring` | - | `--surface-2`, `--text-disabled`, borda tracejada + cadeado + ajuda |
| Input com erro | borda `--danger` 2px, mensagem `--danger-text` | idem | - | + `--focus-ring` | - | - |
| Checkbox | caixa `--input-bg`, borda `--border-strong` | `--surface-2` | - | + `--focus-ring` | - | `--surface-2`, borda `--text-disabled` tracejada |
| Checkbox marcado / indeterminado | `--primary-strong`, borda `--primary-border`, marca `--on-primary` | `--primary-strong-hover` | - | + `--focus-ring` | - | - |
| Segmented control | contêiner borda `--border-strong`; inativo `--text-muted` | inativo `--surface-2` + `--text` | `--surface-active` | + `--focus-ring` | - | `--text-disabled` |
| Segmento selecionado | `--primary-strong`, `--on-primary`, borda `--primary-border` | hover do primário | ativo do primário | + `--focus-ring` | - | - |
| **Aba (>= `md`)** | texto `--text-muted` 500, sem fundo, sobre `--bg` | fundo `--surface-2`, texto `--text` | `--surface-active` | + `--focus-ring` (anel completo, não só sublinhado) | - | (não ocorre) |
| **Aba ativa (>= `md`)** | texto `--text` 600 + indicador 3px `--accent` na base | fundo `--surface-2` | - | + `--focus-ring` | - | - |
| **Aba (< `md`)** | = segmented control (inativa) / segmento selecionado (ativa) | idem | idem | idem | - | - |
| **Disclosure da fatura** | terciário com chevron (`--accent`) | idem terciário | idem | + `--focus-ring` | spinner `--accent` ("Carregando despesas…") | - |
| Item de navegação | inativo `--text-muted`; ativo `--text` + sublinhado 2px `--accent` | `--text` | - | + `--focus-ring` | - | - |
| Linha da tabela | `--surface` | `--surface-2` | - | - | - | - |
| Linha selecionada | `--surface-2` + barra 2px `--accent` à esquerda | idem | - | - | - | - |
| Linha/card recém-criado (rev. 4) | `--surface-2` + contorno interno 2px `--accent` + selo "Novo" | idem | - | - | - | - |
| Opção do combobox (rev. 4) | `--surface`, texto `--text`, 44px | `--surface-2` | - | ativa (`aria-activedescendant`) `--surface-active` | - | - |

O indicador da aba (3px) é mais espesso que o da navbar (2px) e fica sobre a linha `--border` da faixa, para que navbar e abas não se confundam. A aba ativa nunca depende só do indicador: muda também peso e cor do texto, e `aria-selected="true"`.

**Atualizando (D11)** - em resumo, conteúdo das abas, blocos de fatura, cartões e blocos do dashboard: cores normais; barra de progresso 2px `--accent` no topo da região (estática com movimento reduzido); "Atualizando…" `--text-muted` no cabeçalho da região; `aria-busy="true"`; ações da região ignoram novos acionamentos sem mudar de cor; filtros e abas continuam utilizáveis.

**Carregando em qualquer botão (rev. 4, implementado):** `aria-busy="true"` mantém as cores da variante (fundo, texto e borda do estado padrão; só o desabilitado "puro" esmaece), sem efeito de hover (sublinhado do terciário e fundo de hover do primário são suprimidos) e com `cursor: progress`. Isso garante texto >= 4,5:1 em CA83.

### 1.9 Tabela de contraste por tema

Razões WCAG 2.x (luminância relativa sRGB), **arredondadas para baixo** na 2a casa; valores da rev. 5. **T** = texto normal 4,5:1; **C** = componente, ícone, texto grande, borda de controle, anel de foco, indicador de aba, série de gráfico e **desabilitado** 3:1; **D** = decorativo. Cores com alfa são compostas em sRGB sobre o fundo indicado. Matriz inicial do teste de pares de contraste (ADR, tema); o teste recalcula a partir de `tokens.css`.

**Resultado da conferência da rev. 5: nenhum par T fica abaixo de 4,5:1 e nenhum par C abaixo de 3:1; nenhum token semântico ou de série precisou de ajuste.** Margens mais justas (monitorar se algum valor mudar): `--border-strong` sobre `--surface-active` no escuro (3,03), `--text-muted` sobre `--surface-active` no escuro (4,60), `--accent` sobre `--bg` no claro (4,72), `--danger` sobre `--surface-2` no claro (4,46, par C). `--accent` sobre `--surface-active` no claro tem 4,35 e por isso **não** é usado como texto nesse fundo (usa-se `--accent-active`, 5,10).

**Texto sobre superfícies**

| Frente | Fundo | Min. | Claro | Escuro |
|---|---|---|---|---|
| `--text` | `--bg` | T | 12,91 | 13,91 |
| `--text` | `--surface` | T | 14,62 | 12,70 |
| `--text` | `--surface-2` | T | 13,51 | 11,14 |
| `--text` | `--surface-active` | T | 11,89 | 9,22 |
| `--text` | `--header-bg` composto (pior caso: preto por baixo no claro, branco no escuro) | T | 13,09 | 10,99 |
| `--text` | `--input-bg` | T | 14,62 | 13,91 |
| `--text-muted` | `--bg` | T | 6,63 | 6,95 |
| `--text-muted` | `--surface` | T | 7,51 | 6,34 |
| `--text-muted` | `--surface-2` | T | 6,94 | 5,56 |
| `--text-muted` | `--surface-active` | T | 6,11 | 4,60 |
| `--text-muted` | `--header-bg` composto | T | 6,72 | 5,49 |
| `--text-muted` (placeholder) | `--input-bg` | T | 7,51 | 6,95 |
| `--accent` | `--surface` | T | 5,35 | 8,06 |
| `--accent` | `--bg` | T | 4,72 | 8,82 |
| `--accent` | `--surface-2` | T | 4,94 | 7,06 |
| `--accent` | `--header-bg` composto | T | 4,79 | 6,97 |
| `--accent` (referência; não usar como texto no claro) | `--surface-active` | - | 4,35 | 5,85 |
| `--accent-active` | `--surface-active` | T | 5,10 | 5,85 |
| `--on-primary` | `--primary-strong` / `-hover` / `-active` | T | 6,28 / 7,90 / 9,93 | 6,28 / 7,90 / 9,93 |
| `--success-text` | `--surface` / `--surface-2` / `--bg` | T | 5,48 / 5,06 / 4,84 | 8,19 / 7,19 / 8,97 |
| `--warning-text` | `--surface` / `--surface-2` / `--bg` | T | 7,09 / 6,54 / 6,25 | 9,44 / 8,28 / 10,33 |
| `--danger-text` | `--surface` / `--surface-2` / `--bg` | T | 6,46 / 5,97 / 5,71 | 5,69 / 4,99 / 6,24 |
| `--income` | `--surface` / `--surface-2` / `--bg` | T | 6,70 / 6,19 / 5,91 | 6,19 / 5,43 / 6,78 |
| `--expense` | `--surface` / `--surface-2` / `--bg` | T | 6,28 / 5,80 / 5,54 | 5,85 / 5,13 / 6,41 |

**Desabilitado (texto e ícone)**

| Frente | Fundo | Min. | Claro | Escuro |
|---|---|---|---|---|
| `--text-disabled` | `--surface-2` (botão/campo desabilitado; "Pagar fatura" desabilitado; "Salvar lançamento" com painel de cartão aberto) | C | 4,04 | 3,66 |
| `--text-disabled` | `--surface` | C | 4,38 | 4,18 |
| `--text-disabled` | `--bg` | C | 3,87 | 4,58 |

**Componentes, bordas, foco e profundidade**

| Frente | Fundo | Min. | Claro | Escuro |
|---|---|---|---|---|
| `--border-strong` | `--surface` / `--bg` / `--surface-2` / `--surface-active` | C | 4,38 / 3,87 / 4,04 / 3,56 | 4,18 / 4,58 / 3,66 / 3,03 |
| `--border-strong` | `--input-bg` | C | 4,38 | 4,58 |
| `--primary-border` | `--surface` / `--bg` / `--surface-2` | C | 6,28 / 5,54 / 5,80 | 5,28 / 5,78 / 4,63 |
| `--primary-strong` (preenchimento, referência) | `--surface` | D (coberto pela borda) | 6,28 | 2,50 |
| `--focus-color` | `--surface` / `--bg` / `--surface-2` | C | 5,35 / 4,72 / 4,94 | 8,06 / 8,82 / 7,06 |
| `--danger` | `--surface` / `--input-bg` / `--surface-2` | C | 4,82 / 4,82 / 4,46 | 5,69 / 6,24 / 4,99 |
| `--accent` (barra de linha selecionada, progresso) | `--surface-2` | C | 4,94 | 7,06 |
| `--success` | `--surface` / `--surface-2` / `--bg` | C | 3,76 / 3,48 / 3,32 | 8,19 / 7,19 / 8,97 |
| `--warning` | `--surface` / `--surface-2` / `--bg` | C | 5,02 / 4,63 / 4,43 | 9,44 / 8,28 / 10,33 |
| `--surface` (drawer/modal) | `--scrim` composto sobre `--bg` | C | 3,24 | (borda) |
| `--border-strong` (drawer/modal) | `--scrim` composto sobre `--bg` | C | (fundo) | 5,07 |
| `--scrollbar-thumb` | `--scrollbar-track` | C | 4,04 | 3,66 |
| `--surface` (cartão) | `--bg` | D (+ `--border` + `--shadow-card`) | 1,13 | 1,09 |
| `--border` / `--skeleton` | `--surface` | D | 1,35 / 1,22 | 1,31 / 1,37 |

**Pares da rev. 3 (abas, subtotal, blocos de fatura, painel de novo cartão)** - todos com tokens existentes; entram na matriz de teste com o contexto indicado.

| Elemento | Frente | Fundo | Min. | Claro | Escuro |
|---|---|---|---|---|---|
| Aba inativa (>= `md`) | `--text-muted` | `--bg` (faixa de abas) | T | 6,63 | 6,95 |
| Aba ativa (>= `md`) | `--text` | `--bg` | T | 12,91 | 13,91 |
| Aba em hover | `--text` | `--surface-2` | T | 13,51 | 11,14 |
| Aba pressionada | `--text` | `--surface-active` | T | 11,89 | 9,22 |
| Indicador da aba ativa | `--accent` | `--bg` | C | 4,72 | 8,82 |
| Indicador da aba ativa em hover | `--accent` | `--surface-2` | C | 4,94 | 7,06 |
| Foco da aba | `--focus-color` | `--bg` | C | 4,72 | 8,82 |
| Abas no mobile (segmented) | contêiner `--border-strong` / segmento ativo `--primary-border` / `--on-primary` | `--bg` / `--bg` / `--primary-strong` | C / C / T | 3,87 / 5,54 / 6,28 | 4,58 / 5,78 / 6,28 |
| Mês compacto na faixa | `--text` / setas `--text` | `--bg` | T / C | 12,91 | 13,91 |
| Faixa de subtotal: rótulos | `--text-muted` | `--surface-2` | T | 6,94 | 5,56 |
| Faixa de subtotal: valores | `--text` | `--surface-2` | T | 13,51 | 11,14 |
| Bloco de fatura: contorno | `--border-strong` | `--bg` | C | 3,87 | 4,58 |
| Bloco de fatura: datas e rótulos | `--text-muted` | `--surface` | T | 7,51 | 6,34 |
| Bloco de fatura: "Fatura paga" | `--success-text` | `--surface` | T | 5,48 | 8,19 |
| Bloco de fatura: disclosure | `--accent` | `--surface` | T | 5,35 | 8,06 |
| Bloco de fatura: "Pagar fatura" desabilitado | `--text-disabled` | `--surface-2` | C | 4,04 | 3,66 |
| Lista expandida: divisórias | `--border` | `--surface` | D | 1,35 | 1,31 |
| Painel de novo cartão: contorno | `--border-strong` | `--surface` (drawer) | C | 4,38 | 4,18 |
| Painel: rótulos / ajuda | `--text` / `--text-muted` | `--surface-2` | T | 13,51 / 6,94 | 11,14 / 5,56 |
| Painel: borda dos inputs | `--border-strong` | `--surface-2` (em volta do input) | C | 4,04 | 3,66 |
| Painel: erro 409 | `--danger-text` / borda `--danger` | `--surface-2` / `--input-bg` | T / C | 5,97 / 4,82 | 4,99 / 6,24 |
| Painel: foco | `--focus-color` | `--surface-2` | C | 4,94 | 7,06 |
| Painel: "Criar cartão" (primário) | `--primary-border` | `--surface-2` | C | 5,80 | 4,63 |
| Status inicial / aviso PIX futuro | `--text-muted` | `--surface` | T | 7,51 | 6,34 |

**Gráficos** (séries contra `--surface`; marcadores contra `--tooltip-bg`). Séries sem mudança de valor (exceto `--chart-1` e `--chart-6` no escuro, que acompanham `--accent` e `--text-muted`).

| Frente | Fundo | Min. | Claro | Escuro |
|---|---|---|---|---|
| `--chart-income` / `-paid` / `-pending` | `--surface` | C | 6,70 / 3,76 / 5,02 | 6,19 / 8,19 / 9,44 |
| `--chart-balance-realized` / `-projected` | `--surface` | C | 7,10 / 6,03 | 5,79 / 5,95 |
| `--chart-zero-line` | `--surface` | C | 7,51 | 6,34 |
| `--chart-axis` (12px) | `--surface` | T | 7,51 | 6,34 |
| `--chart-1` .. `--chart-6` | `--surface` | C | 5,35 / 6,28 / 6,03 / 4,99 / 5,17 / 4,75 | 8,06 / 5,28 / 5,95 / 10,45 / 6,96 / 6,34 |
| Marcadores income / paid / pending / realized / projected | `--tooltip-bg` | C | 6,70 / 3,76 / 5,02 / 7,10 / 6,03 | 5,43 / 7,19 / 8,28 / 5,07 / 5,21 |
| `--text` / `--text-muted` no tooltip | `--tooltip-bg` | T | 14,62 / 7,51 | 11,14 / 5,56 |
| `--tooltip-border` | `--surface` / `--tooltip-bg` | C | 4,38 / 4,38 | 4,18 / 3,66 |
| `--chart-grid` / `--chart-cursor` | `--surface` | D | 1,35 / 1,13 | 1,46 / 1,14 |

Observações:
- Séries adjacentes (pago x pendente; fatias do donut) não têm 3:1 entre si; a distinção vem de separação 2px `--surface`, hachura, legenda, tooltip e tabela. Linhas de saldo têm halo 4px `--surface`.
- No escuro, `--primary-strong` sozinho tem 2,50:1 contra `--surface` (era 2,81 com o fundo antigo, mais escuro); a borda `--primary-border` é obrigatória em tudo que usa esse preenchimento (inclui a aba ativa no mobile).
- O bloco de fatura é contornado por `--border-strong` (e não `--border`) porque é um bloco de ação com botão próprio; os cards do resumo continuam com `--border` decorativa. Ambos levam `--shadow-card` (1.3, regra 7).
- No escuro, a sombra `--shadow-card` (preto 30%) sobre `--bg` `#151B26` é perceptível porque o fundo deixou de ser quase-preto; no claro, a sombra é de ardósia 6% e funciona junto com o degrau `--bg` -> `--surface`.
- Rev. 4, sem tokens novos (valores da rev. 5): destaque de recém-criado (`--accent` sobre `--surface-2` 4,94 / 7,06; selo `--text-muted` sobre `--surface-2` 6,94 / 5,56); opção ativa do combobox (`--text` sobre `--surface-active` 11,89 / 9,22); lista do combobox (`--border-strong` sobre `--surface` 4,38 / 4,18); item ativo da legenda do donut (`--text` sobre `--surface-2` 13,51 / 11,14, anel `--text` sobre `--surface` 14,62 / 12,70).

---

## 2. Shell da aplicação

### 2.1 Navbar (todas as telas, inclusive loading/erro)

- Fixa no topo, fundo `--header-bg` + blur 12px, borda inferior `--border`.
- Itens: marca (link para `/entries`) | **Lançamentos** (`/entries`), **Dashboard** (`/dashboard`), **Cartões** (`/cards`) | botão de tema (último, à direita). "Lançamentos" é o rótulo da tela com abas (P36).
- Item ativo: `--text`, sublinhado 2px `--accent`, `aria-current="page"`. Inativo `--text-muted`. Alvo mínimo 44px. `nav aria-label="Principal"`. "Pular para o conteúdo" como primeiro focável (salta para o `h1`).

```
>= sm (uma linha, 56 / 64 >= md)
+------------------------------------------------------------------+
| [marca] Finanças      Lançamentos  Dashboard  Cartões      [sol] |
+------------------------------------------------------------------+

< sm (duas linhas)
+----------------------------------+
| [marca]                    [sol] |  linha 1, 56px, fixa
+----------------------------------+
| Lançamentos | Dashboard | Cartões|  linha 2, 44px, rola com a página
+----------------------------------+
```

- Abaixo de `sm`, só a linha 1 é fixa. A faixa de abas da tela de lançamentos (D16) gruda abaixo da linha 1.

### 2.2 Alternador de tema (ThemeToggle)

- `IconButton` 44x44. Ícone **sol** com tema escuro ativo; **lua** com claro (P29). Ambos no DOM, visibilidade por CSS (ícone certo no primeiro quadro, CA81).
- `aria-label` fixo "Tema escuro"; `aria-pressed` true/false; ícones `aria-hidden`. Tooltip visual "Tema escuro: ativado/desativado".
- Clique, `Enter`, `Espaço` alternam; foco permanece no botão (CA78). Sem toast.
- Com drawer/modal aberto o botão fica inerte sob o scrim; a troca só ocorre por mudança do sistema (sem preferência salva), sem perder estado (CA84). Com preferência salva, o tema não muda enquanto houver diálogo aberto. Isso diverge da letra de RF27/CA84: ver seção 12, desvio 2 (**aprovado**, B1 da spec de fechamento).

### 2.3 Região de toasts

- Desktop: canto inferior direito, até 3. Mobile: topo, abaixo da linha 1 da navbar e da faixa de abas (o rodapé é da barra de seleção).
- Fundo `--surface-2`, borda 1px `--border-strong`, borda esquerda 3px (`--success` / `--danger` / `--accent`), ícone `*-text`, texto `--text` 14, fechar 44x44, ação opcional (link `--accent`).
- `role="status"` (sucesso/info) e `role="alert"` (erro). 5s; 8s com ação; erros não somem sozinhos; pausa com hover/foco.
- Com drawer/modal aberto, feedback é **inline no diálogo**; o toast só sai depois que ele fecha (vale para o painel de novo cartão: confirmação inline, ver 3.9.3).

---

## 3. Tela de lançamentos (`/entries`)

### 3.1 Hierarquia de informação

> **Superado em parte (2026-10-30):** o mês inicial do seletor (CA61) é resolvido pela regra de pendências, e pode exibir antes do cabeçalho o aviso de avanço de mês. Na aba Faturas, o painel ganha o filtro de status. Ver `docs/design/listagem-mes-e-status-padrao.md`, seções 1 e 4.

1. **Cabeçalho comum** (igual em todas as abas, D16):
   1. "Lançamentos" (`h1`) + **"+ Novo lançamento"** (ação principal).
   2. **Seletor de mês** (padrão: mês atual em SP, CA61).
   3. **Resumo do mês inteiro** (RF10, DR6): Receitas; Despesas total/pago/pendente; Saldo realizado e previsto com indicador. Nunca muda com aba, filtros ou página (CA47).
2. **Faixa de abas**: Despesas (padrão) | Faturas | Receitas.
3. **Painel da aba ativa**:
   - Despesas: filtros -> subtotal -> toolbar de seleção -> lista -> paginação.
   - Faturas: título com contagem -> blocos por cartão (ordem de vencimento).
   - Receitas: filtro de categoria -> subtotal -> lista -> paginação.

Racional: primeiro "em que mês estou e como ele está" (resumo), depois "o que quero ver" (aba), depois "o que estou vendo soma quanto" (subtotal), por fim a ação sobre itens. O resumo vem antes das abas porque é a resposta à pergunta principal do produto (saldo do mês) e não depende de aba.

### 3.2 Layout por breakpoint

**< `md` (4 colunas)**

```
+----------------------------------+
| [marca]                    [sol] |  fixo
| Lançamentos | Dashboard | Cartões|
+----------------------------------+
| Lançamentos                      |  h1
| [ + Novo lançamento        ]     |  48px, largura total
| [<]   outubro de 2026   [>]      |  MonthPicker
| [Mês atual]                      |  só se não for o mês corrente
|                                  |
| +------------------------------+ |  resumo compacto (D20)
| | ↙ Receitas       R$ 5.000,00 | |
| | ↗ Despesas       R$ 5.500,00 | |
| |   ● Pago 3.000,00 ● Pend. 2.500,00
| | Saldo realizado  R$ 2.000,00 | |
| |                  ▲ Positivo  | |
| | Saldo previsto  -R$ 500,00   | |
| |                  ▼ Negativo  | |
| +------------------------------+ |
+----------------------------------+
| [Despesas][ Faturas ][Receitas]  |  faixa de abas (sticky abaixo da linha 1)
+----------------------------------+
| Despesas de outubro de 2026      |  h2 do painel
| [ Filtros (1) ]   [Limpar]       |  abre a folha (D6)
| Subtotal · com os filtros        |  faixa de subtotal (D21)
| 12 despesas · R$ 1.200,00        |
| Pago R$ 700,00 · Pend. R$ 500,00 |
| [ ] Selecionar pendentes (5)     |
| +------------------------------+ |
| | [ ] Mercado         PENDENTE | |
| |     Alimentação · 15/10/2026 | |
| |     Nubank · [Fatura nov/26] | |
| |                  R$ 250,00   | |
| | [    Marcar como pago      ] | |
| +------------------------------+ |
| [< Anterior] Pág. 1 de 3 [Próx >]|
+----------------------------------+
| 3 selecionados · R$ 150,00       |  barra fixa, só com seleção
| [Limpar]   [Marcar como pago]    |
+----------------------------------+
```

- Resumo compacto (D20): um card `--surface`, borda `--border`, linhas de 2 colunas (rótulo à esquerda, valor à direita). A linha "Pago · Pendente" fica sob Despesas em 14px; os indicadores de saldo quebram para baixo do valor quando não cabem ao lado. Valores 16-18px. Ícones de tipo antes de Receitas/Despesas. Altura ~170px.
- Faixa de abas: segmented de 3 colunas iguais (D18), altura 52 (alvo 44 + respiro), fundo `--bg` opaco, borda inferior `--border`. Gruda abaixo da linha 1 da navbar (56px). Se o texto não couber (zoom 200%, fonte grande), a faixa vira rolagem horizontal com scrollbar tematizada e a aba ativa rolada para a vista; nunca trunca rótulos.
- "+ Novo lançamento" não aparece na faixa fixa no mobile (a faixa é só das abas); para acessá-lo após rolar, o usuário sobe a página. O rodapé é reservado à barra de seleção (D9).
- Barra de seleção fixa: fundo `--surface-2` opaco, borda superior `--border-strong`, safe-area; a lista ganha espaço inferior equivalente.

**`md` a `lg` (8 colunas)**

```
+--------------------------------------------------------------+
| Lançamentos                              [ + Novo lançamento ]|
| [<] outubro de 2026 [>]   [Mês atual]                         |
| +-----------------+ +-----------------+ +------------------+  |
| | Receitas        | | Despesas        | | Saldo            |  |  3 cards (D10)
| | R$ 5.000,00     | | R$ 5.500,00     | | Realizado ...    |  |
| |                 | | ● Pago ● Pend.  | | Previsto  ...    |  |
| +-----------------+ +-----------------+ +------------------+  |
+--------------------------------------------------------------+
| [<] out/26 [>] |  Despesas   Faturas   Receitas  |  [+ Novo]  |  faixa sticky
|                   ‾‾‾‾‾‾‾‾                                    |
+--------------------------------------------------------------+
| Despesas de outubro de 2026                  Atualizando…     |
| Status [Todos|Pendente|Pago]  Categoria [v]  Cartão [v] Limpar|
| Subtotal (com os filtros): 12 despesas · Total R$ 1.200,00 ·  |
|   Pago R$ 700,00 · Pendente R$ 500,00                         |
| 3 selecionados · R$ 150,00            [ Marcar como pago (3) ]|
| +----------------------------------------------------------+ |
| |[ ] Descrição           Data       Valor     Status  Ação  | |
| |[ ] Mercado             15/10/2026 250,00    PEND.   Pagar | |
| |    Alimentação · Nubank · Fatura nov/26                  | |
| +----------------------------------------------------------+ |
| Mostrando 1-20 de 45 despesas      [<] 1 2 3 [>]              |
+--------------------------------------------------------------+
```

- Faixa de abas (D16): à esquerda, mês compacto `[<] out/26 [>]` (setas 44x44 com rótulos "Mês anterior"/"Próximo mês"; o texto do mês não abre a grade, só informa) **visível apenas quando o seletor do cabeçalho saiu da tela**; no centro, abas sublinhadas; à direita, "+ Novo lançamento" secundário, também só quando o botão do cabeçalho saiu da tela. Assim não há controles duplicados visíveis ao mesmo tempo. A faixa tem 56px, fundo `--bg`, borda inferior `--border`.
- Filtros inline em uma ou duas linhas.
- Na tabela, Descrição tem duas linhas: (1) descrição; (2) categoria · forma · chip de fatura em `--text-muted` 12px.

**>= `lg` (12 colunas)**

- Título, seletor de mês e "+ Novo lançamento" na mesma linha (seletor ao centro-direita, botão à direita).
- Resumo: 3 cards de 4 colunas.
- Faixa de abas como em `md`.
- Tabela Despesas: checkbox | Descrição (categoria na 2a linha) | Forma | Data | Valor | Status | Ação. `xl`: Categoria ganha coluna própria.
- Tabela Receitas: Descrição | Categoria | Data | Valor | Status.

### 3.3 Cabeçalho comum

> **Superado em parte (2026-10-30):** "Padrão: mês atual em America/Sao_Paulo (CA61)" vale como mês M do dashboard e de links com `month` explícito. Em `/entries` e `/demo/entries` sem `month`, o mês é o resolvido pela API (regra de mês inicial). Ver `docs/design/listagem-mes-e-status-padrao.md`, seções 4 e 9.

**Seletor de mês (`MonthPicker`)**
- Anterior/próximo (44x44, "Mês anterior"/"Próximo mês") + botão central com o mês por extenso que abre uma grade de 12 meses com navegação de ano; mês corrente marcado com ponto `--accent` na grade.
- Padrão: mês atual em America/Sao_Paulo (CA61). "Mês atual" (terciário) só quando o selecionado não é o corrente.
- Não existe controle de intervalo nem "Todos os períodos" (B6, CA68).
- Trocar o mês (D19): mantém a aba e os filtros, página 1, seleção limpa, blocos de fatura recolhidos; resumo e painel entram em "Atualizando" (D11); anúncio `aria-live="polite"`: "Mostrando outubro de 2026, aba Despesas".
- Mês inválido na URL: usa o mês atual e mostra toast "Mês inválido na URL. Mostrando o mês atual."

**Resumo do mês (`MonthSummary`, RF10, D10/D20)**

| Grupo | Conteúdo |
|---|---|
| **Receitas** | Ícone de tipo Receita (`--income`) + valor. |
| **Despesas** | Ícone de tipo Despesa (`--expense`) + total; abaixo: indicador `--success` + "Pago" + valor; indicador `--warning` + "Pendente" + valor. |
| **Saldo** | "Realizado" + valor + `SignIndicator`; "Previsto" + valor + `SignIndicator`. Ajuda 12px `--text-muted` (>= `md`): "receitas − despesas pagas" / "receitas − todas as despesas". No compacto, a ajuda vira `title`/texto acessível. |

- Título acessível do grupo (`h2` visualmente oculto no mobile, visível 14px `--text-muted` em >= `md`): "Resumo de outubro de 2026". Semântica `<dl>`; leitura "Saldo previsto, menos R$ 500,00, negativo".
- Sem nota "fora do filtro de tipo" (o filtro de tipo deixou de existir).
- Mês sem lançamentos: tudo R$ 0,00, saldos "Zerado", linha `--text-muted` "Sem lançamentos neste mês".
- O resumo carrega, atualiza e falha **independentemente** do painel da aba (RF24): ver 3.12.

### 3.4 Abas

- `role="tablist"`, `aria-label="Lançamentos do mês"`. Cada aba é um link para a URL da aba (mês e filtros preservados, D19) com `role="tab"`, `aria-selected`, `aria-controls`; tabindex móvel (só a ativa no Tab). Setas esquerda/direita movem o foco, `Home`/`End` vão às pontas, `Enter`/`Espaço` ativam (D18). Após a navegação, o foco permanece na aba ativada.
- Painel: `role="tabpanel"`, `aria-labelledby` na aba, com `h2` visível: "Despesas de outubro de 2026" / "Faturas de outubro de 2026" / "Receitas de outubro de 2026".
- Sem contadores nas abas (exigiriam três buscas a cada mês; o resumo já mostra os totais).
- Trocar de aba: resumo e cabeçalho não mudam nem piscam (CA69); só o painel entra em "Atualizando" (ou skeleton do painel na primeira visita à aba); seleção limpa (P11); página 1 na aba destino (P34).
- Aba inválida na URL: abre Despesas.

### 3.5 Estado na URL (D19)

> **Superado em parte (2026-10-30):** a aba Faturas tem filtro de status em `f_status` (`PENDING`, `PAID`, `ALL`), independente de `d_status`; `d_status` também aceita `ALL`. `PENDING` é o padrão e não é escrito na URL. Ver `docs/design/listagem-mes-e-status-padrao.md`, seção 3.1, e ADR 0007, seção 7.1.

Conceitos guardados na URL (nomes finais de parâmetros a cargo do frontend/ADR; sugestão entre parênteses):
- Mês selecionado (`month=YYYY-MM`) e aba ativa (`tab=expenses|invoices|income`; ausente = Despesas).
- Filtros da aba Despesas, com prefixo próprio: status, categoria, cartão (um cartão ou "PIX") (ex.: `d_status`, `d_category`, `d_card`).
- Filtro da aba Receitas, com prefixo próprio: categoria (ex.: `r_category`).
- Página da aba ativa (`page`), descartada ao trocar de aba, de mês ou de filtro.
- A aba Faturas não tem filtros; blocos expandidos **não** vão para a URL.
- Voltar/avançar do navegador restaura mês, aba, filtros e página.

### 3.6 Aba Despesas (RF20)

> **Superado em parte (2026-10-30):** (a) sem status na URL vale "Pendente", e não "Todos"; (b) "Limpar filtros" leva a "Todos" e fica visível também sob o padrão "Pendente", e não só "quando algo difere do padrão"; (c) o contador "Filtros (n)" conta o "Pendente" padrão; (d) abaixo de `md` aparece "Status: <status ativo>" fora da folha. O texto "Abaixo de 400px, na folha, vira select" não é implementado no código. Ver `docs/design/listagem-mes-e-status-padrao.md`, seções 3 e 5.1.

**Filtros**

| Filtro | Controle | Comportamento |
|---|---|---|
| Status | Segmented "Todos / Pendente / Pago" | Sem "Recebida". Abaixo de 400px, na folha, vira select. |
| Categoria | Select "Todas as categorias" + categorias (RF14); combobox com busca acima de 10 itens | Categoria da URL ausente da lista continua selecionada. |
| Cartão | Select: "Todos" (padrão), "PIX", separador, cartões por nome (RF02) | "PIX" = despesas sem cartão (CA55). Id da URL sem cartão correspondente: "Cartão não encontrado" selecionado, resultado vazio (P19). |
| Limpar filtros | Terciário | Volta a Todos/Todas/Todos; visível só quando algo difere do padrão. Não altera mês nem aba. |

- >= `md`: inline, aplicam ao mudar (D6). < `md`: botão "Filtros (n)" abre a folha (BottomSheet) com Status, Categoria, Cartão e rodapé "Limpar" / "Aplicar".
- Mudar filtro: página 1, seleção limpa, painel "Atualizando", anúncio polite "Mostrando 12 despesas de outubro de 2026, pendentes, Nubank".
- Não existem filtros de tipo nem de período.

**Subtotal (D21, RF11)**
- Faixa `--surface-2`, raio 8, padding 12/16, texto 14: rótulo "Subtotal" + qualificador ("todas as despesas do mês" sem filtros; "com os filtros aplicados" com filtros), contagem ("12 despesas", do total de itens da paginação), Total, Pago (indicador `--success`), Pendente (indicador `--warning`). Valores `--text` mono.
- Sobre todo o conjunto filtrado, não só a página (CA50). Calculado pela API; nunca no cliente.
- `aria-live` não: a faixa é lida junto com o anúncio do filtro.

**Tabela (>= `md`)**

| Coluna | Largura | Conteúdo |
|---|---|---|
| Seleção | 48px | Checkbox, área 44x44. Desabilitado para despesas PAGO (P12). |
| Descrição | flexível | 1 linha com reticências (texto completo acessível); 2a linha `--text-muted` 12px: categoria (até `lg`) · forma · chip. |
| Categoria (>= `xl`) | 160-200px | `--text-muted`. |
| Forma (>= `lg`) | 160px | "PIX" ou nome do cartão; chip "Fatura nov/26" abaixo quando o mês de referência difere do mês da data. |
| Data | 112px | `dd/MM/yyyy` (data da compra). |
| Valor | 140px | Mono, à direita, `--text`. |
| Status | 112px | `StatusBadge` Pendente / Pago. |
| Ação | 160px | PENDENTE: secundário "Marcar como pago" (>= `lg`) / "Pagar" (`md`). PAGO: "Pago em 24/10/2026" `--text-muted` (para PIX pago na criação, o instante da criação). |

- Chip "Fatura nov/26": pílula borda `--border-strong`, texto `--text-muted` 12px, texto acessível "Fatura de novembro de 2026". Como o mês da fatura agora é o do vencimento, a maioria das compras no cartão mostra o chip; isso é esperado e é o que explica por que uma compra de outubro aparece em novembro (CA53).
- Cabeçalho da tabela: 14/500 `--text-muted`, `--surface` opaco, sticky abaixo da faixa de abas.
- Linhas: altura mín. 56, divisória `--border`, hover `--surface-2`, selecionada `--surface-2` + barra 2px `--accent`. Pagas mantêm contraste normal.
- `<caption>` oculto: "Despesas de outubro de 2026, mais recentes primeiro".
- Ordem: data desc (API).

**Cards (< `md`)**

```
+------------------------------------------+
| [ ]  Mercado do mês             PENDENTE |  checkbox 44x44 | descrição | badge
|      Alimentação · 15/10/2026            |  14, --text-muted
|      Nubank · [Fatura nov/26]            |  ou "PIX"
|                              R$ 250,00   |  mono 16, 600
| [        Marcar como pago             ]  |  secundário 44px
+------------------------------------------+
```

- Card `--surface`, raio 12, padding 16; `<ul>/<li>`, `aria-labelledby` na descrição.
- PAGO: sem botão; "Pago em 24/10/2026 às 10:00" `--text-muted`; checkbox desabilitado.
- Selecionado: borda 1px `--accent` + `--surface-2`. Tocar no card não seleciona.

**Seleção e toolbar**
- Só despesas PENDENTE são selecionáveis; cabeçalho "Selecionar todos os pendentes desta página" tri-state, desabilitado sem pendentes na página (CA71).
- Seleção só da página; limpa ao mudar página, filtro, mês ou aba (P11).
- Toolbar (>= `md`, sticky abaixo do cabeçalho da tabela quando rola): sem seleção, "Selecione despesas pendentes para pagar em lote" + "Marcar como pago" desabilitado; com seleção, "3 selecionados · R$ 150,00" + "Limpar seleção" + "Marcar como pago (3)". < `md`: barra fixa inferior (3.2).
- Despesas de cartões diferentes e PIX podem ser pagas juntas (CA70, P22).
- Não há "Pagar fatura" nesta aba.

### 3.7 Aba Faturas (RF21, D17)

> **Superado em parte (2026-10-30):** (a) "um bloco por cartão com despesa no mês" passa a respeitar o filtro de status (padrão "Pendente"); (b) o atalho do bloco para a aba Despesas, no caso de fatura **paga**, tem o rótulo "Ver despesas do cartão na aba Despesas" e abre com `d_status=ALL`; fatura com pendência mantém rótulo e status vigente; (c) após pagar sob filtro que retira o bloco, o foco vai para o `h2` do painel. Ver `docs/design/listagem-mes-e-status-padrao.md`, seções 5.2, 6.1 e 9 (DL11).

**Estrutura**
- Título do painel: "Faturas de outubro de 2026" + contagem "3 faturas" `--text-muted`.
- Ajuda única, 14px `--text-muted`: "Cada fatura aparece no mês em que vence."
- Um bloco por cartão com despesa no mês (RF09, DR5), ordenados por vencimento crescente (desempate por nome). Fonte: faturas do mês (RF09).

**Bloco de fatura (`InvoiceBlock`)**

```
< md
+------------------------------------------+
| Nubank                                   |  h3 18/600
| Fecha 25/10/2026 · Vence 05/11/2026      |  14 --text-muted
| +--------------------------------------+ |
| | Total       R$ 140,00                | |
| | ● Pago      R$ 40,00                 | |
| | ● Pendente  R$ 100,00                | |
| +--------------------------------------+ |
| [          Pagar fatura              ]   |  primário, largura total
| [v] Ver 2 despesas                       |  disclosure
+------------------------------------------+

>= md
+------------------------------------------------------------------+
| Nubank                                        [ Pagar fatura ]   |
| Fecha 25/10/2026 · Vence 05/11/2026                              |
| Total R$ 140,00   ● Pago R$ 40,00   ● Pendente R$ 100,00         |
| [v] Ver 2 despesas                                               |
|------------------------------------------------------------------|  (expandido)
| Descrição            Categoria     Data         Valor    Status  |
| Mercado              Alimentação   10/10/2026   100,00   PEND.   |
| Farmácia             Saúde         20/10/2026    40,00   PAGO    |
+------------------------------------------------------------------+
```

- Contêiner `<section aria-labelledby>` com `h3` (nome do cartão); `--surface`, raio 12, borda 1px `--border-strong`, padding 16/20, gap 16 entre blocos.
- Datas de fechamento e vencimento em `dd/MM/yyyy`, exatamente como vêm da API (a regra para datas divergentes é B9; o design só exibe).
- Totais: Total, Pago, Pendente com os indicadores de status (sinal textual "Pago"/"Pendente" sempre presente). Valores `--text`.
- **"Pagar fatura"**: primário. Habilitado com pendente > 0. Com pendente = 0: desabilitado (`aria-disabled`, tokens de desabilitado) + texto "✓ Fatura paga" `--success-text` ao lado (>= `md`) ou acima do botão (< `md`), ligado por `aria-describedby` (CA45). Rótulo acessível "Pagar fatura Nubank de novembro de 2026".
- Não há badge de "vencida", "aberta" ou "fechada" (fora de escopo).
- **Disclosure** (`aria-expanded`, `aria-controls`): "Ver 2 despesas" / "Ocultar despesas", chevron que gira (sem animação com movimento reduzido, CA87). Recolhido por padrão; vários blocos podem ficar abertos ao mesmo tempo.
- **Lista expandida (DR7)**: somente leitura, todas as despesas da fatura (sem paginação), data desc. Fonte: despesas da fatura (RF09), buscada no primeiro expandir e revalidada após mutações. >= `md`: tabela simples (Descrição | Categoria | Data | Valor | Status), sem checkbox nem ação; < `md`: lista de linhas de duas linhas (descrição + valor; categoria · data + badge). Rodapé da lista: link terciário "Pagar despesas individualmente na aba Despesas" -> aba Despesas do mesmo mês filtrada pelo cartão.

| Estado do bloco / lista | Apresentação |
|---|---|
| Lista carregando | Disclosure com spinner "Carregando despesas…"; 3 linhas skeleton dentro do bloco. |
| Lista com erro | Dentro do bloco: "Não foi possível carregar as despesas desta fatura." + "Tentar novamente" (só a lista). Totais e "Pagar fatura" continuam. |
| Pagando | Bloco em "Atualizando" (D11) depois da confirmação. |

**Confirmação "Pagar fatura" (AlertDialog, D2)**

```
+-------------------------------------------+
| Pagar a fatura Nubank de novembro de 2026?|
|                                           |
| Vence em 05/11/2026                       |  --text-muted
| 2 despesas pendentes                      |
| Total: R$ 100,00                          |  Space Grotesk 20
|                                           |
| Serão pagas as despesas pendentes desta   |
| fatura no momento da confirmação.         |
| ⚠ Esta ação não pode ser desfeita.        |  --warning-text + ícone
|                                           |
| [Cancelar]            [Pagar fatura]      |
+-------------------------------------------+
```

- Mostra cartão, mês de referência por extenso, vencimento `dd/MM/yyyy`, quantidade e soma pendentes do bloco (CA72). Quantidade pendente: se a fonte de faturas não trouxer a contagem de pendentes, mostrar só a soma ("Total pendente: R$ 100,00") em vez de calcular no cliente; confirmar com o ADR.
- Foco inicial em "Cancelar"; `Esc` cancela; confirmando, "Pagando…" e `Esc` ignorado até a resposta.

| Resposta (RF08) | Comportamento |
|---|---|
| Sucesso, quantidade > 0 | Fecha; resumo, blocos de fatura, aba Despesas e dashboard revalidados; toast com os valores **da resposta** (P21): "Fatura Nubank de nov/26 paga: 2 despesas, R$ 100,00." Se a soma difere da exibida: "O valor difere do exibido porque a fatura mudou." O bloco passa a pendente R$ 0,00 com botão desabilitado e "Fatura paga". |
| Sucesso, quantidade = 0 | Fecha; toast informativo "Nenhuma despesa pendente nesta fatura. Nada foi alterado."; bloco revalidado. |
| 404 (cartão inexistente) | Fecha; toast de erro "Este cartão não foi encontrado. Nada foi alterado."; aba revalidada. |
| 400 / 500 / rede | Modal aberto; mensagem inline (`role="alert"`) acima dos botões: "Não foi possível pagar a fatura. Nenhuma despesa foi alterada. Tente novamente." |

Foco após sucesso: `h3` do bloco (`tabindex="-1"`).

**Vazio da aba**: ver 3.12.

### 3.8 Aba Receitas (RF22)

- Filtro: Categoria (mesmo controle da aba Despesas, prefixo próprio na URL). Inline em todas as larguras (é um único select; sem folha no mobile, aplica ao mudar).
- Subtotal (D21): "Subtotal · todas as receitas do mês" / "· com o filtro aplicado": "4 receitas · Total R$ 6.200,00".
- Tabela (>= `md`): Descrição | Categoria | Data | Valor | Status (badge "Recebida", `--income`). **Sem coluna de seleção nem de ação** (CA71). `<caption>` oculto "Receitas de outubro de 2026, mais recentes primeiro".
- Cards (< `md`): descrição + badge Recebida; categoria · data; valor. Sem checkbox, sem botão.
- Paginação "Mostrando 1-20 de 24 receitas"; ordem data desc.
- Receita com data futura aparece normalmente e conta no resumo (B7); sem rótulo especial.

### 3.9 Drawer "Novo lançamento" (RF23)

**Layout**: >= `md` painel à direita 480px (100% abaixo de 520px), `--surface`, borda esquerda `--border-strong`, scrim + blur. < `md`: tela cheia, cabeçalho e rodapé fixos (rodapé acima do teclado). Entrada deslizando 200ms; com movimento reduzido, fade 150ms.

```
+-------------------------------------+
| Novo lançamento                 [X] |
|                                     |
| Tipo *                              |
| [ Despesa  |  Receita ]             |  padrão Despesa (P26)
|                                     |
| Descrição *                         |
| [_______________________________]   |
|                              0/120  |
| Categoria *                         |
| [Moradia________________________]   |  combobox sem chevron (rev. 4)
| Data *                              |
| [24/10/2026____________________]    |
| Valor *                             |
| [R$ 0,00_______________________]    |
|                                     |
| Forma de pagamento *                |
| [  PIX  |  Cartão  ]                |  padrão PIX
|                                     |
| (Despesa + PIX)                     |
| [ ] Ainda não paguei                |
| Status inicial: paga.               |  --text-muted, muda com o checkbox
|                                     |
| (Despesa + Cartão)                  |
| Cartão *              [+ Novo cartão]|
| [Nubank · fecha 25 · vence 5   v]   |
| Status inicial: pendente, na fatura |
| do cartão.                          |
+-------------------------------------+
| [Cancelar]        [Salvar lançamento]|
+-------------------------------------+
```

#### 3.9.1 Campos

| Campo | Controle | Regras de UI (a API é a fonte da verdade) | Mensagens |
|---|---|---|---|
| Tipo | Segmented "Despesa / Receita" | Padrão Despesa (P26). | "Escolha o tipo." |
| Descrição | input texto | 1-120 após trim; contador "n/120", `--danger-text` acima de 120. | "Informe a descrição." / "A descrição deve ter no máximo 120 caracteres." |
| Categoria | combobox editável (ARIA 1.2, detalhes abaixo) | Texto livre (B1); sugestões = categorias existentes (RF14, P23); "Criar categoria "<texto>"" no fim; 1-50 após trim. | "Informe a categoria." / "A categoria deve ter no máximo 50 caracteres." |
| Data | `type="date"` | Padrão: hoje em SP. Ajuda: "Data da compra (despesa) ou do recebimento (receita)." | "Informe uma data válida." |
| Valor | texto `inputmode="decimal"`, máscara da direita para a esquerda | String decimal, nunca `Number`; máx. R$ 9.999.999.999,99. | "Informe um valor maior que zero." / "O valor máximo é R$ 9.999.999.999,99." |
| Forma de pagamento | Segmented "PIX / Cartão" | Padrão PIX (P26). Com Receita: fixa em PIX e o segmento "Cartão" desabilitado (`--text-disabled`), ajuda "Receitas são sempre via PIX." | "Escolha a forma de pagamento." |
| Ainda não paguei | Checkbox | **Só aparece** com Despesa + PIX (D23); desmarcado por padrão. Marcar não pede confirmação. | - |
| Cartão | Select de cartões (RF02): "Nubank · fecha 25 · vence 5" | **Só aparece** com Despesa + Cartão (D12); obrigatório. Botão terciário "+ Novo cartão" alinhado à direita do rótulo (alvo 44px). O formulário **não** calcula nem mostra fatura, vencimento ou mês de referência (P24, R5). | "Escolha o cartão." / 404: "Este cartão não existe mais. Escolha outro." |

**Combobox de categoria** (rev. 4, conferido com `CategoryCombobox`)
- Input `role="combobox"` + `listbox` "Sugestões"; `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant` na opção ativa. A lista abre ao digitar, com `↓`/`↑`, ao clicar no input e pelo botão de seta; focar (Tab ou programático) não abre (F1, ver 13.2).
- Affordance (selecionar ou criar): botão de seta (chevron) no campo, `type="button"`, `tabIndex=-1`, `aria-label="Mostrar categorias"`, `aria-controls` da listbox; alterna a lista e mantém o foco no input. Placeholder "Selecione ou digite uma nova". Com o campo vazio a lista mostra todas as categorias; sem nenhuma, uma linha `option` desabilitada "Nenhuma categoria ainda. Digite para criar.". A opção de criar é `Criar categoria "<texto>"`.
- Filtro por "contém", sem diferenciar maiúsculas (B1): "alim" sugere "Alimentação". A última opção é `Criar categoria "<texto aparado>"`, separada por divisória `--border` e peso 500; só aparece com texto não vazio que não coincida (sem diferenciar maiúsculas) com uma categoria existente.
- Teclado: `↓`/`↑` circulam (e abrem a lista), `Home`/`End` vão às pontas com a lista aberta, `Enter` escolhe a opção ativa (sem opção ativa, não faz nada e o texto digitado vale), `Esc` fecha só a lista (com a lista fechada, `Esc` fecha o drawer), `Tab` fecha a lista e segue. Ponteiro: clique escolhe sem tirar o foco do input.
- Visual: lista `--surface`, borda `--border-strong`, sombra, raio 8, altura máx. 224px com rolagem (a opção ativa é rolada para a vista), opções 44px `--text`; ativa `--surface-active`, hover `--surface-2`.
- Sem categorias (erro de RF14): a linha "Nenhuma categoria ainda. Digite para criar." e, ao digitar, só a opção `Criar categoria "<texto>"`. Enviando: somente leitura, lista não abre.
- A grafia gravada é decidida pela API (CA20: "  alimentação " vira "Alimentação"); o cliente não reescreve o texto.

**Linha "Status inicial"** (D23), sempre visível abaixo da forma (ou do checkbox/cartão), 14px `--text-muted`, referenciada por `aria-describedby` do controle que a altera:

| Combinação | Texto |
|---|---|
| Despesa + PIX, desmarcado | "Status inicial: paga." |
| Despesa + PIX, "Ainda não paguei" marcado | "Status inicial: pendente. Você poderá marcá-la como paga depois." |
| Despesa + Cartão | "Status inicial: pendente, na fatura do cartão." (substitui o checkbox; atende "indisponível com explicação", CA73) |
| Receita | "Status inicial: recebida." |

**Aviso de PIX com data futura** (D24, depende de B8): com Despesa + PIX, desmarcado e data > hoje (SP), acrescenta abaixo do status: "Data futura: ela será registrada como paga hoje. Marque "Ainda não paguei" se o PIX ainda não saiu." Nada é marcado sozinho.

**Alternâncias** (CA73)
- Despesa -> Receita: forma vai para PIX; checkbox e cartão somem; o formulário guarda internamente forma, cartão e "Ainda não paguei". Receita -> Despesa: restaura as escolhas anteriores.
- PIX -> Cartão: o checkbox some (o valor é guardado para voltar a PIX); aparece o campo Cartão. Cartão -> PIX: campo Cartão some (seleção guardada), checkbox volta como estava.
- Entradas/saídas de campos sem animação de altura com movimento reduzido. O foco nunca é movido por essas trocas.
- Payload: Receita sem cartão e sem indicador de pagamento; Despesa Cartão sem indicador (ou "não pago"); Despesa PIX com o indicador conforme o checkbox (nome do campo no ADR). Status e mês de referência nunca são campos.

**Sem cartões cadastrados**: o segmento "Cartão" continua habilitado. Ao escolhê-lo, no lugar do select aparece "Nenhum cartão cadastrado." `--text-muted` + botão secundário "+ Novo cartão" (o painel não abre sozinho). A antiga ligação "Ir para Cartões" com descarte de dados foi removida.

**Cartões indisponíveis (erro ao listar)**: no lugar do select, "Não foi possível carregar os cartões." + "Tentar novamente"; "+ Novo cartão" continua disponível.

#### 3.9.2 Validação, envio e sucesso

> **Superado em parte (2026-10-30):** o toast pós-criação passa a ter ação "Limpar filtros" também na aba Faturas (compra no cartão sob o filtro "Pago") e, em Despesas, quando o item criado não aparece sob o filtro "Pendente" (despesa PIX paga). "Ver <mês>" abre com status "Todos". Ver `docs/design/listagem-mes-e-status-padrao.md`, seção 7.

- Validação por campo no blur após a primeira interação; contador e limite do valor ao digitar.
- No envio: valida tudo, mantém aberto, foco no primeiro inválido; resumo `role="alert"` com 2+ erros (CA74).
- 400: detalhes por campo mapeados (tipo, descrição, categoria, data, valor, forma, cartão, indicador de pagamento); sem campo conhecido -> resumo do topo do drawer.
- 404 de cartão: erro inline no Cartão + lista de cartões recarregada.
- Rede/500: banner `--danger` no topo do drawer, dados preservados, foco no banner.
- Enviando: "Salvar lançamento" com spinner e "Salvando…"; campos somente leitura; fechar desabilitado.
- **Sucesso**: fecha; foco volta a "+ Novo lançamento" (o do cabeçalho, ou o da faixa se foi o gatilho); resumo, abas, subtotais, faturas e dashboard revalidados; toast (D25), sempre com dados **da resposta**:

| Caso | Toast |
|---|---|
| Despesa PIX paga | "Despesa criada como paga." |
| Despesa PIX pendente | "Despesa criada como pendente." |
| Despesa no cartão | "Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026." (mês de `referenceMonth` e vencimento da resposta, nunca o mês da data da compra) |
| Receita | "Receita criada." |

- Ação do toast (8s), quando o lançamento não aparece na tela atual:
  - mês de referência != mês selecionado: acrescenta "Ela está em novembro de 2026." + ação "Ver novembro" -> mesmo mês da resposta, aba Despesas (despesa) ou Receitas (receita).
  - mesmo mês, aba ativa de outro tipo (ex.: criou receita na aba Despesas): ação "Ver receitas" / "Ver despesas".
  - mesmo mês e aba, mas excluído pelos filtros: "Ela não aparece nos filtros atuais." + "Limpar filtros".
  - Despesa no cartão com a aba Faturas ativa e mesmo mês: sem ação (o bloco é atualizado).
- **Destaque de recém-criado** (rev. 4, CAF02): se o item aparece na página atual das abas Despesas ou Receitas (mesmo mês, aba e filtros), a linha (tabela, >= `md`) ou o card (< `md`) recebe por cerca de 2s um realce **estático**: fundo `--surface-2`, contorno interno 2px `--accent` e selo "Novo" ao lado da descrição (chip, texto oculto "lançamento recém-criado"). Sem transição de entrada nem de saída em nenhum caso, com ou sem movimento reduzido. O realce não depende só de cor (selo textual). Não se aplica a pagamentos (PF05) nem aos blocos da aba Faturas; o foco não vai para a linha (continua no gatilho). Os ~2s contam a partir do momento em que a linha aparece (item F2 da 13.2).
- Fechar (X, Cancelar, `Esc`, scrim) sem confirmação de descarte (aprovado); reabre limpo.

#### 3.9.3 Atalho "+ Novo cartão" (D22, RF23, CA75)

**Forma escolhida: embutido** - um painel inline que se abre logo abaixo do campo Cartão, dentro do mesmo drawer.

Por que embutido e não sobreposto:
- **Uma camada de diálogo só**: um modal sobre o drawer cria `<dialog>` aninhado, scrim duplo (o segundo scrim sobre o drawer escurece o formulário e complica o contraste do fundo), armadilha de foco dentro de armadilha de foco e `Esc` ambíguo. No mobile seria uma tela cheia sobre outra tela cheia, escondendo o formulário.
- **Contexto visível**: os dados digitados continuam na tela, o que é a prova visual de que nada se perdeu (requisito central do CA75).
- **Formulário curto**: 3 campos (nome, fechamento, vencimento) cabem no fluxo; o drawer já rola.
- **Feedback coerente com 2.3**: diálogos usam feedback inline; o painel herda isso sem regra nova.
- Alternativa descartada também: trocar a "página" do drawer (push view), que esconde o formulário e passa a sensação de que os dados sumiram.

```
| Cartão *                            |
| [Selecione um cartão          v]    |  select fica visível, desabilitado
| +---------------------------------+ |  painel --surface-2, borda --border-strong
| | Novo cartão                     | |  h3 16/600
| | Nome *                          | |
| | [Inter_____________________]    | |
| | Já existe um cartão com esse    | |  409 inline (--danger-text)
| | nome.                           | |
| | Fecha dia *      Vence dia *    | |  lado a lado >= 360px úteis; senão empilhados
| | [ 3 ]            [ 10 ]         | |
| | Em meses mais curtos, vale o    | |
| | último dia do mês.              | |
| | [Cancelar]     [Criar cartão]   | |
| +---------------------------------+ |
...
+-------------------------------------+
| Conclua ou cancele o novo cartão    |  --text-muted 12, só com painel aberto
| [Cancelar]   [Salvar lançamento]    |  "Salvar" desabilitado (aria-disabled)
+-------------------------------------+
```

Comportamento:
1. "+ Novo cartão" abre o painel (`aria-expanded` no botão, `aria-controls` no painel, `role="group"` com `aria-labelledby` no título). Foco vai para "Nome". Entrada sem animação com movimento reduzido.
2. Enquanto aberto: o select de cartão fica desabilitado; "Salvar lançamento" fica desabilitado com o texto "Conclua ou cancele o novo cartão" no rodapé (evita salvar o lançamento sem cartão por engano e dois envios simultâneos). Os demais campos do lançamento continuam editáveis.
3. `Enter` num campo do painel envia **só o painel** (o painel não é um `<form>` aninhado; o envio é isolado). Validação idêntica à de `/cards` (RF01): nome 1-50, dias 1-31.
4. `Esc` com foco no painel: fecha **só o painel** (o drawer não fecha) e devolve o foco ao campo Cartão. Um segundo `Esc` fecha o drawer. Durante o envio, `Esc` é ignorado.
5. "Criar cartão": "Criando…", campos do painel somente leitura.
6. **Sucesso (RF01)**: painel fecha; lista de cartões recarregada; o novo cartão fica **selecionado**; foco no select de Cartão; mensagem inline `role="status"` abaixo do campo, `--success-text` com ícone: "Cartão "Inter" criado e selecionado." (some na próxima edição do campo). Nenhum dado do lançamento muda. Cartão passa a aparecer em `/cards` e no filtro (revalidação).
7. **409 (nome duplicado, CA3)**: erro inline no Nome ("Já existe um cartão com esse nome."), borda `--danger`, foco no Nome, painel aberto, nada criado.
8. **400**: mapeado por campo (nome, fechamento, vencimento). **Rede/500**: `InlineAlert` dentro do painel "Não foi possível criar o cartão. Tente novamente.", dados do painel preservados.
9. "Cancelar" do painel: fecha sem criar, foco no campo Cartão, dados do lançamento intactos.
10. Fechar o drawer com o painel aberto (X, scrim): fecha tudo sem confirmação (regra aprovada de não confirmar descarte).
11. Troca de tema com o painel aberto (só pelo sistema, 2.2): nada se perde (CA84).

### 3.10 Confirmação de pagamento (individual e lote, aba Despesas)

> **Superado em parte (2026-10-30):** sob o filtro "Pendente", a despesa paga individualmente sai da lista e o foco vai para o `h2` do painel, e não para "a mesma linha". Sob "Todos", a linha permanece. Ver `docs/design/listagem-mes-e-status-padrao.md`, seção 6.2.

Título ("Marcar 3 despesas como pagas?" / "Marcar "Aluguel" como pago?"), total, até 5 itens + "e mais n", aviso `--warning-text`, foco em "Cancelar".

| Resposta | Comportamento |
|---|---|
| Sucesso | Fecha; seleção limpa; resumo, lista, subtotal, faturas e dashboard revalidados; toast "3 despesas marcadas como pagas." / "2 despesas marcadas como pagas. 1 já estava paga." / ""Aluguel" marcado como pago.". Foco: lote -> `h2` do painel; individual -> mesma linha/card. |
| 404 (lote) | Fecha; banner persistente acima da lista (`role="alert"`): "Nenhuma despesa foi alterada. 2 despesas selecionadas não foram encontradas:" + descrições (ou ids). Lista revalidada; seleção mantida sem as ausentes. |
| 422 (lote) | Fecha; banner: "Nenhuma despesa foi alterada. Receitas não podem ser marcadas como pagas:" + descrições. Só ocorre por dado obsoleto/uso indevido (DR1). |
| 404 (individual) | Fecha; toast de erro "Esta despesa não foi encontrada. A lista foi atualizada." |
| 422 (individual) | Fecha; toast de erro "Receitas não podem ser marcadas como pagas. Nada foi alterado." |
| 400 / 500 / rede | Modal aberto; inline: "Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente." |

Banner (`InlineAlert`): `--surface`, borda 1px `--danger` + esquerda 3px, ícone `--danger-text`, texto `--text`, fechar 44x44; um por vez.

### 3.11 Paginação (Despesas e Receitas)

"Mostrando 21-40 de 135 despesas" (ou receitas), números com reticências, página atual `--primary-strong` + `--primary-border` + `--on-primary` com `aria-current="page"`, controles 44x44, versão compacta < `md`, links reais, limpa seleção, oculta com 1 página, tamanho 20. Ao mudar de página, o foco vai para o `h2` do painel e a página rola até a faixa de abas.

### 3.12 Estados da tela de lançamentos

> **Superado em parte (2026-10-30):** os estados vazios de Despesas e Faturas passam a depender do status (vazio com filtros e vazio sem filtros), e a abertura sem `month` mostra o `loading.tsx` enquanto o mês inicial é resolvido. O texto sobre "seletor real no skeleton" não é o que o código faz. Ver `docs/design/listagem-mes-e-status-padrao.md`, seções 5 e 8.

O resumo e o painel da aba são regiões independentes: cada uma tem seu skeleton, atualização e erro (RF24).

| Região / estado | Condição | Apresentação |
|---|---|---|
| Carregamento inicial | primeira carga da rota | Skeleton com a geometria final: cabeçalho (título, botão, seletor renderizados de verdade a partir da URL), resumo (3 cards ou compacto), faixa de abas real e painel da aba ativa em skeleton (Despesas/Receitas: faixa de subtotal + 8 linhas, 4 cards no mobile; Faturas: 2 blocos). `aria-busy` + texto oculto "Carregando lançamentos". Shimmer desligado com movimento reduzido. |
| Primeira visita a outra aba | troca de aba sem dados | Skeleton **só do painel**; cabeçalho e resumo intactos. |
| Atualizando | troca de mês/filtro/página, pós-mutação | D11 na região afetada (resumo e/ou painel); não volta ao skeleton. |
| **Resumo com erro** | falha do resumo (RF10) | No lugar dos cards: `ErrorState` compacto "Não foi possível carregar o resumo do mês." + "Tentar novamente" (refaz só o resumo). Abas continuam funcionando. |
| **Despesas vazia (sem filtros)** | 0 despesas no mês | Ícone + "Nenhuma despesa em outubro de 2026", "Registre uma despesa ou escolha outro mês.", botão "+ Novo lançamento". Subtotal R$ 0,00; toolbar e paginação ocultas. |
| **Despesas vazia (com filtros)** | 0 itens com filtros | "Nenhuma despesa para os filtros selecionados em outubro de 2026", ações "Limpar filtros" e "+ Novo lançamento". Subtotal R$ 0,00; resumo inalterado (CA58). |
| Despesas com cartão inexistente no filtro | id sem cartão (P19) | Select mostra "Cartão não encontrado"; vazio com "Este cartão não foi encontrado." + "Remover filtro de cartão". |
| **Faturas vazia** | nenhum cartão com despesa no mês (DR5, CA44) | "Nenhuma fatura neste mês", "Compras no cartão aparecem na fatura do mês em que vencem.", botão "+ Novo lançamento"; se não há cartões cadastrados, link adicional "Cadastrar cartão" (`/cards`). |
| **Receitas vazia (sem filtro)** | 0 receitas | "Nenhuma receita em outubro de 2026" + "+ Novo lançamento". Subtotal R$ 0,00. |
| **Receitas vazia (com filtro)** | 0 com categoria | "Nenhuma receita na categoria Moradia em outubro de 2026" + "Limpar filtro". |
| Página além do fim | itens vazios com total > 0 | "Esta página não existe." + "Ir para a última página". |
| Erro do painel | falha da aba | No lugar do conteúdo da aba (`role="alert"`): "Não foi possível carregar as despesas/faturas/receitas." + "Tentar novamente" (refaz só o painel). Cabeçalho, resumo, abas e navbar utilizáveis, no tema correto. |
| Filtros inválidos | 400 por URL editada | No painel: "Os filtros da URL são inválidos." + "Limpar filtros" (mantém mês e aba). |
| Categorias indisponíveis | falha de RF14 | Lista funciona; select mostra só "Todas as categorias" + "Não foi possível carregar as categorias." + "Tentar novamente". No drawer, o combobox aceita texto livre sem sugestões. |
| Cartões indisponíveis | falha de RF02 | Filtro mostra "Todos" e "PIX" + mensagem e "Tentar novamente"; no drawer, ver 3.9.1. |
| Mês sem nenhum lançamento | tudo zerado | Resumo R$ 0,00 + "Sem lançamentos neste mês"; cada aba mostra seu vazio. |

Após qualquer mutação (criar, pagar, pagar fatura, criar cartão), nenhuma região pode exibir número antigo: o resumo e o painel ativo são revalidados juntos; as outras abas recarregam ao serem abertas (R16; estratégia em T14).

---

## 4. Tela de cartões (`/cards`)

### 4.1 Hierarquia

1. "Cartões" + "Novo cartão".
2. Lista: nome, "Fecha dia X · Vence dia Y", ações (Editar, Ver despesas do mês).
3. Ajuda (uma vez, `--text-muted`): "Compras até o dia de fechamento entram na fatura que vence logo depois. A fatura aparece no mês do vencimento."

### 4.2 Layout por breakpoint

```
< md                                   >= lg
+----------------------------------+   +--------------------------------------------------------------+
| Cartões                          |   | Cartões                                     [ + Novo cartão ] |
| [ + Novo cartão            ]     |   | Compras até o dia de fechamento entram na fatura ...          |
| Compras até o dia de ...         |   | +------------------+ +------------------+ +------------------+ |
| +------------------------------+ |   | | Itaú             | | Nubank           | | ...              | |
| | Itaú                         | |   | | Fecha dia 5      | | Fecha dia 25     | |                  | |
| | Fecha dia 5 · Vence dia 12   | |   | | Vence dia 12     | | Vence dia 5      | |                  | |
| | [Editar]  Ver despesas >     | |   | | [Editar] Ver >   | | [Editar] Ver >   | |                  | |
| +------------------------------+ |   | +------------------+ +------------------+ +------------------+ |
+----------------------------------+   +--------------------------------------------------------------+
```

- < `md`: 1 coluna; `md`: 2; >= `lg`: 3. `<ul>`, cada card com `h2` e `aria-labelledby`.
- Card `--surface`, raio 12, borda `--border`. Nome 16/600; dias 14 `--text-muted`; texto acessível "Nubank · Fecha dia 25 · Vence dia 5" (CA77).
- Ações: "Editar" (secundário 44px, `aria-label="Editar Nubank"`) e link terciário **"Ver despesas do mês"** -> `/entries` na aba Despesas, **mês atual (SP)**, filtro de cartão = este cartão (DR8, CA77). `aria-label="Ver despesas de Nubank em outubro de 2026"`. O link é calculado com o mês atual no momento da renderização.

### 4.3 Drawer "Novo cartão" / "Editar cartão"

Mesmo `Drawer` (D1). Os campos e mensagens são os mesmos do painel embutido (3.9.3), num componente de campos compartilhado (`CardFields`).

| Campo | Controle | Regras | Mensagens |
|---|---|---|---|
| Nome * | texto | 1-50 após trim; único sem diferenciar maiúsculas (P18) | "Informe o nome." / "O nome deve ter no máximo 50 caracteres." / 409: "Já existe um cartão com esse nome." |
| Dia de fechamento * | texto `inputmode="numeric"` (2 dígitos) | Inteiro 1-31. Ajuda: "Em meses mais curtos, vale o último dia do mês." | "Informe um dia entre 1 e 31." |
| Dia de vencimento * | idem | Inteiro 1-31. Ajuda: "Define o mês em que a fatura aparece." (P20; substitui "Informativo.") | "Informe um dia entre 1 e 31." |

- Sem pré-visualização de exemplo de fatura (evita duplicar a regra no web, R5).
- **Edição**: `InlineAlert` informativo (`--accent`): "Alterações valem só para novos lançamentos. Os já registrados continuam na fatura em que foram lançados." (DR2).
- 409: erro inline no Nome, foco nele. 404 na edição: banner "Este cartão não existe mais." + "Fechar"; lista revalidada. 400 por campo; rede/500 banner, dados preservados.
- Sucesso: fecha; foco no gatilho; toast "Cartão "Nubank" criado." / "atualizado."; lista revalidada. Edição sem mudança: "Nenhuma alteração.".

### 4.4 Estados

| Estado | Apresentação |
|---|---|
| Carregando | 3 cards skeleton. |
| Atualizando | D11. |
| Vazio | "Nenhum cartão cadastrado", "Cadastre um cartão para registrar compras no crédito.", "Novo cartão" (CA77). |
| Erro | "Não foi possível carregar os cartões." + "Tentar novamente". |

---

## 5. Dashboard (`/dashboard`)

Mantido como na rev. 2, com: só seletor de mês (padrão mês atual, B14), forma de pagamento sem "Conta", resumo vindo da mesma fonte do topo da tela de lançamentos (RF10/RF15) e referências de CA atualizadas.

### 5.1 Hierarquia

1. Título + seletor de mês (padrão: mês atual em SP, CA61).
2. Cards do mês (RF15): Receitas; Despesas (pago/pendente); Saldo (realizado/previsto).
3. Barras 12 meses (RF16): receitas x despesas (pago/pendente) + linhas de saldo.
4. Donut (RF17): despesas por categoria no mês.

Cada bloco carrega, atualiza e falha de forma independente.

### 5.2 Layout por breakpoint

**< `md`**

```
+----------------------------------+
| Dashboard                        |
| [<]  outubro de 2026  [>]        |
| [Mês atual]  Ver lançamentos >   |
| +------------------------------+ |
| | Receitas       R$ 5.000,00   | |
| +------------------------------+ |
| | Despesas       R$ 1.000,00   | |
| | ● Pago R$ 800 ● Pendente 200 | |
| +------------------------------+ |
| | Saldo                        | |
| | Realizado R$ 4.200,00 ▲ Pos. | |
| | Previsto  R$ 4.000,00 ▲ Pos. | |
| +------------------------------+ |
| +------------------------------+ |
| | Evolução mensal  [Gráf|Tab]  | |
| | legenda (2 linhas)           | |
| | R$|  ▇▇ ▇▇ ▇▇ ▇▇ ▇▇ ▇▇ ->    | |  eixo Y fixo + área rolável (D15)
| |   |  mai jun jul ago set out | |
| | [<] Deslize para ver 12 meses| |
| +------------------------------+ |
| +------------------------------+ |
| | Despesas por categoria [G|T] | |
| |         ( donut )            | |
| | • Moradia R$ 1.500,00  75%   | |
| +------------------------------+ |
+----------------------------------+
```

No dashboard os cards mantêm a forma de 3 cards (D10) também no mobile: aqui eles são o conteúdo principal, não um cabeçalho acima de uma lista.

**`md` a `lg`**: título à esquerda e seletor à direita; 3 cards em linha; barras em largura total (altura 280); donut em largura total com legenda à direita.

**>= `lg`**

```
+-----------------------------------------------------------------------+
| Dashboard                  [Mês atual] [<] outubro de 2026 [>]        |
| +---------------------+ +---------------------+ +---------------------+
| | Receitas            | | Despesas            | | Saldo               |
| +---------------------+ +---------------------+ +---------------------+
| +-------------------------------------------+ +-------------------------+
| | Evolução mensal (nov/25 a out/26) [G|T]   | | Despesas por categoria  |
| | barras + linhas, altura 320               | |      ( donut )          |
| +-------------------------------------------+ +-------------------------+
+-----------------------------------------------------------------------+
```

Barras 8 colunas, donut 4; mesma altura.

### 5.3 Seletor de mês

- `MonthPicker` compartilhado com a tela de lançamentos; mês na URL; padrão mês atual em SP. Sem intervalo.
- "Mês atual" só quando o selecionado não é o corrente.
- "Ver lançamentos do mês" -> `/entries` com o mesmo mês (aba Despesas).
- Trocar o mês: blocos em "Atualizando"; anúncio "Mostrando outubro de 2026".
- Mês inválido na URL: mês atual + toast "Mês inválido na URL. Mostrando o mês atual."

### 5.4 Cards do mês

`MonthSummary` na variante de 3 cards (3.3), mesma fonte do topo da tela de lançamentos (CA59: valores iguais para o mesmo mês). Mês sem lançamentos: R$ 0,00, "Zerado", "Sem lançamentos neste mês" (CA65). Saldo negativo com sinal e indicador textual (CA60).

### 5.5 Gráfico de barras: evolução mensal (DR3, D3, D15)

- `figure` "Evolução mensal" + subtítulo "nov/25 a out/26"; alternador "Gráfico | Tabela".
- Séries (`ComposedChart`): barra "Receitas" (`--chart-income`); barra "Despesas" empilhada com "Pagas" (`--chart-paid`) na base e "Pendentes" (`--chart-pending`, hachura diagonal 2px `--surface` a cada 6px) em cima, separação 2px `--surface`, raio 4 no topo; linha "Saldo realizado" contínua 2,5px com círculo cheio; linha "Saldo previsto" tracejada (6-4) com losango vazado; halo 4px `--surface`.
- Eixo Y de `min(0, menor valor)` a `max`, 4-6 ticks compactos pt-BR com negativos; linha de zero `--chart-zero-line` 1,5px; grade tracejada `--chart-grid`.
- Eixo X `out/26`, 12px `--chart-axis`; mês selecionado em `--text` 700 com faixa `--chart-cursor` (faixa ainda não implementada: item F4 da 13.2).
- Todas as despesas no cartão entram pelo mês de referência (mês do vencimento, CA63).
- Legenda própria acima do gráfico; tooltip próprio (`--tooltip-bg`, `--tooltip-border`) com "outubro de 2026" e seis linhas (Receitas, Despesas pagas, Despesas pendentes, Total de despesas, Saldo realizado + indicador, Saldo previsto + indicador).
- Teclado: gráfico focável, setas entre meses. Sem clique em barras.
- **Movimento (CA87)**: barras e linhas entram em 250ms só com `prefers-reduced-motion: no-preference`, lido ao vivo; com `reduce`, e na renderização do servidor, sem animação. Tooltip e coluna do eixo fixo nunca animam. Rolagem dos botões suave só sem movimento reduzido.
- **Contêiner estreito (D15)**: quando a largura útil do contêiner (medida ao vivo) fica abaixo de 560px, modo rolável: coluna do eixo Y fixa de 76px (mesma escala e ticks do gráfico, `aria-hidden`) + área rolável de 12 x 56px, focável, `role="group"` "Gráfico de evolução mensal, role para ver os 12 meses". Abre com o **mês selecionado centralizado** (coincide com o fim quando ele é o último da série). Scroll-snap por mês (item F3 da 13.2). Abaixo da área: botões 44x44 "Meses anteriores" / "Meses recentes", que rolam 3 meses e ficam desabilitados (`aria-disabled`) na ponta correspondente, e o texto "Deslize para ver os 12 meses". Scrollbar tematizada, sem fade nas bordas. Alturas 260 / 280 / 320.

### 5.6 Donut: despesas por categoria

- "Despesas por categoria" + "outubro de 2026"; só despesas (CA64).
- Raio interno 68%, 2px `--surface` entre fatias, ordem decrescente; `--chart-1..5` + "Outras" (`--chart-6`) a partir da 6a (D4).
- Centro: "Total de despesas" + total.
- Legenda própria com itens focáveis (`Tab`), cada um com rótulo "Moradia, R$ 1.500,00, 75%". Hover ou foco num item da legenda, ou hover numa fatia, destaca o par: fatia com contorno 3px `--text`; item da legenda com fundo `--surface-2` + anel 2px `--text`. As demais fatias não mudam (sem opacidade), então o destaque não depende só de cor. Tooltip com nome, valor e percentual (só no ponteiro sobre a fatia); "Outras" lista as agrupadas (tooltip e `title` do item).
- Entrada em 250ms só sem movimento reduzido (mesma regra de 5.5).

### 5.7 Alternativa acessível

- Resumo textual em `aria-describedby` (barras e donut).
- Tabela: barras com Mês | Receitas | Despesas pagas | Despesas pendentes | Total de despesas | Saldo realizado | Saldo previsto (12 linhas, rolável no mobile com coluna Mês fixa); donut com Categoria | Valor | Percentual + Total.

### 5.8 Estados por bloco

| Bloco | Carregando | Vazio | Erro |
|---|---|---|---|
| Cards | 3 skeletons | R$ 0,00, "Zerado", "Sem lançamentos neste mês" | "Não foi possível carregar o resumo." + "Tentar novamente" |
| Barras | 12 pares skeleton | 12 meses zerados + pílula opaca "Sem lançamentos de nov/25 a out/26" | "Não foi possível carregar a evolução mensal." + "Tentar novamente" |
| Donut | anel `--skeleton` + 3 linhas | "R$ 0,00", "Nenhuma despesa em outubro de 2026" + "Ir para lançamentos"; alternador "Tabela" oculto | "Não foi possível carregar as despesas por categoria." + "Tentar novamente" |

"Tentar novamente" refaz só o bloco (CA66).

---

## 6. Componentes

O `web/` ainda é o scaffold do `create-next-app` (só `app/page.tsx`, `app/layout.tsx`, `app/globals.css`): **nenhum componente existe em código**. A coluna "Origem" indica se o componente já estava especificado nas revisões anteriores (mantido ou alterado) ou se é novo na rev. 3. Primitivos em `web/components/ui/` (aprovado); tema em `web/components/theme/`; compartilhados em `web/components/`; específicos em `_components/` das rotas.

(Rev. 4: a nota acima descreve o estado antes da implementação. Hoje todos os componentes existem; o fechamento não cria componente novo. Peças da rev. 4 já no código: `CategoryCombobox` em `components/ui/combobox.tsx`; `EntryRow`, `EntryItem`, `RecentBadge` em `entries/_components/entry-drawer-context.tsx`; hook `usePrefersReducedMotion` em `web/lib/hooks/reduced-motion.ts`.)

### 6.1 Primitivos (`web/components/ui/`)

| Componente | Origem | Notas |
|---|---|---|
| `Button`, `IconButton` | Rev. 2, mantido | Estados da 1.8; `IconButton` com `aria-pressed`. |
| `Checkbox` | Rev. 2, mantido | Usado também em "Ainda não paguei". |
| `SegmentedControl` | Rev. 2, mantido | Tipo, forma, status; base da variante mobile de `Tabs`. |
| `Select` / `Combobox` | Rev. 2, mantido | Separador, opção "Cartão não encontrado". |
| `TextField`, `DateField`, `MoneyField`, `NumberDayField` | Rev. 2, mantido | |
| `Dialog`, `AlertDialog`, `Drawer`, `BottomSheet` | Rev. 2, alterado | `Drawer` precisa permitir que um `Esc` interno (painel de novo cartão) seja tratado antes de fechar o diálogo. |
| `Toast` + `ToastRegion` | Rev. 2, alterado | Ação opcional usada pelo D25; no mobile, abaixo da faixa de abas. |
| `Badge`, `Skeleton`, `Card`, `InlineAlert`, `EmptyState`, `ErrorState`, `Pagination`, `VisuallyHidden`, `UpdatingIndicator`, `HorizontalScrollRegion` | Rev. 2, mantido | `ErrorState` ganha variante compacta (resumo, lista da fatura). |
| `Tabs` (`TabList`, `Tab`, `TabPanel`) | **Novo** | Abas-link com ativação manual (D18), tabindex móvel, variante sublinhada (>= `md`) e segmented (< `md`) com fallback de rolagem horizontal; suporte a sticky. |
| `Disclosure` | **Novo** | Botão com `aria-expanded`/`aria-controls` + região; estados carregando/erro do conteúdo; sem animação com movimento reduzido. |
| `StickyBar` | **Novo** | Faixa opaca que gruda abaixo da navbar e informa quando um elemento-sentinela (seletor/botão do cabeçalho) saiu da vista, para mostrar os controles compactos (D16). |

### 6.2 Tema (`web/components/theme/`)

| Componente | Origem | Notas |
|---|---|---|
| `ThemeToggle` | Rev. 2, mantido | 2.2. |

### 6.3 Compartilhados de domínio (`web/components/`)

| Componente | Origem | Usado em |
|---|---|---|
| `AppHeader` + `MainNav` | Rev. 2, mantido | Lançamentos, Dashboard, Cartões + tema. |
| `MonthPicker` | Rev. 2, alterado | **Sem variante De/Até**; ganha variante compacta (setas + `out/26`) para a faixa de abas. |
| `MonthSummary` | Rev. 2 (`TotalCard`/`TotalsGroup`), alterado | Variantes "3 cards" e "compacto" (D20); sem nota de filtro de tipo; estados próprios. Usado no topo de `/entries` e no dashboard. |
| `SignIndicator` | Rev. 2, mantido | |
| `StatusBadge` | Rev. 2, mantido | Pendente / Pago / Recebida. |
| `EntryTypeLabel` | Rev. 2, alterado | Só no drawer e no resumo (a lista deixou de ter coluna Tipo). |
| `ReferenceMonthChip` | Rev. 2, alterado | "Fatura nov/26", agora pelo mês do vencimento (só exibe o dado da API). |
| `PaymentMethodLabel` | **Novo** | "PIX" ou nome do cartão + chip. |
| `CardFields` | **Novo** | Campos nome/fechamento/vencimento com validação e mapeamento de 400/409, compartilhados por `CardDrawer` e `InlineNewCardPanel`. |
| `Money` / `CivilDate` / `MonthLabel` | Rev. 2, mantido | `CivilDate` também para fechamento/vencimento. |

### 6.4 Tela de lançamentos (`web/app/(app)/entries/_components/`)

| Componente | Origem | Responsabilidade |
|---|---|---|
| `EntriesHeader` | **Novo** | Título, "+ Novo lançamento", `MonthPicker`, `MonthSummary`; sentinelas para a faixa compacta. |
| `EntriesTabs` | **Novo** | `Tabs` + `StickyBar` com mês compacto e botão compacto (>= `md`); preserva mês e filtros ao trocar (D19). |
| `ExpensesTab` | **Novo** (absorve `EntriesResults` da rev. 2) | Painel Despesas: filtros, subtotal, seleção, lista, paginação, estados. |
| `ExpenseFilters` | Rev. 2 (`EntriesFilters`), alterado | Status (sem Recebida), Categoria, Cartão com "PIX"; inline ou folha. |
| `CardFilter` | Rev. 2, alterado | Opção "PIX" no lugar de "Sem cartão (conta)". |
| `TabSubtotal` | **Novo** | Faixa de subtotal (D21), variantes despesas e receitas. |
| `ExpensesTable` / `ExpenseCardList` / `ExpenseCard` | Rev. 2 (`EntriesTable`/`EntryCard`), alterado | Sem coluna Tipo; coluna Forma; só despesas. |
| `SelectionToolbar`, `MobileSelectionBar` | Rev. 2, mantido | |
| `PayConfirmDialog` | Rev. 2, alterado | Textos "despesas". |
| `BatchErrorAlert` | Rev. 2, mantido | 404/422 do lote. |
| `InvoicesTab` | **Novo** | Painel Faturas: título, ajuda, blocos, vazio. |
| `InvoiceBlock` | **Novo** (substitui `InvoiceBar`) | Datas, totais, "Pagar fatura", "Fatura paga", `Disclosure`. |
| `InvoiceExpenseList` | **Novo** | Lista somente leitura da fatura, carregada ao expandir, estados próprios, link para a aba Despesas filtrada. |
| `PayInvoiceDialog` | Rev. 2, alterado | Mostra vencimento `dd/MM/yyyy`; feedback com valores da resposta. |
| `IncomeTab` + `IncomeTable` / `IncomeCardList` | **Novo** | Painel Receitas sem seleção nem ação; filtro de categoria; subtotal; paginação. |
| `NewEntryDrawer` / `NewEntryForm` | Rev. 2, alterado | Forma PIX/Cartão, "Ainda não paguei", linha de status inicial, aviso PIX futuro, atalho de cartão, toast D25. |
| `InlineNewCardPanel` | **Novo** | Painel embutido "+ Novo cartão" (3.9.3). |
| `TabEmptyState` | Rev. 2 (`EntriesEmptyState`), alterado | Vazios por aba (3.12); sem mensagens de combinação incompatível. |
| `EntriesSkeleton` | Rev. 2, alterado | Skeleton por região (resumo, painel por aba). |
| ~~`PeriodFilter`~~, ~~`TypeFilter`~~, ~~`InvoiceBar`~~, ~~`ActiveFiltersSummary`~~ | **Removidos** | Sem intervalo, sem tipo, fatura na aba própria; a linha de contexto é substituída pelo `h2` do painel + qualificador do subtotal. |

### 6.5 Cartões (`web/app/(app)/cards/_components/`)

| Componente | Origem | Responsabilidade |
|---|---|---|
| `CardsList` / `CardItem` | Rev. 2, alterado | Ação "Ver despesas do mês" (DR8). |
| `CardDrawer` / `CardForm` | Rev. 2, alterado | Usa `CardFields`; ajuda do vencimento revista. |
| `CardsEmptyState`, `CardsSkeleton` | Rev. 2, mantido | |

### 6.6 Dashboard (`web/app/(app)/dashboard/_components/`)

| Componente | Origem | Responsabilidade |
|---|---|---|
| `DashboardHeader` | Rev. 2, mantido | "Mês atual", "Ver lançamentos do mês". |
| `SummaryCards` | Rev. 2, alterado | Usa `MonthSummary` (3 cards). |
| `MonthlyChart`, `ChartLegend`, `ChartTooltip`, `CategoryDonut` + `CategoryLegend`, `ChartCard`, `ChartDataTable`, `BlockErrorBoundary`, `*Skeleton` | Rev. 2, mantido | |

---

## 7. Fluxos de interação

### 7.1 Abrir e navegar na tela de lançamentos
1. `/entries` sem parâmetros: mês atual (SP), aba Despesas, sem filtros, página 1.
2. Troca de mês (cabeçalho ou faixa compacta): aba e filtros mantidos, página 1, seleção limpa, blocos recolhidos; resumo e painel "Atualizando"; anúncio (CA68).
3. Troca de aba (clique ou teclado): só o painel muda; mês e filtros de cada aba preservados; página 1 (CA69, D19).
4. Rolagem: a faixa de abas gruda; em >= `md`, mês compacto e "+ Novo lançamento" aparecem nela quando os do cabeçalho saem da vista.
5. Voltar/avançar do navegador restaura mês, aba, filtros e página.

### 7.2 Filtrar despesas ou receitas
1. Despesas: status, categoria, cartão (inclui "PIX"); >= `md` aplica ao mudar; < `md` folha com "Aplicar".
2. Receitas: categoria, aplica ao mudar.
3. Subtotal atualiza com o filtro; o resumo do topo não muda (CA47, CA50, CA54).
4. "Limpar filtros" volta ao padrão da aba sem mexer no mês nem nas outras abas.

### 7.3 Criar lançamento
1. "+ Novo lançamento" abre o drawer; foco em Tipo (Despesa).
2. Preenche; Categoria pelo combobox (sugestão existente ou `Usar "<texto>"`); Forma PIX mostra "Ainda não paguei" e a linha de status inicial; Cartão mostra o campo Cartão e "pendente, na fatura do cartão"; Receita fixa PIX.
3. Opcional: "+ Novo cartão" -> painel embutido -> "Criar cartão" -> cartão selecionado, foco no campo, dados intactos; 409 inline; `Esc`/Cancelar volta ao campo Cartão (3.9.3).
4. Salvar: validação -> envio -> erros inline / banner.
5. Sucesso: drawer fecha, foco no gatilho, toast com fatura e vencimento da resposta (cartão) e ação para o mês/aba certos quando não aparece na tela (D25); se aparece na página atual, destaque estático de ~2s com selo "Novo" (3.9.2).

### 7.4 Pagar despesas (individual ou lote)
1. Aba Despesas: marca pendentes (pagas indisponíveis); toolbar "n selecionados · soma".
2. "Marcar como pago (n)" ou "Marcar como pago" da linha -> `AlertDialog`, foco em "Cancelar".
3. Confirma -> 3.10. Resumo: pendente cai e pago sobe pela soma; saldo realizado cai; receitas e previsto iguais (RF13, CA51). Faturas afetadas atualizadas (CA70).

### 7.5 Pagar fatura
1. Aba Faturas: blocos por vencimento; expande para conferir as despesas (opcional).
2. "Pagar fatura" -> confirmação com cartão, mês, vencimento, quantidade/soma pendentes.
3. Confirma -> toast com valores da resposta; bloco com pendente R$ 0,00, botão desabilitado e "Fatura paga"; resumo e aba Despesas atualizados (CA72).
4. Para pagar só parte da fatura: link da lista expandida leva à aba Despesas filtrada pelo cartão (DR7).

### 7.6 Cartões
1. `/cards` -> lista ou vazio. "Novo cartão" -> drawer -> salvar -> toast.
2. "Editar" -> drawer com aviso de não retroatividade; 409 inline.
3. "Ver despesas do mês" -> `/entries`, aba Despesas, mês atual, filtrada pelo cartão (DR8).

### 7.7 Dashboard
1. `/dashboard` -> mês atual; três blocos em paralelo com skeleton.
2. Troca de mês -> blocos "Atualizando"; barras terminam no novo mês.
3. Tooltip (hover/teclado), rolagem do gráfico no mobile (eixo Y fixo), alternador de tabela, destaque de categoria pela legenda (foco ou ponteiro).
4. Bloco com erro -> só ele mostra "Tentar novamente".

### 7.8 Tema
1. Primeira visita sem preferência: tema do sistema, ao vivo.
2. Sol/lua: troca imediata, ícone e `aria-pressed` atualizam, foco fica; preferência persiste.
3. Nenhum estado se perde (drawer, painel de novo cartão, digitação, seleção, aba, filtros, blocos expandidos, tooltip).
4. Com diálogo aberto, o botão fica sob o scrim; a troca só vem do sistema e só sem preferência salva (2.2; desvio 2, pendente).

---

## 8. Acessibilidade e verificação de tema (checklist)

- `lang="pt-BR"`; `h1` por página; `h2` para resumo e painel da aba; `h3` por bloco de fatura.
- Contraste conforme 1.9 nos dois temas e em todos os estados da 1.8 (inclusive desabilitado >= 3:1 e "atualizando" sem perda).
- Foco visível em todo controle: abas, disclosure, painel de novo cartão, gráfico, regiões roláveis, alternador.
- Alvos >= 44x44: abas, checkboxes, botões de linha, setas do `MonthPicker` (inclusive na faixa compacta), "+ Novo cartão", disclosure, paginação, fechar, tema, itens da navbar.
- Abas: `tablist`/`tab`/`tabpanel`, `aria-selected`, setas/Home/End, ativação manual; aba ativa indicada por peso, cor e indicador (não só cor).
- Rótulos acessíveis:
  - Checkbox: "Selecionar Mercado, R$ 250,00, 15/10/2026". Desabilitado: "Mercado já pago".
  - Cabeçalho: "Selecionar todas as despesas pendentes desta página".
  - Ação de linha: "Marcar Mercado como pago".
  - Pagar fatura: "Pagar fatura Nubank de novembro de 2026"; desabilitado descrito por "Fatura paga".
  - Disclosure: "Ver 2 despesas da fatura Nubank" com `aria-expanded`.
  - "+ Novo cartão": `aria-expanded` + `aria-controls`.
  - Tema: `aria-label="Tema escuro"` + `aria-pressed`.
- Diálogos: `aria-labelledby`, foco preso, `Esc` (exceto durante envio; no painel de novo cartão, `Esc` fecha só o painel e devolve o foco ao campo Cartão, RNF09; no combobox aberto, `Esc` fecha só a lista), fundo inerte, foco devolvido ao gatilho.
- Live regions: mês/aba/filtros (polite), seleção (debounce 500ms), cartão criado no drawer (status), erros (alert). Sem anúncios duplicados.
- Gráficos: resumo textual + tabela; nenhuma informação só por cor.
- `prefers-reduced-motion`: sem deslizar, sem shimmer, sem animação de gráfico, sem rolagem suave, expandir fatura e abrir painel instantâneos, barra de progresso estática; troca de tema sempre instantânea (CA87). O destaque de recém-criado é estático com e sem movimento reduzido.
- Zoom 200% e 320px sem rolagem horizontal da página (só a faixa de abas, quando não couber, e regiões internas roláveis e focáveis).
- **Verificação por tema** (tester, RNF11): para cada tela/estado do CA82 em claro e escuro: resumo (com dados, zerado, erro); abas Despesas (com dados, vazia, filtrada vazia, com seleção, banner 404/422, atualizando), Faturas (bloco recolhido, expandido, lista carregando/erro, fatura paga com botão desabilitado, vazia), Receitas (com dados, vazia); faixa de abas grudada com conteúdo rolando por baixo; drawer de lançamento (com erros, com painel de novo cartão aberto e com 409) e de cartão; modais; folha de filtros; toasts; `/cards`; dashboard (com dados, vazio, erro, tooltip, tabela). Conferir também: tooltip do Recharts sem fundo branco no escuro; `select` aberto e date picker no tema; autofill; placeholder; barras de rolagem (inclusive da faixa de abas); nada sob a navbar ou a faixa de abas abaixo de AA; nenhum elemento fixo cobrindo texto ou botões (última linha visível acima da barra de seleção; rodapé do drawer acima do teclado). Matriz detalhada do fechamento em 13.3.

---

## 9. Microcopy (referência)

| Contexto | Texto |
|---|---|
| Botões principais | + Novo lançamento / Novo cartão / + Novo cartão (drawer) |
| Abas | Despesas / Faturas / Receitas |
| Tipos | Despesa / Receita |
| Formas | PIX / Cartão |
| Status | Pendente / Pago / Recebida |
| Opção PIX | Ainda não paguei |
| Status inicial | Status inicial: paga. / pendente. Você poderá marcá-la como paga depois. / pendente, na fatura do cartão. / recebida. |
| Receita na forma | Receitas são sempre via PIX. |
| PIX com data futura | Data futura: ela será registrada como paga hoje. Marque "Ainda não paguei" se o PIX ainda não saiu. |
| Resumo | Resumo de outubro de 2026 · Receitas · Despesas · Pago · Pendente · Saldo realizado · Saldo previsto |
| Subtotal | Subtotal · todas as despesas do mês / com os filtros aplicados · 12 despesas · Total · Pago · Pendente |
| Chip de fatura | Fatura nov/26 |
| Bloco de fatura | Nubank · Fecha 25/10/2026 · Vence 05/11/2026 · Total · Pago · Pendente · Pagar fatura · Ver 2 despesas / Ocultar despesas |
| Fatura sem pendências | Fatura paga |
| Ajuda da aba Faturas | Cada fatura aparece no mês em que vence. |
| Link da lista da fatura | Pagar despesas individualmente na aba Despesas |
| Confirmação de fatura | Pagar a fatura Nubank de novembro de 2026? · Vence em 05/11/2026 |
| Sucesso de fatura | Fatura Nubank de nov/26 paga: 2 despesas, R$ 100,00. |
| Fatura vazia ao pagar | Nenhuma despesa pendente nesta fatura. Nada foi alterado. |
| Sucesso criação (cartão) | Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026. |
| Sucesso criação (PIX) | Despesa criada como paga. / Despesa criada como pendente. / Receita criada. |
| Fora da tela atual | Ela está em novembro de 2026. · Ver novembro / Ver receitas / Ver despesas / Ela não aparece nos filtros atuais. · Limpar filtros |
| Selo de recém-criado | Novo (leitor de tela: "Novo lançamento recém-criado") |
| Combobox de categoria | Sugestões · Usar "Lazer" |
| Painel de cartão | Novo cartão · Criar cartão · Cancelar · Conclua ou cancele o novo cartão · Cartão "Inter" criado e selecionado. |
| 409 cartão | Já existe um cartão com esse nome. |
| Vencimento (ajuda) | Define o mês em que a fatura aparece. |
| Ajuda `/cards` | Compras até o dia de fechamento entram na fatura que vence logo depois. A fatura aparece no mês do vencimento. |
| Atalho `/cards` | Ver despesas do mês |
| Aviso de edição de cartão | Alterações valem só para novos lançamentos. Os já registrados continuam na fatura em que foram lançados. |
| Vazios | Nenhuma despesa em outubro de 2026 / Nenhuma despesa para os filtros selecionados em outubro de 2026 / Nenhuma fatura neste mês / Nenhuma receita em outubro de 2026 / Nenhum cartão cadastrado / Nenhuma despesa em outubro de 2026 (donut) |
| 404 lote | Nenhuma despesa foi alterada. 2 despesas selecionadas não foram encontradas: |
| 422 lote | Nenhuma despesa foi alterada. Receitas não podem ser marcadas como pagas: |
| Erros de região | Não foi possível carregar o resumo do mês. / as despesas. / as faturas. / as receitas. / as despesas desta fatura. |
| Atualizando | Atualizando… |
| Gráfico estreito | Deslize para ver os 12 meses · Meses anteriores · Meses recentes |
| Tema (tooltip visual) | Tema escuro: ativado / Tema escuro: desativado |
| Retry | Tentar novamente |

---

## 10. Fora de escopo (UI)

- Edição/exclusão de lançamentos (B3), exclusão de cartão, estorno, detalhe de lançamento.
- Filtro de intervalo de/até, "todos os períodos" e filtro de tipo (B6).
- Seleção ou pagamento parcial dentro do bloco de fatura (DR7); status de fatura aberta/fechada/vencida; limite de crédito.
- Pré-visualização de fatura, vencimento ou mês de referência no formulário de lançamento ou de cartão (P24).
- Contadores nas abas; ordenação por coluna; seletor de tamanho de página; "selecionar todos os resultados"; múltiplas categorias/cartões no filtro.
- Pré-selecionar o tipo pela aba ativa (ex.: Receita ao abrir o drawer na aba Receitas): não adotado para manter P26; pode ser revisto.
- Opção "seguir o sistema" após uma escolha de tema (P27); temas além de claro/escuro; alto contraste.
- Clique em barra/fatia para navegar.

---

## 11. Pontos para aprovação

**Novos na rev. 3**

1. **Topo "fixo" como cabeçalho persistente + faixa de abas sticky** (D16): só a faixa de abas gruda ao rolar; em >= `md` ela ganha mês compacto e "+ Novo lançamento" quando os do cabeçalho saem da vista; no mobile, só as abas (o botão de novo lançamento fica no cabeçalho). Alternativa: grudar o cabeçalho inteiro (custa ~250px fixos).
2. **Atalho "+ Novo cartão" embutido** no drawer (D22, 3.9.3), com "Salvar lançamento" desabilitado enquanto o painel está aberto e `Esc` fechando primeiro o painel.
3. **"Ainda não paguei" oculto fora de Despesa + PIX**, com a linha "Status inicial" explicando o resultado em todos os casos (D23).
4. **Aviso para PIX com data futura** (D24), condicionado à resposta de **B8** (se B8 mudar, por exemplo para nascer pendente com data futura, o aviso sai e a linha de status inicial passa a refletir a nova regra).
5. **Filtros por aba com prefixo na URL e preservados ao trocar de aba e de mês** (D19). Alternativa: descartar os filtros ao sair da aba.
6. **Resumo compacto em card único no mobile** (D20) x 3 cards em >= `md` e no dashboard.
7. **Faixa de subtotal sempre visível**, com qualificador "todas as despesas do mês" sem filtros (D21). Alternativa: só mostrar com filtro ativo.
8. **Aba Faturas**: blocos em coluna única, lista recolhida por padrão e carregada ao expandir, link para a aba Despesas filtrada, "Fatura paga" junto do botão desabilitado (D17).
9. **Abas com ativação manual e variante segmented no mobile** (D18); sem contadores nas abas.
10. **Toast pós-criação com ação para o mês/aba onde o lançamento aparece** (D25).
11. **Dependências para o ADR (sem nomes de endpoint aqui)**: a fonte de faturas do mês precisa trazer a **quantidade de pendentes** por fatura para a confirmação (senão a confirmação mostra só a soma); a lista de despesas da fatura precisa poder ser buscada por bloco (carregamento ao expandir); a resposta da criação precisa trazer `referenceMonth` e a data de vencimento para o toast. As datas exibidas com despesas divergentes seguem **B9** (o design só exibe o que a API retorna).

**Herdados da rev. 2, ainda sem aprovação registrada (sem mudança de conteúdo)**

12. Valores do tema claro, ajustes do escuro e tokens além da lista original do ADR (`--surface-active`, `--input-bg`, `--header-bg`, `--primary-strong-hover`, `--primary-strong-active`, `--primary-border`, `--focus-color`, `--tooltip-border`, variantes `*-text`), incluindo a borda obrigatória `--primary-border` (1.2, 1.9).
13. Navbar em duas linhas abaixo de `sm` (D9); estado "atualizando" sem opacidade (D11); campo Cartão só com Despesa + Cartão (D12); gráfico rolável em telas estreitas (D15).
14. Correção no design system (doc-writer): caminho `web/app/styles/tokens.css` e tabela de tokens dos dois temas. **Atendida:** `docs/design/design-system.md` foi corrigido e agora contém a tabela de tokens.

**Novo na rev. 4**

15. **Desvio 2 da seção 12** (tema com diálogo aberto, B1 da spec de fechamento): aprovar a manutenção de 2.2 ou pedir mudança de comportamento.

---

## 12. Desvios aceitos na implementação

A feature foi implementada e aprovada no code review (branch `feature/finance`). Os pontos abaixo divergem deste design ou da spec; onde houver conflito com as seções anteriores, vale o que está aqui e no código.

| # | Seção | Previsto | Implementado | Situação |
|---|---|---|---|---|
| 1 | 3.3 (cabeçalho de `/entries`) | Ordem visual do cabeçalho comum | O cabeçalho de `/entries` foi implementado na **ordem do DOM** (ordem de leitura = ordem do código), sem depender de reordenação visual; a disposição pode diferir em detalhes do desenho. | Aceito |
| 2 | 2.2 / spec RF27, CA84 (G7, B1 do fechamento) | Spec: alternar o tema "com drawer, atalho de novo cartão ou modal aberto". | Mantido o 2.2: com qualquer `<dialog>` modal aberto (drawer de lançamento ou de cartão, painel "+ Novo cartão", modal de confirmação, folha de filtros), o botão de tema fica inerte sob o scrim (fundo inerte nativo, D7). A troca nesse estado só ocorre por mudança do tema do sistema **sem preferência salva**, e preserva diálogo, dados digitados, seleção, aba e cores. Com preferência salva, o tema não muda até o diálogo fechar. CA84 passa a ser lido como "a troca de tema, quando ocorre com um diálogo aberto, preserva estado e cores"; `theme.pw.ts` já testa assim. | **Aprovado** pelo usuário em 2026-10-25 (B1). |

---

## 13. Fechamento (rev. 4): conferência, divergências e matriz de verificação

Base: `docs/specs/lancamentos-financeiros-fechamento.md` (RFF01, RFF03, CAF02-CAF04, CAF06-CAF09). Sem tela nem componente novo.

### 13.1 Follow-ups de UX conferidos no working tree

| Follow-up | Código | Situação |
|---|---|---|
| Eixo Y fixo no gráfico estreito (CAF04, D15) | `monthly-chart.tsx`, `lib/dashboard/chart-data.ts` | Conforme 5.5 (coluna fixa de 76px com a mesma escala, abertura no mês selecionado centralizado, botões de 3 meses). Pendentes: F3, F4, F5. |
| Destaque ~2s do recém-criado (CAF02) | `entry-drawer-context.tsx`, `expenses-list.tsx`, `income-panel.tsx`, `globals.css` (`.row-highlight`) | Conforme 3.9.2 (estático, fundo + contorno 2px + selo "Novo" com texto oculto, tabela e cards, Despesas e Receitas). Pendentes: F2, F6. |
| Combobox ARIA de categoria (CAF03, B1) | `components/ui/combobox.tsx` | Conforme 3.9.1 (com chevron). Pendente: F1. |
| Gráficos sob `prefers-reduced-motion` (CAF04, CA87) | `lib/hooks/reduced-motion.ts`, `monthly-chart.tsx`, `category-donut.tsx` | Conforme 5.5/5.6 (ao vivo; servidor assume `reduce`; tooltip e eixo fixo nunca animam). |
| Destaque do donut pela legenda (CAF04) | `category-donut.tsx` | Conforme 5.6 (design ajustado: contorno 3px na fatia; destaque nos dois sentidos, fatia e legenda). |

### 13.2 Divergências para o frontend-dev

| # | Onde | Divergência | Ação esperada |
|---|---|---|---|
| F1 | `combobox.tsx` | A lista abre em **qualquer** foco, inclusive no foco programático do envio inválido (3.9.2, "foco no primeiro inválido"). Com o campo vazio, a lista mostra todas as categorias e, por ser sobreposta abaixo do input, **cobre a mensagem "Informe a categoria."** e a ajuda. | Não abrir a lista ao receber foco; abrir só ao digitar, com `↓`/`↑` ou com clique no input. |
| F2 | `entry-drawer-context.tsx` (`markRecent`) | Os 2s começam a contar no sucesso, antes de a revalidação trazer a linha. Com resposta lenta, o destaque aparece por menos tempo ou nem aparece. | Contar os ~2s a partir da primeira renderização da linha destacada (ou do fim da revalidação). |
| F3 | `monthly-chart.tsx` | Área rolável sem scroll-snap (5.5). | `scroll-snap-type: x proximity` com alinhamento por mês, sem atrapalhar a abertura centralizada nem os botões de 3 meses. |
| F4 | `monthly-chart.tsx` | Mês selecionado sem a faixa `--chart-cursor` (5.5): só o rótulo muda (700, `--text`). A faixa aparece apenas no hover/foco. | Desenhar a faixa fixa do mês selecionado em `--chart-cursor`, atrás das séries, nos dois modos. |
| F5 | `monthly-chart.tsx` | Verificar: (a) dupla parada de `Tab` (o contêiner `tabIndex=0` e a superfície do Recharts com `accessibilityLayer`); (b) no modo estreito, a navegação por setas não rola a área para manter o mês ativo visível. | Uma única parada de foco por gráfico; o mês ativo pelo teclado deve ficar sempre visível na área rolável. |
| F6 | `new-entry-drawer.tsx` (`markRecent` sempre chamado) | O id é marcado mesmo quando o lançamento é de outro mês. Se o usuário aciona "Ver novembro" em menos de 2s, a linha recebe destaque no outro mês, o que contraria o CAF02 ("lançamento de outro mês não gera destaque"). | Marcar só quando `referenceMonth` = mês selecionado e o tipo corresponde à aba ativa. |

Fora do escopo do frontend-dev, mas a registrar: o CAF07 cita botão "perigo", que **não existe** no design nem no código (`Button` tem primário, secundário e terciário; as confirmações irreversíveis usam o primário com aviso `--warning-text`). O tester deve cobrir as variantes existentes, e o planner deve corrigir o CAF07.

### 13.3 Matriz de verificação (CA82, CA83, CA86)

Tudo em **claro e escuro**, por tema salvo (cookie) e, onde indicado, pelo sistema. Critério geral: axe sem violações nem `incomplete` de color-contrast fora da allowlist (PF04); texto >= 4,5:1 e componentes/bordas/foco/desabilitado >= 3:1 contra o **fundo efetivo** (pares da 1.9).

**Botões (CA83).** Variantes: primário, secundário, terciário/link, ícone (inclui o tema e "Meses anteriores/recentes"), aba (>= `md` e segmented < `md`), paginação (página atual e setas), segmented (Tipo/Forma/Status). Pseudo-estados forçados via CDP `CSS.forcePseudoState` (T2).

| Estado | Como produzir | O que verificar |
|---|---|---|
| default | tela real | Tokens da 1.8; texto/ícone contra o fundo do botão e borda (`--border-strong` ou `--primary-border`) contra o fundo ao redor (`--surface`, `--bg`, `--surface-2`). |
| hover | `:hover` forçado | Fundo muda (`--surface-2` ou `--primary-strong-hover`) sem perder AA. Terciário: sublinhado presente. |
| focus-visible | `Tab` real (preferível) ou `:focus-visible` forçado | Anel `--focus-color` 2px + afastamento visível e >= 3:1 contra o fundo ao redor; não cortado por `overflow` (abas, faixa sticky, células). |
| active | `:active` forçado | `--surface-active` / `--primary-strong-active`; texto >= 4,5:1 (rev. 5, escuro: `--text-muted` sobre `--surface-active` é 4,60 e `--border-strong` sobre `--surface-active` é 3,03, margens pequenas). |
| carregando | stub lento ("Salvar lançamento", "Criar cartão", "Pagar fatura", confirmação de lote) | Spinner + texto mantêm cor e contraste do default; `aria-busy`; novo clique ignorado. Com `reduce`, spinner parado. |
| disabled | "Pagar fatura" com fatura paga, "Salvar" com painel de cartão aberto, "Marcar como pago" sem seleção, seta de gráfico na ponta, segmento "Cartão" com Receita | `--surface-2` + `--text-disabled` (>= 3:1; 4,04 / 3,66) e borda `--border-strong`; continua focável (`aria-disabled`) e tem o anel de foco. |

**Estados de tela (CA82, CAF06).**

| Estado | Como produzir | O que verificar em cada tema |
|---|---|---|
| Atualizando (resumo, painel da aba, bloco de fatura, blocos do dashboard) | stub com atraso na troca de mês/filtro | Sem opacidade nem scrim; barra de progresso `--accent`; "Atualizando…" `--text-muted` >= 4,5:1; `aria-busy`. Inclui CA85 no escuro. |
| Banners 404 e 422 do lote | stub responde 404/422 ao lote | `InlineAlert` `--surface`, borda `--danger`, ícone `--danger-text`, texto `--text`; fechar 44x44 com foco visível. |
| Painel "+ Novo cartão" (aberto, com erro 409, com erro de rede) | drawer de lançamento, Cartão, "+ Novo cartão" | Painel `--surface-2` com contorno `--border-strong` contra `--surface`; inputs e erro conforme 1.9; "Salvar lançamento" desabilitado + texto do rodapé. |
| Drawer de cartão (criar, editar com aviso, 409, 404 na edição) | `/cards` | Aviso `--accent`, erro inline, banner; scrim e borda do drawer conforme 1.9; rodapé opaco. |
| Modal de confirmação (lote, individual, "Pagar fatura", erro inline) | aba Despesas / Faturas | `--surface` opaco sobre scrim; aviso `--warning-text`; erro inline `--danger-text`; foco em "Cancelar". |
| Folha de filtros mobile | 360px, "Filtros (n)" | Selects/segmented no tema; rodapé "Limpar/Aplicar" opaco; `select` aberto e lista nativa no tema (`color-scheme`). |
| Toasts (sucesso, erro, com ação) | criar/pagar/erro | `--surface-2`, borda esquerda semântica, ícone `*-text`, ação `--accent` >= 4,5:1; posição não cobre a barra de seleção nem a faixa de abas. |
| Tooltip dos gráficos (barras e donut) | hover ou setas no gráfico | `--tooltip-bg` opaco (nunca branco no escuro); textos e marcadores conforme 1.9; borda `--tooltip-border`. |
| Tabela alternativa (barras e donut) | alternador "Tabela" | Cabeçalho `--text-muted`, células `--text`; coluna Mês fixa opaca ao rolar; região rolável focável com anel visível. |
| Rev. 4: destaque de recém-criado, combobox aberto (opção ativa e `Usar "..."`), legenda do donut com item ativo | criar lançamento; digitar na Categoria; focar a legenda | Pares da nota rev. 4 em 1.9; selo "Novo" legível; nada sobreposto ao erro do campo (F1). |
| Rev. 5: cartões sobre o fundo | `/entries`, `/dashboard`, `/cards` | Todo `--surface` apoiado em `--bg` tem borda (`--border` ou `--border-strong`) e `--shadow-card`; sombra visível nos dois temas; nenhuma cor literal de sombra fora de `tokens.css`. |

**Gráficos e controles nativos após alternar (CA86, CAF09).**

| Cenário | Como alternar | O que verificar no tema de chegada |
|---|---|---|
| Dashboard aberto, com tooltip visível e, à parte, em 360px (eixo fixo) | botão de tema | Eixos (`--chart-axis`), grade, linha do zero, legenda, tooltip, cursor e as 5 séries + fatias do donut assumem os valores do novo tema sem recarregar; contraste das séries conforme 1.9; nenhum `fill`/`stroke` com cor literal ou antiga. |
| Drawer de lançamento aberto (com texto digitado e painel de cartão aberto) | sistema, sem preferência salva (desvio 2) | Dados preservados; `color-scheme` efetivo de `input[type=date]`, `select`, combobox e scrollbar igual ao tema ativo; autofill e placeholder no tema. |
| `/entries` e `/dashboard` sem diálogo | botão de tema | `color-scheme` computado do `<html>` e dos controles nativos (data, mês, select) acompanha o tema; scrollbars (`--scrollbar-*`) da página, da faixa de abas e da área do gráfico. |
