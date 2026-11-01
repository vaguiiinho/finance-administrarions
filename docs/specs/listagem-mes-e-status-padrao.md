# Spec: Listagem de lançamentos com mês e status padrão orientados a pendências

**Impacto em UI: sim.** Muda o estado inicial da tela `/entries` (mês e status), o comportamento de "Limpar filtros", textos dos estados vazios e o subtotal padrão. A aba Faturas ganha um filtro de status, e o aviso de mês avançado (RF05) e a indicação de status no mobile (RF23) são elementos novos. Todos passam pelo ui-designer.

- Data: 2026-10-30 (rev. 3, aprovada)
- Branch: `feat/listies`
- Status: **aprovada pelo usuário, conforme informado pelo coordenador.** As decisões técnicas da seção 11 foram resolvidas no ADR 0007 (Aceito). A tarefa 21 (atualização da spec e do design de origem) foi feita em 2026-10-30: notas "Superado" em `docs/specs/lancamentos-financeiros.md` e `docs/design/lancamentos-financeiros.md`.
- **Adendo aprovado em 2026-11-01:** ver `docs/specs/mes-inicial-fatura-pendente-mais-antiga.md` e ADR 0009. Faturas de cartão pendentes anteriores a M passam a ser consideradas; PIX anterior a M continua sem influenciar a seleção.
- Pedido original (literal):
  > modifique a listagem:
  > - se não tiver fatura pendente de nenhum cartão pula para o mês seguinte de acordo com o fechamento
  > - deixe como padrão selecionado so as pentedes
- Referências: `docs/specs/lancamentos-financeiros.md` (RF05, RF20, RF21, B6, B10, B12, B14, DR7, DR8, CA47, CA50, CA55, CA61), `docs/design/lancamentos-financeiros.md` (§3.3, §3.6 e a seção da aba Faturas), `docs/adr/0005-autenticacao-autorizacao-demo.md` (§9.6).

## 1. Contexto

### Qual é a listagem

O pedido não nomeia a tela. A única listagem com seletor de mês e filtro de status é a **tela de lançamentos** (`/entries` e `/demo/entries`, mesmo `EntriesScreen`), com as abas Despesas (padrão), Faturas e Receitas. É essa a tela adotada aqui.

### Como funciona hoje

| Assunto | Comportamento atual | Onde |
|---|---|---|
| Mês selecionado | Vem de `?month=YYYY-MM`. Sem parâmetro ou inválido: mês atual em America/Sao_Paulo. Inválido também gera toast "Mostrando o mês atual". | `web/lib/filters/entries-search-params.ts`, `month-notice.tsx` |
| Abrangência do mês | Um único mês para cabeçalho, resumo e as três abas (B12). | `entries-screen.tsx`, `entries-header.tsx` |
| Links que levam à tela | Menu e redirect de `/`: sem `month`. Dashboard, `/cards`, abas, seletor, paginação e filtros: sempre com `month`, pois `serializeEntriesState` sempre o escreve. | `main-nav.tsx`, `app/page.tsx`, `dashboard-header.tsx`, `category-donut.tsx`, `cards-list.tsx` |
| Filtro de status | Existe só na aba Despesas: "Todos / Pendente / Pago". Sem `d_status` significa **Todos**; não existe representação explícita de "Todos" na URL. | `expense-filters.tsx`, `entries-search-params.ts` |
| Aba Faturas | Sem filtro de status. Um bloco por cartão com despesa no mês, inclusive faturas já pagas. Após pagar, o foco vai para o título do bloco. | `invoices-panel.tsx`, `invoice-block.tsx` |
| Atalho do bloco de fatura | Leva à aba Despesas no mês da fatura, filtrada pelo cartão. Rótulo: "Pagar despesas individualmente na aba Despesas" (demo: "Ver despesas do cartão na aba Despesas"), inclusive em fatura paga. | `invoice-block.tsx` |
| Cálculo da fatura | Regra RF05: a compra cai no fechamento do mês se o dia for <= ao fechamento efetivo; senão, no do mês seguinte. O vencimento é a primeira ocorrência estritamente após o fechamento. **O mês de referência é o mês do vencimento**, gravado na criação e nunca recalculado (B10, DR2). | `api/.../domain/billing/calculate-invoice-dates.ts` |
| Leituras disponíveis | `GET /invoices?month=` devolve `pendingCount` por cartão, só de despesas de cartão e de um único mês. Não há leitura que responda "qual o próximo mês com pendência". | `list-invoices.ts`, `invoice-read-model.prisma.ts` |

### Pontos que exigem atenção

- Mudar o padrão de status quebra a equivalência "sem `d_status` = Todos", da qual dependem "Limpar filtros", os toasts pós-criação e o subtotal (RF10, RF11).
- Com o padrão "Pendente" na aba Faturas, a fatura paga **some da lista** logo após o pagamento. Hoje o foco vai para o título desse bloco, que deixaria de existir (RF21).

## 2. Linguagem ubíqua

Os demais termos (Fatura, Mês de referência, Data de fechamento etc.) seguem `docs/specs/lancamentos-financeiros.md`, seção 2.

| Termo | Definição |
|---|---|
| **Mês atual (M)** | Mês corrente em America/Sao_Paulo. |
| **Pendência** | Despesa com status PENDENTE, seja de cartão (fatura) ou PIX, localizada pelo seu mês de referência gravado. Receitas não geram pendência. |
| **Fatura pendente** | Fatura (cartão + mês de referência) com ao menos uma despesa PENDENTE. Fatura em aberto ou já fechada conta igualmente; fatura parcialmente paga é pendente. |
| **Fatura paga** | Fatura com despesas e nenhuma delas PENDENTE (`pendingCount = 0`). |
| **Mês inicial** | Mês mostrado quando a tela é aberta **sem** `month` na URL. Resultado da regra deste documento. |
| **Avanço de mês** | Abrir em um mês posterior a M, porque M não tem pendência. Pode ser de um ou mais meses. |
| **Escolha explícita** | Mês ou status informado na URL, por ação do usuário ou por link. Nunca é sobrescrita pelos padrões. |
| **Status padrão** | "Pendente": status aplicado nas abas Despesas e Faturas quando não há escolha explícita naquela aba. |

