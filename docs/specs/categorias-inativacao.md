# Spec: Categorias como entidade, inativação de cartão e cancelamento de lançamento

**Impacto em UI: sim.** Há uma tela nova de categorias (com aba de receita e aba de despesa), o campo Categoria do formulário de lançamento muda para "selecionar ou criar", aparecem as ações "Inativar" e "Reativar" em cartões e categorias e as ações "Cancelar" e "Reativar" em lançamentos (despesas pendentes, despesas PIX pagas e receitas), e as listagens ganham o filtro "Mostrar cancelados/inativos" com uma marcação visual própria. O ui-designer entra no fluxo.

- Data: 2026-10-29
- Branch: a definir (depois de `feat/auth-authorized`)
- Depende de: `docs/specs/autenticacao-autorizacao.md` (Feature A) e `docs/adr/0005-autenticacao-autorizacao-demo.md`. Esta spec parte do pressuposto de que a Feature A já está pronta, ou seja: usuários com níveis `ADMIN` e `USER`, `ownerId` obrigatório em todo repositório e read model do `finance`, isolamento por dono (recurso de outro dono = 404), demo pública só para visualização com o usuário demo e o `DemoDatasetStore`.
- Referências: `docs/specs/lancamentos-financeiros.md` (rev. 3: B1, B3, DR2, DR4, DR7), `docs/api/finance.md`, `docs/design/design-system.md`, `docs/adr/0006-categorias-inativacao-cancelamento.md`.

### Histórico de revisões

- **rev. 1 (2026-10-29):** versão inicial (cancelamento só de `PENDING`).
- **rev. 2 (2026-10-29):** B1 decidida pelo usuário: **cancelar vale também para lançamentos `PAID` e `RECEIVED`**, exceto despesa de cartão já paga (fatura paga). O registro vira `CANCELED` e sai dos totais. Reativação (RF15, T1) decidida: o lançamento volta ao **status que tinha antes do cancelamento**, sempre permitida para receita e despesa PIX, e para despesa de cartão só se a fatura não tiver nenhuma despesa `PAID`. Ajustados: linguagem ubíqua, RF14, RF15, RF16, RF17, RF19, RF20, RNF02, CA17-CA22, CA25, CA27 (novo), fora de escopo, R1, R6, P01, P08, P09, P12, P13 e tarefas.

## 1. Contexto

Situação do código atual, já considerando a Feature A:

- **Categoria não é entidade.** `entries` grava o texto em `category` e a chave de comparação em `category_key` (VO `Category`, que aplica `normalizeLabel` e `labelKey`: sem diferenciar maiúsculas de minúsculas, com acentos diferenciando). A grafia canônica é a do primeiro uso, resolvida por `PrismaCategoryCatalog.findByKey`, que na Feature A passa a ser por dono. `GET /api/categories` devolve uma lista única de strings que mistura receitas e despesas. O filtro de categoria nas listagens compara o texto sem diferenciar maiúsculas de minúsculas, e a distribuição por categoria do dashboard agrupa por `category_key`.
- **Cartão.** Dá para criar, listar e editar (PUT), mas não existe exclusão (DR2). O nome é único por dono, também na Feature A. O formulário de lançamento lista todos os cartões e tem o atalho "+ Novo cartão" (B13).
- **Lançamento.** Os status são `PENDING`, `PAID` e `RECEIVED`; o aggregate `Entry` admite criar, `markAsPaid` e edição administrativa de despesas (incluída depois desta spec). Receita nasce sempre `RECEIVED` e despesa é `PENDING` ou `PAID`. `PAID` continua terminal, sem estorno. Não há exclusão.
- **Fatura** não é persistida: é o conjunto das despesas de um cartão com o mesmo mês de referência. "Pagar fatura" paga as `PENDING` (DR4). Os totais de fatura, resumo, série mensal e distribuição são calculados por SQL nos read models.
- **Web.** O campo Categoria do drawer "Novo lançamento" é um combobox de texto livre com a opção `Usar "<texto>"`. Os filtros de categoria das abas Despesas e Receitas são `<select>` de strings. A tela `/cards` lista e edita cartões.

O pedido (Feature B das decisões do usuário de 2026-10-29) é transformar a categoria numa entidade do dono, separada por tipo, e trocar "excluir" por "inativar" (cartão e categoria) e "cancelar" (lançamento). Assim, nenhum dado histórico some e as listagens continuam limpas.

**Efeito sobre a Feature A:** a "grafia canônica por usuário" (RF26 e o critério correspondente da Feature A) deixa de existir e passa a valer a categoria-entidade (RF01 a RF04 desta spec). As rotas de demo da Feature A ganham os novos parâmetros de leitura (RF20).

## 2. Linguagem ubíqua

