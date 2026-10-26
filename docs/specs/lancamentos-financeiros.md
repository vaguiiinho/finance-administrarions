# Spec: Lançamentos financeiros (receitas e despesas), cartões, faturas, pagamento em lote e dashboard mensal

**Impacto em UI: sim** (telas: Lançamentos com abas Despesas/Faturas/Receitas e drawer de criação, Cartões e Dashboard mensal; alternador de tema claro/escuro na navbar)

**Revisão 3** (2026-10-24). O ADR `docs/adr/0001-lancamentos-financeiros.md` e o design `docs/design/lancamentos-financeiros.md` foram revistos para a revisão 3 e implementados (branch `feature/finance`). O fechamento da feature (Playwright, desempenho, follow-ups de UX) está em `docs/specs/lancamentos-financeiros-fechamento.md` e `docs/adr/0002-lancamentos-financeiros-fechamento.md`.

### Histórico de revisões

| Rev. | Data | Mudanças |
|---|---|---|
| 1 | 2026-10-24 | Versão inicial (tudo é despesa, sem cartões, só tema escuro). |
| 2 | 2026-10-24 | Decisões B1-B5 (categoria livre, tipo Receita/Despesa, sem edição/exclusão, cartões com mês de referência pelo fechamento, dashboard com seletor de mês); aprovação do design (D1-D4); tema claro/escuro (D5); DR1-DR4. Abertas B6 e B7. |
| 3 | 2026-10-24 | **B6 resolvida:** só seletor de mês (sem intervalo de/até), na listagem e no dashboard. **B7 resolvida:** receita com data futura conta no saldo realizado. **Mês de referência de compra no cartão passa a ser o mês do vencimento da fatura** (antes: mês do fechamento); tabela CA21 refeita. **Formas de pagamento:** apenas PIX e CARTAO (substitui CONTA). **Alteração da regra 1** (status inicial): despesa PIX nasce PAGA por padrão, com opção "Ainda não paguei"; despesa no cartão nasce PENDENTE. **Tela de lançamentos com abas** (Despesas, Faturas, Receitas) e cabeçalho comum com seletor de mês, botão de novo lançamento e resumo do mês; o resumo do topo é sempre do mês inteiro e cada aba tem subtotal próprio (substitui "totais respeitam filtros ativos"). Filtro por tipo e por intervalo saem; "Pagar fatura" migra para a aba Faturas. **Atalho "+ Novo cartão"** no drawer de lançamento. Novos DR5-DR8; novas perguntas B8-B9. CAs renumerados. |
| 3 (fechamento) | 2026-10-25 | Sem mudança de regra de negócio. Fechamento em `docs/specs/lancamentos-financeiros-fechamento.md` (ADR 0002). B8 e B9 decididas com a resposta padrão (seção 9). Desvio aprovado de RF27/CA84 (B1 do fechamento): ver nota em RF27. |

## 1. Contexto

O repositório está em estado inicial (greenfield):

- `api/` é um scaffold NestJS 12 (ESM, Vitest, Prisma 7 com `@prisma/adapter-pg` já listados), contendo apenas `AppController`/`AppService`. Não existe `src/modules/`, `schema.prisma` nem migrations.
- `web/` é um scaffold Next.js 16 (App Router, Tailwind 4) com a página padrão do `create-next-app`. Recharts ainda não está instalado.
- `docs/design/design-system.md` define o design system (dark-first, "com suporte a light mode", mas sem valores de tokens claros), tipografia, breakpoints e alvos de toque >= 44px.
- `docs/design/lancamentos-financeiros.md` (ui-designer, rev. 2) e `docs/adr/0001-lancamentos-financeiros.md` (architect) existem e foram feitos sobre revisões anteriores desta spec.
- PostgreSQL configurado via `.env` (`POSTGRES_DB=finance`).

Esta é a primeira feature de negócio do produto: cria o primeiro bounded context da API e as primeiras telas do web.

Objetivo: permitir registrar **receitas** e **despesas** pagas via **PIX** ou **cartão de crédito**, controlar a despesa do mês (pago x pendente), saber se o **saldo do mês** foi positivo, acompanhar as **faturas** de cada cartão no mês em que vencem, pagar despesas individualmente, em lote ou por fatura (de forma atômica) e visualizar a evolução mensal num dashboard com dados agregados no banco. A interface deve funcionar em tema claro e escuro.

## 2. Linguagem ubíqua

| Termo | Definição |
|---|---|
| **Lançamento** | Registro de um valor financeiro com tipo, descrição, categoria, data, valor, forma de pagamento, mês de referência e status. |
| **Tipo** | Natureza do lançamento: `RECEITA` ou `DESPESA`. Obrigatório e imutável. |
| **Receita** | Lançamento de entrada de dinheiro. Sempre PIX, nasce `RECEBIDA` e não participa do fluxo de pagamento. |
| **Despesa** | Lançamento de saída de dinheiro. Status inicial depende da forma de pagamento (PIX: PAGO por padrão, ou PENDENTE se "Ainda não paguei"; CARTAO: sempre PENDENTE). |
| **Descrição** | Texto livre que identifica o lançamento (1 a 120 caracteres após trim). |
| **Categoria** | Rótulo em texto livre que agrupa lançamentos (ex.: Moradia, Alimentação, Salário). Duas grafias são a mesma categoria quando iguais após trim/normalização de espaços, ignorando maiúsculas/minúsculas. |
| **Data do lançamento** | Data civil (sem hora/fuso) do fato: data da compra (despesa) ou do recebimento (receita). |
| **Forma de pagamento** | `PIX` ou `CARTAO` (cartão de crédito vinculado a um cartão cadastrado). Receita é sempre `PIX`. Não existe mais "conta/dinheiro". |
| **Cartão** | Cartão de crédito cadastrado, com nome, dia de fechamento e dia de vencimento. |
| **Dia de fechamento** | Dia do mês (1 a 31) em que a fatura do cartão fecha. |
| **Dia de vencimento** | Dia do mês (1 a 31) em que a fatura vence. Usado no cálculo do mês de referência. |
| **Dia efetivo** | Dia de fechamento ou vencimento ajustado a um mês: se o mês não tem esse dia (ex.: 31 em fevereiro), vale o último dia do mês. |
| **Data de fechamento da fatura** | Data em que fecha a fatura de uma compra: o fechamento efetivo do mês da compra, se o dia da compra for <= a ele; senão, o fechamento efetivo do mês seguinte. |
| **Data de vencimento da fatura** | Primeira ocorrência do dia de vencimento (efetivo) **estritamente após** a data de fechamento da fatura. |
| **Mês de referência (competência)** | Mês/ano ao qual o lançamento pertence para listagem, totais, faturas e dashboard. PIX: mês da data. CARTAO: mês da data de vencimento da fatura. Calculado na criação e gravado; nunca recalculado. |
| **Fatura** | Conjunto das despesas de um cartão com o mesmo mês de referência. Identificada por **cartão + mês de referência** (= mês do vencimento) e exibida com suas datas de fechamento e vencimento. |
| **Pagar fatura** | Marcar como pagas, numa operação atômica, todas as despesas PENDENTE de uma fatura. |
| **Status** | `PENDENTE` ou `PAGO` (despesa); `RECEBIDA` (receita). |
| **PENDENTE** | Despesa ainda não paga (toda despesa no cartão e despesa PIX criada com "Ainda não paguei"). |
| **PAGO** | Estado final de uma despesa quitada. Não retorna a PENDENTE. |
| **RECEBIDA** | Estado único e permanente de toda receita. |
| **"Ainda não paguei"** | Opção do formulário (e campo opcional da API) que faz uma despesa PIX nascer PENDENTE em vez de PAGO. |
| **Marcar como pago** | Transição PENDENTE -> PAGO de uma despesa. Não se aplica a receitas. |
| **Pagamento em lote** | Marcar como pagas várias despesas numa única operação atômica. |
| **Atomicidade do lote** | Ou todas as despesas válidas do lote são pagas, ou nenhum lançamento é alterado. |
| **Idempotência do lote** | Despesas já PAGO no lote são ignoradas sem erro e sem alteração. |
| **Money (Valor)** | Valor em R$ com exatamente 2 casas decimais, nunca representado como float. Valor de lançamento é sempre positivo. |
| **Mês selecionado** | Mês de referência escolhido no seletor de mês da tela de lançamentos ou do dashboard. Padrão: mês atual em America/Sao_Paulo. |
| **Resumo do mês** | Receitas, despesas (total/pago/pendente) e saldos realizado/previsto de **todo** o mês selecionado, sem filtros. Exibido no topo da tela de lançamentos e nos cards do dashboard. |
| **Subtotal da aba** | Totais da aba ativa respeitando os filtros da aba (Despesas: total/pago/pendente; Receitas: total). Não altera o resumo do mês. |
| **Saldo realizado** | Receitas - despesas pagas. Pode ser negativo. |
| **Saldo previsto** | Receitas - todas as despesas (pagas + pendentes). Pode ser negativo. Sempre <= saldo realizado. |
| **Saldo positivo / negativo / zerado** | Saldo > 0 / < 0 / = 0. |
| **Série mensal** | Resumo mensal de cada mês numa janela de 12 meses. |
| **Distribuição por categoria** | Soma das **despesas** por categoria num mês de referência. |
| **Data de pagamento (paidAt)** | Instante (UTC) em que a despesa passou a PAGO (para PIX pago na criação, o instante da criação). Auditoria. |
| **Tema** | Esquema de cores da interface: `claro` ou `escuro`. |
| **Preferência de tema** | Tema escolhido explicitamente pelo usuário no alternador e persistido no navegador. Na ausência dela, vale o tema do sistema (`prefers-color-scheme`). |

## 3. Decisões registradas

### 3.1 Decisões do usuário

