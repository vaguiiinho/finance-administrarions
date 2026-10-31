# Design: Listagem de lançamentos com mês e status padrão orientados a pendências

- Data: 2026-10-30 (rev. 2, com as decisões do usuário)
- Branch: `feat/listies`
- Autor: ui-designer
- Status: **Aprovado** pelo usuário (2026-10-30, informado pelo coordenador). Decisões na seção 13.
- Entradas: `docs/specs/listagem-mes-e-status-padrao.md` (rev. 2; a spec está hoje na rev. 3), `docs/adr/0007-listagem-mes-e-status-padrao.md` (Proposto na época; hoje Aceito), `docs/design/design-system.md` (rev. 7), `docs/design/lancamentos-financeiros.md` (seções 1.8, 3.3 a 3.7, 3.9.2, 3.10, 3.12, 8), `docs/design/autenticacao-autorizacao.md` (seção 17) e o código atual de `web/features/entries`.
- Escopo: `EntriesScreen`, em `/entries` e `/demo/entries`. Nenhum token novo, nenhuma tela nova. Dashboard e aba Receitas não mudam.

Este documento não contém código. Os nomes de componentes vêm do ADR ou são sugestões para o frontend-dev. A spec e o ADR não foram alterados: os conflitos estão na seção 12.

### Histórico de revisões

- **rev. 2 (2026-10-30):** aprovação do usuário. Fechados os pontos da seção 13 e os conflitos C1, C2, C4, C5, C6 e C9. Nova decisão DL11: o atalho de fatura paga abre Despesas em "Todos", com rótulo próprio.
- **rev. 1 (2026-10-30):** versão inicial.

---

## 0. Decisões de design

| Id | Decisão | Motivo |
|---|---|---|
| DL1 | O aviso de avanço é um **banner persistente e dispensável** (`InlineAlert`, tom `info`), primeiro elemento da tela, acima do `h1`. Não é toast. | Um toast some em 5 s, e o aviso explica uma troca de mês que dura toda a visita. Acima do `h1`, o banner não exige mudança em `EntriesHeader` e fica junto do seletor, antes do resumo, também em 360px. |
| DL2 | O aviso tem **um único modelo por variante**, com mês por extenso e ano, para um mês ou vários e dentro ou fora do ano. | O mesmo texto serve para salto longo e virada de ano. Não há intervalo de meses para calcular nem mês abreviado para confundir. |
| DL3 | O aviso **não tem ação própria**. "Mês atual" continua no seletor. | RF05 já o mantém ali, a poucos pixels. Uma segunda ação duplicaria o controle e dificultaria retirar o aviso. |
| DL4 | O texto do aviso diz "sem pendências em" ou "de ... em diante", **nunca** "você não tem pendências". | Sob PV2, pode haver pendência em mês anterior (CA14, CA19). A frase precisa continuar verdadeira nesses casos. |
| DL5 | `InvoiceStatusFilter` repete o padrão de `ExpenseFilters`: `SegmentedControl` inline em >= `md`, botão "Filtros (n)" e `BottomSheet` em < `md`. | RF16. O usuário aprende uma única forma de filtrar. |
| DL6 | Abaixo de `md`, uma linha de texto **"Status: `<status ativo>`"** fica fora da folha, junto do botão "Filtros", nas duas abas. Aprovada. | Em < `md` o padrão fica escondido na folha, e "Filtros (1)" não diz qual é o filtro. Mitiga R1. |
| DL7 | "Limpar filtros" e "Limpar" levam o foco ao `h2` do painel. | O botão some depois de usado (RF11, CA36). Sem destino, o foco cairia em `body`. |
| DL8 | Os vazios com filtro mantêm o título de CA38 e ganham uma descrição por status. A descrição **não promete** que há itens fora do filtro. | A leitura filtrada não sabe se existem itens pagos (CA39 e CA53 são o caso de mês vazio). O título sozinho fala em "filtros selecionados" para quem não escolheu nenhum. |
| DL9 | Sem cartão, a aba Faturas **não mostra** o controle de status. Aprovada. | Sem cartão não há fatura possível, e RF20 pede o vazio "sem exigir limpar filtros". Diverge da letra de RF11: ver C1. |
| DL10 | A linha de filtros passa a **quebrar linha** a partir de `md`. | "Limpar filtros" agora aparece quase sempre. Com Status, Categoria e Cartão, a linha única não cabe com folga em 768px. |
| DL11 | O atalho de **fatura paga** abre Despesas em "Todos" (`d_status=ALL`), com o rótulo **"Ver despesas do cartão na aba Despesas"**. O atalho de fatura não paga não muda. Aprovada. | Com o status vigente, o atalho cairia em lista vazia sob "Pendente", e "Pagar despesas individualmente" não faz sentido sem nada a pagar. O rótulo já existe na demo e não fala em pagar. Diverge da letra de RF19: ver C5. |

---

## 1. Hierarquia de informação

O resumo, as abas e os painéis seguem a ordem do design de origem (3.1). O que muda está em negrito.