| Termo | Definição |
|---|---|
| **Categoria** | Entidade do dono que agrupa lançamentos de **um** tipo. Tem id (UUID v7), nome, tipo (`INCOME` ou `EXPENSE`) e situação (ativa ou inativa). O lançamento referencia a categoria pelo id, e não pelo texto. |
| **Tipo da categoria** | `INCOME` (categoria de receita) ou `EXPENSE` (categoria de despesa). É definido na criação e não muda. As duas listas são independentes: "Outros" de receita e "Outros" de despesa são categorias diferentes. |
| **Chave do nome** | Forma de comparação do nome, igual à de hoje (`labelKey`): normalizado, sem diferenciar maiúsculas de minúsculas, com acentos diferenciando. A unicidade é por (dono, tipo, chave). |
| **Renomear categoria** | Trocar o nome de exibição. Como o lançamento referencia por id, o novo nome aparece em todos os lançamentos, filtros e gráficos, inclusive nos antigos. |
| **Categoria ativa / inativa** | Só a ativa aparece para seleção em novos lançamentos. A inativa continua ligada aos lançamentos que já a usam e aparece no histórico, nos filtros e nos gráficos. |
| **Inativar / reativar** | Alternar a situação de uma categoria ou de um cartão. Não apaga nada e pode ser desfeito. Não existe exclusão. |
| **Criar na hora** | Criar uma categoria nova do tipo do lançamento direto no formulário de lançamento, sem sair dele. |
| **Cartão ativo / inativo** | O cartão inativo não aparece para seleção em novos lançamentos. O histórico e as faturas dele continuam existindo, e uma fatura com pendências continua pagável. |
| **Cancelar lançamento** | Transição de `PENDING`, `PAID` ou `RECEIVED` para `CANCELED`. **Exceção:** despesa de cartão `PAID` (a fatura dela já foi paga, total ou parcialmente) não pode ser cancelada. O registro é mantido, com todos os dados (inclusive `paidAt`), e o lançamento sai de todos os totais, faturas, subtotais e do dashboard. Cancelar não é estorno: não cria movimento contrário, só tira o lançamento das contas. |
| **Despesa de cartão paga** | Despesa `CARD` com status `PAID`. Ela só fica assim quando a fatura dela é paga (por "Pagar fatura", pagamento individual ou em lote). É a única que não pode ser cancelada. |
| **CANCELED (Cancelado)** | Status de um lançamento cancelado. Ele não pode ser pago e só sai desse estado por reativação, quando ela é permitida (RF15). |
| **Status anterior ao cancelamento** | Status que o lançamento tinha no momento do cancelamento (`PENDING`, `PAID` ou `RECEIVED`). Fica guardado no lançamento cancelado e é o status para o qual a reativação volta. |
| **Data de cancelamento (canceledAt)** | Instante (UTC) em que o lançamento foi cancelado. Serve de auditoria. |
| **Reativar lançamento** | Transição `CANCELED` → status anterior ao cancelamento, nos casos de baixo impacto do RF15. É o "desfazer" do cancelamento: um lançamento pago volta pago, com o mesmo `paidAt`. |
| **Lançamento efetivo** | Lançamento com status diferente de `CANCELED`. É o único que entra em qualquer total. |
| **Filtro "Mostrar cancelados" / "Mostrar inativos"** | Controle de uma listagem que inclui itens cancelados ou inativos, que ficam ocultos por padrão. |
| **Marcação de inativo/cancelado** | Tratamento visual que distingue o item cancelado ou inativo de um ativo: selo textual ("Cancelado", "Inativo", "Inativa") somado a um estilo atenuado. Não depende só de cor. |
| **Migração de categorias** | Conversão única do texto livre de `entries` em linhas de categoria por (dono, tipo, chave), com o lançamento passando a apontar para a categoria por FK. |

## 3. Requisitos funcionais

### Categorias

- **RF01 - Criar categoria.** Campos: nome e tipo. As regras do nome são as de hoje: normalizado (NFC, trim e espaços colapsados), com 1 a 50 caracteres. A categoria nasce ativa e pertence ao usuário autenticado. O nome é único por (dono, tipo, chave), considerando ativas **e** inativas. Um nome repetido gera 409, e se a categoria existente estiver inativa a resposta informa isso para que a UI ofereça reativar (P04).
- **RF02 - Renomear categoria.** Muda só o nome, com as mesmas regras e a mesma unicidade do RF01, excluindo a própria categoria da comparação. Dá para trocar só maiúsculas e minúsculas ("alimentação" → "Alimentação"). O novo nome aparece em todos os lançamentos, filtros, faturas e gráficos, inclusive de meses passados. Renomear sem mudança efetiva não faz nada. O tipo não pode ser alterado. Categoria inativa também pode ser renomeada.
- **RF03 - Inativar e reativar categoria.** As duas operações são idempotentes. A categoria inativa:
  - não aparece para seleção nem para "criar na hora" (RF06);
  - continua nos lançamentos que já a referenciam e é exibida neles normalmente;
  - continua nos agregados (distribuição por categoria) e nas opções de filtro das listagens, com a marcação de inativa (P06).

  Inativar não exige que a categoria esteja sem lançamentos e não muda nenhum lançamento.
- **RF04 - Listar categorias.** Lista as categorias do dono por tipo, ordenadas pela chave do nome. Por padrão só aparecem as ativas, e um filtro inclui as inativas, que aparecem com a marcação. Não existe exclusão de categoria.
- **RF05 - Tela de categorias.** Uma tela protegida de categorias, com navegação na `MainNav`, tem uma aba para receita e outra para despesa. Cada aba tem: listagem (RF04), "+ Nova categoria", "Renomear", "Inativar" e "Reativar", e o filtro "Mostrar inativas". Os erros de nome (vazio, longo, repetido) aparecem inline.

### Categoria no lançamento

- **RF06 - Selecionar ou criar no formulário.** O campo Categoria do drawer "Novo lançamento" oferece só as categorias **ativas** do **tipo** escolhido. Trocar o tipo limpa a categoria selecionada se ela não for do novo tipo. Ao digitar um nome sem correspondência entre as ativas do tipo, o campo oferece criar a categoria na hora. A criação usa as regras do RF01:
  - se o nome digitado corresponder a uma categoria **inativa** do mesmo tipo, o campo não cria uma duplicata e oferece reativar e usar essa categoria (P04);
  - a correspondência com uma ativa (por chave) seleciona a ativa e não cria nada.
- **RF07 - Lançamento referencia categoria por id.** Ao criar um lançamento, a categoria tem de existir, ser do dono, ser do mesmo tipo do lançamento e estar ativa. Categoria de outro dono ou inexistente gera 404. Categoria de tipo diferente ou inativa gera erro de regra de negócio (códigos em P09). A precedência continua 400 > 404 > 422 e 409.
- **RF08 - Exibição.** Toda resposta e tela que hoje mostra a categoria de um lançamento passa a mostrar o nome **atual** da categoria referenciada. O nome de uma categoria inativa aparece sem destaque nas linhas de lançamento (a marcação de inativa só aparece em filtros e na tela de categorias, P06).
- **RF09 - Filtros de categoria.** O filtro de categoria das abas Despesas e Receitas filtra pela categoria-entidade do tipo da aba. As opções incluem as categorias inativas que tenham lançamentos (P06).
- **RF10 - Distribuição por categoria.** O dashboard agrupa as despesas efetivas por categoria-entidade, com o nome atual. As categorias inativas aparecem normalmente se tiverem valor no mês.

### Migração

- **RF11 - Migração do texto livre.** Para cada (dono, tipo, chave de categoria) existente em `entries`, a migração cria **uma** categoria ativa:
  - o nome é a grafia canônica atual (primeiro uso por dono e por tipo, P02);
  - todos os lançamentos daquele (dono, tipo, chave) passam a referenciá-la.

  A mesma chave usada em receitas e em despesas vira duas categorias. Nenhum lançamento fica sem categoria e nenhum total muda com a migração. A migração é segura para reexecução, e o usuário demo segue o RF20.

### Cartão