## 3. Decisões do usuário

Informadas ao planner pelo coordenador.

| # | Assunto | Decisão |
|---|---|---|
| **B1** | O que significa "de acordo com o fechamento" | Usar o mês de referência gravado na fatura; o fechamento já está embutido nele. |
| **B2** | Abrangência do status padrão | "Pendente" vale para Despesas **e** Faturas. A aba Faturas ganha filtro de status, com o mesmo comportamento de URL e "Limpar filtros" da aba Despesas. |
| **B3** | PIX pendente em M | Impede o avanço. Qualquer pendência em M (fatura ou PIX) mantém a tela em M. |
| **B4** | Até onde avança | Vai direto para o primeiro mês futuro com pendência. Se não houver nenhum, abre em M+1. |
| **PV1** | PIX futuro | Conta na busca do próximo mês com pendência. |
| **PV2 (alterada pelo ADR 0009)** | Pendência de mês anterior | Fatura de cartão pendente anterior a M pode definir o mês inicial; PIX anterior a M continua sem influenciar. |
| **PV3** | Sem cartão e sem pendência | Abre em M. |
| **R3 / P08** | Limite de avanço | Sem limite nesta feature. O aviso mostra o mês para onde a tela pulou. |
| **P02** | Aviso de avanço | Mantido, como requisito (RF05). |
| **Filtro sem cartão** | Faturas para quem não tem cartão | O filtro de status fica escondido. |
| **Status no mobile** | Abaixo de `md` | Mostrar o status ativo ("Status: Pendente") fora da folha de filtros (RF23). |
| **Foco no pagamento individual** | Sob "Pendente" | Vai para o título (h2) do painel (RF24). |
| **Atalho de fatura paga** | Aba Despesas | Abre em "Todos" (`d_status=ALL`), com rótulo novo que não fala em pagar (RF19). O atalho de fatura não paga mantém o comportamento. |
| **Foco da ação do toast** | Escopo | Fora do escopo. |
| **RNF01** | Desempenho | Número constante de consultas e p95 abaixo de 300 ms. |

## 4. Requisitos funcionais

### Mês inicial

- **RF01 - Regra do mês inicial.** Ao abrir a tela sem `month`, aplica-se a primeira condição verdadeira:
  1. Há pendência em M: abre em M.
  2. Há pendência em mês posterior a M: abre no primeiro desses meses, sem limite de distância.
  3. Não há pendência em M nem depois, e o usuário tem cartão: abre em M+1.
  4. Não há pendência em M nem depois, e o usuário não tem cartão: abre em M.
- **RF02 - Base de cálculo.** A verificação usa o mês de referência gravado nas despesas (B1). Não recalcula faturas nem altera dados. Alterar o fechamento de um cartão não muda faturas existentes (DR2).
- **RF03 - Um único mês por tela.** O mês inicial vale para cabeçalho, resumo e todas as abas, inclusive `/entries?tab=...` sem `month`. O dashboard não muda (B14).
- **RF04 - Sem cartão.** Ter cartão só importa nas condições 3 e 4 do RF01. Usuário sem cartão com pendência PIX segue as condições 1 e 2; sem nenhuma pendência, fica em M, com os estados vazios atuais (incluindo "Cadastrar cartão").
- **RF05 - Aviso de avanço (obrigatório).** Sempre que houver avanço, a tela informa o motivo e mostra o mês para onde pulou, nos dois casos: próxima pendência encontrada (M+1 ou mais adiante) e nenhuma pendência à frente (M+1). "Mês atual" continua disponível no seletor. Forma e texto ficam com o ui-designer.
- **RF06 - Escolha explícita de mês preservada.** `month` válido na URL nunca é alterado, com ou sem pendências naquele mês. Inclui as setas, a grade, "Mês atual" e os links do dashboard e de `/cards`.
- **RF07 - Estabilidade durante o uso.** Depois de resolvido, o mês não muda sozinho na mesma visita: pagar a última pendência ou criar um lançamento não troca o mês. A regra só é reaplicada em nova abertura sem `month`.
- **RF08 - Mês inválido.** Mantém o comportamento atual: mostra o mês atual, com o toast, sem avanço (o toast afirma "Mostrando o mês atual").

### Status padrão em Despesas e Faturas

- **RF09 - Pendente por padrão.** Nas abas Despesas e Faturas, sem status na URL para aquela aba, o filtro aplicado e o selecionado no controle é "Pendente". Na aba Despesas, a lista, a contagem, o subtotal e o anúncio para leitor de tela refletem o filtro. Na aba Faturas, a lista de blocos, a contagem e o anúncio refletem o filtro.
- **RF10 - "Todos" é uma escolha.** Selecionar "Todos" ou "Pago" fica registrado na URL e sobrevive a recarregar a página e a trocar de mês, de aba e de página. Os filtros de categoria e cartão de Despesas seguem iguais.
- **RF11 - "Limpar filtros".** Leva a "Todos" (e, em Despesas, a "Todas" e "Todos" nos demais filtros, como em design §3.6) e por isso **fica visível enquanto o padrão "Pendente" estiver ativo**. Depois de limpar, a lista mostra tudo do mês e o botão some. O contador "Filtros (n)" do mobile conta o "Pendente" padrão. Vale em Despesas e Faturas, nas origens: filtros, estado vazio e folha mobile. **Exceção:** na aba Faturas de usuário sem cartão não há filtro, então "Limpar filtros" e o contador não aparecem (RF20).
- **RF12 - Links que dependem de ver tudo.** O toast pós-criação (ações "Ver <mês>" e "Limpar filtros") leva a uma tela onde o lançamento aparece, inclusive despesa PIX já paga.
- **RF13 - Valor inválido.** Status inválido na URL é ignorado e vale o status padrão.
- **RF14 - Receitas e resumo.** O status padrão não se aplica a Receitas. O resumo do mês continua considerando o mês inteiro (CA47 da spec de origem).
- **RF15 - Demo.** Os demais requisitos valem igualmente em `/demo/entries`, sem escrita. Os que dependem de pagar ou criar lançamento (RF21, RF22, RF24) não se aplicam.
- **RF23 - Status ativo visível abaixo de `md`.** Nas abas Despesas e Faturas, abaixo de `md`, o status ativo aparece fora da folha de filtros, no formato "Status: Pendente" (ou "Status: Todos", "Status: Pago"). Mostra o status aplicado, não o rascunho da folha, e é acessível a leitores de tela. Não aparece na aba Faturas de usuário sem cartão.
- **RF24 - Foco após pagamento individual sob "Pendente".** Na aba Despesas, após marcar uma despesa como paga com o filtro "Pendente" ativo, o foco vai para o título (h2) do painel. O pagamento em lote mantém o comportamento atual.