1. **Aviso de avanço**, só quando houver avanço (seção 4).
2. Cabeçalho comum: `h1`, "+ Novo lançamento", seletor de mês, resumo do mês inteiro (nunca afetado por filtro, CA32).
3. Faixa de abas.
4. Painel da aba ativa:
   - **Despesas:** `h2`, filtros **(Pendente por padrão)**, subtotal **(reflete o padrão, CA31)**, seleção, lista, paginação.
   - **Faturas:** `h2`, **filtro de status**, contagem e ajuda, blocos. **Sem subtotal** (RF09).
   - **Receitas:** sem mudança (RF14).

Racional: o aviso vem antes de tudo porque explica por que o mês na tela não é o corrente. A pessoa precisa dessa resposta antes de ler o resumo, para não concluir que perdeu dados (R2).

---

## 2. Layout por breakpoint

### 2.1 Abaixo de `md` (aba Faturas)

```
+----------------------------------+
| (i) Sem pendências em outubro de |  aviso: só com avanço
|     2026. Mostrando dezembro de  |
|     2026, o próximo mês com  [X] |  fechar 44x44
|     pendências.                  |
+----------------------------------+
| Lançamentos                      |  h1
| [ + Novo lançamento            ] |
| [<]  dezembro de 2026  [>]       |
| [Mês atual]                      |
| (resumo do mês)                  |
+----------------------------------+
| [Despesas][ Faturas ][Receitas]  |  sticky
+----------------------------------+
| Faturas de dezembro de 2026      |  h2 (tabindex -1)
| [ Filtros (1) ]  [Limpar]        |
| Status: Pendente                 |  DL6, 14px --text-muted
| 1 fatura. Cada fatura aparece    |
| no mês em que vence.             |
| (blocos de fatura)               |
+----------------------------------+
```

Folha de filtros da aba Faturas, com o `BottomSheet` existente:

```
+----------------------------------+
| Filtros                          |  título da folha
+----------------------------------+
| Status                           |
| [ Todos |*Pendente*| Pago ]      |
+----------------------------------+
| [Limpar]              [Aplicar]  |
+----------------------------------+
```

- "Limpar" na folha só altera o rascunho para "Todos". Nada é aplicado até "Aplicar" (CA37). `Esc`, scrim ou fechar descartam o rascunho.
- A aba Despesas usa o mesmo botão, a mesma linha "Status: ..." e a folha atual, com Status, Categoria e Cartão.
- A linha "Status: ..." mostra sempre o status aplicado (Pendente, Pago ou Todos), não o rascunho da folha. Sem cartão, em Faturas, ela não aparece, assim como o botão (DL9).
- O aviso reserva a coluna do `InlineAlert` e tem cerca de 100px em 360px. Sem aviso, nenhum espaço é reservado.
- Em 320px ou zoom de 200%, o texto quebra. Não há rolagem horizontal.

### 2.2 De `md` a `lg`

```
+--------------------------------------------------------------+
| (i) Sem pendências em outubro de 2026. Mostrando dezembro de  |
|     2026, o próximo mês com pendências.                  [X]  |
+--------------------------------------------------------------+
| Lançamentos                              [ + Novo lançamento ]|
| [<] dezembro de 2026 [>]   [Mês atual]                        |
| (3 cards do resumo)                                           |
+--------------------------------------------------------------+
|        Despesas   Faturas   Receitas                          |
+--------------------------------------------------------------+
| Faturas de dezembro de 2026                    Atualizando…   |
| Status                                                        |
| [ Todos |*Pendente*| Pago ]   Limpar filtros                  |
| 1 fatura. Cada fatura aparece no mês em que vence.            |
| (blocos de fatura)                                            |
+--------------------------------------------------------------+
```

Na aba Despesas, a linha de filtros passa a quebrar (DL10):

```
| Status                      Categoria        Cartão           |
| [ Todos |*Pendente*| Pago ] [Todas     v]    [Todos  v]       |
| Limpar filtros                                                |
```

### 2.3 A partir de `lg`

- Mesma estrutura de `md`. O aviso ocupa a largura da coluna de conteúdo, à direita do menu lateral a partir de `xl` (design de autenticação, seção 17).
- Título, seletor e "+ Novo lançamento" ficam na mesma linha, como hoje. "Limpar filtros" tende a caber na linha dos filtros.
- A faixa de abas sticky, a faixa compacta e os z-indexes não mudam. O aviso não é sticky: sai da tela com a rolagem.

---

## 3. Filtro de status

### 3.1 Controle

| Item | Despesas | Faturas |
|---|---|---|
| Opções, nesta ordem (RF16) | Todos / Pendente / Pago | Todos / Pendente / Pago |
| Sem escolha na URL ou valor inválido | Pendente selecionado (RF09, RF13, CA35) | Pendente selecionado (CA50) |
| Parâmetro (ADR 7.1) | `d_status` | `f_status`, independente de `d_status` (RF19) |
| >= `md` | Inline, aplica ao mudar | Inline, aplica ao mudar |
| < `md` | Folha com "Aplicar" | Folha com "Aplicar" |
| "Limpar filtros" | Status "Todos", Categoria "Todas", Cartão "Todos" | Status "Todos" |
| Contador | Conta Status (se não for "Todos"), Categoria e Cartão | 0 ou 1 |
| Mudar o filtro | Página 1, seleção limpa, painel "Atualizando" | Painel "Atualizando". Blocos que continuam na lista mantêm o estado de expansão |