- **RF12 - Inativar e reativar cartão.** As duas operações são idempotentes. O cartão inativo:
  - não aparece para seleção em novos lançamentos (nem no drawer, nem como resultado do atalho "+ Novo cartão");
  - mantém histórico, faturas e totais;
  - tem a fatura com pendências **continuando pagável** ("Pagar fatura" e pagamento individual ou em lote das despesas dele);
  - continua aparecendo nas opções do filtro de cartão da aba Despesas, com a marcação (P06).

  Criar um lançamento com cartão inativo via API gera erro de regra de negócio (P09). A edição (PUT) continua como hoje e também vale para cartão inativo (P05). Inativar não exige que o cartão esteja sem pendências. Não existe exclusão de cartão.
- **RF13 - Nome de cartão e inativos.** A unicidade do nome por dono continua valendo e considera cartões inativos. Criar ou renomear para o nome de um cartão inativo gera 409, informando que ele está inativo para que a UI ofereça reativar (P04).

### Lançamento

- **RF14 - Cancelar lançamento.** Podem ser cancelados:
  - despesa `PENDING` (PIX ou cartão);
  - despesa PIX `PAID`;
  - receita `RECEIVED`.

  **Não** pode ser cancelada a despesa de cartão `PAID` (a fatura dela já foi paga, total ou parcialmente): a resposta é erro de regra de negócio com o motivo (P09) e nada muda. O cancelamento:
  - muda o status para `CANCELED`, grava `canceledAt` e guarda o status anterior ao cancelamento;
  - mantém todos os demais dados (valor, datas, mês de referência, cartão, categoria e, se havia, `paidAt`);
  - é idempotente: cancelar um lançamento já `CANCELED` responde sucesso sem alterar nada;
  - responde 404 para lançamento inexistente ou de outro dono.

  Na UI, a ação "Cancelar" fica disponível na aba Despesas (despesas `PENDING` e despesas PIX `PAID`) e na aba Receitas (receitas `RECEIVED`), e exige confirmação. A confirmação de um lançamento pago ou recebido explica que o valor sai dos totais e que isso não é um estorno.
- **RF15 - Reativar lançamento cancelado.** A reativação volta o lançamento para o **status anterior ao cancelamento** (`PENDING`, `PAID` ou `RECEIVED`), mantendo o `paidAt` original quando ele era `PAID`, e limpa `canceledAt`. Regras (decididas no ADR 0006, T1):
  - **receita cancelada:** pode ser reativada (volta a `RECEIVED`);
  - **despesa PIX cancelada:** pode ser reativada (volta a `PENDING` ou `PAID`, conforme estava);
  - **despesa no cartão cancelada** (só pode ter sido cancelada a partir de `PENDING`): só pode ser reativada se a fatura dela (cartão + mês de referência) **não tiver nenhuma despesa `PAID`**. Assim não se reabre uma fatura já quitada, total ou parcialmente. Em caso de conflito, a resposta é um erro de regra de negócio com o motivo e nada muda;
  - cartão ou categoria inativos não bloqueiam a reativação (o lançamento já os referenciava);
  - só um lançamento `CANCELED` pode ser reativado. Reativar um lançamento `PENDING`, `PAID` ou `RECEIVED` é erro de regra (P09).

  Na UI, a ação "Reativar" aparece nos lançamentos cancelados exibidos com "Mostrar cancelados", sem confirmação. Se a API recusar (fatura com pagamento), a UI mostra o motivo.
- **RF16 - Lançamento cancelado fora dos totais.** Lançamentos `CANCELED` **não** entram em nenhum destes:
  - resumo do mês (receitas e despesas), subtotais das abas, série mensal e distribuição por categoria;
  - totais, contagens (`entryCount`, `pendingCount`) e datas exibidas (maior fechamento e maior vencimento) da fatura;
  - "Pagar fatura": cancelados nunca são pagos.

  Uma fatura que só tem lançamentos cancelados não aparece na aba Faturas.
- **RF17 - Pagar lançamento cancelado.** Pagar um `CANCELED`, individualmente ou em lote, é erro de regra de negócio. No lote, o lote inteiro é rejeitado e nada muda (mesma atomicidade de hoje), e o erro lista os ids cancelados. A precedência é 400 > 404 > 422.
- **RF18 - Edição de lançamento.** Continua fora desta entrega (ver Fora de escopo).

### Listagens

- **RF19 - Ocultos por padrão, com filtro e marcação.**
  - **Aba Despesas:** os cancelados ficam ocultos por padrão. Com o filtro "Mostrar cancelados", eles entram na lista (respeitando os outros filtros e a paginação) com o selo "Cancelado" e o estilo atenuado, sem checkbox de seleção e sem as ações "Pagar" e "Cancelar"; a ação disponível é "Reativar" (RF15). O subtotal da aba nunca inclui cancelados, mesmo com o filtro ligado.
  - **Aba Faturas:** a lista expansível de cada fatura oculta os cancelados por padrão e os mostra, com a marcação, quando "Mostrar cancelados" está ligado. Os totais do bloco nunca incluem cancelados. A lista continua somente leitura (DR7).
  - **Aba Receitas:** igual à aba Despesas: cancelados ocultos por padrão, "Mostrar cancelados", selo, "Cancelar" nas recebidas e "Reativar" nas canceladas. O subtotal nunca inclui canceladas.
  - **`/cards`:** os inativos ficam ocultos por padrão. O filtro "Mostrar inativos" os exibe com o selo "Inativo", e a ação disponível é "Reativar" no lugar de "Inativar".
  - **Tela de categorias:** RF04 e RF05.
  - O estado dos filtros fica na URL (query params), como os filtros atuais.

### Demo

- **RF20 - Demo com categorias-entidade.** O dataset demo passa a criar categorias-entidade de receita e de despesa (pelo menos 5 de despesa e 2 de receita). Para mostrar os filtros e as marcações, ele inclui também pelo menos 1 categoria inativa com lançamentos, 1 cartão inativo com histórico e lançamentos cancelados (P08). As leituras públicas de demo da Feature A passam a aceitar os mesmos parâmetros novos (mostrar cancelados ou inativos, tipo de categoria) e ganham a leitura de categorias por tipo. A demo continua **só visualização**: "+ Nova categoria", "Renomear", "Inativar", "Reativar" e "Cancelar" **não aparecem** nas telas de demo e não existe rota de escrita em `/api/demo/*`. A tela de categorias também tem versão demo, somente leitura (P07).