### Filtro de status na aba Faturas

- **RF16 - Controle.** Para usuário com cartão, a aba Faturas ganha o controle "Todos / Pendente / Pago", em >= `md` aplicando ao mudar e em < `md` pela folha com "Aplicar", como em Despesas.
- **RF17 - Semântica.** "Pendente" lista as faturas pendentes, inclusive as parcialmente pagas. "Pago" lista as faturas pagas. "Todos" lista as duas.
- **RF18 - Conteúdo do bloco.** O filtro seleciona faturas inteiras: totais, contagens e lista expansível do bloco continuam considerando todas as despesas da fatura (DR7), mesmo com o filtro "Pendente".
- **RF19 - Filtros independentes e atalho para Despesas.** O status de Faturas e o de Despesas são independentes: mudar um não altera o outro. O atalho do bloco para a aba Despesas depende da fatura:
  - **Fatura não paga** (inclusive parcial): mantém o status vigente em Despesas e o rótulo atual.
  - **Fatura paga:** abre Despesas em "Todos" (`d_status=ALL`), qualquer que seja o status vigente, com o rótulo "Ver despesas do cartão na aba Despesas", que também vale na demo. Com o padrão "Pendente", a lista ficaria vazia.
- **RF20 - Filtro e estados vazios de Faturas.** Sem cartão: o filtro de status, "Limpar filtros", o contador e a indicação de RF23 ficam escondidos, um status na URL é ignorado e a aba mostra "Nenhuma fatura neste mês" e "Cadastrar cartão". Com cartão e filtro ativo sem resultado: mensagem de vazio com filtros e "Limpar filtros". Com cartão, "Todos" e nenhuma fatura: "Nenhuma fatura neste mês".
- **RF21 - Pagar fatura sob filtro.** Se a fatura paga deixar de atender ao filtro, ela sai da lista, o toast de pagamento é mantido e o foco vai para o título (h2) do painel. Se continuar na lista ("Todos"), o comportamento atual é mantido: "Fatura paga" e foco no título do bloco.
- **RF22 - Toast pós-criação em Faturas.** Compra no cartão criada com o filtro "Pago" ativo não aparece na lista, e o toast informa isso e oferece "Limpar filtros".

## 5. Requisitos não funcionais

- **RNF01 - Desempenho.** A resolução do mês inicial e o filtro de Faturas usam um número constante de consultas, que não cresce com a quantidade de cartões nem com a distância até a próxima pendência, e têm p95 abaixo de 300 ms, com o volume do RNF06 da spec de origem (100 mil lançamentos e 20 cartões).
- **RNF02 - Resiliência.** Falha na verificação não derruba a tela: usa M, sem aviso de avanço. Sessão expirada continua levando ao login.
- **RNF03 - Fuso.** "Mês atual" é sempre calculado em America/Sao_Paulo, nunca em UTC nem no fuso do navegador, e sem divergência de hidratação.
- **RNF04 - Isolamento.** Só as pendências do próprio usuário contam (ou do dataset demo, em `/demo`).
- **RNF05 - Navegação.** O botão Voltar não pode prender o usuário em um ciclo de redirecionamento. O foco e os anúncios seguem o padrão atual de troca de mês.
- **RNF06 - Acessibilidade.** O aviso de RF05, o controle de status de Faturas e a indicação de RF23 são anunciados a leitores de tela, não dependem só de cor e passam em axe nos dois temas.
- **RNF07 - Testes e arquitetura.** Conforme `CLAUDE.md`: a regra é testada de forma unitária, sem I/O e com relógio controlado. Cobertura mínima de 80% em domain/application.

## 6. Critérios de aceite

Os números abaixo são deste documento; critérios da spec de origem são citados como "da spec de origem".

Cartões usados nos exemplos (datas calculadas pela regra RF05 da spec de origem):

| Cartão | Fecha | Vence | Compra | Fatura (mês de referência) |
|---|---|---|---|---|
| Azul | 10 | 17 | 04/10/2026 | 2026-10 (fecha 10/10, vence 17/10) |
| Azul | 10 | 17 | 12/10/2026 | 2026-11 (fecha 10/11, vence 17/11) |
| Roxo | 25 | 5 | 12/09/2026 | 2026-10 (fecha 25/09, vence 05/10) |
| Roxo | 25 | 5 | 12/10/2026 | 2026-11 (fecha 25/10, vence 05/11) |
| Roxo | 25 | 5 | 26/10/2026 | 2026-12 (fecha 25/11, vence 05/12) |
| Roxo | 25 | 5 | 10/12/2026 | 2027-01 (fecha 25/12, vence 05/01/2027) |
| Roxo | 25 | 5 | 10/01/2027 | 2027-02 (fecha 25/01, vence 05/02/2027) |

### Mês inicial

**CA01 - Fica em M com fatura pendente**
- Given hoje é 30/10/2026 em SP e o Azul tem fatura 2026-10 com despesa PENDENTE
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é outubro de 2026 e não há aviso de avanço.