| Id | Decisão |
|---|---|
| **B1** | Categoria é texto livre; uma categoria pode ter vários lançamentos. Autocomplete com as categorias já usadas, trim e comparação case-insensitive. |
| **B2** | Lançamento tem tipo `RECEITA` ou `DESPESA`. Receita nasce RECEBIDA, sem fluxo de pagamento. Regras de pagamento de despesa: individual/lote, atômico, idempotente, 404 com todos os ids ausentes, 422 para receitas, sem estorno. Saldo realizado = receitas - despesas pagas; saldo previsto = receitas - todas as despesas. (O status inicial da despesa foi alterado na rev. 3, ver B11; a regra de totais "respeitando filtros" foi substituída na rev. 3, ver DR6.) |
| **B3** | Edição e exclusão de lançamentos continuam fora de escopo. |
| **B4** | Cadastro de cartão (nome, dia de fechamento, dia de vencimento); mês de referência calculado na criação e gravado; listagem e dashboard usam o mês de referência; filtro por cartão; ação "Pagar fatura". Parcelamento e recorrência fora de escopo. (Regra do mês de referência revista na rev. 3, ver B10; filtro por tipo e período revistos, ver B6 e B12.) |
| **B5** | Dashboard com seletor de mês, padrão = mês atual em America/Sao_Paulo; barras com os 12 meses terminando no mês selecionado; donut com a distribuição das despesas por categoria no mês; cards com receitas, despesas (pago/pendente) e saldo realizado/previsto. |
| **Design (D1-D4)** | Aprovados e mantidos: D1 drawer para criação/edição; D2 modal de alerta para confirmação; D3 barras empilhadas (forma da DR3); D4 donut com até 5 categorias + "Outras". Também: tokens `--primary-strong`, `--on-primary`, `--surface-2`, `--scrim`, `--focus-ring`, `--chart-1..6`; pasta `web/components/`; drawer fecha sem confirmação de descarte. |
| **D5 (tema)** | Mantida como na rev. 2: tema claro e escuro com ícone de sol/lua na navbar; contraste WCAG AA em ambos; preferência persistida, padrão segue o sistema, sem flash, ícone acessível. |
| **B6 (rev. 3) - Período** | **Resolvida.** Listagem e dashboard usam **apenas seletor de mês** (padrão: mês atual em America/Sao_Paulo). Não existe filtro por intervalo de/até. O mês selecionado é sempre o mês de referência. |
| **B7 (rev. 3) - Receita futura** | **Resolvida.** Receita com data futura conta no saldo realizado do seu mês de referência (nasce RECEBIDA, sem exceção). O fluxo "a receber" fica para uma feature futura. |
| **B10 (rev. 3) - Mês de referência no cartão** | Passa a ser o **mês do vencimento da fatura** (antes: mês do fechamento). Regra em RF05. Continua calculado e gravado na criação; edição do cartão não altera lançamentos existentes. A fatura é identificada por cartão + mês de referência e exibe datas de fechamento e vencimento. |
| **B11 (rev. 3) - Formas de pagamento e status inicial** | Apenas `PIX` e `CARTAO` (substitui conta/dinheiro). PIX: mês de referência = mês da data. Receita sempre PIX. **Alteração da regra 1 original** ("toda despesa nasce PENDENTE"): despesa PIX nasce **PAGO** por padrão (`paidAt` = instante da criação) e nasce PENDENTE quando o usuário marca "Ainda não paguei" (API: campo opcional, padrão "pago" para PIX); despesa no CARTAO sempre nasce **PENDENTE**. Receita continua nascendo RECEBIDA. Regras de pagar inalteradas. |
| **B12 (rev. 3) - Tela de lançamentos com abas** | Cabeçalho comum (seletor de mês, "+ Novo lançamento", resumo do mês) visível em todas as abas; abas **Despesas** (todas as despesas do mês, filtros status/categoria/cartão incluindo "PIX", seleção múltipla e "Marcar como pago", paginação, data desc), **Faturas** (um bloco por cartão, ordenado por vencimento, com datas, totais, "Pagar fatura" e lista expansível) e **Receitas** (sem seleção nem pagar, filtro de categoria, paginação). |
| **B13 (rev. 3) - Atalho de cartão** | Drawer de lançamento tem atalho "+ Novo cartão" para criar um cartão sem sair do formulário. A tela `/cards` continua existindo. |
| **B14 (rev. 3) - Dashboard** | Seletor de mês (padrão mês atual), tudo por mês de referência; demais decisões da rev. 2 mantidas. |

### 3.2 Decisões definidas pelo planner (o usuário pediu que fossem definidas)

| Id | Decisão | Justificativa |
|---|---|---|
| **DR1 - Pagar receita via API** | Marcar uma receita como paga (individual ou em lote) é **rejeitado com 422** (`details` lista os ids de receitas). No lote, a operação inteira é rejeitada. Precedência: 400 > 404 > 422. | Requisição bem formada e ids existentes, mas viola regra de negócio; rejeitar o lote inteiro preserva a atomicidade. |
| **DR2 - Edição de cartão** | Entra nesta entrega (nome, dia de fechamento, dia de vencimento). Não altera mês de referência nem datas de fatura de lançamentos já criados. Exclusão de cartão fora de escopo. | Bancos mudam datas com frequência; sem exclusão, um cartão errado seria permanente. Sem efeito retroativo, o custo é baixo. |
| **DR3 - Forma do gráfico de barras** | Por mês: barra **Receitas** e barra **Despesas** empilhada (pago na base, pendente em cima), mais linhas **Saldo realizado** (contínua) e **Saldo previsto** (tracejada); eixo Y com negativos e linha de zero destacada; tooltip com os seis valores. Legibilidade em telas estreitas a cargo do ui-designer, mantendo os 12 meses disponíveis. | Compara receita x despesa e responde "o saldo foi positivo?" pela linha em relação ao zero. |
| **DR4 - Pagar fatura** | Operação sobre (cartão, mês de referência) que seleciona, no momento da execução, todas as despesas PENDENTE da fatura e aplica o pagamento em lote. Sem pendências: sucesso sem alterações. Cartão inexistente: 404. | Reaproveita as garantias do lote. |
| **DR5 (rev. 3) - Cartões sem lançamento no mês** | Na aba Faturas, cartões **sem nenhuma despesa** com o mês de referência selecionado **não aparecem**. Se nenhum cartão tiver fatura no mês, a aba mostra estado vazio ("Nenhuma fatura neste mês") com atalho para "+ Novo lançamento". Faturas totalmente pagas continuam aparecendo (com "Pagar fatura" desabilitado). | Fatura é, por definição, um conjunto de despesas: uma fatura vazia não existe e não teria datas confiáveis (ver B9) nem ação possível. Blocos zerados poluiriam a tela com até 20 cartões e esconderiam as faturas reais. O cadastro completo de cartões continua visível em `/cards`. |
| **DR6 (rev. 3) - Resumo do topo x subtotal da aba** | O **resumo do mês** no topo é sempre do **mês selecionado inteiro** (todas as receitas e despesas do mês de referência), não depende da aba ativa, dos filtros da aba nem da paginação. Cada aba pode exibir um **subtotal** que respeita os filtros da aba e não a paginação: Despesas = total/pago/pendente das despesas filtradas; Receitas = total das receitas filtradas; Faturas = totais por bloco (cartão). Substitui o critério da rev. 2 "totais respeitam filtros ativos". | O resumo responde "como está meu mês?" e não pode oscilar conforme o usuário navega entre abas ou filtra; o subtotal responde "quanto soma o que estou vendo?". Separar evita que um filtro de categoria faça o saldo parecer diferente do real. |
| **DR7 (rev. 3) - Lista da fatura** | A lista expansível de cada bloco da aba Faturas mostra todas as despesas da fatura (sem paginação), ordenadas por data desc, com status; é somente leitura. Pagamentos individuais ou parciais de despesas de cartão são feitos na aba Despesas (filtro pelo cartão). | Mantém a aba Faturas focada na fatura como unidade e evita duas superfícies de seleção múltipla com regras diferentes. |
| **DR8 (rev. 3) - Atalho a partir de /cards** | O atalho de cada cartão em `/cards` leva à aba Despesas do mês atual filtrada por aquele cartão. | Mostra as despesas do cartão com as ações de pagamento disponíveis. |

## 4. Requisitos funcionais

### Cartões

#### RF01 - Cadastrar cartão
- Campos obrigatórios: nome, dia de fechamento, dia de vencimento.
- Nome: 1 a 50 caracteres após trim, único ignorando maiúsculas/minúsculas (P18).
- Dias: inteiros de 1 a 31. Vencimento pode ser igual, menor ou maior que o fechamento.
- ID UUID v7. Retorna o cartão criado.
- Usado pela tela `/cards` e pelo atalho "+ Novo cartão" do drawer de lançamento (mesmas validações e erros).

#### RF02 - Listar cartões
- Lista todos os cartões (nome, dia de fechamento, dia de vencimento), ordenados por nome.
- Usada no formulário de lançamento, no filtro por cartão e na tela de cartões.

#### RF03 - Editar cartão
- Permite alterar nome, dia de fechamento e dia de vencimento, com as mesmas validações do cadastro.
- Não altera mês de referência nem datas de fatura de nenhum lançamento existente (DR2).
- Id inexistente -> 404.

### Lançamentos

#### RF04 - Criar lançamento
- Campos obrigatórios: tipo, descrição, categoria, data, valor, forma de pagamento (com cartão quando a forma é `CARTAO`).
- Tipo: `RECEITA` ou `DESPESA`, sem valor padrão na API.
- Descrição: 1 a 120 caracteres (após trim).
- Categoria: texto livre, 1 a 50 caracteres após trim e normalização de espaços; se já existir categoria igual ignorando maiúsculas/minúsculas, usa a grafia existente.
- Data: data civil válida no formato `YYYY-MM-DD`.
- Valor: string decimal (ex.: `"1234.56"`), > 0, no máximo 2 casas, máx. `9999999999.99`.
- Forma de pagamento: apenas `PIX` ou `CARTAO` (qualquer outro valor, inclusive `CONTA`, -> 400).
  - `PIX`: não aceita cartão.
  - `CARTAO`: exige um cartão existente (cartão inexistente -> 404); permitido apenas para DESPESA.
  - RECEITA com forma `CARTAO` ou com cartão informado -> 400.
- Indicador de pagamento na criação (campo opcional, nome a cargo do architect, ex.: `paid: boolean`):
  - DESPESA `PIX`: omitido ou `true` -> nasce PAGO com `paidAt` = instante da criação (servidor, UTC); `false` -> nasce PENDENTE.
  - DESPESA `CARTAO`: sempre nasce PENDENTE; `true` -> 400; `false` ou omitido aceito (P31).
  - RECEITA: sempre nasce RECEBIDA; campo informado -> 400 (P31).
- Status e mês de referência não são aceitos na entrada (400, P05).
- Mês de referência é calculado (RF05) e gravado; para CARTAO, as datas de fechamento e vencimento da fatura também são calculadas e ficam disponíveis no lançamento (P32).
- Retorna o lançamento criado, incluindo status, `paidAt` (quando PAGO), mês de referência e, para CARTAO, datas de fechamento e vencimento da fatura.

#### RF05 - Calcular mês de referência
- Forma `PIX` (despesa ou receita): mês de referência = mês da data do lançamento.
- Forma `CARTAO`, a partir da data da compra e dos dias do cartão vigentes no momento da criação:
  1. **Data de fechamento da fatura:** seja F o dia efetivo de fechamento no mês da compra (dia de fechamento, ou último dia do mês se ele não existir). Se dia da compra <= F, a fatura fecha em F do mês da compra; senão, fecha no dia efetivo de fechamento do mês seguinte (dezembro -> janeiro do ano seguinte).
  2. **Data de vencimento da fatura:** primeira ocorrência do dia de vencimento **estritamente após** a data de fechamento, usando o dia efetivo de cada mês (dia inexistente -> último dia do mês). Ou seja: se o dia efetivo de vencimento no mês do fechamento for maior que o dia do fechamento, vence nesse mês; senão, vence no dia efetivo de vencimento do mês seguinte.
  3. **Mês de referência** = mês/ano da data de vencimento.
- Calculado uma única vez, na criação; nunca recalculado (nem por edição do cartão).
- Exemplos: cartão fecha 25 e vence 5 — compra 10/10 -> fecha 25/10 -> vence 05/11 -> novembro; compra 26/10 -> fecha 25/11 -> vence 05/12 -> dezembro. Cartão fecha 3 e vence 10 — compra 02/10 -> fecha 03/10 -> vence 10/10 -> outubro. Tabela completa em CA21.

#### RF06 - Marcar uma despesa como paga
- Transição PENDENTE -> PAGO, registrando `paidAt`.
- Despesa já PAGO (inclusive PIX que nasceu paga): idempotente (sucesso sem alteração).
- Id inexistente -> 404.
- Id de receita -> 422 (DR1), sem alteração.