## 4. Requisitos não funcionais

- **RNF01 - Isolamento por dono.** Categoria é dado do dono, igual a cartão e lançamento: toda leitura e escrita filtra por `ownerId` na infraestrutura, e a categoria de outro dono é inexistente (404). O banco garante que o lançamento e a categoria dele têm o mesmo dono e que o tipo da categoria é igual ao do lançamento (T3). Há testes de integração com dois usuários.
- **RNF02 - Integridade.** Não existe `DELETE` de categoria, cartão nem lançamento, e as FKs para categoria e cartão são `RESTRICT`. As transições para e de `CANCELED` usam o mesmo cuidado de concorrência do pagamento (lock de linha), e a reativação de despesa de cartão trava as despesas da fatura. Um pagamento e um cancelamento simultâneos do mesmo lançamento são serializados: o resultado é sempre o de uma das duas ordens possíveis (CA22), nunca um estado intermediário. O banco garante a coerência entre status, `paidAt`, `canceledAt` e o status anterior ao cancelamento (CHECKs).
- **RNF03 - Migração sem perda.** Antes e depois da migração (RF11), são iguais por dono e por mês: contagem de lançamentos, resumo, série mensal e distribuição por categoria, com os mesmos nomes de categoria exibidos. Há teste de integração da migração com dados de pelo menos dois donos, mesma chave em receita e em despesa, e grafias diferentes.
- **RNF04 - Desempenho.** O RNF07 da Feature A (p95 < 300 ms por usuário, com 100 mil lançamentos e 20 cartões) continua valendo com o filtro de status efetivo em todas as agregações e o join com categorias. Listar categorias (até 500 por dono): p95 < 100 ms.
- **RNF05 - Formato de erros.** Os erros novos seguem `{ code, message, details }`, com `message` em pt-BR. Os ids são UUID v7 e as datas (`canceledAt`) ficam em UTC.
- **RNF06 - Arquitetura.** A categoria vira um aggregate do `domain` do `finance` (T2). Cancelar e reativar são transições do aggregate `Entry`, e inativar e reativar são transições de `Card` e `Category`, sem dependência de NestJS ou Prisma no domínio.
- **RNF07 - Acessibilidade.** A tela de categorias, o campo "selecionar ou criar", os filtros novos, as marcações e as confirmações atendem WCAG 2.1 AA nos dois temas, sem violações no axe. A marcação de cancelado ou inativo tem texto (selo) e não depende só de cor ou de opacidade. O texto atenuado mantém contraste AA.
- **RNF08 - Testes.** Unitários para os aggregates e use cases novos (transições, idempotência, unicidade, regra de cancelamento e de reativação). Integração (testcontainers) para repositórios, read models com cancelados (inclusive receita cancelada) e dois donos, e para a migração. e2e (supertest) para os códigos novos e a precedência. Playwright + axe para a tela de categorias, o campo do formulário, os filtros e as marcações. Cobertura de pelo menos 80% em domain e application.

## 5. Critérios de aceite

### Categorias

**CA01 - Criar categoria (RF01)**
- Given Ana sem categorias de despesa
- When ela cria "  Alimentação  " do tipo despesa
- Then a categoria é criada ativa com o nome "Alimentação" e tipo `EXPENSE`, e aparece na aba Despesa da tela de categorias.

**CA02 - Mesmo nome em tipos diferentes (RF01)**
- Given Ana com a categoria de despesa "Outros"
- When ela cria "outros" do tipo receita
- Then a categoria é criada, e cada aba da tela de categorias mostra só a sua "Outros".

**CA03 - Nome duplicado, inclusive com inativa (RF01)**
- Given Ana com a categoria de despesa ativa "Lazer" e a inativa "Viagem"
- When ela cria as categorias de despesa "LAZER" e "viagem"
- Then as duas tentativas respondem 409. A segunda informa que a categoria existente está inativa, a UI oferece "Reativar" e nenhuma categoria nova é criada.

**CA04 - Renomear reflete no histórico (RF02, RF08, RF10)**
- Given a categoria de despesa "Mercado", usada em despesas de 2026-08 a 2026-10
- When Ana a renomeia para "Supermercado"
- Then as listagens de todos esses meses, a lista da fatura e a distribuição por categoria mostram "Supermercado", e nenhum lançamento muda de `updatedAt`.

**CA05 - Renomear para nome existente (RF02)**
- Given as categorias de despesa "Casa" e "Moradia"
- When Ana renomeia "Casa" para "moradia"
- Then a resposta é 409 e nada muda. Já renomear "Casa" para "CASA" é aceito e o nome passa a ser "CASA".

**CA06 - Inativar categoria (RF03, RF06)**
- Given a categoria de despesa "Academia", usada em 3 despesas
- When Ana a inativa
- Then "Academia" some das opções do campo Categoria do drawer para despesa, as 3 despesas continuam mostrando "Academia", o filtro de categoria da aba Despesas continua listando "Academia" com a marcação de inativa, e a tela de categorias só a mostra com "Mostrar inativas" ligado, com o selo "Inativa" e a ação "Reativar".

**CA07 - Reativar categoria (RF03)**
- Given a categoria inativa "Academia"
- When Ana a reativa, duas vezes seguidas
- Then ela volta a aparecer para seleção, e a segunda chamada responde sucesso sem alteração.

**CA08 - Categoria de outro dono (RF07, RNF01)**
- Given a categoria C de Bruno
- When Ana cria um lançamento com C, ou tenta renomear, inativar ou reativar C
- Then a resposta é 404 de categoria inexistente, e C não muda.

### Categoria no lançamento

**CA09 - Selecionar por tipo (RF06)**
- Given Ana com as categorias de despesa "Alimentação" e "Moradia" e a categoria de receita "Salário"
- When ela abre "Novo lançamento" com tipo Despesa e depois troca para Receita
- Then em Despesa as opções são só "Alimentação" e "Moradia". Ao trocar para Receita, a categoria escolhida é limpa e a opção passa a ser só "Salário".

**CA10 - Criar na hora (RF06)**
- Given Ana no drawer, com tipo Despesa e sem a categoria "Pets"
- When ela digita "Pets", escolhe criar e salva o lançamento
- Then existe a categoria de despesa ativa "Pets", o lançamento a referencia, e ela aparece na tela de categorias e nos próximos lançamentos.