**CA02 - Sem pendência nenhuma, com cartão: M+1**
- Given hoje é 30/10/2026 em SP, as faturas 2026-10 de Azul e Roxo estão totalmente pagas e não há pendência futura
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é novembro de 2026, cabeçalho, resumo e abas mostram novembro, e o aviso informa que não há pendências à frente e mostra novembro de 2026.

**CA03 - Cartões com fechamentos diferentes: basta um pendente**
- Given hoje é 30/10/2026, a fatura 2026-10 do Azul está paga e a do Roxo tem uma despesa PENDENTE
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é outubro de 2026.

**CA04 - Fechamentos diferentes não antecipam o avanço**
- Given hoje é 30/10/2026, o Roxo já fechou a fatura de novembro em 25/10 e tem PENDENTE apenas em 2026-11, e o Azul tem fatura 2026-10 com PENDENTE
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é outubro de 2026, pois a verificação usa o mês de referência, e não a data de fechamento.

**CA05 - Fatura em aberto conta como pendente**
- Given hoje é 05/10/2026 e o Azul tem compra de 04/10/2026, pendente, em fatura que só fecha em 10/10
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é outubro de 2026.

**CA06 - Avança direto até a próxima pendência**
- Given hoje é 30/10/2026, sem pendência em 2026-10 e 2026-11, e com a fatura 2026-12 do Roxo pendente
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é dezembro de 2026, e o aviso mostra que a tela pulou para dezembro de 2026.

**CA07 - Escolhe o primeiro mês com pendência**
- Given hoje é 30/10/2026, sem pendência em 2026-10, e com faturas pendentes em 2026-11 (Azul) e 2026-12 (Roxo)
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é novembro de 2026.

**CA08 - Cartão sem nenhuma despesa**
- Given um cartão cadastrado e nenhuma despesa em nenhum mês
- When o usuário abre `/entries` sem `month` em 30/10/2026
- Then o mês selecionado é novembro de 2026, com o aviso e o estado vazio do mês.

**CA09 - PIX pendente em M impede o avanço**
- Given hoje é 30/10/2026, cartão cadastrado, nenhuma fatura pendente em 2026-10, uma fatura pendente em 2026-11 e uma despesa PIX PENDENTE em 2026-10
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é outubro de 2026, sem aviso de avanço.

**CA10 - PIX pendente futuro conta como próxima pendência** (decisão PV1)
- Given hoje é 30/10/2026, cartão cadastrado, sem pendência em 2026-10 e 2026-11, e uma despesa PIX PENDENTE em 2026-12, a primeira pendência futura
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é dezembro de 2026.

**CA11 - Sem cartão e sem pendência** (decisão PV3)
- Given um usuário sem cartões, com despesas PIX pagas em 2026-10 e nenhuma pendência
- When abre `/entries` sem `month` em 30/10/2026
- Then o mês selecionado é outubro de 2026, sem aviso; na aba Faturas valem as condições do CA54.

**CA12 - Sem cartão com PIX pendente em M**
- Given um usuário sem cartões, com despesa PIX PENDENTE em 2026-10
- When abre `/entries` sem `month` em 30/10/2026
- Then o mês selecionado é outubro de 2026, sem aviso.

**CA13 - Sem cartão com PIX pendente futuro** (decisões PV1 e PV3)
- Given um usuário sem cartões, sem pendência em 2026-10 e com despesa PIX PENDENTE em 2026-12
- When abre `/entries` sem `month` em 30/10/2026
- Then o mês selecionado é dezembro de 2026, com o aviso de avanço.

**CA14 - PIX pendente de mês anterior não interfere** (decisão PV2)
- Given hoje é 30/10/2026, despesa PIX de 2026-09 pendente, e nenhuma pendência a partir de 2026-10, com cartão cadastrado
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é novembro de 2026.

**CA15 - Virada de ano com a próxima pendência**
- Given hoje é 15/12/2026 em SP, sem pendência em 2026-12 e com fatura 2027-01 pendente no Roxo
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é janeiro de 2027 e a lista mostra a fatura 2027-01.

**CA16 - Virada de ano com salto de vários meses**
- Given hoje é 20/11/2026 em SP, sem pendência em 2026-11, 2026-12 e 2027-01, e com fatura 2027-02 pendente no Roxo
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é fevereiro de 2027, e o aviso mostra que a tela pulou para fevereiro de 2027.

**CA17 - Virada de ano sem pendência**
- Given hoje é 15/12/2026 em SP, com cartão e nenhuma pendência
- When o usuário abre `/entries` sem `month`
- Then o mês selecionado é janeiro de 2027.

**CA18 - Timezone: último minuto do mês em SP**
- Given o instante 2026-11-01 02:30 UTC (31/10/2026 23:30 em SP), com cartão
- When o usuário abre `/entries` sem `month`
- Then com pendência em 2026-10 o mês é outubro de 2026; sem nenhuma pendência, é novembro de 2026.

**CA19 - Timezone: primeiro minuto do mês em SP**
- Given o instante 2026-11-01 03:30 UTC (01/11/2026 00:30 em SP), com cartão
- When o usuário abre `/entries` sem `month`
- Then M é novembro: com pendência em 2026-11 o mês é novembro de 2026; com PIX pendente apenas em 2026-10, é dezembro de 2026.

**CA20 - Timezone na virada de ano**
- Given o instante 2027-01-01 02:30 UTC (31/12/2026 23:30 em SP), com cartão
- When o usuário abre `/entries` sem `month`
- Then com pendência em 2026-12 o mês é dezembro de 2026; sem nenhuma pendência, é janeiro de 2027.

**CA21 - Mudança de fechamento não é retroativa**
- Given o Roxo com fatura 2026-10 pendente, que passa a fechar em outro dia
- When o usuário abre `/entries` sem `month`
- Then a fatura segue em 2026-10 e o mês selecionado é outubro de 2026.

**CA22 - Falha na verificação**
- Given a leitura usada para decidir o mês falha com erro de servidor
- When o usuário abre `/entries` sem `month`
- Then a tela abre em M, sem aviso de avanço, e os demais blocos seguem seus estados de erro atuais.