#### RF07 - Pagamento em lote
- Recebe uma lista de ids.
- Atômico: todas as despesas PENDENTE do lote passam a PAGO, ou nenhum lançamento é alterado.
- Despesas já PAGO são ignoradas sem erro. Ids duplicados são tratados como um só.
- Qualquer id inexistente: nada é alterado; 404 com `details` listando **todos** os ids inexistentes.
- Sem ids inexistentes, mas com receitas no lote: nada é alterado; 422 com `details` listando **todas** as receitas (DR1).
- Lista vazia, ids mal formados ou lista acima do limite -> 400.
- Sucesso informa quais ids foram efetivamente pagos e quais já estavam pagos.

#### RF08 - Pagar fatura
- Recebe cartão e mês de referência (`YYYY-MM`, mês do vencimento).
- Marca como pagas todas as despesas PENDENTE da fatura, com as garantias do RF07 (atomicidade, `paidAt` único, concorrência).
- Sem despesas pendentes na fatura: sucesso sem alterações.
- Cartão inexistente -> 404; mês inválido -> 400.
- Resposta informa os ids pagos, a quantidade e a soma paga.
- Considera as pendências existentes no instante da execução (P21).

#### RF09 - Listar faturas do mês
- Recebe um mês de referência (`YYYY-MM`, obrigatório).
- Retorna uma fatura por cartão que tenha ao menos uma despesa com esse mês de referência (DR5), ordenadas por data de vencimento crescente (desempate: nome do cartão).
- Cada fatura informa: cartão (id e nome), mês de referência, data de fechamento, data de vencimento, quantidade de despesas, total, total pago e total pendente.
- É possível obter todas as despesas de uma fatura (para a lista expansível, DR7), ordenadas por data desc.
- Datas exibidas quando as despesas da fatura têm datas divergentes (cartão editado): ver B9.
- Totais calculados no banco (query agregada).

#### RF10 - Resumo do mês
- Para um mês de referência (`YYYY-MM`): receitas, despesas (total/pago/pendente), saldo realizado e saldo previsto, sobre **todos** os lançamentos do mês, sem filtros (DR6).
- Mesmo cálculo usado no topo da tela de lançamentos e nos cards do dashboard.

#### RF11 - Listar despesas do mês
- Mês de referência obrigatório (`YYYY-MM`). Não existe filtro por intervalo.
- Filtros opcionais e combináveis: status (`PENDENTE` ou `PAGO`), categoria (case-insensitive), cartão (um cartão específico ou "PIX/sem cartão").
- Ordenação: data do lançamento decrescente (desempate estável, ver T5).
- Paginação com metadados (página, tamanho, total de itens, total de páginas).
- Subtotal sobre **todo o conjunto filtrado** (não só a página): despesas total, pagas e pendentes.
- Cada item informa forma de pagamento, cartão (id e nome, quando houver), data, mês de referência, valor, status e `paidAt`.

#### RF12 - Listar receitas do mês
- Mês de referência obrigatório (`YYYY-MM`). Filtro opcional de categoria (case-insensitive).
- Ordenação, paginação e desempate iguais ao RF11.
- Subtotal sobre todo o conjunto filtrado: total de receitas.
- Separar RF11 e RF12 em endpoints ou em um endpoint com tipo obrigatório é decisão do architect (T8).

#### RF13 - Totais consistentes após pagamento
- Após pagar despesas (individual, lote ou fatura): despesas pendentes diminuem e despesas pagas aumentam exatamente pela soma das despesas efetivamente alteradas; total de despesas, receitas e saldo previsto não mudam; saldo realizado diminui pela mesma soma. Vale para o resumo do mês, o subtotal da aba Despesas, os totais das faturas e o dashboard.

#### RF14 - Listar categorias existentes
- Categorias distintas já usadas (receitas e despesas, catálogo único, P23), para o filtro e o autocomplete do formulário.

### Dashboard

#### RF15 - Resumo do mês no dashboard
- Usa o RF10 para o mês selecionado.

#### RF16 - Série mensal (barras)
- Para os 12 meses terminando no mês selecionado (inclusive), por mês de referência: receitas, despesas pagas, despesas pendentes, total de despesas, saldo realizado e saldo previsto.
- Meses sem lançamentos aparecem com zeros (sempre 12 pontos).

#### RF17 - Distribuição por categoria (donut)
- Para o mês selecionado: soma das **despesas** (pagas e pendentes) por categoria, ordenada por valor decrescente, com percentual. Receitas não entram.

#### RF18 - Agregação no banco
- RF09, RF10, RF11/RF12 (subtotais), RF16 e RF17 calculados via query agregada no Postgres, agrupando pelo mês de referência; o frontend apenas exibe.

### Web

#### RF19 - Tela de lançamentos: cabeçalho comum
- Topo fixo, visível em todas as abas: seletor de mês (padrão: mês atual em America/Sao_Paulo), botão "+ Novo lançamento" e resumo do mês (Receitas; Despesas total/pago/pendente; Saldo realizado e Saldo previsto com indicação textual de positivo/negativo/zerado).
- O resumo do mês não muda ao trocar de aba, filtrar ou paginar (DR6).
- Mês selecionado, aba ativa, filtros da aba e página ficam na URL.
- Abas: Despesas (padrão), Faturas, Receitas.

#### RF20 - Aba Despesas
- Todas as despesas do mês de referência selecionado, de todos os cartões e PIX.
- Tabela (desktop) / cards (mobile): descrição, categoria, data (dd/MM/yyyy), forma de pagamento ("PIX" ou nome do cartão), indicação da fatura quando a compra no cartão tem mês de referência diferente do mês da data (ex.: "Fatura nov/26"), valor (R$ 1.234,56) e status (badge Pendente/Pago).
- Filtros: status (Pendente/Pago), categoria, cartão (inclui a opção "PIX/sem cartão").
- Subtotal da aba (total/pago/pendente) respeitando os filtros da aba.
- Seleção múltipla apenas de despesas PENDENTE ("selecionar todos os pendentes da página"); despesas pagas com checkbox indisponível. Ação "Marcar como pago" com quantidade e soma dos selecionados. Ação individual "Marcar como pago" em despesas PENDENTE.
- Paginação; ordenação data desc.
- "Pagar fatura" não fica nesta aba (está na aba Faturas).

#### RF21 - Aba Faturas
- Um bloco por cartão com fatura no mês selecionado (RF09, DR5), ordenado por data de vencimento.
- Cada bloco: nome do cartão, data de fechamento, data de vencimento, total, pago, pendente, botão "Pagar fatura" e lista expansível das despesas (DR7).
- "Pagar fatura" pede confirmação mostrando cartão, mês de referência, data de vencimento, quantidade e soma pendente; desabilitado quando a fatura não tem pendências.
- Estado vazio quando nenhum cartão tem fatura no mês.

#### RF22 - Aba Receitas
- Receitas do mês selecionado: descrição, categoria, data, valor, badge Recebida; sem checkbox e sem ação de pagar.
- Filtro de categoria; subtotal (total de receitas filtradas); paginação.

#### RF23 - Drawer "Novo lançamento"
- Campos: tipo (padrão na UI: Despesa), descrição, categoria (autocomplete), data, valor (máscara pt-BR), forma de pagamento (PIX ou Cartão; padrão na UI: PIX), cartão (quando Cartão) e opção "Ainda não paguei" (só quando Despesa + PIX; desmarcada por padrão).
- Com tipo Receita: forma fixa em PIX, cartão e "Ainda não paguei" indisponíveis.
- Com forma Cartão: "Ainda não paguei" indisponível (despesa no cartão sempre nasce pendente), com texto explicando que ela entra na fatura.
- Atalho "+ Novo cartão" junto ao campo cartão: cria o cartão sem sair do drawer (mesmos campos e validações da tela de cartões, inclusive 409 de nome duplicado); ao criar, o cartão fica selecionado e os dados já digitados no lançamento são preservados; cancelar o atalho volta ao formulário sem perder dados.
- Validação inline. Após criar: resumo, subtotais, abas e faturas atualizados; feedback de sucesso. Compra no cartão: feedback informa a fatura (ex.: "Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026").

#### RF24 - Feedback e estados da tela de lançamentos
- Após pagar: itens, resumo, subtotais e faturas atualizados; feedback de sucesso/erro.
- Erro 404 do lote: informa quais lançamentos não foram encontrados. Erro 422: informa que receitas não podem ser pagas.
- Estados de loading, vazio e erro com "tentar novamente", por aba e para o resumo.

#### RF25 - Tela de cartões
- Lista de cartões com nome, "Fecha dia X" e "Vence dia Y".
- Criar e editar cartão em drawer, com validação inline. Ao editar, aviso de que a mudança só vale para novos lançamentos.
- Estados de loading, vazio ("Nenhum cartão cadastrado") e erro.
- Atalho por cartão para a aba Despesas do mês atual filtrada pelo cartão (DR8).

#### RF26 - Tela de dashboard
- Seletor de mês (padrão: mês corrente em America/Sao_Paulo), com o mês na URL.
- Cards: Receitas, Despesas (com pago e pendente), Saldo realizado e Saldo previsto (com indicação textual de positivo/negativo/zerado).
- Gráfico de barras (Recharts) na forma de DR3, 12 meses terminando no mês selecionado, rótulos de mês em pt-BR, tooltip em R$.
- Donut (Recharts): despesas por categoria no mês selecionado, legenda e tooltip com R$ e percentual.
- Estados loading (skeleton), vazio e erro com "tentar novamente", independentes por bloco.
- Navegação entre Lançamentos, Cartões e Dashboard.

#### RF27 - Tema claro e escuro
- Botão com ícone de sol/lua na navbar alterna entre tema claro e escuro, em todas as telas.
- Sem preferência salva: segue `prefers-color-scheme` e acompanha mudanças do sistema em tempo real.
- Ao alternar: a escolha passa a ser a preferência de tema, persistida no navegador e reaplicada em novas visitas; mudanças do sistema deixam de sobrepor a escolha.
- Sem flash de tema errado no carregamento (inclusive skeletons, páginas de erro e primeira renderização no servidor).
- A troca de tema não recarrega a página nem perde estado (drawer aberto, atalho de novo cartão aberto, dados digitados, seleção, aba, filtros).
- **Desvio aprovado (2026-10-25, B1 do fechamento):** com qualquer diálogo modal aberto (drawer, painel "+ Novo cartão", modal de confirmação, folha de filtros), o botão de tema fica inerte sob o scrim (fundo inerte nativo). A troca de tema nesse estado só ocorre por mudança do tema do sistema **sem preferência salva**, e preserva diálogo, dados digitados, seleção, aba, filtros e cores. Com preferência salva, o tema só muda após fechar o diálogo. O CA84 deve ser lido nesse sentido. Detalhe: design §12, item 2.
- Botão acessível: alvo >= 44x44, `aria-label` fixo (ex.: "Tema escuro") com `aria-pressed`; ícone decorativo oculto de leitores de tela; operável por teclado com foco visível.
- Tudo segue o tema ativo: header, abas, superfícies, tabela, cards, blocos de fatura, inputs, drawer, modais, folhas, toasts, skeletons, estados vazio/erro, scrim, anel de foco, gráficos e controles nativos.
- Ambos os temas definidos por tokens; nenhum componente usa cor literal. Semântica de cores mantida nos dois temas (pago, pendente, recebida, receita, despesa, saldo negativo, erro).

## 5. Requisitos não funcionais