**CA11 - Digitar nome de inativa ou de ativa (RF06)**
- Given a categoria de despesa inativa "Viagem" e a ativa "Alimentação"
- When Ana digita "viagem" no campo
- Then não aparece a opção de criar "viagem", e sim a opção de reativar e usar "Viagem". Ao digitar "ALIMENTAÇÃO", a opção oferecida é a existente "Alimentação", e nenhuma categoria nova é criada.

**CA12 - Categoria inválida via API (RF07)**
- Given a categoria de receita R e a categoria de despesa inativa I, ambas de Ana
- When Ana cria uma despesa com R, e depois uma com I
- Then as duas respostas são erro de regra de negócio (tipo divergente e categoria inativa, P09) e nenhum lançamento é criado. Um corpo que também tem um valor inválido responde 400 primeiro.

### Migração

**CA13 - Migração do texto livre (RF11, RNF03)**
- Given Ana com despesas em "alimentação" (primeiro uso) e "Alimentação", e uma receita em "Alimentação", e Bruno com uma despesa em "Alimentação"
- When a migração roda
- Then Ana fica com a categoria de despesa "alimentação" (todas as despesas dela apontando para ela) e a categoria de receita "Alimentação", Bruno fica com a sua categoria de despesa "Alimentação", e resumo, série e distribuição de cada um ficam iguais aos de antes.

**CA14 - Migração reexecutável (RF11)**
- Given o banco já migrado
- When a migração (ou o passo de dados dela) roda de novo
- Then nenhuma categoria é duplicada e nenhum lançamento muda.

### Cartão

**CA15 - Inativar cartão com fatura em aberto (RF12)**
- Given o cartão "Nubank" com a fatura 2026-11 de R$ 500,00 pendente
- When Ana inativa o cartão
- Then "Nubank" some do drawer "Novo lançamento" e da lista padrão de `/cards`, a aba Faturas de 2026-11 continua mostrando a fatura com "Pagar fatura", e pagar essa fatura funciona e zera o pendente.
- And criar via API uma despesa com `cardId` do "Nubank" responde com erro de cartão inativo.

**CA16 - Mostrar e reativar cartão (RF12, RF13, RF19)**
- Given o cartão inativo "Nubank"
- When Ana liga "Mostrar inativos" em `/cards` e escolhe "Reativar"
- Then o cartão aparecia com o selo "Inativo" e estilo atenuado, e depois da reativação volta à lista padrão e ao drawer. Antes de reativar, criar o cartão "nubank" respondia 409 informando que o cartão existente está inativo.

### Lançamento

**CA17 - Cancelar despesa pendente (RF14, RF16)**
- Given em 2026-11 a despesa PIX pendente "Conserto" de 200.00 e a despesa no cartão pendente "Fone" de 300.00 (fatura Nubank 2026-11, sem outras despesas), com resumo expenses.total "500.00"
- When Ana cancela as duas, confirmando no diálogo
- Then as duas ficam `CANCELED` com `canceledAt` e status anterior `PENDING`, o resumo de 2026-11 passa a expenses.total "0.00", a fatura Nubank 2026-11 some da aba Faturas, a série mensal e a distribuição de 2026-11 não as consideram, e elas somem da aba Despesas por padrão.

**CA18 - Cancelar lançamento pago ou recebido, e o caso proibido (RF14, RF16)**
- Given em 2026-11 a despesa PIX paga "Farmácia" de 80.00, a receita recebida "Freela" de 1000.00 e a despesa no cartão paga "Livro" de 50.00 (fatura Nubank 2026-11 paga)
- When Ana cancela "Farmácia" e "Freela", confirmando no diálogo, e tenta cancelar "Livro" via API
- Then "Farmácia" e "Freela" ficam `CANCELED` com `canceledAt`, mantêm o `paidAt` (quando havia) e guardam o status anterior (`PAID` e `RECEIVED`); o resumo de 2026-11 perde 80.00 em expenses.paid e 1000.00 em income, e a série e a distribuição acompanham.
- And o cancelamento de "Livro" responde erro de regra de negócio com o motivo "fatura paga" (P09), "Livro" continua `PAID`, e na UI a ação "Cancelar" não aparece para ela.
- And cancelar de novo um lançamento já `CANCELED` responde sucesso sem alterar `canceledAt`.

**CA19 - Reativar volta ao status anterior (RF15)**
- Given a despesa PIX "Conserto" cancelada a partir de `PENDING`, a despesa PIX "Farmácia" cancelada a partir de `PAID` (paga em 2026-11-05T12:00:00Z), a receita "Freela" cancelada e a despesa no cartão "Fone" cancelada, da fatura Nubank 2026-12, que não tem despesas `PAID`
- When Ana reativa cada uma
- Then "Conserto" volta a `PENDING`, "Farmácia" volta a `PAID` com `paidAt` 2026-11-05T12:00:00Z, "Freela" volta a `RECEIVED` e "Fone" volta a `PENDING`; todas perdem `canceledAt` e voltam a entrar no resumo, na série, na distribuição e (no caso de "Fone") na fatura.

**CA20 - Reativação bloqueada por fatura com pagamento (RF15)**
- Given a despesa cancelada "Fone" da fatura Nubank 2026-11, em que outra despesa já está `PAID`
- When Ana tenta reativá-la
- Then a resposta é erro de regra de negócio com o motivo "fatura com pagamento" (P09), "Fone" continua `CANCELED` e a UI mostra o motivo.
- And reativar um lançamento que não está `CANCELED` responde erro de regra de negócio com o motivo "não cancelado".

**CA21 - Pagar cancelado (RF17)**
- Given a despesa pendente A e a despesa cancelada C
- When Ana chama o pagamento em lote com `[A, C]`, e depois o pagamento individual de C
- Then o lote responde 422 com C na lista de cancelados e A **não** é paga. O pagamento individual também responde 422. "Pagar fatura" de uma fatura com C paga só as `PENDING`.

**CA22 - Concorrência pagar x cancelar (RNF02)**
- Given a despesa PIX pendente P e a despesa no cartão pendente Q
- When um pagamento e um cancelamento de P chegam ao mesmo tempo, e o mesmo acontece com Q
- Then as operações são serializadas e o resultado é o de uma das ordens possíveis:
  - P: se o cancelamento vem primeiro, P fica `CANCELED` (anterior `PENDING`) e o pagamento responde 422; se o pagamento vem primeiro, P fica `PAID` e depois `CANCELED` (anterior `PAID`, com `paidAt`);
  - Q: se o cancelamento vem primeiro, Q fica `CANCELED` e o pagamento responde 422; se o pagamento vem primeiro, Q fica `PAID` e o cancelamento responde 422 (fatura paga).