**CA23 - Isolamento**
- Given a usuária A com cartão e sem pendências, e o usuário B com pendência em 2026-10 e 2026-12
- When A abre `/entries` sem `month` em 30/10/2026
- Then o mês selecionado para A é novembro de 2026.

**CA24 - Demo**
- Given o dataset demo, que tem pendências no mês-âncora
- When um visitante abre `/demo/entries` sem `month` no mês-âncora
- Then o mês selecionado é o mês atual, "Pendente" está selecionado em Despesas e Faturas, e não há ações de escrita.

### Escolha manual preservada

**CA25 - Mês manual depois do avanço**
- Given a tela em dezembro de 2026 após avanço a partir de outubro
- When o usuário clica em "Mês atual" e recarrega a página; depois usa "Próximo mês" e recarrega
- Then a tela mostra outubro de 2026 e depois novembro de 2026, sem aviso de avanço e sem ser levada de volta a dezembro.

**CA26 - URL com mês explícito**
- Given nenhuma pendência em 2026-10
- When o usuário abre `/entries?month=2026-10`
- Then o mês selecionado é outubro de 2026, sem aviso. O mesmo vale para os links do dashboard e de `/cards`.

**CA27 - Mês inválido**
- Given nenhuma pendência em M
- When o usuário abre `/entries?month=abc`
- Then é mostrado M, com o toast atual, sem avanço.

**CA28 - Pagar a última pendência não troca o mês**
- Given a tela aberta sem `month` em outubro de 2026, na aba Faturas, com uma única fatura pendente e nenhuma outra pendência
- When o usuário paga a fatura
- Then a tela continua em outubro de 2026, a fatura sai da lista, o toast é exibido, o foco vai para o título (h2) do painel e aparece o vazio com filtros.

**CA29 - Voltar do navegador**
- Given o usuário chegou por uma página anterior e houve avanço de mês
- When usa Voltar uma vez
- Then retorna à página anterior, sem ser reconduzido à tela.

**CA30 - Reabertura pelo menu**
- Given hoje é 30/10/2026, o usuário em `/entries?month=2026-08`, sem pendências e com cartão
- When clica em "Lançamentos" no menu
- Then o link não tem `month`, e o mês selecionado é novembro de 2026 (nova abertura, P03).

### Status padrão em Despesas

**CA31 - Padrão Pendente**
- Given em 2026-10: 3 despesas PENDENTE (R$ 300,00) e 2 PAGO (R$ 200,00)
- When o usuário abre `/entries?month=2026-10`
- Then "Pendente" está selecionado, a lista tem 3 itens, e o subtotal mostra "com os filtros aplicados", 3 despesas, Total R$ 300,00, Pago R$ 0,00 e Pendente R$ 300,00.

**CA32 - O resumo não é afetado**
- Given o cenário do CA31
- When a aba Despesas está com o padrão aplicado
- Then o resumo do mês mostra despesas de R$ 500,00 (pago R$ 200,00, pendente R$ 300,00).

**CA33 - "Todos" não é sobrescrito**
- Given o padrão aplicado em Despesas
- When o usuário seleciona "Todos", recarrega, troca de mês, troca para Faturas e volta para Despesas
- Then "Todos" continua selecionado em Despesas e a lista traz despesas pagas e pendentes em todos os passos.

**CA34 - "Pago" não é sobrescrito**
- Given o usuário seleciona "Pago" em Despesas
- When recarrega e troca de página
- Then continua "Pago".

**CA35 - Filtro explícito por URL**
- Given a URL com `d_status=PAID`
- When a tela abre
- Then "Pago" está selecionado. Com `d_status=pending` (valor inválido), vale "Pendente".

**CA36 - "Limpar filtros" sai do padrão**
- Given o padrão aplicado, em desktop
- When o usuário clica em "Limpar filtros"
- Then "Todos" fica selecionado, a lista mostra todas as despesas do mês, o subtotal mostra "todas as despesas do mês" e o botão some.

**CA37 - Folha de filtros no mobile**
- Given viewport abaixo de `md`, com o padrão aplicado
- When o usuário abre "Filtros (1)", seleciona "Todos" e aplica; depois reabre e usa "Limpar" e aplica
- Then o botão passa a "Filtros" sem contador e a lista mostra todas as despesas nos dois caminhos.

**CA38 - Vazio com padrão e com despesas pagas**
- Given um mês com despesas, todas PAGO
- When o usuário abre o mês com o padrão aplicado
- Then aparece "Nenhuma despesa para os filtros selecionados", e "Limpar filtros" passa a mostrar as despesas pagas.

**CA39 - Vazio sem despesas**
- Given um mês sem nenhuma despesa
- When o usuário abre o mês com o padrão aplicado, e depois limpa os filtros
- Then a tela mostra o vazio com filtros e, depois de limpar, "Nenhuma despesa em <mês>".

**CA40 - Toast ao criar despesa PIX paga**
- Given o padrão aplicado em outubro de 2026
- When o usuário cria uma despesa PIX paga de outubro
- Then o toast diz que ela não aparece nos filtros atuais, sem destaque de recém-criado, e "Limpar filtros" leva à lista onde ela aparece.

**CA41 - Toast para despesa de outro mês**
- Given o padrão aplicado em novembro de 2026
- When o usuário cria uma despesa PIX paga de outubro e aciona "Ver outubro"
- Then a tela abre em outubro de 2026, com a despesa visível na lista.

**CA42 - Pagar sob o padrão**
- Given a lista com padrão aplicado e uma despesa PENDENTE selecionada
- When o usuário marca como paga
- Then ela sai da lista, os totais se atualizam e, se a página ficar sem itens, vale o tratamento atual de página inexistente.

**CA43 - Links sem status explícito**
- Given os links "Ver despesas" de `/cards`, "Ver lançamentos do mês" do dashboard e "Ir para lançamentos"
- When acionados
- Then abrem no mês do link com "Pendente" selecionado (P04).