- **RNF01 - Precisão monetária:** nenhum valor monetário como float em qualquer camada. Banco `Decimal(12,2)` para valores de lançamento; API trafega string decimal (`"1234.56"`). Saldos podem ser negativos (`"-150.00"`). Somas e formatação no web sem `Number`.
- **RNF02 - Atomicidade:** pagamento em lote e pagar fatura numa única transação; falha parcial não deixa estado intermediário; pagamentos concorrentes sobre a mesma despesa não geram estado inconsistente nem `paidAt` duplicado.
- **RNF03 - Datas:** instantes (`createdAt`, `updatedAt`, `paidAt`) em UTC; exibição em America/Sao_Paulo. Data do lançamento, datas de fechamento/vencimento da fatura são datas civis; mês de referência é mês civil; nenhum pode sofrer deslocamento de fuso.
- **RNF04 - Erros:** formato `{ code, message, details }`; id inexistente -> 404; validação -> 400 com detalhes por campo; regra de negócio sobre requisição válida (pagar receita) -> 422; nome de cartão duplicado -> 409.
- **RNF05 - Arquitetura:** Clean Architecture + DDD conforme CLAUDE.md. O cálculo de datas da fatura e do mês de referência é regra de domínio, sem dependência externa.
- **RNF06 - Desempenho:** listagens paginadas, subtotais, resumo do mês, faturas do mês, pagar fatura e agregações do dashboard < 300 ms (p95) com 100 mil lançamentos e 20 cartões, em ambiente local.
- **RNF07 - Testes:** unitários para domain e use cases (incluindo a tabela CA21); integração com Postgres real (testcontainers); e2e com supertest; cobertura >= 80% em domain/application.
- **RNF08 - UI:** design system do projeto; mobile-first, tabela vira cards abaixo de `md` (768px); abas e cabeçalho utilizáveis em 360px; alvos de toque >= 44px; respeitar `prefers-reduced-motion`; formatação pt-BR (`R$ 1.234,56`, `-R$ 150,00`, `dd/MM/yyyy`).
- **RNF09 - Acessibilidade:** abas com semântica e navegação por teclado de abas; checkboxes e ações com rótulos acessíveis; blocos de fatura expansíveis com estado anunciado; gráficos com alternativa textual; modal/drawer com foco preso e Esc (inclusive o atalho de novo cartão, retornando o foco ao campo cartão); cor nunca é o único sinal.
- **RNF10 - Contraste em ambos os temas:** WCAG AA (>= 4,5:1 texto normal; >= 3:1 texto grande, componentes de UI, bordas, anel de foco e elementos gráficos) nos dois temas e em todos os estados; estados desabilitados também >= 3:1 para texto e ícone; opacidade/scrim/blur não podem derrubar o contraste.
- **RNF11 - Verificação automatizada de contraste:** testes automatizados de acessibilidade (ex.: axe) em cada tela, aba e estado relevante, nos dois temas, sem violações de contraste.

## 6. Critérios de aceite

> Os payloads usam nomes em pt-BR para legibilidade; o mapeamento para os nomes da API é do architect. `pago` representa o campo opcional de RF04.

### Cartões

**CA01 - Cadastro válido**
- Given o payload `{ nome: "Nubank", diaFechamento: 25, diaVencimento: 5 }`
- When o usuário cadastra o cartão
- Then a API responde 201 com o cartão e `id` UUID v7.

**CA02 - Cadastro inválido**
- Given nome vazio ou com 51 caracteres, ou dia de fechamento/vencimento `0`, `32`, `10.5` ou `"10"`
- When o usuário cadastra o cartão
- Then a API responde 400 com `details` por campo.

**CA03 - Nome duplicado**
- Given um cartão "Nubank" cadastrado
- When o usuário cadastra " nubank " (pela tela de cartões ou pelo atalho do drawer)
- Then a API responde 409 e nenhum cartão é criado.

**CA04 - Listagem de cartões**
- Given os cartões "Nubank" e "Itaú"
- When o usuário lista cartões
- Then recebe ambos ordenados por nome, com dias de fechamento e vencimento.

**CA05 - Edição não recalcula lançamentos existentes**
- Given o cartão C (fecha 10, vence 17) e uma despesa em C com data 2026-10-15 (fecha 10/11, vence 17/11, mês de referência 2026-11)
- When o usuário altera C para fecha 20 e vence 25 e depois cria outra despesa em C com data 2026-10-15
- Then a primeira despesa continua com mês de referência 2026-11 e vencimento 17/11/2026, e a nova recebe fechamento 20/10/2026, vencimento 25/10/2026 e mês de referência 2026-10.

**CA06 - Edição de cartão inexistente**
- Given um UUID que não corresponde a cartão
- When o usuário tenta editá-lo
- Then a API responde 404 no formato `{ code, message, details }`.

### Criação de lançamento

**CA07 - Despesa PIX nasce PAGA por padrão**
- Given `{ tipo: "DESPESA", descricao: "Aluguel", categoria: "Moradia", data: "2026-10-05", valor: "1500.00", formaPagamento: "PIX" }` (sem `pago`), criada em 2026-10-05T13:00:00Z
- When o usuário cria o lançamento
- Then a API responde 201 com `status: "PAGO"`, `paidAt: "2026-10-05T13:00:00Z"`, `mesReferencia: "2026-10"`, `valor: "1500.00"` e `id` UUID v7; o resumo de 2026-10 passa a ter R$ 1.500,00 a mais em despesas pagas e o saldo realizado diminui nesse valor.

**CA08 - Despesa PIX "Ainda não paguei" nasce PENDENTE**
- Given o payload do CA07 com `pago: false`
- When o usuário cria o lançamento
- Then a API responde 201 com `status: "PENDENTE"` e sem `paidAt`; com `pago: true`, o resultado é igual ao CA07.

**CA09 - Despesa no cartão nasce PENDENTE**
- Given o cartão C (fecha 25, vence 5) e uma DESPESA com forma `CARTAO`, cartão C, data 2026-10-10, sem `pago` ou com `pago: false`
- When o usuário cria o lançamento
- Then a API responde 201 com `status: "PENDENTE"`, sem `paidAt`, `mesReferencia: "2026-11"`, data de fechamento `2026-10-25` e data de vencimento `2026-11-05`; com `pago: true`, a API responde 400 com `details` no campo e nada é criado.

**CA10 - Receita nasce RECEBIDA**
- Given `{ tipo: "RECEITA", descricao: "Salário", categoria: "Salário", data: "2026-10-30", valor: "5000.00", formaPagamento: "PIX" }`, criada em 2026-10-24
- When o usuário cria o lançamento
- Then a API responde 201 com `status: "RECEBIDA"`, sem cartão, `mesReferencia: "2026-10"`, e o valor entra no saldo realizado de outubro mesmo com a data futura (B7).

**CA11 - Receita no cartão ou com indicador de pagamento é rejeitada**
- Given um payload de RECEITA com forma `CARTAO`, com cartão informado ou com o campo `pago`
- When o usuário cria o lançamento
- Then a API responde 400 e nada é criado.

**CA12 - Consistência entre forma e cartão**
- Given uma DESPESA com forma `CARTAO` sem cartão, ou com forma `PIX` e cartão informado
- When o usuário cria o lançamento
- Then a API responde 400 com `details` apontando o campo correspondente.

**CA13 - Cartão inexistente**
- Given uma DESPESA com forma `CARTAO` e um UUID de cartão inexistente
- When o usuário cria o lançamento
- Then a API responde 404 e nada é criado.

**CA14 - Tipo e forma de pagamento válidos**
- Given payload sem tipo, com tipo `"TRANSFERENCIA"`, sem forma de pagamento ou com forma `"CONTA"` ou `"DINHEIRO"`
- When o usuário cria o lançamento
- Then a API responde 400 com `details` apontando o campo tipo ou forma de pagamento.

**CA15 - Status e mês de referência não são aceitos na entrada**
- Given um payload válido contendo `status: "PAGO"`, `mesReferencia: "2026-01"` ou datas de fechamento/vencimento
- When o usuário cria o lançamento
- Then a API responde 400 (P05) e nada é criado.

**CA16 - Descrição inválida e no limite**
- Given descrição vazia, só com espaços ou com 121 caracteres
- When o usuário cria o lançamento
- Then a API responde 400 com `details` no campo descrição; com exatamente 120 caracteres, responde 201.

**CA17 - Valor inválido**
- Given valor `"0"`, `"0.00"`, `"-10.00"`, `"10.123"`, `"abc"`, `"10000000000.00"` ou numérico (não string)
- When o usuário cria o lançamento (receita ou despesa)
- Then a API responde 400 com `details` no campo valor.

**CA18 - Valor com menos casas**
- Given valor `"10"` ou `"10.5"`
- When o usuário cria o lançamento
- Then a API responde 201 com `"10.00"` / `"10.50"`.

**CA19 - Campos obrigatórios e data inválida**
- Given payload sem categoria, sem data, ou com data `"2026-02-30"`
- When o usuário cria o lançamento
- Then a API responde 400 com `details` por campo (todas as violações juntas).

**CA20 - Categoria case-insensitive com grafia existente**
- Given um lançamento existente na categoria "Alimentação"
- When o usuário cria outro com categoria "  alimentação "
- Then o novo lançamento fica na categoria "Alimentação" e a lista de categorias tem uma única entrada para ela.

### Mês de referência

**CA21 - Tabela de cálculo do mês de referência**
- Given os cenários abaixo (dias de fechamento/vencimento vigentes no cartão na criação)
- When o lançamento é criado
- Then a data de fechamento, a data de vencimento e o mês de referência gravados são os das colunas correspondentes.

| # | Forma | Fecha | Vence | Data da compra | Fechamento | Vencimento | Mês ref. | Motivo |
|---|---|---|---|---|---|---|---|---|
| 1 | CARTAO | 25 | 5 | 2026-10-10 | 2026-10-25 | 2026-11-05 | 2026-11 | antes do fechamento; vencimento < fechamento -> mês seguinte ao fechamento |
| 2 | CARTAO | 25 | 5 | 2026-10-25 | 2026-10-25 | 2026-11-05 | 2026-11 | compra no dia do fechamento entra na fatura que fecha nesse dia |
| 3 | CARTAO | 25 | 5 | 2026-10-26 | 2026-11-25 | 2026-12-05 | 2026-12 | após o fechamento -> próxima fatura |
| 4 | CARTAO | 3 | 10 | 2026-10-02 | 2026-10-03 | 2026-10-10 | 2026-10 | vencimento > fechamento -> vence no mesmo mês do fechamento |
| 5 | CARTAO | 3 | 10 | 2026-10-04 | 2026-11-03 | 2026-11-10 | 2026-11 | após o fechamento, vencimento > fechamento |
| 6 | CARTAO | 5 | 15 | 2026-10-05 | 2026-10-05 | 2026-10-15 | 2026-10 | dia do fechamento, vencimento > fechamento |
| 7 | CARTAO | 10 | 10 | 2026-10-05 | 2026-10-10 | 2026-11-10 | 2026-11 | vencimento igual ao fechamento -> estritamente após, mês seguinte |
| 8 | CARTAO | 25 | 5 | 2026-12-10 | 2026-12-25 | 2027-01-05 | 2027-01 | virada dez -> jan no vencimento |
| 9 | CARTAO | 25 | 5 | 2026-12-26 | 2027-01-25 | 2027-02-05 | 2027-02 | virada dez -> jan no fechamento |
| 10 | CARTAO | 3 | 10 | 2026-12-15 | 2027-01-03 | 2027-01-10 | 2027-01 | virada no fechamento, vencimento > fechamento |
| 11 | CARTAO | 31 | 10 | 2026-02-15 | 2026-02-28 | 2026-03-10 | 2026-03 | fechamento 31 em fevereiro -> último dia (28) |
| 12 | CARTAO | 31 | 10 | 2026-02-28 | 2026-02-28 | 2026-03-10 | 2026-03 | compra no fechamento efetivo de fevereiro |
| 13 | CARTAO | 31 | 10 | 2026-01-31 | 2026-01-31 | 2026-02-10 | 2026-02 | mês de 31 dias, compra no fechamento |
| 14 | CARTAO | 30 | 5 | 2026-01-31 | 2026-02-28 | 2026-03-05 | 2026-03 | após o fechamento de janeiro; fechamento seguinte ajustado a 28/02 |
| 15 | CARTAO | 30 | 7 | 2028-02-29 | 2028-02-29 | 2028-03-07 | 2028-03 | ano bissexto: fechamento efetivo 29/02 |
| 16 | CARTAO | 29 | 7 | 2027-02-28 | 2027-02-28 | 2027-03-07 | 2027-03 | ano não bissexto: fechamento 29 -> 28/02 |
| 17 | CARTAO | 20 | 31 | 2026-02-10 | 2026-02-20 | 2026-02-28 | 2026-02 | vencimento 31 inexistente em fevereiro -> 28/02 (> fechamento) |
| 18 | CARTAO | 31 | 30 | 2026-02-28 | 2026-02-28 | 2026-03-30 | 2026-03 | vencimento ajustado (28/02) igual ao fechamento -> mês seguinte |
| 19 | CARTAO | 31 | 31 | 2026-04-30 | 2026-04-30 | 2026-05-31 | 2026-05 | abril tem 30 dias; vencimento igual ao fechamento efetivo -> mês seguinte |
| 20 | CARTAO | 28 | 30 | 2026-01-29 | 2026-02-28 | 2026-03-30 | 2026-03 | vencimento ajustado a 28/02 não é estritamente após 28/02 -> março |
| 21 | PIX (despesa) | - | - | 2026-10-31 | - | - | 2026-10 | PIX: mês da data |
| 22 | PIX (receita) | - | - | 2026-12-31 | - | - | 2026-12 | receita: mês da data |