- And nunca há estado incoerente (por exemplo, `CANCELED` sem status anterior, ou despesa de cartão cancelada a partir de `PAID`).

### Listagens

**CA23 - Mostrar cancelados na aba Despesas (RF19)**
- Given em 2026-11 as despesas efetivas de 100.00 (paga) e 50.00 (pendente) e uma cancelada de 70.00
- When Ana liga "Mostrar cancelados"
- Then a lista mostra 3 itens, o cancelado com o selo "Cancelado", estilo atenuado, sem checkbox, sem "Pagar" e "Cancelar" e com "Reativar", e o subtotal continua total "150.00", paid "100.00", pending "50.00". A URL guarda o filtro, e ao desligá-lo a lista volta a 2 itens.

**CA24 - Lista da fatura com cancelados (RF19)**
- Given a fatura Nubank 2026-11 com 2 despesas efetivas e 1 cancelada
- When Ana expande o bloco, com e sem "Mostrar cancelados"
- Then sem o filtro a lista mostra 2 itens, e com o filtro mostra 3, o cancelado marcado. O bloco mostra `entryCount` 2 e os totais sem o cancelado nos dois casos.

### Demo

**CA25 - Demo com categorias-entidade, somente leitura (RF20)**
- Given um visitante na demo
- When ele abre as telas de lançamentos, cartões, categorias e dashboard, liga "Mostrar cancelados" ou "Mostrar inativos" e filtra por uma categoria inativa
- Then vê categorias de receita e de despesa, a categoria inativa, o cartão inativo e os lançamentos cancelados (despesa e receita) com as marcações, e não existem os botões "+ Nova categoria", "Renomear", "Inativar", "Reativar" nem "Cancelar". Qualquer método diferente de GET em `/api/demo/*` responde 404 `ROUTE_NOT_FOUND`.

**CA26 - Acessibilidade (RNF07)**
- Given a tela de categorias (vazia, com dados, com inativas, com erro inline), o campo Categoria com a opção de criar e a de reativar, as abas Despesas e Receitas com cancelados, `/cards` com inativos e os diálogos de confirmação
- When cada estado é auditado com axe nos temas claro e escuro, em 360 px e em 1280 px
- Then não há violações, os selos são lidos por leitor de tela e o texto atenuado mantém AA.

**CA27 - Mostrar canceladas na aba Receitas (RF19)**
- Given em 2026-11 as receitas recebidas de 5000.00 e de 1000.00, sendo a de 1000.00 cancelada
- When Ana abre a aba Receitas, com e sem "Mostrar cancelados"
- Then sem o filtro a lista mostra 1 item e, com o filtro, 2 itens, a cancelada com o selo "Cancelado" e a ação "Reativar"; o subtotal é "5000.00" nos dois casos.

## 6. Fora de escopo

- **Edição de lançamento** (descrição, valor, data, categoria, cartão, forma), inclusive trocar a categoria de um lançamento existente.
- Exclusão física de categoria, cartão ou lançamento.
- **Estorno de pagamento** como operação própria (voltar de `PAID` para `PENDING` sem cancelar).
- Cancelar despesa de cartão `PAID` (fatura paga), inclusive "cancelar fatura".
- Cancelamento ou reativação em lote.
- Mesclar categorias, mover lançamentos entre categorias, subcategorias, cores ou ícones de categoria, e ordem manual.
- Trocar o tipo de uma categoria.
- Reativação automática de categoria ou cartão por qualquer outra via que não as ações explícitas (RF03, RF06, RF12).
- Histórico de auditoria além de `canceledAt` e do status anterior (quem cancelou, motivo do cancelamento, histórico de vários cancelamentos e reativações).
- Escrita na demo (continua só visualização, Feature A).

## 7. Riscos

- **R1 - Despesa de cartão paga lançada por engano fica permanente.** Com a decisão de B1, receitas e despesas PIX pagas podem ser canceladas. Continua sem correção a despesa de cartão `PAID`, porque a fatura dela já foi paga e removê-la dos totais divergiria do valor efetivamente pago. Sem edição, um valor errado se corrige cancelando e lançando de novo (quando o cancelamento é permitido). O tema fica registrado para a futura feature de edição e estorno.
- **R2 - Filtro de status esquecido em SQL cru.** Os read models usam `$queryRaw`. Esquecer `status <> 'CANCELED'` em uma agregação infla totais. Hoje as somas de receita não filtram status (todas as receitas eram `RECEIVED`), então a receita cancelada é o caso mais fácil de esquecer. Mitigação: um fragmento SQL único de "lançamento efetivo", teste de integração com cancelado (despesa e receita) em **cada** read model e revisão dedicada.
- **R3 - Migração com dados de vários donos e grafias.** Risco de categorias duplicadas por (dono, tipo, chave) ou de lançamento sem FK. Mitigação: RNF03, CA13 e CA14.
- **R4 - Mudança de contrato.** `POST /api/entries`, `GET /api/categories`, o filtro `category` e o objeto `Entry` mudam de forma (texto → id). Web, stub de e2e e rotas de demo precisam acompanhar no mesmo corte (T4).
- **R5 - "Criar na hora" sem atomicidade.** Se a categoria for criada numa chamada e o lançamento falhar em outra, sobra uma categoria criada. É aceitável pelas regras (P03), mas pode surpreender (T5).
- **R6 - Regra de reativação de lançamento de cartão.** "Fatura sem despesa paga" depende de uma fatura que não é persistida. Um pagamento concorrente à reativação poderia quebrar a regra sem lock. Mitigação (ADR 0006): a reativação trava todas as despesas da fatura antes de decidir.
- **R7 - Datas exibidas da fatura.** Com cancelados fora do cálculo de `MAX(closing_date/due_date)` (B9), as datas exibidas de uma fatura podem mudar depois de um cancelamento, o que é coerente mas visível.
- **R8 - Cancelar pago como atalho de edição.** Cancelar um lançamento pago e lançar de novo é o caminho de correção nesta entrega. O histórico mantém o cancelado (filtro "Mostrar cancelados"), o que pode poluir a visão de quem usa muito esse atalho.