**CA44 - Receitas sem filtro de status**
- Given o padrão aplicado em Despesas
- When o usuário abre a aba Receitas
- Then a API não recebe status nessa leitura e todas as receitas aparecem.

**CA60 - Status ativo visível no mobile**
- Given viewport abaixo de `md`, com cartão cadastrado e a folha de filtros fechada
- When o usuário abre as abas Despesas e Faturas com o padrão aplicado; depois abre a folha em uma delas, seleciona "Pago" sem aplicar e fecha; depois seleciona "Todos" e aplica
- Then aparece "Status: Pendente" nas duas abas, continua "Status: Pendente" depois de fechar sem aplicar e passa a "Status: Todos" só na aba em que o filtro foi aplicado. Em >= `md`, a indicação não aparece.

**CA61 - Foco após pagamento individual sob "Pendente"**
- Given a aba Despesas com "Pendente" ativo e ao menos duas despesas pendentes
- When o usuário marca uma delas como paga, individualmente
- Then a despesa sai da lista e o foco vai para o título (h2) do painel. O mesmo vale se a despesa for a última da lista.

### Filtro de status em Faturas

Cenário-base de 2026-10: Azul parcialmente paga (1 despesa PAGO, 1 PENDENTE) e Roxo totalmente paga.

**CA45 - Padrão Pendente em Faturas**
- Given o cenário-base
- When o usuário abre `/entries?month=2026-10&tab=invoices`
- Then "Pendente" está selecionado e aparece só o bloco do Azul, com a contagem "1 fatura".

**CA46 - Fatura parcial mantém o conteúdo inteiro**
- Given o bloco do Azul sob o filtro "Pendente"
- When o usuário expande a lista
- Then os totais e a lista mostram as 2 despesas, a paga e a pendente.

**CA47 - "Pago" e "Todos"**
- Given o cenário-base
- When o usuário seleciona "Pago" e depois "Todos"
- Then "Pago" mostra só o Roxo, e "Todos" mostra os dois blocos, em ordem de vencimento.

**CA48 - Escolha em Faturas não é sobrescrita**
- Given o usuário seleciona "Todos" em Faturas
- When recarrega, troca de mês, vai para Despesas e volta
- Then "Todos" continua selecionado em Faturas.

**CA49 - Filtros independentes**
- Given "Todos" selecionado em Faturas e nenhuma escolha em Despesas
- When o usuário vai para Despesas
- Then Despesas mostra "Pendente". Selecionar "Pago" em Despesas não altera o "Todos" de Faturas.

**CA50 - Valor inválido em Faturas**
- Given um status inválido na URL para Faturas
- When a aba abre
- Then vale "Pendente", sem erro.

**CA51 - "Limpar filtros" em Faturas**
- Given o padrão aplicado em Faturas
- When o usuário clica em "Limpar filtros"
- Then "Todos" fica selecionado, os dois blocos aparecem, o botão some e o mês e a aba não mudam. Em viewport abaixo de `md`, o mesmo vale pelo botão "Limpar" e pela folha de filtros.

**CA52 - Vazio com filtro em Faturas**
- Given um mês com cartão e só faturas pagas, com o padrão aplicado
- When o usuário abre a aba Faturas
- Then aparece o vazio com filtros e "Limpar filtros", que passa a mostrar as faturas pagas.

**CA53 - Mês sem faturas**
- Given um mês sem faturas, com cartão cadastrado
- When o usuário abre a aba Faturas e limpa os filtros
- Then aparece o vazio com filtros e, depois de limpar, "Nenhuma fatura neste mês".

**CA54 - Sem cartão em Faturas: filtro escondido**
- Given um usuário sem cartões, em qualquer largura de tela, com ou sem status de Faturas na URL
- When abre a aba Faturas
- Then aparecem "Nenhuma fatura neste mês" e "Cadastrar cartão". O filtro de status, "Limpar filtros", o botão "Filtros", o contador e "Status: ..." não aparecem, nem o vazio com filtros. Se a leitura de cartões falhar, o filtro continua visível, pois não se sabe que o usuário não tem cartão (P12).

**CA55 - Pagar sob "Pendente"**
- Given o cenário-base, sob "Pendente", com o Azul e também outra fatura pendente
- When o usuário paga o Azul
- Then o Azul sai da lista, a outra fatura permanece, o toast é exibido e o foco vai para o título (h2) do painel.

**CA56 - Pagar sob "Todos"**
- Given o cenário-base, sob "Todos"
- When o usuário paga o Azul
- Then o bloco permanece, mostra "Fatura paga" e o foco fica no título do bloco.

**CA57 - Compra criada sob "Pago"**
- Given a aba Faturas sob "Pago" em 2026-11
- When o usuário cria uma compra no cartão com fatura em 2026-11
- Then o toast informa que ela não aparece nos filtros atuais e "Limpar filtros" leva a uma lista onde a fatura aparece.

**CA58 - Atalho para Despesas**
- Given o cenário-base, com os blocos do Azul (parcial) e do Roxo (paga) expandidos sob "Todos" em Faturas, e "Pago" vigente em Despesas
- When o usuário aciona o atalho de cada bloco
- Then o do Azul mantém o rótulo atual e abre Despesas em 2026-10, filtrada pelo Azul, com "Pago". O do Roxo tem o rótulo "Ver despesas do cartão na aba Despesas", sem falar em pagar, e abre Despesas em 2026-10, filtrada pelo Roxo, com "Todos" (`d_status=ALL`), mostrando as despesas da fatura. Ao pagar o Azul sob "Todos", o atalho dele passa ao rótulo e ao destino da fatura paga.

**CA59 - Demo em Faturas**
- Given `/demo/entries` na aba Faturas
- When o visitante alterna entre "Pendente", "Pago" e "Todos"
- Then a lista segue o filtro e não há botão "Pagar fatura".

## 7. Fora de escopo