**CA22 - Datas da fatura no lançamento**
- Given o cartão C (fecha 25, vence 5)
- When o usuário cria uma despesa em C com data 2026-10-26
- Then a resposta e a listagem informam fatura com fechamento 25/11/2026, vencimento 05/12/2026 e mês de referência 2026-12.

**CA23 - Sem deslocamento de fuso**
- Given uma despesa PIX com data 2026-10-31 criada às 23h em America/Sao_Paulo
- When o usuário consulta o mês 2026-10 (lançamentos e dashboard)
- Then o lançamento aparece em outubro e é exibido como 31/10/2026; datas de fechamento e vencimento também não se deslocam.

### Pagamento individual

**CA24 - Marcar despesa como paga**
- Given uma despesa PENDENTE (no cartão ou PIX "Ainda não paguei")
- When o usuário a marca como paga
- Then o status passa a PAGO e `paidAt` é registrado em UTC.

**CA25 - Idempotência individual**
- Given uma despesa já PAGO (inclusive PIX que nasceu paga)
- When o usuário a marca como paga novamente
- Then a operação tem sucesso, o status continua PAGO e `paidAt` não muda.

**CA26 - Id inexistente**
- Given um UUID que não corresponde a lançamento
- When o usuário tenta marcá-lo como pago
- Then a API responde 404 no formato `{ code, message, details }`.

**CA27 - Receita não pode ser paga**
- Given uma receita RECEBIDA
- When um cliente da API tenta marcá-la como paga
- Then a API responde 422 com `details` contendo o id e a receita permanece inalterada.

**CA28 - Sem estorno**
- Given uma despesa PAGO
- When qualquer operação tenta voltá-la a PENDENTE
- Then não existe operação disponível (nem endpoint nem ação de UI).

### Pagamento em lote

**CA29 - Lote todo pendente**
- Given as despesas A (R$ 100,00) e B (R$ 50,25), PENDENTE
- When o usuário paga em lote [A, B]
- Then A e B ficam PAGO e a resposta informa ambas como pagas.

**CA30 - Lote misto (idempotente)**
- Given A PENDENTE e B já PAGO
- When o usuário paga em lote [A, B]
- Then A passa a PAGO, B fica inalterada (inclusive `paidAt`) e a resposta informa A como paga e B como já paga.

**CA31 - Lote com ids inexistentes**
- Given A PENDENTE e os ids X e Y inexistentes
- When o usuário paga em lote [A, X, Y]
- Then a API responde 404 com `details` contendo X e Y, e A permanece PENDENTE.

**CA32 - Lote com receita**
- Given A despesa PENDENTE e R receita
- When um cliente da API paga em lote [A, R]
- Then a API responde 422 com `details` contendo R, e A permanece PENDENTE.

**CA33 - Precedência 404 sobre 422**
- Given R receita e X inexistente
- When um cliente da API paga em lote [R, X]
- Then a API responde 404 com `details` contendo X e nada é alterado.

**CA34 - Falha durante a persistência**
- Given um lote de despesas PENDENTE e uma falha simulada no meio da gravação
- When o pagamento em lote é executado
- Then nenhum lançamento é alterado.

**CA35 - Ids duplicados**
- Given A PENDENTE
- When o usuário paga em lote [A, A]
- Then A passa a PAGO uma única vez e a operação tem sucesso.

**CA36 - Lote inválido**
- Given lista vazia, ids mal formados ou lista acima do limite
- When o usuário paga em lote
- Then a API responde 400 e nada é alterado.

**CA37 - Concorrência**
- Given dois pagamentos simultâneos (lote x lote, ou lote x pagar fatura) com interseção de despesas
- When ambos executam
- Then as despesas terminam PAGO com um único `paidAt` cada e os totais ficam consistentes.

### Pagar fatura

**CA38 - Pagar fatura do mês**
- Given o cartão C com despesas no mês de referência 2026-11: E1 PENDENTE R$ 100,00, E2 PENDENTE R$ 50,00, E3 já PAGO R$ 30,00; E4 PENDENTE em C com referência 2026-12; E5 PENDENTE em outro cartão com referência 2026-11; E6 PIX PENDENTE com referência 2026-11
- When o usuário paga a fatura de C em 2026-11
- Then E1 e E2 ficam PAGO, a resposta informa 2 lançamentos e R$ 150,00, e E3, E4, E5 e E6 ficam inalterados.

**CA39 - Fatura usa o mês do vencimento, não o da compra nem o do fechamento**
- Given o cartão C (fecha 25, vence 5) e uma despesa PENDENTE de data 2026-10-10 (fecha 25/10, vence 05/11, referência 2026-11)
- When o usuário paga a fatura de C em 2026-10
- Then essa despesa permanece PENDENTE; ao pagar a fatura de C em 2026-11, ela passa a PAGO.

**CA40 - Fatura sem pendências**
- Given uma fatura sem despesas PENDENTE (vazia ou toda paga)
- When o usuário paga a fatura
- Then a operação tem sucesso, nenhum lançamento muda e a resposta informa 0 lançamentos e `"0.00"`.

**CA41 - Fatura de cartão inexistente ou mês inválido**
- Given um cartão inexistente, ou o mês `"2026-13"`
- When o usuário paga a fatura
- Then a API responde 404 / 400, respectivamente, e nada é alterado.

**CA42 - Atomicidade da fatura**
- Given uma fatura com 3 despesas PENDENTE e uma falha simulada no meio da gravação
- When o usuário paga a fatura
- Then nenhuma das 3 é alterada.

### Faturas do mês

**CA43 - Faturas do mês com datas e totais**
- Given o cartão A (fecha 25, vence 5) com despesas de 2026-10-10 (R$ 100,00, PENDENTE) e 2026-10-20 (R$ 40,00, já paga individualmente), e o cartão B (fecha 3, vence 10) com despesa de 2026-10-15 (R$ 60,00, PENDENTE)
- When o usuário consulta as faturas de 2026-11
- Then recebe duas faturas, ordenadas por vencimento: primeiro A (fecha 25/10/2026, vence 05/11/2026, 2 despesas, total R$ 140,00, pago R$ 40,00, pendente R$ 100,00) e depois B (fecha 03/11/2026, vence 10/11/2026, 1 despesa, total R$ 60,00, pago R$ 0,00, pendente R$ 60,00).

**CA44 - Cartão sem despesas no mês não aparece**
- Given os cartões A e B, apenas A com despesas de referência 2026-11
- When o usuário consulta as faturas de 2026-11
- Then só a fatura de A é retornada; sem nenhuma fatura no mês, a lista vem vazia e a aba Faturas exibe "Nenhuma fatura neste mês".

**CA45 - Fatura paga continua listada**
- Given a fatura de A em 2026-11 com todas as despesas PAGO
- When o usuário consulta as faturas de 2026-11
- Then A aparece com pendente R$ 0,00 e, na UI, "Pagar fatura" desabilitado.

### Listagem, resumo e subtotais

**CA46 - Mês obrigatório, ordenação e paginação padrão**
- Given 25 despesas no mês de referência 2026-10 com datas variadas
- When o cliente lista as despesas de 2026-10 sem outros parâmetros
- Then recebe a primeira página com o tamanho padrão, ordenada por data decrescente, com metadados de paginação; sem mês informado, a API responde 400 (P14).

**CA47 - Resumo do mês independe de aba, filtros e paginação**
- Given em 2026-10: receitas R$ 5.000,00; despesas PAGO R$ 3.000,00 (das quais R$ 1.000,00 em "Moradia") e PENDENTE R$ 2.500,00
- When o usuário, com 2026-10 selecionado, troca entre as abas, filtra a aba Despesas por categoria "Moradia" e muda de página
- Then o resumo do topo continua: Receitas R$ 5.000,00; Despesas R$ 5.500,00 (pago R$ 3.000,00, pendente R$ 2.500,00); Saldo realizado R$ 2.000,00 e Saldo previsto -R$ 500,00.

**CA48 - Cálculo do resumo do mês**
- Given o mês do CA47
- When o cliente consulta o resumo de 2026-10
- Then receitas = `"5000.00"`, despesas total = `"5500.00"`, pagas = `"3000.00"`, pendentes = `"2500.00"`, saldo realizado = `"2000.00"` e saldo previsto = `"-500.00"`.

**CA49 - Invariantes dos totais**
- Given qualquer mês e qualquer combinação de filtros
- When o cliente consulta o resumo, os subtotais ou as faturas
- Then despesas total = pagas + pendentes, saldo realizado = receitas - pagas, saldo previsto = receitas - despesas total, saldo previsto <= saldo realizado, e a soma dos totais das faturas do mês é igual à soma das despesas no cartão do mês, exatamente (sem arredondamento).

**CA50 - Subtotal da aba respeita filtros, não a página**
- Given 30 despesas em 2026-10 que atendem ao filtro de categoria "Moradia", com página de 20 itens
- When o usuário lista a página 1 da aba Despesas com esse filtro
- Then o subtotal (total/pago/pendente) considera as 30 despesas de Moradia, e o resumo do topo continua considerando o mês inteiro.

**CA51 - Totais após pagamento**
- Given receitas R$ 1.000,00, despesas pagas R$ 200,00 e pendentes R$ 300,00 no mês, com A (R$ 100,10) e B (R$ 49,90) PENDENTE
- When o usuário paga em lote [A, B] e consulta novamente
- Then pendentes = R$ 150,00, pagas = R$ 350,00, despesas total = R$ 500,00, receitas = R$ 1.000,00, saldo realizado = R$ 650,00 e saldo previsto = R$ 500,00 (inalterado), no resumo, no subtotal da aba Despesas e no dashboard.