## 8. Perguntas em aberto

### Bloqueantes (mudam regra de negócio)

**B1 - Correção de receitas e despesas já pagas. DECIDIDA (2026-10-29).**
Decisão do usuário: cancelar vale também para lançamentos `PAID` e `RECEIVED`, exceto despesa de cartão cuja fatura já foi paga (despesa de cartão `PAID`). O registro vira `CANCELED` e sai dos totais. Refletida em RF14, RF15, RF16, RF19, CA18-CA22, CA27, R1 e P01.

### Técnicas (decisão do architect)

As respostas estão no ADR 0006 (`docs/adr/0006-categorias-inativacao-cancelamento.md`).

- **T1 - Reativação de lançamento cancelado.** *Decidida no ADR 0006:* mantida, voltando ao status anterior ao cancelamento (RF15). Receita e PIX sempre; cartão só se a fatura não tiver `PAID`, com lock de todas as despesas da fatura.
- **T2 - Lugar da categoria no domínio.** *Sugestão:* aggregate `Category` no contexto `finance` (`domain/category/`), com `CategoryRepository` e um `CategoryReadModel` por dono e por tipo. O VO `Category` atual vira `CategoryName`.
- **T3 - Esquema e integridade.** *Sugestão:*
  - tabela `categories` (id, `user_id`, `type`, `name`, `name_key`, `active` ou `inactivated_at`, timestamps), com unicidade `(user_id, type, name_key)`;
  - `entries.category_id` NOT NULL com FK composta `(category_id, user_id, type)` para garantir mesmo dono e mesmo tipo;
  - remover `category` e `category_key` de `entries` depois da migração;
  - `cards.inactivated_at` (ou `active`);
  - `entry_status` ganha `CANCELED`, e `entries` ganha `canceled_at` e o status anterior ao cancelamento, com CHECKs de coerência entre status, `paid_at`, `canceled_at` e status anterior;
  - revisão dos índices de categoria e status.
- **T4 - Contratos HTTP.** *Sugestão:*
  - `POST /api/entries` recebe `categoryId` no lugar de `category` (com `category` passando a `UNKNOWN_FIELD`), e o `Entry` devolve `category: { id, name }`;
  - categorias: `GET /api/categories?type=&includeInactive=`, `POST /api/categories`, `PATCH /api/categories/:id` (nome) e `POST .../:id/inactivate` e `.../:id/reactivate`;
  - cartões: `POST /api/cards/:id/inactivate` e `.../reactivate`, e `GET /api/cards?includeInactive=`;
  - lançamentos: `POST /api/entries/:id/cancel` e `.../reactivate`;
  - filtros `includeCanceled` em `GET /api/entries/expenses`, `GET /api/entries/incomes` e na lista da fatura, e `categoryId` no lugar de `category` nos filtros;
  - o `Card` e a `Category` de resposta incluem `active`, e o `Entry` inclui `canceledAt` e o status anterior ao cancelamento;
  - o mesmo vale para as rotas `/api/demo/*`.
- **T5 - "Criar na hora" atômico ou em duas chamadas.** *Sugestão:* duas chamadas pela Server Action (criar a categoria e depois o lançamento), aceitando o R5 (P03). A alternativa é `POST /api/entries` aceitar `newCategoryName` e fazer o find-or-create na mesma transação.
- **T6 - Migração.** *Sugestão:* uma migration Prisma com SQL de dados: `INSERT ... SELECT DISTINCT ON (user_id, type, category_key) ... ORDER BY created_at, id`, `UPDATE entries SET category_id`, `NOT NULL`, e só depois o drop das colunas antigas, tudo numa transação. O dataset demo é regenerado pelo `DemoDatasetStore`.
- **T7 - Códigos de erro.** Confirmar os nomes de P09.
- **T8 - Stub de e2e do web.** *Sugestão:* o stub ganha categorias, inativação, cancelamento e os filtros novos.

## 9. Premissas adotadas

- **P01** A ação "Cancelar" aparece na aba Despesas (despesas `PENDING` e despesas PIX `PAID`) e na aba Receitas (receitas `RECEIVED`), sempre com diálogo de confirmação; para lançamento pago ou recebido, o diálogo avisa que o valor sai dos totais e que não é estorno. Ela não aparece para despesa de cartão `PAID`. A lista expansível da fatura continua somente leitura (DR7). Inativar cartão pede confirmação explicando os efeitos. Inativar categoria e todas as reativações (categoria, cartão e lançamento) não pedem confirmação. O ui-designer pode ajustar a forma.
- **P02** Na migração, o nome de cada categoria é a grafia do primeiro uso (menor `created_at`, desempate por `id`) dentro de (dono, tipo, chave). Todas as categorias migradas nascem ativas.
- **P03** Uma categoria criada na hora continua existindo mesmo que o lançamento não seja salvo depois (por erro ou desistência), se a criação for em duas chamadas (T5).
- **P04** Nome repetido de uma categoria ou de um cartão **inativo** responde 409 com um indicativo de que o existente está inativo (por exemplo, `details` com o id e `active: false`). A UI oferece "Reativar" (em `/cards` e na tela de categorias) ou "Reativar e usar" (no campo Categoria). Nunca se cria uma duplicata.
- **P05** O cartão inativo continua editável (PUT, sem retroatividade). A ação "Editar" aparece para ele quando "Mostrar inativos" está ligado.
- **P06** Os filtros de categoria (Despesas e Receitas) e de cartão (Despesas) listam ativos e inativos. Os inativos vêm depois dos ativos, com o sufixo "(inativa)" ou "(inativo)", porque o usuário precisa achar o histórico. Nas linhas de lançamento, a categoria ou o cartão inativo aparece sem marcação.
- **P07** A tela de categorias tem versão demo somente leitura (por exemplo, `/demo/categories`) e entra na `MainNav` da demo.
- **P08** O dataset demo inclui categoria inativa, cartão inativo e lançamentos cancelados, para mostrar as funções: pelo menos uma despesa cancelada a partir de `PENDING`, uma despesa PIX cancelada a partir de `PAID` e uma receita cancelada, em meses com outros lançamentos efetivos.
- **P09** Os códigos de erro (nomes finais confirmados no ADR 0006, T7) são:
  - 404: `CATEGORY_NOT_FOUND`;
  - 409: `CATEGORY_NAME_TAKEN` (código de campo `NAME_TAKEN`), e `CARD_NAME_TAKEN` passando a indicar quando o existente está inativo;
  - 422: `CATEGORY_INACTIVE`, `CATEGORY_TYPE_MISMATCH`, `CARD_INACTIVE`, `ENTRY_NOT_CANCELABLE` (`details.reason = "CARD_INVOICE_PAID"`), `ENTRY_NOT_REACTIVATABLE` (`details.reason = "NOT_CANCELED"` ou `"INVOICE_HAS_PAYMENTS"`), e `ENTRY_NOT_PAYABLE` e `ENTRIES_NOT_PAYABLE` ganhando `canceledIds` em `details`.

  A precedência continua 400 > 404 > 422, com 409 depois de 400 e 404.