- O rótulo visível é "Status", ligado ao grupo por `aria-labelledby`, como em `ExpenseFilters`.
- O filtro e o botão "Limpar filtros" ficam **na mesma posição da árvore** nos ramos com lista e vazio. Trocar para um resultado vazio não pode desmontar o controle, senão o foco em um radio se perde. A exceção é o caso sem cartão (DL9), em que o controle nunca é renderizado.
- Em Faturas, o filtro seleciona faturas inteiras: totais, contagens e lista expansível não mudam (RF18, CA46). Uma fatura parcial aparece em "Pendente" com o badge "Pago" nas despesas pagas. Isso é esperado.

### 3.2 "Limpar filtros" (RF11)

| Origem | Visível quando | Efeito | Foco depois |
|---|---|---|---|
| Inline (>= `md`) | Contador > 0, inclusive com o padrão "Pendente" | Aplica na hora. O botão some. Mês e aba não mudam | `h2` do painel (DL7) |
| "Limpar" (< `md`), nome acessível "Limpar filtros" | Contador > 0 | Aplica na hora. O botão passa a "Filtros", sem contador | `h2` do painel (DL7) |
| Folha, "Limpar" + "Aplicar" | Sempre, na folha | Aplica ao confirmar | Volta a "Filtros" (`ModalDialog`) |
| Estado vazio | No vazio com filtros | Aplica na hora | `h2` do painel (padrão atual de `NavLink`) |
| Toast (RF12, RF22) | Quando o item não aparece | Aplica na hora, nos filtros da aba ativa | Sem mudança nesta feature (C6, fora do escopo) |

Para voltar ao padrão depois de limpar, a pessoa seleciona "Pendente". Não existe "restaurar padrão". Em Despesas, "Limpar filtros" também remove Categoria e Cartão. Para manter o cartão, ela seleciona outro valor só no Status.

---

## 4. Aviso de avanço de mês (P02, isolado)

Mantido por decisão do usuário (seção 13, item 6). Componente `MonthAdvanceNotice`, sobre o `InlineAlert` existente. O aviso só existe com `advance` diferente de `NONE`, no sinal `adv` e `adv_from` da URL de redirecionamento (ADR 7.3).

### 4.1 Texto

Textos aprovados. `<M>` é `adv_from` e `<mês>` é o mês da tela, ambos por extenso e com ano.

| Variante | Texto |
|---|---|
| `NEXT_PENDING` | Sem pendências em `<M>`. Mostrando `<mês>`, o próximo mês com pendências. |
| `NO_PENDING_AHEAD` | Sem pendências de `<M>` em diante. Mostrando `<mês>`. |

| Cenário | Texto resultante |
|---|---|
| Próximo mês, CA07 | Sem pendências em outubro de 2026. Mostrando novembro de 2026, o próximo mês com pendências. |
| Salto de vários meses, CA06 | Sem pendências em outubro de 2026. Mostrando dezembro de 2026, o próximo mês com pendências. |
| Virada de ano, CA15 | Sem pendências em dezembro de 2026. Mostrando janeiro de 2027, o próximo mês com pendências. |
| Salto com virada, CA16 | Sem pendências em novembro de 2026. Mostrando fevereiro de 2027, o próximo mês com pendências. |
| Salto muito longo, R3 | Sem pendências em outubro de 2026. Mostrando março de 2036, o próximo mês com pendências. |
| Nenhuma à frente, CA02 | Sem pendências de outubro de 2026 em diante. Mostrando novembro de 2026. |
| Nenhuma à frente com virada, CA17 | Sem pendências de dezembro de 2026 em diante. Mostrando janeiro de 2027. |
| Só há pendência anterior, CA14 | Sem pendências de outubro de 2026 em diante. Mostrando novembro de 2026. |

- Salto longo não tem tratamento visual próprio: é a opção C da seção 12 do ADR, ainda sem decisão do usuário. O ano por extenso já torna 2036 visível.
- Os textos vêm só de modelos fixos. Nada da URL é exibido (ADR 7.3).

### 4.2 Aparência

- `InlineAlert` tom `info`: vidro, borda `--border-strong`, borda esquerda 3px `--accent`, ícone `--accent`, texto `--text` 14px. Os pares já são validados nos dois temas, sobre vidro e no fallback opaco.
- Não usa `warning` nem `danger`: nada está errado. As duas variantes têm a mesma aparência.
- Fechar: `IconButton` 44x44, no slot `actions` do `InlineAlert`, com nome "Fechar aviso de mês".
- Margem inferior de 16px (24px a partir de `md`), igual ao espaçamento entre blocos.

### 4.3 Ciclo de vida