**CA52 - Precisão decimal**
- Given despesas de `"0.10"`, `"0.20"` e `"0.30"` e receita de `"0.50"` no mês
- When o cliente consulta o resumo
- Then despesas total = `"0.60"` e saldo previsto = `"-0.10"`.

**CA53 - Mês selecionado usa o mês de referência**
- Given o cartão C (fecha 25, vence 5); despesa em C com data 2026-10-10 (referência 2026-11); despesa PIX com data 2026-10-20; receita com data 2026-11-05
- When o usuário seleciona 2026-11
- Then a aba Despesas mostra a compra de 10/10 (com "Fatura nov/26"), a aba Receitas mostra a receita de 05/11, a aba Faturas mostra a fatura de C, e a despesa PIX de 20/10 não aparece.

**CA54 - Filtro por status**
- Given despesas PAGO e PENDENTE no mês
- When o usuário filtra a aba Despesas por Pendente
- Then retornam só despesas PENDENTE; o subtotal tem pagas = `"0.00"` e despesas total = pendentes; o resumo do topo não muda.

**CA55 - Filtro por cartão**
- Given despesas nos cartões C1 e C2 e despesas PIX no mês
- When o usuário filtra a aba Despesas por C1
- Then retornam só despesas de C1 com subtotal correspondente; filtrando por "PIX/sem cartão", retornam só despesas PIX.

**CA56 - Filtro por categoria case-insensitive**
- Given despesas e receitas em "Moradia" e "Alimentação"
- When o usuário filtra a aba Despesas (ou Receitas) por categoria "moradia"
- Then retornam só os lançamentos de Moradia do tipo da aba e o subtotal considera apenas eles.

**CA57 - Parâmetros inválidos**
- Given mês ausente ou `"2026-13"`, status fora de `PENDENTE`/`PAGO` na listagem de despesas, cartão mal formado, ou parâmetros de intervalo (de/até)
- When o cliente lista
- Then a API responde 400.

**CA58 - Resultado vazio**
- Given filtros sem correspondência no mês
- When o usuário lista
- Then recebe lista vazia, subtotais `"0.00"` e o web exibe o estado vazio da aba (o resumo do topo continua com os valores do mês).

### Dashboard

**CA59 - Resumo do mês**
- Given em 2026-10 (referência): receitas R$ 5.000,00; despesas PAGO R$ 800,00 e PENDENTE R$ 200,00
- When o usuário seleciona 2026-10
- Then os cards mostram Receitas R$ 5.000,00; Despesas R$ 1.000,00 (pago R$ 800,00, pendente R$ 200,00); Saldo realizado R$ 4.200,00 (positivo) e Saldo previsto R$ 4.000,00 (positivo), iguais ao resumo do topo da tela de lançamentos para o mesmo mês.

**CA60 - Saldo negativo**
- Given em 2026-10: receitas R$ 1.000,00 e despesas PENDENTE R$ 1.500,00
- When o usuário seleciona 2026-10
- Then saldo realizado é R$ 1.000,00 (positivo) e saldo previsto é -R$ 500,00, identificado como negativo por texto/ícone.

**CA61 - Mês padrão**
- Given a data atual 2026-10-31 23:30 em America/Sao_Paulo (2026-11-01 02:30 UTC)
- When o usuário abre o dashboard ou a tela de lançamentos sem mês na URL
- Then o mês selecionado é outubro de 2026.

**CA62 - Série de 12 meses com zeros**
- Given lançamentos apenas em 2026-03 e 2026-10
- When o usuário seleciona 2026-10
- Then o gráfico tem 12 meses (2025-11 a 2026-10), com zeros nos meses sem lançamentos, e cada mês mostra receitas, despesas pago/pendente e as linhas de saldo realizado e previsto.

**CA63 - Série usa o mês de referência**
- Given o cartão C (fecha 25, vence 5) com uma despesa de data 2026-09-10 (fecha 25/09, vence 05/10, referência 2026-10)
- When o usuário seleciona 2026-10
- Then a despesa entra nas barras e no resumo de outubro, não de setembro.

**CA64 - Donut só com despesas**
- Given em 2026-10: despesas Moradia R$ 1.500,00 e Alimentação R$ 500,00; receita Salário R$ 5.000,00
- When o usuário seleciona 2026-10
- Then o donut mostra Moradia 75% e Alimentação 25%, sem Salário, com valores em R$ no tooltip.

**CA65 - Mês sem dados**
- Given um mês sem lançamentos
- When o usuário o seleciona
- Then os cards mostram R$ 0,00 (saldos zerados), o donut mostra estado vazio e as barras mostram a série com zeros.

**CA66 - Erro no dashboard**
- Given a API do dashboard indisponível
- When o usuário abre o dashboard
- Then cada bloco afetado exibe erro com "Tentar novamente".

### UI

**CA67 - Formatação pt-BR**
- Given uma despesa de `"1234.56"` com data 2026-10-05 e um saldo `"-150.00"`
- When exibidos no web
- Then aparecem como `R$ 1.234,56`, `05/10/2026` e `-R$ 150,00`.

**CA68 - Seletor de mês na tela de lançamentos**
- Given a tela de lançamentos aberta em outubro de 2026 na aba Faturas
- When o usuário seleciona novembro de 2026
- Then o resumo do topo e a aba ativa passam a mostrar novembro, a aba continua Faturas, a URL reflete mês e aba, a página volta à 1 e a seleção é limpa; não existe controle de intervalo de/até.

**CA69 - Abas e cabeçalho comum**
- Given a tela de lançamentos com dados no mês
- When o usuário alterna entre Despesas, Faturas e Receitas (mouse ou teclado)
- Then o seletor de mês, o botão "+ Novo lançamento" e o resumo do mês permanecem visíveis e inalterados, e só o conteúdo da aba muda.

**CA70 - Seleção e pagamento em lote na aba Despesas**
- Given 3 despesas PENDENTE selecionadas na aba Despesas (de cartões diferentes e PIX)
- When o usuário clica em "Marcar como pago" e confirma
- Then as 3 aparecem como PAGO, a seleção é limpa e o resumo, o subtotal e as faturas afetadas são atualizados.

**CA71 - Pagas e receitas fora da seleção**
- Given a aba Despesas com despesas PAGO e PENDENTE e a aba Receitas com receitas
- When o usuário usa "selecionar todos os pendentes da página" na aba Despesas e depois abre a aba Receitas
- Then só as despesas PENDENTE são selecionadas; na aba Receitas não há checkbox nem ação "Marcar como pago".

**CA72 - Aba Faturas e pagar fatura na UI**
- Given em 2026-11 a fatura do cartão C com fechamento 25/10/2026, vencimento 05/11/2026 e 2 despesas PENDENTE somando R$ 150,00
- When o usuário abre a aba Faturas, expande o bloco de C, aciona "Pagar fatura" e confirma
- Then o bloco mostra nome, fechamento, vencimento, total, pago e pendente; a lista expandida mostra as despesas da fatura; a confirmação mostra "C", "novembro de 2026", vencimento 05/11/2026, 2 lançamentos e R$ 150,00; após confirmar, o pendente do bloco fica R$ 0,00, o botão fica desabilitado, e resumo e aba Despesas são atualizados com o valor efetivamente pago.

**CA73 - Formulário: tipo, forma e "Ainda não paguei"**
- Given o drawer "Novo lançamento" aberto
- When o usuário alterna tipo e forma de pagamento
- Then com Despesa + PIX aparece "Ainda não paguei" desmarcado; com Despesa + Cartão o campo cartão é exigido e "Ainda não paguei" fica indisponível com explicação; com Receita a forma fica fixa em PIX e cartão e "Ainda não paguei" ficam indisponíveis; ao voltar para Despesa, forma e cartão podem ser escolhidos novamente.

**CA74 - Formulário de criação**
- Given o drawer de criação aberto
- When o usuário submete com campos inválidos
- Then os erros aparecem inline e o drawer permanece aberto; com dados válidos, fecha, exibe sucesso (com fatura e vencimento quando for compra no cartão) e o lançamento aparece na aba correspondente se pertencer ao mês selecionado.

**CA75 - Atalho "+ Novo cartão" no drawer**
- Given o drawer de lançamento com descrição, valor e data preenchidos e forma Cartão
- When o usuário aciona "+ Novo cartão", informa "Inter" (fecha 3, vence 10) e confirma
- Then o cartão é criado, fica selecionado no campo cartão, os dados digitados permanecem e o cartão passa a aparecer em `/cards` e no filtro; com nome duplicado, o erro 409 aparece inline no atalho; cancelar o atalho devolve ao formulário sem perder dados e com foco no campo cartão.

**CA76 - Responsividade**
- Given viewport < 768px
- When o usuário abre a tela de lançamentos
- Then abas, seletor de mês e resumo continuam utilizáveis, as despesas aparecem como cards com checkbox e ação de pagar com alvos >= 44px, e os blocos de fatura são expansíveis.

**CA77 - Tela de cartões**
- Given nenhum cartão cadastrado
- When o usuário abre a tela de cartões e cadastra "Nubank" (fecha 25, vence 5)
- Then o estado vazio dá lugar à lista com "Nubank · Fecha dia 25 · Vence dia 5", o cartão fica disponível no formulário e no filtro, e o atalho do cartão abre a aba Despesas do mês atual filtrada por ele.

### Tema claro e escuro

**CA78 - Alternar tema**
- Given o tema escuro ativo
- When o usuário aciona o botão sol/lua na navbar (clique, Enter ou Espaço)
- Then toda a interface passa ao tema claro sem recarregar, o ícone muda, `aria-pressed` passa a `false`, o `aria-label` permanece estável e o foco continua no botão.

**CA79 - Padrão segue o sistema**
- Given nenhuma preferência salva e o sistema em modo claro (ou escuro)
- When o usuário abre a aplicação
- Then o tema exibido é o claro (ou escuro); se o sistema mudar com a página aberta, o tema acompanha.

**CA80 - Preferência persistida**
- Given o sistema em modo escuro e o usuário escolheu o tema claro
- When recarrega a página, abre outra rota ou volta dias depois no mesmo navegador
- Then o tema claro é aplicado, e mudanças no tema do sistema não o sobrepõem.

**CA81 - Sem flash de tema errado**
- Given preferência salva diferente do tema do sistema
- When o usuário carrega qualquer rota (inclusive com rede lenta, estado de loading e página de erro)
- Then o primeiro quadro pintado já está no tema da preferência; não há troca visível de cores após a hidratação nem aviso de hydration mismatch.

**CA82 - Contraste AA em ambos os temas**
- Given cada tela e estado: tela de lançamentos (cabeçalho com resumo; abas Despesas, Faturas com bloco expandido e recolhido, Receitas; com dados, vazia, erro, atualizando, com seleção, banner de 404/422), drawer de lançamento (com erros e com o atalho de novo cartão aberto) e de cartão, modal de confirmação, folha de filtros mobile, toasts, tela de cartões, dashboard (com dados, vazio, erro, tooltip aberto, tabela alternativa)
- When verificados nos temas claro e escuro
- Then todo texto normal tem contraste >= 4,5:1 com o fundo efetivo; texto grande, ícones, bordas de inputs, anel de foco, indicador de aba ativa, séries e marcadores dos gráficos têm >= 3:1; a verificação automatizada não aponta violação de contraste.