- **P10** Cancelar, reativar, inativar e renomear atualizam `updatedAt` do registro alterado. Operações sem efeito (idempotentes) não atualizam.
- **P11** Não há limite de quantidade de categorias por dono. A referência de desempenho é de até 500 categorias.
- **P12** A aba Receitas ganha "Mostrar cancelados", "Cancelar" e "Reativar", porque receita recebida pode ser cancelada (B1).
- **P13** O filtro "Mostrar cancelados" é um só para as abas Despesas, Receitas e Faturas do mesmo mês (um query param compartilhado).
- **P14** Ao criar uma categoria pela tela de categorias, o tipo é o da aba ativa. No campo Categoria do formulário, é o tipo do lançamento.

## 10. Tarefas (ordenadas)

### Banco
1. [db] Tabela `categories` por dono e tipo, com unicidade `(user_id, type, name_key)` e situação ativa ou inativa (RF01, RF03, T3).
2. [db] Migração de dados: categorias a partir de `entries` por (dono, tipo, chave), `entries.category_id` NOT NULL com FK garantindo mesmo dono e mesmo tipo, e remoção das colunas de texto, com teste de integração de equivalência (RF11, RNF03, CA13, CA14, T6).
3. [db] Situação ativa ou inativa em `cards`, status `CANCELED`, `canceled_at` e status anterior em `entries`, com CHECKs de coerência (inclusive "cartão pago não cancela"), e revisão dos índices (RF12, RF14, RF15, T3).

### API: domínio e aplicação
4. [api] Aggregate `Category` (criar, renomear, inativar, reativar, idempotência) e VO de nome, com testes unitários (RF01-RF03, T2).
5. [api] `Card`: inativar e reativar, com testes unitários (RF12).
6. [api] `Entry`: referência à categoria por id, transição `cancel` (de `PENDING`, `PAID` ou `RECEIVED`, exceto cartão `PAID`; idempotente; com `canceledAt` e status anterior), transição `reactivate` (volta ao status anterior, regra de fatura para cartão), e bloqueio de pagamento de cancelado no `EntryPaymentService`, com testes unitários (RF14, RF15, RF17).
7. [api] Use cases de categoria (criar, renomear, inativar, reativar, listar por tipo e situação), com 409 informando inativa, e testes unitários (RF01-RF04, P04).
8. [api] Use cases de cartão (inativar, reativar, listar com ou sem inativos) e `CreateEntry` validando categoria (dono, tipo, ativa) e cartão ativo, com testes unitários (RF07, RF12, RF13).
9. [api] Use cases de cancelar e reativar lançamento, e ajuste do pagamento individual e em lote (422 com `canceledIds`), com testes unitários (RF14, RF15, RF17).

### API: infraestrutura e HTTP
10. [api] Repositório e read model de categorias, com mappers e integração com dois donos (RNF01).
11. [api] Read models (despesas, receitas, faturas, lista da fatura, resumo, série, distribuição) excluindo cancelados dos totais (inclusive receitas), com `includeCanceled`, filtro por `categoryId` e nome atual da categoria, e integração com cancelados em cada um (RF09, RF10, RF16, RF19, R2).
12. [api] Repositórios de cartão e lançamento com as novas transições e lock para pagar, cancelar e reativar (inclusive lock da fatura na reativação), com integração da concorrência (RNF02, CA22).
13. [api] Controllers e DTOs: rotas de categoria, de inativar e reativar cartão, de cancelar e reativar lançamento, `categoryId` em `POST /api/entries`, filtros novos e códigos de erro no `HttpErrorFilter`, com e2e (supertest) para CA01-CA24 e CA27 no que é API (T4, P09).
14. [api] Rotas `/api/demo/*` com os parâmetros novos e a leitura de categorias por tipo, com e2e de somente leitura (RF20, CA25).
15. [db] Dataset demo com categorias-entidade, categoria inativa, cartão inativo e lançamentos cancelados (RF20, P08).
16. [api] Medir RNF04 e registrar o resultado.

### Web
17. [web] Tipos, endpoints e Server Actions: categorias (criar, renomear, inativar, reativar), cartão (inativar, reativar), lançamento (cancelar, reativar) e `categoryId` na criação (T4, T5).
18. [web] Tela de categorias protegida e versão demo somente leitura, com abas de receita e despesa, "Mostrar inativas", ações e erros inline, e entrada na `MainNav` (RF04, RF05, P07).
19. [web] Campo Categoria do drawer: só ativas do tipo, limpar ao trocar o tipo, criar na hora e "Reativar e usar" (RF06, CA09-CA11).
20. [web] `/cards`: "Mostrar inativos", selo "Inativo", "Inativar" com confirmação e "Reativar", e drawer de lançamento sem cartões inativos (RF12, RF13, CA15, CA16).
21. [web] Abas Despesas, Receitas e Faturas: "Mostrar cancelados", marcação, "Cancelar" com confirmação (textos distintos para pendente e para pago/recebido), "Reativar" com exibição do motivo da recusa, e cancelados sem seleção; filtros de categoria e cartão com inativos marcados (RF09, RF14, RF15, RF19, P01, P06, P12, P13).
22. [web] Testes unitários dos componentes novos e alterados, atualização do stub de e2e (T8) e Playwright + axe para CA06, CA09-CA11, CA15-CA20, CA23-CA27.

### Fechamento
23. Code-reviewer, com atenção a R2 (status efetivo em SQL cru, inclusive receitas) e ao isolamento por dono das categorias.
24. Doc-writer: atualizar `docs/api/finance.md` (categorias, cancelamento, reativação, inativação, erros novos, contrato de `Entry`), o glossário da spec de origem (status `CANCELED`, categoria-entidade), o README (migração) e o CHANGELOG.