| Evento | Aviso |
|---|---|
| Abertura sem `month` com avanço | Aparece. O sinal sai da URL na montagem (ADR 7.3) |
| Troca de aba, filtro ou página | **Permanece**. O componente fica sempre montado na mesma posição e guarda o sinal em estado local, porque as navegações seguintes chegam sem o sinal |
| Pagar ou criar lançamento | Permanece. O mês também não muda (RF07). Ver C8 |
| Troca de mês, por qualquer controle | Some e não volta, nem ao retornar ao mesmo mês (CA25) |
| Fechar | Some até a próxima abertura com avanço |
| Recarregar ou Voltar | Não reaparece |
| Nova abertura sem `month`, pelo menu | Reavaliado (P03, CA30) |
| Falha ou timeout da verificação | Não aparece. A tela abre em M sem mensagem (RNF02, CA22) |
| Sem avanço, `month` explícito ou inválido | Não aparece (CA01, CA26, CA27) |
| Sinal inválido na URL | Ignorado, sem erro (ADR 7.3) |

**Dispensa:** só pelo botão fechar. Não fecha sozinho nem com `Esc`. O foco vai para `<main id="conteudo">`, que já é focável e é o destino de "Pular para o conteúdo". Assim, o próximo `Tab` chega a "+ Novo lançamento", sem tocar no cabeçalho.

### 4.4 Isolamento

O usuário manteve o aviso. O isolamento continua como regra de implementação. O aviso toca apenas estes pontos:

| Ponto | O que sairia em uma retirada futura |
|---|---|
| Componente `MonthAdvanceNotice` | O arquivo |
| `EntriesScreen` | A leitura de `adv` e `adv_from` e a linha que renderiza o componente |
| Redirecionamento (`initial-month.ts`) | O acréscimo de `adv` e `adv_from` à URL |
| Testes e fixtures | Os casos de aviso, inclusive a verificação de leitor de tela |

Permaneceriam iguais: a regra e o redirecionamento do mês, o contrato da API (`advance` passaria a ser ignorado), `EntriesState`, `EntriesHeader`, os filtros, os vazios e os toasts. Sem o aviso, nenhum espaço fica reservado.

---

## 5. Estados vazios

Textos aprovados.

### 5.1 Despesas

| Status | Outros filtros | Título | Descrição | Ações |
|---|---|---|---|---|
| Pendente | Nenhum | Nenhuma despesa para os filtros selecionados em `<mês>` | Não há despesas pendentes neste mês. "Limpar filtros" mostra todo o mês. | Limpar filtros; + Novo lançamento |
| Pago | Nenhum | Idem | Não há despesas pagas neste mês. "Limpar filtros" mostra todo o mês. | Idem |
| Pendente ou Pago | Categoria ou cartão | Idem | Nenhuma despesa atende a esta combinação. "Limpar filtros" mostra todo o mês. | Idem |
| Todos | Categoria ou cartão | Idem | Idem | Idem |
| Todos | Nenhum | Nenhuma despesa em `<mês>` | Registre uma despesa ou escolha outro mês. | + Novo lançamento |
| Qualquer | Cartão inexistente | Este cartão não foi encontrado. | - | Remover filtro de cartão |
| Qualquer | Página além do fim | Esta página não existe. | - | Ir para a última página |

Em qualquer vazio, o subtotal mostra R$ 0,00 e o resumo não muda (CA32). "Remover filtro de cartão" mantém o status vigente. Um usuário sem cartão vê os mesmos estados nesta aba, sem "Cadastrar cartão" (só Faturas o oferece, RF20).

### 5.2 Faturas

Ordem de avaliação do ADR 7.4, com `items` vazio:

| # | Condição | Filtro visível | Título | Descrição | Ações |
|---|---|---|---|---|---|
| 1 | Sem cartão (leitura com sucesso), qualquer status | Não (DL9) | Nenhuma fatura neste mês | Compras no cartão aparecem na fatura do mês em que vencem. | + Novo lançamento; **Cadastrar cartão** |
| 2 | Pendente, com cartão ou com falha na leitura de cartões | Sim | Nenhuma fatura para os filtros selecionados em `<mês>` | Não há faturas pendentes neste mês. "Limpar filtros" mostra todo o mês. | Limpar filtros; + Novo lançamento |
| 3 | Pago, com cartão ou com falha na leitura de cartões | Sim | Idem | Não há faturas pagas neste mês. "Limpar filtros" mostra todo o mês. | Idem |
| 4 | Todos | Sim | Nenhuma fatura neste mês | Compras no cartão aparecem na fatura do mês em que vencem. | + Novo lançamento |

A contagem e a ajuda "Cada fatura aparece no mês em que vence." só aparecem com fatura na lista.

### 5.3 Situações sem pendências

| Situação | Mês | Aviso | Despesas | Faturas |
|---|---|---|---|---|
| Com cartão, tudo pago, nada à frente (CA02, CA08) | M+1 | `NO_PENDING_AHEAD` | 5.1, Pendente | 5.2, linha 2 |
| Sem cartão, nenhuma pendência (CA11) | M | Nenhum | 5.1, Pendente | 5.2, linha 1 |
| Abriu um mês com tudo pago, por link (CA38, CA52) | O do link | Nenhum | 5.1, Pendente. Limpar mostra as pagas | 5.2, linha 2. Limpar mostra as pagas |
| Pagou a última pendência na visita (CA28) | Não muda | Mantido, se havia | 5.1, Pendente | 5.2, linha 2 |
| Mês sem lançamentos, depois de limpar (CA39, CA53) | O atual da tela | Conforme o caso | 5.1, Todos | 5.2, linha 4 |