**CA83 - Botões legíveis em todos os estados**
- Given botões primário, secundário, terciário, perigo, ícone (inclusive o alternador), abas e paginação
- When exibidos em padrão, hover, foco, pressionado, carregando e desabilitado, em ambos os temas
- Then texto e ícone nunca têm a mesma cor do fundo do botão nem do fundo ao redor e mantêm >= 4,5:1 (texto) / >= 3:1 (ícone, borda e estado desabilitado).

**CA84 - Alternâncias repetidas não degradam cores**
- *Leitura aprovada (B1 do fechamento): o alternador fica inerte sob o scrim; com diálogo aberto a troca só ocorre pela mudança do tema do sistema sem preferência salva.*
- Given qualquer tela com drawer, atalho de novo cartão ou modal aberto
- When o usuário alterna o tema várias vezes seguidas
- Then nenhum elemento fica com cor herdada do tema anterior, e dados digitados, seleção, aba e filtros são preservados.

**CA85 - Tema escuro sem tons lavados**
- Given o tema escuro
- When qualquer tela é exibida
- Then superfícies, inputs, tooltips, toasts, menus, skeletons, abas, blocos de fatura e botões não primários usam apenas tokens do tema escuro; textos sem transparência que reduza o contraste abaixo de AA; o estado "atualizando" não deixa o conteúdo abaixo de AA.

**CA86 - Gráficos e controles nativos acompanham o tema**
- Given o dashboard e o formulário abertos
- When o usuário alterna o tema
- Then eixos, grade, legenda, tooltip, cursor e séries dos gráficos mudam para as cores do tema com contraste AA, e seletores nativos (data, mês), selects e barras de rolagem seguem o tema ativo.

**CA87 - Movimento reduzido**
- Given `prefers-reduced-motion: reduce`
- When o usuário alterna o tema ou expande um bloco de fatura
- Then a mudança é instantânea, sem animação.

## 7. Fora de escopo

- Autenticação e multiusuário (lançamentos e cartões globais).
- Recorrência e parcelamento de lançamentos.
- Edição e exclusão de lançamentos (B3); exclusão de cartão.
- Estorno de pagamento (PAGO -> PENDENTE); receita "a receber"/pendente e fluxo de recebimento (B7).
- Formas de pagamento além de PIX e cartão de crédito (dinheiro, débito, boleto, conta); receita no cartão.
- Filtro por intervalo de datas ou de meses (de/até) e visão "todos os meses" na listagem (B6).
- Limite de crédito, status de fatura fechada/aberta, juros, pagamento parcial de fatura, fatura sem despesas.
- Data de pagamento informada pelo usuário (inclusive para PIX pago na criação).
- Múltiplas contas bancárias, transferências, saldo acumulado entre meses (o saldo é por mês).
- Anexos, importação de extrato, exportação (CSV/PDF), múltiplas moedas.
- Cadastro de categorias como entidade (CRUD), categorias separadas por tipo.
- "Selecionar todos os resultados" através de páginas; ordenação por coluna; filtro de múltiplas categorias/cartões; seleção/pagamento parcial dentro do bloco da aba Faturas (DR7).
- Terceira opção "seguir o sistema" no alternador de tema após uma escolha explícita (P27); temas além de claro/escuro; alto contraste.

## 8. Riscos

- **R1 - Float acidental:** máscaras/formatação no web ou parsing JSON podem converter valores para `number`; saldos negativos aumentam o risco. Mitigação: CA49, CA52, CA67.
- **R2 - Fuso horário:** tratar data, datas da fatura ou mês de referência como timestamp desloca lançamentos de fim/início de mês (CA23, CA61).
- **R3 - Concorrência:** lote x lote e lote x pagar fatura podem sobrescrever `paidAt` sem controle adequado (CA37).
- **R4 - Regra do mês de referência (agora em duas etapas):** fechamento e vencimento com ajuste de último dia, "estritamente após", vencimento igual/menor/maior que fechamento, fevereiro, bissexto e viradas de ano são fonte clássica de off-by-one; casos como o 18 e o 20 da tabela (vencimento ajustado coincidindo com o fechamento) são contraintuitivos. Mitigação: tabela CA21 como testes unitários de domínio, idealmente complementada por teste baseado em propriedades (compra <= fechamento < vencimento; vencimento no mesmo mês do fechamento ou no seguinte).
- **R5 - Duplicação da regra no web:** se o formulário pré-calcular fatura/vencimento, a regra pode divergir da API (P24).
- **R6 - Fatura muda entre a confirmação e a execução:** "Pagar fatura" paga as pendências do instante da execução (P21).
- **R7 - Saldo negativo e tipo Money:** o ADR atual define `Money` como não negativo; saldos exigem representação com sinal sem float.
- **R8 - Receita futura no saldo realizado (aceito, B7):** salário lançado antecipadamente infla o saldo realizado do mês; comportamento aceito pelo usuário até existir o fluxo "a receber".
- **R9 - PIX pago por padrão:** o usuário pode esquecer de marcar "Ainda não paguei" e o saldo realizado fica menor que o real; `paidAt` registra o instante da criação, não a data real do pagamento; PIX com data futura nasce paga (B8). Não há estorno para corrigir.
- **R10 - Datas da fatura divergentes após edição do cartão:** despesas da mesma fatura (cartão + mês) criadas antes e depois de uma edição podem ter fechamento/vencimento diferentes; a exibição precisa de regra (B9). Também é possível que, após edição, despesas que o usuário considera da "mesma fatura" caiam em meses de referência diferentes.
- **R11 - Mudança de regra sobre ADR e design:** ADR 0001 e design (rev. 2) usam mês pelo fechamento, meio CONTA, status inicial PENDENTE para toda despesa, filtros de tipo/intervalo e totais por filtro; precisam ser revistos antes do tester (red).
- **R12 - Tema: flash e hydration:** aplicar o tema só após a hidratação causa flash e hydration mismatch (CA81).
- **R13 - Tema: padrões de terceiros:** Recharts, controles nativos (date/month picker, select) e scrollbars ignoram tokens (CA85, CA86).
- **R14 - Tema: contraste dos tokens atuais:** `--text-muted` sobre `--surface-2`, cores de status como texto sobre fundo claro e opacidade no estado "atualizando" podem falhar AA.
- **R15 - Desempenho** das agregações por mês de referência, cartão e status (resumo + subtotal + faturas por carga de tela) sem índices adequados.
- **R16 - Totais desatualizados na UI:** uma mutação afeta resumo, subtotal da aba, faturas e dashboard; invalidação parcial deixa números inconsistentes entre o topo e as abas (CA51, CA70, CA72).
- **R17 - Lista expansível da fatura sem paginação:** uma fatura muito grande pode pesar na tela (DR7); risco baixo com uso individual.
- **R18 - Greenfield:** primeira feature define padrões transversais; esforço de fundação alto.

## 9. Perguntas em aberto

### Bloqueantes (mudam regra de negócio)

Nenhuma em aberto. B8 e B9 foram aprovadas com a resposta padrão (ver decididos abaixo).

### Decididas

**B8 - Despesa PIX com data futura nasce PAGA?** *Decidido (resposta padrão aprovada):* sim, sem exceção (simétrico a B7). Um PIX agendado para 30/11 lançado hoje entra como pago (com `paidAt` de hoje) e reduz o saldo realizado de novembro antes de sair da conta. A data só define o mês de referência; a UI não marca "Ainda não paguei" automaticamente para datas futuras, e o usuário marca manualmente se quiser. Risco residual: R9.

**B9 - Quais datas de fechamento e vencimento a fatura exibe quando suas despesas têm datas diferentes?** *Decidido (resposta padrão aprovada):* a fatura exibe a **maior** data de vencimento e a **maior** data de fechamento entre suas despesas (refletem a configuração mais recente), sem aviso adicional; a lista expansível não mostra datas por despesa. Risco residual: R10.

### Técnicas (decisão do architect)

- **T1 - Tipo das colunas de data:** data do lançamento `DATE`; datas de fechamento e vencimento `DATE` (nulas para PIX); mês de referência como `DATE` (primeiro dia do mês), `CHAR(7)` ou ano/mês. *Sugestão:* `DATE` com o primeiro dia do mês, trafegado como `YYYY-MM`.
- **T2 - Códigos de erro:** *Sugestão:* 404 `ENTRIES_NOT_FOUND` (`details.missingIds`), 404 `CARD_NOT_FOUND`, 422 `ENTRY_NOT_PAYABLE` / `ENTRIES_NOT_PAYABLE` (`details.incomeIds`), 409 `CARD_NAME_TAKEN`.
- **T3 - Limite de ids por lote:** *Sugestão:* 100. Pagar fatura sem esse limite (seleção no servidor).
- **T4 - Paginação:** *Sugestão:* offset (`page`, `pageSize`), padrão 20, máximo 100.
- **T5 - Desempate da ordenação:** *Sugestão:* `data DESC, createdAt DESC, id DESC`.
- **T6 - Concorrência no lote e na fatura:** *Sugestão:* lock pessimista do ADR; pagar fatura seleciona com `FOR UPDATE` as pendentes do cartão/mês ordenadas por id.
- **T7 - Meses zerados:** *Sugestão:* `generate_series` no banco.
- **T8 - Contrato dos endpoints:** listagem de despesas e de receitas (endpoints separados ou tipo obrigatório), resumo do mês (reaproveitar o do dashboard), faturas do mês e despesas da fatura (endpoint próprio ou listagem de despesas filtrada por cartão sem paginação), nome do campo "pago" na criação, nomes de forma de pagamento (`PIX`/`CARD`).
- **T9 - Representação de valor com sinal** para saldos (VO separado ou `Money` com sinal), sem float.
- **T10 - Modelagem do status e CHECKs:** *Sugestão:* enum único `PENDENTE|PAGO|RECEBIDA` com CHECKs (receita => RECEBIDA, PIX e sem cartão; CARTAO => despesa, com cartão e datas de fatura; PIX => sem cartão e sem datas de fatura; PAGO <=> `paidAt`).
- **T11 - Unicidade do nome do cartão** case-insensitive no banco.
- **T12 - Índices:** *Sugestão:* `(mes_referencia, tipo, data)`, `(mes_referencia, tipo, status)`, `(categoria_key, mes_referencia)`, `(cartao_id, mes_referencia, status)`.
- **T13 - UUID v7 e Clock:** como no ADR; `paidAt` do PIX pago na criação vem do mesmo Clock que `createdAt`.
- **T14 - Estratégia de dados no web:** Server Components vs client fetching; invalidação conjunta de resumo, subtotais, faturas e dashboard após mutações (R16).
- **T15 - Persistência do tema sem flash:** *Sugestão:* cookie + atributo no `<html>` renderizado no servidor.
- **T16 - Verificação de contraste:** ferramenta (axe via Playwright/Testing Library) e onde roda (CI).
- **T17 - Domínio das datas da fatura:** VO/serviço de domínio que calcula (fechamento, vencimento, mês de referência) a partir de (data da compra, dia de fechamento, dia de vencimento), puro e testável pela tabela CA21.

## 10. Premissas adotadas