- Alterar o cálculo de fechamento, vencimento ou mês de referência (RF05 da spec de origem).
- Alterar dados gravados. Nenhuma migração de dados.
- Dashboard: mês padrão e filtros (B14).
- Persistir a preferência de mês ou status entre visitas (localStorage, banco). O estado continua na URL.
- Filtro de status em Receitas.
- Filtros de categoria ou cartão na aba Faturas.
- Filtrar as despesas dentro do bloco de fatura (DR7).
- Alterar o resultado de `GET /entries/expenses` e `GET /invoices` quando chamados sem `status`: continuam devolvendo tudo. O padrão é da tela.
- Alerta ou destaque para PIX pendente em mês anterior; faturas antigas de cartão podem definir o mês inicial, mas não exibem aviso de avanço.
- Limite de distância para o avanço de mês (decisão R3 / P08).
- Foco da ação do toast.

## 8. Riscos

- **R1 - Despesas e faturas pagas escondidas.** Com o padrão Pendente, o que está pago deixa de aparecer à primeira vista nas duas abas. Quem procura uma fatura paga precisa mudar o filtro.
- **R2 - Avanço a um mês vazio.** Quem tem cartão e nenhuma pendência abre em um mês vazio (CA08), o que pode parecer perda de dados. RF05 mitiga.
- **R3 - Salto longo (aceito).** Uma única despesa pendente com data digitada errada (por exemplo, 2036) leva a abertura da tela para esse mês até ser paga. Como não existe edição nem exclusão de lançamento, a única saída é pagá-la. O risco foi aceito nesta feature; RF05 e "Mês atual" mitigam.
- **R4 - Pendência PIX vencida não vista.** PIX pendente em mês anterior não muda o mês inicial. Faturas antigas de cartão passam a ser selecionadas; uma referência errada ainda pode abrir a listagem em um mês histórico.
- **R5 - Mês atual "sem pendência" esconde o que já foi pago.** O resumo inicial passa a ser de um mês futuro, não do mês corrente, para quem está em dia.
- **R6 - Troca de mês durante o uso.** Sem o mês fixado na visita, a revalidação após pagar a última pendência trocaria o mês (CA28, T2).
- **R7 - Foco perdido.** Sob "Pendente", o bloco ou a linha paga é desmontada, e o foco precisa ir para o título do painel (RF21, RF24, CA55, CA61).
- **R8 - Quebra silenciosa de "sem `d_status`".** `changeFilter`, `CLEAR_EXPENSE_FILTERS`, `apply({})`, `onClear`, `withMonthAndTab` e `hasExpenseFilters` assumem "ausente = Todos". Um ponto esquecido gera um "Limpar filtros" que não limpa (CA36 a CA41).
- **R9 - Tempo de carregamento.** `EntriesScreen` hoje renderiza o cabeçalho sem aguardar a API; o mês inicial passa a depender de uma leitura antes de cabeçalho e painéis (T4).
- **R10 - Testes existentes.** Testes de unidade e e2e (`entries-search-params.spec.ts`, `feedback.spec.ts`, `invoice-block.spec.tsx`, `panels.spec.tsx`, `entries.pw.ts`, stub da API) assumem o comportamento antigo. O stub tem regra própria de datas (`invoice-dates.mjs`).
- **R11 - Divergência da spec de origem.** CA61, RF20, RF21, os critérios da aba Faturas e o termo "Mês selecionado" da spec de origem deixam de valer como escritos para `/entries`. O CA61 da spec de origem continua valendo para o dashboard.

## 9. Premissas adotadas

A numeração foi preservada; P02 e P08 viraram decisões (seção 3).

- **P01** A "listagem" é a tela de lançamentos. A aba inicial continua sendo Despesas.
- **P03** O mês inicial é reavaliado a cada abertura sem `month`, inclusive pelo menu. A escolha manual vale enquanto estiver na URL.
- **P04** Links internos sem status explícito recebem o padrão Pendente, inclusive "Ver lançamentos do mês" do dashboard e o atalho DR8 de `/cards`. Isso mantém uma regra única.
- **P05** Só a abertura sem `month` dispara o avanço. Outros parâmetros (`tab`, `d_card`) não o impedem.
- **P06** Links e favoritos antigos sem status passam a abrir em "Pendente".
- **P07** Não há mudança de schema nem de dados. O índice `entries_owner_month_type_status_idx` deve atender à verificação, a confirmar em T4.
- **P09** Na aba Faturas, "Pendente" inclui fatura parcialmente paga; o filtro seleciona a fatura inteira, sem filtrar seu conteúdo (RF17, RF18).
- **P10** Os status de Despesas e Faturas são independentes, seguindo o padrão atual de filtros por aba na URL (`d_*`, `r_*`) (RF19).
- **P11** Fatura paga sob "Pendente" sai da lista imediatamente, como a despesa em Despesas (RF21).
- **P12** Se a leitura de cartões falhar, o filtro de Faturas continua visível, como a lógica atual de `noCards`, que só considera "sem cartão" com leitura bem-sucedida e lista vazia (CA54).

## 10. Perguntas em aberto

### Bloqueantes (mudam regra de negócio)

Nenhuma. Todas foram decididas (seção 3).

## 11. Decisões técnicas (architect)

- **T1 - Onde fica a regra do mês inicial.** *Sugestão:* caso de uso de leitura na API (rota protegida e equivalente demo em `demo.controller.ts`). Compor no web com as leituras atuais deixou de ser adequado: elas são por mês e só de faturas, então exigiriam varrer meses, contrariando RNF01, além do risco de regra duplicada (R5 da spec de origem).
- **T2 - Fixar o mês na visita (RF07, CA28, CA29).** *Sugestão:* ao abrir sem `month`, redirecionar no servidor para a URL com o mês resolvido, sem criar entrada no histórico, de modo que o estado continue na URL (ADR 9.3). O aviso de RF05 precisa então de sinal próprio, que não reapareça indevidamente ao recarregar ou ao copiar o link.
- **T3 - Representar os status na URL.** `d_status=ALL` já está definido pela decisão do atalho de fatura paga. *Sugestão para o restante:* um parâmetro próprio de Faturas (`f_status`, com os valores `PENDING`, `PAID` e `ALL`). `ALL` fica só no web e não é enviado à API.
- **T4 - Carregamento e desempenho.** Como evitar que a verificação bloqueie a tela além do aceitável, e como medir. *Sugestão:* consulta única pelo menor mês de referência >= M com pendência, por dono, usando os índices existentes; medir com o seed de `api/test/perf`.
- **T5 - Relógio.** Como controlar "agora" nos testes da regra, na API e nos e2e. *Sugestão:* relógio injetado na regra; cenários determinísticos no stub.
- **T6 - Onde filtrar as faturas.** *Sugestão:* parâmetro opcional `status` em `GET /invoices`, para a filtragem e a contagem saírem da API; hoje `monthQuerySchema` é estrito e rejeita o parâmetro. Sem `status`, a resposta segue igual. A alternativa é filtrar no web por `pendingCount`, sem mudar o contrato.