Em `/demo/entries`, "+ Novo lançamento" não existe (`WriteOnly`). "Limpar filtros" funciona.

---

## 6. Pagar sob filtro

### 6.1 Fatura (RF21)

| Filtro | Bloco depois do sucesso | Toast | Foco |
|---|---|---|---|
| Pendente | Sai da lista, imediatamente e sem animação (P11) | Mantido: "Fatura Nubank de nov/26 paga: 2 despesas, R$ 100,00." | `h2` do painel, "Faturas de `<mês>`" |
| Todos | Permanece, com "Fatura paga" e botão desabilitado | Igual | `h3` do bloco (comportamento atual) |
| Pago | Não ocorre: toda fatura listada tem botão desabilitado | - | Se ocorrer por dado obsoleto, `h2` do painel (ADR 7.5) |

- Resposta com `paidCount = 0` (outra aba já pagou): toast informativo atual, com a mesma tabela de foco.
- Se restarem faturas (CA55), a contagem e a lista se atualizam. Se não restar nenhuma (CA28), aparece a linha 2 de 5.2, no mesmo lugar, com o filtro mantido.
- O `h2` está em `EntriesScreen`, fora do bloco. O `scroll-padding-top` global já evita que a navbar e a faixa de abas o cubram.
- O foco visível no `h2` usa o anel normal de `:focus-visible`, quando o navegador o aplica.
- Erros seguem iguais: 400, 500 e rede mantêm o modal aberto, e o 404 fecha com toast de erro. No 404 sob filtro, se o bloco sair na revalidação, o foco também vai para o `h2`.

**Critério obrigatório.** O foco só pode ser movido **depois de o `AlertDialog` fechar**, porque um `<dialog>` modal deixa o resto da página inerte. O bloco pode já ter sido desmontado nesse momento. Ver C3.

### 6.2 Despesa individual (decisão do usuário)

| Filtro | Item depois do sucesso | Foco |
|---|---|---|
| Pendente | Sai da lista (CA42) | `h2` do painel, "Despesas de `<mês>`" |
| Todos | Permanece, como paga | Mesma linha ou card (design 3.10) |

Se a página ficar sem itens, vale o tratamento de página inexistente (CA42), e o foco continua no `h2`. O critério do `AlertDialog` da seção 6.1 também vale aqui. O pagamento em lote já leva o foco ao `h2`.

---

## 7. Toast para compra criada sob "Pago" (RF22)

Compra no cartão, aba Faturas, filtro "Pago", mesmo mês:

> Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026. Ela não aparece nos filtros atuais. **Limpar filtros**

- `kind` `success`, com a duração de 8 s dos toasts com ação. Pausa com hover ou foco. Usa o `ToastProvider` atual.
- A ação leva a `f_status=ALL`, mantendo mês e aba (CA57). `d_status` não muda (RF19).
- "Ela" se refere à fatura. Vale também quando uma fatura já listada como paga recebe a compra: ela passa a pendente e **sai** da lista sob "Pago", e o toast explica essa saída.
- Sem destaque de recém-criado: ele não existe na aba Faturas (3.9.2).
- O foco volta para "+ Novo lançamento" (3.9.2).

Demais casos pós-criação:

| Aba e filtro | Situação | Toast |
|---|---|---|
| Faturas, Pendente ou Todos | Compra no cartão, mesmo mês | Sem ação: o bloco aparece |
| Faturas, qualquer | Outro mês | "Ela está em `<mês>`." + "Ver `<mês>`": abre Despesas com "Todos" (ADR 7.6) |
| Faturas, qualquer | PIX ou receita, mesmo mês | "Ver despesas" ou "Ver receitas" |
| Despesas, Pendente | PIX paga, mesmo mês (CA40) | "Ela não aparece nos filtros atuais." + "Limpar filtros", sem destaque |
| Despesas, qualquer | Outro mês (CA41) | "Ver `<mês>`": abre com "Todos", com a despesa visível |

A demo não cria lançamentos, então RF22 não se aplica lá.

---

## 8. Carregamento e erro

| Região e estado | Condição | Apresentação |
|---|---|---|
| Tela, resolvendo o mês | Abertura sem `month` | `loading.tsx` atual (`EntriesLoading`): título, skeletons e "Carregando lançamentos". Nenhum mês errado é mostrado (R9). Limite de 1,5 s na leitura (ADR). Sem JavaScript, cerca de 1 s de espera |
| Verificação falhou | Erro ou timeout | Abre em M, sem aviso e sem mensagem de erro. Só sessão expirada vai ao login |
| Painel, primeira visita à aba | Troca de aba | `InvoicesPanelSkeleton` ou `ListPanelSkeleton`. O de Faturas **ganha uma linha para o filtro**, igual à de `ListPanelSkeleton`, para evitar salto de layout |
| Painel, atualizando | Troca de filtro, mês ou página; pós-pagamento | D11: conteúdo anterior com cores normais, barra de progresso, "Atualizando…" e `aria-busy`. Filtros e abas continuam utilizáveis |
| Painel, erro | Falha da leitura | `BlockErrorBoundary`: "Não foi possível carregar as faturas." ou "...as despesas." + "Tentar novamente". O filtro sai junto com o painel. Cabeçalho, aviso e abas continuam |
| Resumo, erro | Falha do resumo | Sem mudança: erro compacto, independente do painel |
| Cartões, erro em Faturas | Falha com lista vazia | Trata como "com cartão": filtro visível e linhas 2 a 4 de 5.2 |
| Status inválido na URL | Valor desconhecido | Ignorado: vale "Pendente", sem erro (RF13) |
| Mês inválido | `month` malformado | Toast atual, M e nenhum avanço (RF08, CA27) |