- **P01** Valor aceito como string com até 2 casas; menos casas são completadas; mais de 2 casas é rejeitado, nunca arredondado.
- **P02** Valor máximo de lançamento: `9999999999.99`. Totais e saldos podem exceder esse limite em módulo.
- **P03** Datas passadas e futuras são permitidas, sem limite.
- **P04** Categoria: 1 a 50 caracteres após trim e colapso de espaços internos; acentos diferenciam categorias.
- **P05** Campos não aceitos na criação (`status`, `mesReferencia`, datas da fatura, chaves desconhecidas) são rejeitados com 400.
- **P06** Pagar individualmente uma despesa já PAGO retorna sucesso sem alteração.
- **P07** Em lote com ids inexistentes e já pagos, prevalece o 404; com inexistentes e receitas, o 404; com receitas e já pagos, o 422.
- **P08** `paidAt` é registrado automaticamente (instante do servidor, UTC), inclusive para PIX pago na criação; receitas e despesas PENDENTE não têm `paidAt`.
- **P09** Subtotais das abas não dependem da paginação; o resumo do topo não depende de aba, filtros nem paginação (DR6).
- **P10** O donut considera despesas pagas e pendentes do mês.
- **P11** Na UI, a seleção vale só para a página atual da aba Despesas; mudar página, filtros, mês ou aba limpa a seleção.
- **P12** Na aba Despesas, despesas PAGO aparecem com checkbox indisponível.
- **P13** Pagamento individual, em lote e de fatura pedem confirmação (sem estorno). Criar despesa PIX já paga não pede confirmação.
- **P14** Mês de referência é obrigatório nas listagens, no resumo e nas faturas da API (ausente -> 400); o web sempre envia o mês selecionado (padrão: mês atual em America/Sao_Paulo). Não existe "ver tudo".
- **P15** Filtros de categoria e de cartão são de seleção única.
- **P16** Mês corrente é calculado em America/Sao_Paulo.
- **P17** Rótulos de mês nos gráficos em pt-BR abreviado ("out/26").
- **P18** Nome do cartão é único ignorando maiúsculas/minúsculas e espaços nas pontas; duplicado -> 409.
- **P19** Filtro por cartão inexistente (id bem formado) retorna lista vazia com subtotais zerados; id mal formado -> 400.
- **P20** (substitui a P20 da rev. 2) Dia de vencimento participa do cálculo do mês de referência (RF05) e é exibido na tela de cartões, na fatura e na confirmação de pagar fatura.
- **P21** Pagar fatura paga as pendências existentes no instante da execução e a resposta informa quantidade e soma efetivamente pagas; a UI exibe o valor da resposta no feedback.
- **P22** Despesas no cartão também podem ser pagas individualmente ou em lote (aba Despesas), sem pagar a fatura inteira. Não há restrição de pagar fatura de mês corrente ou futuro.
- **P23** Catálogo de categorias é único para receitas e despesas; o autocomplete sugere todas.
- **P24** O formulário não pré-calcula fatura, vencimento nem mês de referência; essas informações aparecem no feedback a partir da resposta da API.
- **P25** Saldo zero é exibido como "zerado"; saldo negativo como `-R$ 150,00` com indicação textual/ícone.
- **P26** No formulário web, o tipo vem pré-selecionado como Despesa, a forma como PIX e "Ainda não paguei" desmarcado; na API tipo e forma são obrigatórios, sem padrão.
- **P27** O alternador de tema tem dois estados (claro/escuro); voltar a "seguir o sistema" só limpando os dados do navegador.
- **P28** Os valores de cor do tema claro são definidos pelo ui-designer em tokens próprios.
- **P29** Ícone do alternador: sol quando o tema escuro está ativo, lua quando o claro está ativo; `aria-label` fixo "Tema escuro" com `aria-pressed`.
- **P30** Ordenação das abas Despesas e Receitas por data do lançamento (não por mês de referência).
- **P31** Indicador de pagamento na criação: `true` com CARTAO -> 400; `false` ou omitido com CARTAO aceito; qualquer valor em RECEITA -> 400.
- **P32** Datas de fechamento e vencimento da fatura são calculadas e gravadas junto com o mês de referência na criação (não recalculadas a partir do cartão atual), para que a fatura exiba as datas com que suas despesas foram classificadas.
- **P33** Ordem das faturas na aba: data de vencimento crescente; empate pelo nome do cartão.
- **P34** Cada aba guarda seus próprios filtros na URL; trocar de aba mantém o mês e volta à página 1 da aba destino.
- **P35** O atalho "+ Novo cartão" abre um formulário sobreposto ou embutido no drawer (forma a cargo do ui-designer), sem fechar o drawer do lançamento.
- **P36** A tela de lançamentos substitui a antiga "Listagem" na navegação (rótulo "Lançamentos").

## 11. Impacto em artefatos existentes

- **ADR 0001** (architect): revisar regra do mês de referência (vencimento, duas etapas, T17) e persistência das datas da fatura; forma de pagamento `PIX|CARTAO` (remove CONTA); status inicial por forma e campo "pago" na criação; contratos novos (resumo do mês, listagens de despesas e receitas com subtotais, faturas do mês e despesas da fatura); remoção de filtro por tipo e intervalo; mês obrigatório; CHECKs e índices (T10, T12).
- **Design** (ui-designer): reestruturar `/entries` em cabeçalho comum (seletor de mês, "+ Novo lançamento", resumo do mês) + abas Despesas/Faturas/Receitas; bloco de fatura (datas, totais, "Pagar fatura", lista expansível, estado vazio da aba); remover filtro de tipo/intervalo e "Pagar fatura" da lista; formulário com PIX/Cartão, "Ainda não paguei" e atalho "+ Novo cartão"; feedback com fatura e vencimento; atalho de `/cards` para a aba Despesas; contraste das abas e blocos nos dois temas. D1-D4 e D5 mantidos.

## 12. Tarefas (ordenadas)

### Fundação
1. [db] Configurar Prisma 7 com adapter-pg, `schema.prisma` e pipeline de migrations apontando para o Postgres do `.env`.
2. [api] Fundação transversal: filtro global de erros `{ code, message, details }` com mapeamento 400/404/409/422, validação de entrada com detalhes por campo, port de UUID v7, port de relógio.
3. [api] Infra de testes: testcontainers para Postgres e configuração e2e com supertest.
4. [web] Fundação de tema: tokens dos temas claro e escuro (incluindo abas e blocos de fatura), aplicação do tema antes da primeira pintura, `color-scheme` para controles nativos.
5. [web] Fundação de layout: navegação Lançamentos/Cartões/Dashboard, alternador sol/lua acessível com persistência e padrão do sistema (CA78-CA81, CA87), cliente HTTP com tratamento de erros, formatadores pt-BR (moeda com sinal sem float, data civil, mês), componente de seletor de mês com padrão em America/Sao_Paulo.
6. [web] Testes automatizados de contraste/acessibilidade rodando nos dois temas (base para CA82-CA86).

### Domínio
7. [api] VO de valor monetário (lançamento positivo) e representação de saldo com sinal, sem float, com testes unitários.
8. [api] Agregado Cartão (nome, dias 1..31, edição) com testes unitários.
9. [api] Regra de domínio das datas da fatura e do mês de referência (fechamento efetivo, vencimento estritamente após, ajuste de último dia, bissexto, viradas de ano, PIX x cartão) com a tabela CA21 como testes unitários.
10. [api] Agregado Lançamento: tipo, forma PIX/CARTAO, consistência receita/cartão, status inicial (PIX pago por padrão ou pendente; cartão pendente; receita recebida) com `paidAt` na criação, transição para PAGO idempotente só para despesa, rejeição de pagamento de receita, sem estorno; testes unitários.
11. [api] Interfaces de repositórios e read models (cartões, lançamentos, resumo do mês, listagens com subtotais, faturas do mês, despesas da fatura, dashboard).

### Persistência
12. [db] Model e migration de cartões (nome único case-insensitive, dias com CHECK 1..31, timestamps UTC).
13. [db] Model e migration de lançamentos: tipo, forma PIX/CARTAO, FK para cartão, data, datas de fechamento/vencimento da fatura, mês de referência, status (incluindo RECEBIDA), `paidAt`, CHECKs de consistência (T10), índices (T12).
14. [api] Repositórios Prisma + mappers de cartão e lançamento, com testes de integração (incluindo CA23 com `TZ=America/Sao_Paulo`).

### Casos de uso e HTTP
15. [api] Use cases + endpoints de cartões: criar, listar, editar (CA01-CA06).
16. [api] Use case + endpoint: criar lançamento com status inicial por forma, indicador "pago", cálculo das datas da fatura e do mês de referência, resolução de categoria (CA07-CA23).
17. [api] Use case + endpoint: marcar despesa como paga, com 404 e 422 (CA24-CA28).
18. [api] Use case + endpoint: pagamento em lote atômico e idempotente, com 404/422 e precedência (CA29-CA37), incluindo testes de integração de atomicidade e concorrência.
19. [api] Use case + endpoint: pagar fatura reaproveitando o pagamento em lote (CA38-CA42), incluindo concorrência com lote.
20. [db] Query agregada do resumo do mês (receitas, despesas total/pago/pendente, saldos) por mês de referência, sem filtros.
21. [db] Queries agregadas das listagens de despesas (status, categoria, cartão/PIX) e de receitas (categoria) por mês de referência, com ordenação, paginação e subtotal sobre o conjunto filtrado.
22. [db] Query agregada das faturas do mês (por cartão com despesas no mês: datas conforme B9, quantidade, total, pago, pendente, ordem por vencimento) e das despesas de uma fatura.
23. [api] Use cases + endpoints: resumo do mês, listar despesas, listar receitas, listar faturas do mês e despesas da fatura (CA43-CA58).
24. [api] Use case + endpoint: listar categorias distintas (RF14).
25. [db] Queries agregadas do dashboard por mês de referência: série de 12 meses com zeros e distribuição de despesas por categoria (CA62-CA65).
26. [api] Use cases + endpoints do dashboard, reaproveitando o resumo do mês (RF15-RF18, CA59-CA66).

### Web
27. [web] Tela de cartões: lista, drawer de criar/editar com aviso de não retroatividade, atalho para a aba Despesas filtrada, estados (CA77).
28. [web] Tela de lançamentos: cabeçalho comum com seletor de mês, "+ Novo lançamento" e resumo do mês independente de aba/filtros; estrutura de abas com estado na URL (CA61, CA68, CA69).
29. [web] Aba Despesas: tabela/cards com forma, fatura, badges, filtros status/categoria/cartão (com PIX), subtotal, paginação, estados loading/vazio/erro (CA53-CA58).
30. [web] Aba Despesas: seleção múltipla só de pendentes, pagamento individual e em lote com confirmação, tratamento de 404/422, invalidação de resumo/subtotal/faturas (CA70, CA71).
31. [web] Aba Faturas: blocos por cartão com datas e totais, lista expansível, "Pagar fatura" com confirmação e feedback do valor pago, estado vazio (CA43-CA45, CA72).
32. [web] Aba Receitas: lista sem seleção, filtro de categoria, subtotal, paginação, estados (CA71).
33. [web] Drawer "Novo lançamento": tipo, forma PIX/Cartão, "Ainda não paguei", cartão, autocomplete de categoria, máscara monetária, feedback com fatura e vencimento (CA73, CA74).
34. [web] Atalho "+ Novo cartão" dentro do drawer, com seleção automática, preservação dos dados e erro 409 inline (CA75).
35. [web] Instalar Recharts; dashboard: seletor de mês, cards (resumo do mês), barras conforme DR3 com eixo negativo, donut de despesas, estados por bloco, alternativas acessíveis, cores por tema (CA59-CA66, CA86).
36. [web] Revisão final de responsividade, acessibilidade e contraste nas três telas, todas as abas, em ambos os temas e todos os estados (CA67, CA76, CA82-CA85).