## 12. Tarefas (ordenadas)

Dependem de T1 a T6. As tarefas [api] seguem as sugestões de T1 e T6; se o architect decidir diferente, a regra ou o filtro e seus testes migram para [web].

### Dados
1. [db] Nenhuma migração prevista. Confirmar com `EXPLAIN` sobre o seed de volume que as leituras usam os índices existentes (RNF01, P07); só propor índice se o resultado exigir.

### Regra do mês inicial
2. [api] Regra pura de domínio: dado M, o primeiro mês com pendência a partir de M (ou nenhum) e se há cartão, devolver o mês inicial e se houve avanço. Testes unitários (CA01-CA17, CA20).
3. [api] Caso de uso e porta de leitura por dono, com relógio em America/Sao_Paulo e número constante de consultas. Testes unitários (CA18-CA20, CA23) e de integração do repositório com testcontainers, com despesas de cartão e PIX, PAGO e PENDENTE, antes e depois de M (CA03, CA09, CA10, CA14, CA21).
4. [api] Exposição HTTP protegida e demo, com erro no formato padrão, devolvendo o mês para onde a tela pulou. e2e com supertest e atualização de `docs/api/finance.md` (CA23, CA24).
5. [web] Resolver o mês inicial na abertura sem `month`, fixando-o na visita e tratando falhas (CA01-CA13, CA22, CA25-CA30).
6. [web] Aviso de avanço obrigatório, nas duas variantes e com o mês de destino, conforme o ui-designer e com acessibilidade (RF05, RNF06, CA02, CA06, CA16, CA25).

### Status padrão em Despesas
7. [web] Parse e serialização com status padrão e `d_status=ALL`; `toApiQuery` sem status para "Todos" (CA31, CA33-CA35, CA44).
8. [web] Controle de status, "Limpar filtros", contador, folha mobile e "Status: ..." abaixo de `md` (RF23, CA36, CA37, CA60).
9. [web] Estados vazios, subtotal e anúncio para leitor de tela sob o padrão (CA31, CA32, CA38, CA39).
10. [web] Toasts pós-criação, destaque de recém-criado e links internos (CA40, CA41, CA43), incluindo `feedback.ts` e `cards-list.tsx`.
11. [web] Pagamento individual sob "Pendente" com foco no h2 do painel (RF24, CA61); verificar o pagamento em lote sob o padrão (CA42).

### Filtro de status em Faturas
12. [api] Filtro por status na listagem de faturas, conforme T6, com testes de caso de uso, integração e e2e; o resultado sem `status` não muda. Atualizar `docs/api/finance.md` (CA45, CA47, CA59).
13. [web] Estado do filtro de Faturas na URL, independente do de Despesas (CA45, CA48-CA50).
14. [web] Controle de status, "Limpar filtros", folha mobile e "Status: ..." abaixo de `md` na aba Faturas, tudo escondido sem cartão (RF16, RF23, CA47, CA51, CA54, CA60).
15. [web] Estados vazios, contagem e anúncio da aba Faturas, com o caso sem cartão (RF20, CA52-CA54).
16. [web] Pagar fatura sob filtro: saída do bloco, toast e foco no h2 do painel (CA28, CA55, CA56), além de manter conteúdo inteiro no bloco (CA46).
17. [web] Toast pós-criação a partir de Faturas (CA57) e atalho para Despesas: rótulo e destino conforme a fatura esteja paga ou não (RF19, CA58).

### Testes de ponta a ponta
18. [web] Ajustar o stub da API e os e2e Playwright existentes; novos e2e com relógio controlado para virada de ano e fuso (CA15-CA20, CA25-CA29, CA37, CA51, CA54, CA58-CA61), além de axe nos dois temas (RNF06).

### Fechamento
19. [api] Medir o p95 das leituras novas contra o limite de 300 ms e confirmar o número constante de consultas (RNF01).
20. [web] Medir o impacto no carregamento da tela (R9, T4).
21. Doc-writer: atualizar CA61, RF20, RF21, os critérios da aba Faturas e o termo "Mês selecionado" da spec de origem, as seções correspondentes do design, `CHANGELOG.md` e registro em `docs/runs/`.

## 13. Adendo: fatura pendente anterior ao mês atual

O ADR 0009 altera apenas a escolha automática quando não há `month` explícito. Se existir fatura de cartão pendente antes de M, abre-se no menor mês de referência dessas faturas, inclusive quando também há pendências atuais. Usa-se `reference_month` persistido, sem recalcular a fatura com o fechamento vigente. PIX anterior a M continua ignorado; na ausência de fatura antiga, CA01-CA30 mantêm a regra original.

**RFH01 - Fatura antiga mais pendente**
- Given hoje é novembro de 2026, cartão com fechamento no dia 04 e vencimento no dia 11, e compras pendentes em 20/09/2026 e 20/10/2026
- When o usuário abre `/entries` sem `month`
- Then a listagem abre em outubro de 2026 (mês de referência da fatura pendente mais antiga), sem aviso de avanço.
- And se a fatura de outubro deixar de ter despesas pendentes, a abertura passa para novembro, conforme a regra atual.