O skeleton da rota é sempre o de lista, inclusive com `tab=invoices`, porque `loading.tsx` não conhece a aba. Isso já acontece hoje e é aceitável.

---

## 9. Fluxos de interação

**Abertura sem `month`**
1. O usuário clica em "Lançamentos" ou abre `/entries`. Skeleton.
2. O mês é resolvido. O redirecionamento usa `replace`, e Voltar não prende o usuário (CA29).
3. A tela aparece no mês resolvido, com "Pendente" nas abas Despesas e Faturas. Se houve avanço, o aviso aparece e o sinal sai da URL.

**Consultar o que está pago (R1)**
1. Em >= `md`, selecionar "Pago" ou "Todos" no segmented. Em < `md`, abrir "Filtros (1)", escolher e "Aplicar".
2. A escolha sobrevive a recarregar e a trocar de mês, aba e página (RF10, CA33, CA48).

**Pagar a última fatura pendente**
1. "Pagar fatura", depois a confirmação. Foco inicial em "Cancelar".
2. O modal fecha, o toast aparece, o bloco sai e o foco vai para o `h2`.
3. Surge o vazio com filtros. O mês não muda. "Limpar filtros" mostra a fatura recém-paga.

**Criar compra sob "Pago"**
1. "+ Novo lançamento", depois salvar. O drawer fecha e o foco volta ao botão.
2. O toast informa que a fatura não aparece. "Limpar filtros" leva a "Todos", onde ela está.

**Voltar ao mês corrente depois de um avanço**
1. "Mês atual" no seletor. O aviso some.
2. Recarregar mantém o mês, porque ele agora está na URL (CA25).

**Atalho do bloco para Despesas (DL11)**

| Fatura | Rótulo | Status em Despesas |
|---|---|---|
| Não paga (`pendingCount > 0`) | Sem mudança: "Pagar despesas individualmente na aba Despesas"; na demo, "Ver despesas do cartão na aba Despesas" | O vigente em Despesas (RF19, CA58) |
| Paga (`pendingCount = 0`), em qualquer filtro de Faturas, protegido e demo | **Ver despesas do cartão na aba Despesas** | "Todos" (`d_status=ALL`) |

Nos dois casos, o link abre o mês da fatura, filtrado pelo cartão, e `f_status` não muda. Os demais filtros de Despesas seguem como hoje: uma categoria já aplicada é mantida e pode levar ao vazio de 5.1.

---

## 10. Acessibilidade

### 10.1 Teclado e foco

| Elemento | Comportamento |
|---|---|
| Filtro de status | `radiogroup` do `SegmentedControl`: `Tab` entra no selecionado e as setas movem e selecionam. Em >= `md`, cada seleção aplica (D6), e o foco fica no radio depois de atualizar |
| Botão "Filtros" | `aria-haspopup="dialog"`. Foco preso na folha, `Esc` descarta, e o foco volta ao botão |
| "Limpar filtros" e "Limpar" | Foco no `h2` do painel (DL7) |
| Fechar aviso | Primeiro focável do conteúdo. Depois de usado, foco em `main` |
| Fatura paga, Pendente | Foco no `h2` do painel, depois do fechamento do modal |
| Pagamento individual sob Pendente | Foco no `h2` do painel, depois do fechamento do modal (6.2) |
| Alvos | Todos >= 44x44. Anel `--focus-ring` |

### 10.2 Anúncios

| Evento | Canal | Texto |
|---|---|---|
| Avanço | `aria-live="polite"` oculto, próprio do aviso | O mesmo texto do aviso |
| Filtro em Despesas | Região polite do painel | "Mostrando 3 despesas de outubro de 2026, pendentes". Com "Todos", sem qualificador |
| Filtro em Faturas, com itens | Região polite do painel | "Mostrando 1 fatura de outubro de 2026, pendentes". Com "Pago": ", pagas". Com "Todos", sem qualificador |
| Filtro em Faturas, sem itens | Mesma região | "Nenhuma fatura de outubro de 2026, pendentes" |
| Fatura paga | Toast + foco | Toast polite + leitura do `h2`. Depois, a região do painel com a nova contagem |
| Compra sob "Pago" | Toast | O texto do toast |
| Erro | `role="alert"` | Mensagem do bloco |

Requisitos para o anúncio funcionar:

- **Aviso de avanço.** Uma região com `role="status"` e conteúdo já presente na carga **não é anunciada**, e o aviso vem renderizado pelo servidor. Por isso:
  - o banner visível é estático, sem região viva, e o `InlineAlert` passa a aceitar `role="note"`, com o padrão atual inalterado;
  - uma região polite oculta nasce vazia e recebe o texto cerca de 500 ms depois da montagem;
  - ela é esvaziada após 10 s ou ao fechar, para o texto não ser lido duas vezes na navegação por leitura;
  - o foco **não** é movido na carga.
- **Faturas.** Hoje o ramo vazio de `InvoicesPanel` não tem região viva. Ela precisa ficar sempre montada na mesma posição, nos ramos com lista e vazio (RF09).
- **Despesas.** O anúncio trata hoje qualquer status diferente de "PENDING" como "pagas". Com `ALL` explícito, "Todos" não pode ser lido como "pagas" (risco R8).
- O texto `Status: ...` (DL6) é estático, fora de região viva.

### 10.3 Outros

- Status e aviso não dependem só de cor: há texto, ícone e estado `aria-checked`.
- O bloco de fatura mantém o `h3` focável para o caso "Todos".
- Com movimento reduzido, nada muda: a saída do bloco e o aviso não têm animação.
- `InlineAlert`, `BottomSheet`, `SegmentedControl` e toast não ganham tokens. O axe roda nos dois temas (RNF06) para os estados da seção 14.
- O anúncio do aviso e a sequência de foco com toast exigem conferência manual com leitor de tela, porque o axe não os avalia.

### 10.4 Exibição de mês (America/Sao_Paulo)

- M vem do servidor: `currentMonth` da API ou `currentYearMonthSP` no web. Nunca do relógio ou do fuso do navegador (RNF03).
- Textos de mês vêm de `monthLongPtBR` (por extenso) e `monthLabelPtBR` (`nov/26`), que tratam `YYYY-MM` como texto. **Proibido** converter esse valor em `Date`: `2026-11` seria lido como UTC e exibido como outubro em São Paulo.
- O aviso recebe os meses por props, calculados no servidor, sem divergência de hidratação.
- Nas fronteiras (CA18 a CA20), a tela só exibe os valores decididos pela API. O design não recalcula nada.

---

## 11. Componentes

### Novos

| Componente | Local | Papel |
|---|---|---|
| `MonthAdvanceNotice` | `features/entries/_components/` | Aviso, região polite e dispensa (seção 4). Depende só de `InlineAlert`, `IconButton` e `monthLongPtBR` |
| `InvoiceStatusFilter` | `features/entries/_components/` | Controle da aba Faturas (DL5) |

### Existentes alterados

| Componente | Mudança |
|---|---|
| `ExpenseFilters` | Status obrigatório, "Limpar" leva a "Todos" e move o foco, linha "Status: ...", quebra de linha em >= `md`. As opções de status passam a ser compartilhadas com `InvoiceStatusFilter` |
| `ExpensesPanel` | Descrição dos vazios por status, anúncio com "Todos" |
| `ExpensesList` | Foco no `h2` depois do pagamento individual sob filtro que retira o item (6.2) |
| `InvoicesPanel` | Filtro, escondido sem cartão, vazios de 5.2, região viva sempre montada |
| `InvoiceBlock` | Destino do foco por filtro (6.1). Com fatura paga, rótulo e destino próprios no atalho (DL11). Conteúdo sem mudança |
| `InvoicesPanelSkeleton` | Linha do filtro |
| `EntriesScreen` | Renderiza `MonthAdvanceNotice` |
| `InlineAlert` | Aceita `role="note"` |
| `lib/entries/feedback.ts` | Caso de RF22, "Limpar" e "Ver `<mês>`" com "Todos" |

### Existentes sem mudança

`SegmentedControl`, `BottomSheet`, `ModalDialog`, `AlertDialog`, `EmptyState`, `Button`, `IconButton`, `NavLink`, `UpdatingRegion`, `BlockErrorBoundary`, `MonthPicker`, `EntriesHeader`, `EntriesTabsBar`, `ToastProvider`, `MonthSummary`, `EntriesLoading`, `EntriesError`.

---

## 12. Conflitos e lacunas

A spec e o ADR não foram alterados.

| # | Item | Situação | Estado |
|---|---|---|---|
| **C1** | RF11 x RF20 e CA54 | RF11 mantém "Limpar filtros" visível sob o padrão em Faturas. RF20 pede o vazio sem cartão "sem exigir limpar filtros". O ADR 7.4 diz que o painel renderiza o filtro e não trata esse caso | **Fechado pelo usuário:** filtro escondido sem cartão (DL9). Desvio da letra de RF11 e do ADR 7.4 nesse caso |
| **C2** | P02 x CA e riscos | P02 diz que o aviso sai "sem afetar os demais requisitos". Porém CA02, CA06, CA08 e CA13 afirmam o aviso, e R2 e R3 têm RF05 como mitigação | **Fechado pelo usuário:** o aviso é mantido, e esses critérios e mitigações seguem valendo |
| **C3** | RF21 e ADR 7.5 x ciclo do modal | O código atual pede o foco logo depois de `setConfirmOpen(false)`, quando o `<dialog>` pode ainda estar aberto e a página inerte. Se isso falhar, o `ModalDialog` devolve o foco ao gatilho, que já não existe sob "Pendente". O teste unitário atual não prova o comportamento em navegador real | Aberto para implementação: critério de 6.1. CA28, CA42 e CA55 precisam de verificação de foco em Playwright |
| **C4** | Design 3.10 x CA42 | O pagamento individual devolvia o foco à "mesma linha", que sai da lista sob "Pendente". A spec trata só a fatura (RF21, R7) e CA42 não define foco | **Fechado pelo usuário:** foco no `h2` do painel (6.2) |
| **C5** | RF19 e CA58 x atalho do bloco | Sob "Pago" em Faturas, o atalho abriria Despesas em "Pendente" e cairia em vazio, com um rótulo que fala em pagar. RF19 diz que o atalho "mantém o status já vigente em Despesas" e o ADR 7.4 repete isso, sem exceção | **Fechado pelo usuário:** DL11. Desvio aprovado de RF19 e do ADR 7.4 para fatura paga. CA58 segue válido para fatura não paga. Spec e ADR precisam registrar a exceção pelo responsável por esses documentos |
| **C6** | RF12, RF22 x toast | A ação do toast é um `Link` simples e o `ToastProvider` fica fora do `NavProvider`. O toast some no clique, e o foco cai em `body`. Nem a spec nem o ADR definem o destino | **Fechado pelo usuário:** fora do escopo. Limitação existente, sem mudança nesta feature |
| **C7** | Letra de RF16 x gramática e base | "Todos" e "Pago" concordam mal com "fatura", mas RF16 é explícito. O design 3.8 justifica não usar folha quando há um único controle, enquanto RF16 pede folha em Faturas | Decidido: seguir RF16 |
| **C8** | RF05 x RF07 | O aviso permanece depois de mutações. Se a pessoa criar uma pendência em M, "Sem pendências em `<M>`" fica desatualizado até trocar de mês | Aceito. Detectar isso acoplaria o aviso às mutações e quebraria o isolamento |
| **C9** | CA38 x linguagem | "Filtros selecionados" aparece para quem nunca selecionou um filtro | **Fechado pelo usuário:** título e descrição aprovados (DL8) |
| **C10** | Design de origem | Ficam superados: 3.1 e 3.3 (CA61, mês padrão), 3.5 ("Faturas não tem filtros"), 3.6 (Limpar "só quando difere do padrão"), D6 ("só aba Despesas"), 3.7 (foco e rótulo do atalho), 3.9.2 (sem ação em Faturas), 3.10 (foco individual), 3.12 (vazios). 3.6 cita select abaixo de 400px, e 3.12 cita seletor real no skeleton: o código não faz nenhum dos dois | Atualização pelo doc-writer (tarefa 21): **feita em 2026-10-30**, com notas "Superado" em `docs/design/lancamentos-financeiros.md` (3.1, 3.3, 3.5, 3.6, 3.7, 3.9.2, 3.10, 3.12 e D6). O select não é introduzido aqui |
| **C11** | Status do ADR | ADR "Proposto", com PV1, PV2, PV3 e R3 sem validação. A UI assume o padrão deles | Aberto, fora desta aprovação. Sob a alternativa de PV2, seria preciso um terceiro texto. PV3 mudaria 5.3. PV1 não muda a UI. C5 do ADR (cartão inativo conta como cartão?) pode mudar a linha 1 de 5.2 |

---

## 13. Decisões do usuário

Todos os pontos foram decididos em 2026-10-30.

| # | Ponto | Decisão | Onde |
|---|---|---|---|
| 1 | Filtro de Faturas sem cartão | Escondido | DL9, 5.2, C1 |
| 2 | Status visível abaixo de `md` | Mostrar "Status: `<status ativo>`" fora da folha | DL6, 2.1 |
| 3 | Foco após pagamento individual sob "Pendente" | `h2` do painel | 6.2, C4 |
| 4 | Atalho de fatura paga | Abre Despesas em "Todos" (`d_status=ALL`), com o rótulo "Ver despesas do cartão na aba Despesas". O de fatura não paga não muda | DL11, seção 9, C5 |
| 5 | Foco da ação do toast | Fora do escopo | C6 |
| 6 | Aviso de avanço | Mantido | Seção 4, C2 |
| 7 | Textos do aviso e dos vazios | Aprovados como estão | 4.1, 5.1, 5.2, C9 |

---

## 14. Verificação

Em claro e escuro, com axe, em 360px, `md` e `lg`:

- Aviso nas duas variantes, com texto longo, e depois de fechado.
- Faturas: Pendente, Pago e Todos, com lista; os quatro vazios de 5.2, sem filtro na linha 1; folha aberta; skeleton; erro.
- Despesas: padrão aplicado, "Todos", cada vazio de 5.1, folha aberta; linha de filtros em 768px.
- Abaixo de `md`: "Status: ..." com cada status nas duas abas, sem refletir o rascunho da folha.
- Atalho: fatura paga abre `d_status=ALL` com o rótulo novo, mesmo com outro status vigente em Despesas; fatura não paga mantém rótulo e status; `f_status` não muda.
- Foco em navegador real: fechar aviso, Limpar nas origens de 3.2 com foco definido, pagar fatura sob Pendente e Todos, pagar despesa individual sob Pendente e Todos.
- Manual, com leitor de tela: anúncio do aviso na carga, sem repetição; sequência do `h2`, do toast e da contagem depois de pagar.
- Demo: alternar status, sem escrita (CA59), "+ Novo lançamento" ausente nos vazios.
