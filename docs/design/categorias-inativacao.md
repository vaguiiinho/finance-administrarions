# Design: Categorias como entidade, inativação de cartão e cancelamento de lançamento

- Data: 2026-10-29 (rev. 2: 2026-10-29)
- Branch: a definir (depois de `feat/auth-authorized`)
- Autor: ui-designer
- Status: **Aprovado** (2026-10-29), inclusive a navegação (depende da seção 17 da Feature A, aprovada com PL1-PL3).
- Entradas: `docs/specs/categorias-inativacao.md` (rev. 2: RF01-RF20, RNF07, CA01-CA27, P01-P14), `docs/adr/0006-categorias-inativacao-cancelamento.md` (seções 6 e 9), `docs/design/design-system.md` (rev. 7, vidro fosco), `docs/design/lancamentos-financeiros.md` (tela `/entries` 3.x, `/cards` 4.x, estados dos controles 1.8, componentes 6.x), `docs/design/autenticacao-autorizacao.md` (rev. 3: shell, `WriteOnly`, demo, sessão expirada, padrões de inativar e reativar, layout global na seção 17).
- Escopo: só `web/`. Os contratos são os do ADR 0006, seção 6. **Nenhum token de cor novo.**
- Pressuposto: a Feature A está pronta. As telas ficam em `web/features/*`, são parametrizadas por `AppMode` e `FinanceReader`, a escrita fica dentro de `<WriteOnly>`, os fluxos de sessão expirada são os da seção 8 do design da Feature A e a navegação principal é o menu lateral e o drawer da seção 17 de lá.

### Histórico de revisões

- **rev. 2 (2026-10-29):** sai o desvio da navbar (DB11 antigo: links na linha 2 até `md`). "Categorias" passa a ser o 4º item do menu lateral e do drawer de navegação da Feature A (seção 17, Proposta). PB1 e PB2 aprovados. PB3 recusado: o painel "+ Novo cartão" do drawer continua só com o aviso para reativar em Cartões (4.5).
- **rev. 1 (2026-10-29):** versão inicial.

---

## 0. Decisões de design

| Id | Decisão | Motivo |
|---|---|---|
| DB1 | Existe **um único selo** para "fora de uso": o `StateTag`. É uma pílula com borda 1px **tracejada** `--border-strong`, ícone de círculo cortado e texto `--text-muted` 12/500. Os textos são "Cancelado" (lançamento), "Inativo" (cartão) e "Inativa" (categoria). | RNF07: o selo combina texto, ícone e forma (borda tracejada) e não depende só de cor. Um selo só, usado em todas as telas, ensina o significado uma vez. |
| DB2 | O "estilo atenuado" **não usa opacidade** (regra 2 do design system). Ele combina descrição, metadados e valor em `--text-muted`, valor riscado (`line-through`) com o texto oculto "fora dos totais" e, nos cards de lista e nos cards de `/cards`, borda tracejada `--border-strong` no lugar da borda de vidro (PB1 aprovado). | Opacidade derrubaria o contraste abaixo de AA. `--text-muted` já tem AA validado sobre vidro e opaco. O risco no valor explica sem cor que ele não entra nas somas. |
| DB3 | Na tela de categorias e em `/cards`, os inativos aparecem num **grupo próprio**, com título visível ("Inativas (n)" ou "Inativos (n)"), abaixo dos ativos, quando "Mostrar inativas/inativos" está ligado (PB2 aprovado). Nas listas de lançamentos (paginadas e em ordem de data) o cancelado fica na posição normal, com o selo. | Mesmo padrão da lista de usuários da Feature A (DA14 e PA8, aprovados). Assim a distinção vem da posição, do título, do selo e da borda. Nas listas por data, agrupar quebraria a ordem e a paginação. |
| DB4 | "Mostrar cancelados", "Mostrar inativos" e "Mostrar inativas" são **opções de exibição**, e não filtros: um `Checkbox` com rótulo, sempre visível (fora da folha de filtros no mobile), que aplica ao mudar. Ele não entra na contagem "Filtros (n)", não é limpo por "Limpar filtros" e não muda o qualificador do subtotal. | Ligar a opção não estreita o resultado, só acrescenta itens marcados, e o subtotal nunca muda (RF19). Tratar como filtro faria o subtotal dizer "com os filtros aplicados" sem que os números mudassem. |
| DB5 | "Mostrar cancelados" é **um só** para as abas Despesas, Faturas e Receitas (`canceled=1`, P13) e aparece nas três, com o mesmo rótulo e o mesmo estado. | P13. Repetir o controle em cada aba evita que a pessoa procure o controle em outra aba. |
| DB6 | Na confirmação de cancelamento, os botões são **"Voltar"** e **"Cancelar lançamento"**, e não "Cancelar" e "Cancelar". O botão da linha continua "Cancelar" (texto da spec), com nome acessível "Cancelar <descrição>". | Dois "Cancelar" no mesmo diálogo, com sentidos opostos, causariam erro de clique e seriam ambíguos para o leitor de tela. |
| DB7 | Cancelar pede confirmação, e o texto muda para pendente, pago e recebido. Inativar cartão pede confirmação. Inativar categoria e todas as reativações **não** pedem confirmação. Todas usam o `AlertDialog` sem a linha "Esta ação não pode ser desfeita." (prop opcional da Feature A). | P01. As ações são reversíveis, então a linha de "irreversível" seria falsa. |
| DB8 | A recusa da reativação por fatura com pagamento (`INVOICE_HAS_PAYMENTS`) aparece num **banner persistente** acima da lista (`InlineAlert` `danger`, `role="alert"`, com fechar). Não aparece em toast. A UI **não antecipa** a regra (o "Reativar" continua aparecendo). | CA20 pede que o motivo fique visível. Um toast some antes de ser lido. Antecipar a regra exigiria saber, por linha, o estado de pagamento da fatura, que a lista não traz e que muda sob concorrência (mesmo raciocínio de DA16 da Feature A). |
| DB9 | O campo Categoria do drawer guarda **um id**. O texto digitado sem escolha não vale. Ao sair do campo, um texto que coincide pela chave com uma categoria ativa do tipo é selecionado sozinho. Nada é criado nem reativado sem uma escolha explícita na lista. | RF06 e T5: criar e reativar têm efeito no servidor no momento da escolha (P03), então não podem acontecer por blur. Selecionar uma ativa que já existe não tem efeito colateral e evita o erro "escolha da lista" para quem digitou o nome inteiro. |
| DB10 | "Criar categoria" e "Reativar e usar" são a **última opção** da lista, separada por divisória e exclusivas entre si. "Reativar e usar" só aparece quando o texto coincide **pela chave** com uma inativa do tipo e traz o selo "Inativa" dentro da opção. Correspondência parcial com inativa não aparece. | CA11. Mostrar inativas por correspondência parcial poluiria a lista de seleção, que deve ter só ativas (RF06). |
| DB11 | **(rev. 2)** "Categorias" entra como **4º item da navegação principal** (menu lateral a partir de `xl` e drawer de navegação abaixo disso, Feature A 17), depois de "Cartões". A navbar não muda. | Com a navegação fora da navbar, o 4º item não cabe mal em nenhuma largura, e o desvio da linha 2 até `md` deixa de existir. Depende da seção 17 da Feature A (Proposta). |
| DB12 | Criar e renomear categoria usam um **modal de formulário** de um campo (`ModalDialog variant="modal"`), e não drawer. | Um campo só. O drawer (D1) é para formulários longos. É o mesmo padrão do "Redefinir senha" da Feature A. |
| DB13 | Com "Mostrar cancelados" ligado e o Status da aba Despesas em "Pendente" ou "Pago", os cancelados não aparecem (o filtro de status é exato, ADR 5.3). O painel mostra então uma nota fixa explicando como vê-los. | Evita a impressão de que a opção "não funciona". |

---

## 1. Fundamentos usados (sem token novo)

| Elemento | Material | Tokens |
|---|---|---|
| `StateTag` (selo "Cancelado", "Inativo", "Inativa") | Sem preenchimento (transparente sobre o material do contêiner) | borda 1px tracejada `--border-strong`, texto e ícone `--text-muted`, raio 999px, padding 2px 8px, Inter 500 12, ícone 14px |
| Linha ou card cancelado ou inativo | O mesmo do item ativo (vidro plano na lista, vidro nos cards de `/cards`, opaco no drawer e nos diálogos) | texto `--text-muted`; valor `--text-muted` com `line-through`; cards: borda 1px tracejada `--border-strong` no lugar de `--card-border` |
| Título de grupo ("Inativas (n)") | Linha de título no contêiner da lista | Inter 600 14 `--text`, fundo `--card-bg-2`; `h2` no mobile |
| Opções de exibição ("Mostrar …") | `Checkbox` existente com rótulo | estados da 1.8 do design de lançamentos; alvo de 44px |
| Lista do combobox | Opaca (dentro do drawer) | a mesma da rev. 4: `--surface`, borda `--border-strong`, opção ativa `--surface-active` |
| Banner de recusa de reativação | `InlineAlert` `danger` | o da 3.10 do design de lançamentos |
| Diálogos (cancelar, inativar cartão, criar e renomear categoria) | Opaco (top layer) | `--surface`, `--scrim`, borda `--border-strong` |

Pares de contraste: só pares já validados. `--text-muted` sobre `--card-bg`, `--card-bg-2`, `--surface` e `--surface-2` e `--border-strong` (3:1, não textual) sobre os mesmos fundos já estão em `tokens.spec.ts`. O `line-through` usa a cor do texto (`--text-muted`), sem cor própria.

Indicadores (sempre ícone + texto):

| Indicador | Ícone | Texto | Cor | Onde |
|---|---|---|---|---|
| Lançamento cancelado | círculo cortado | "Cancelado" | `--text-muted` | coluna Status (substitui o `StatusBadge`), cards mobile, lista da fatura |
| Cartão inativo | círculo cortado | "Inativo" | `--text-muted` | card em `/cards` |
| Categoria inativa | círculo cortado | "Inativa" | `--text-muted` | linha da tela de categorias, opção "Reativar e usar" |
| Inativa ou inativo em filtro | - | sufixo "(inativa)" ou "(inativo)" e grupo "Inativas" ou "Inativos" no `<select>` | `--text` (padrão do `option`) | filtros de categoria e cartão (P06) |

O ícone de círculo cortado é o mesmo do "Inativo" da lista de usuários da Feature A (já previsto no `Icon`).

Motion: nada novo. A linha que sai da lista (cancelada com a opção desligada) some sem animação, e a lista é revalidada.

---

## 2. Navegação (Feature A 17, aprovada)

- Itens da navegação principal: Lançamentos, Dashboard, Cartões, **Categorias**, nessa ordem, com `basePath` (`/categories` ou `/demo/categories`, P07). Valem para o menu lateral (a partir de `xl`) e para o drawer de navegação (abaixo de `xl`), com os estilos, a regra de ativo e o teclado da Feature A (17.5-17.7).
- Ícone de "Categorias": etiqueta, 20px, `aria-hidden` (novo no `Icon`, Feature A 17.12).
- O item fica ativo em `/categories` e `/demo/categories` (inclusive com query string `?type=…&inactive=1`).
- Na demo o item aparece igual, apontando para `/demo/categories` (P07). Não há item de administração.
- A navbar não muda: continua com marca, tema e conta ou "Entrar" (Feature A 2.1).
- Login: o `next=/categories` mapeia o rótulo "Categorias" ("Entre para continuar em Categorias.", 3.3 da Feature A).
- `document.title`: "Categorias · Finanças" e "Categorias (demonstração) · Finanças".

```
>= xl (1280)
+---------------------------------------------------------------------------------------+
| Finanças                                                                 [sol]  (A)    |
+--------------------+------------------------------------------------------------------+
|  [≣] Lançamentos   |  Categorias                                    [ Nova categoria ] |
|  [▥] Dashboard     |  ...                                                              |
|  [▭] Cartões       |                                                                   |
| ▌[◇] Categorias    |                                                                   |
+--------------------+------------------------------------------------------------------+

< xl (360px, drawer aberto)
+----------------------------+-----+
| Finanças                [x]|     |
|----------------------------|scrim|
|  [≣] Lançamentos           |     |
|  [▥] Dashboard             |     |
|  [▭] Cartões               |     |
| ▌[◇] Categorias            |     |
+----------------------------+-----+
```

---

## 3. Tela de categorias (`/categories`, RF04, RF05, P07, P14)

### 3.1 Hierarquia de informação

1. h1 "Categorias" e ação primária "Nova categoria" (fora da demo).
2. Ajuda curta (`--text-muted` 14): "Cada categoria vale para um tipo de lançamento. Renomear muda o nome em todos os lançamentos, inclusive nos antigos."
3. Abas **Despesas** | **Receitas** (padrão Despesas).
4. Painel da aba: h2 "Categorias de despesa" ou "Categorias de receita" e contagem; opção "Mostrar inativas"; lista de ativas; grupo "Inativas (n)" quando a opção está ligada.

Não há busca, ordenação manual nem paginação (P11: até cerca de 500 itens). A ordem é a da API (ativas e depois inativas; em cada grupo, pela chave do nome).

### 3.2 Estado na URL

`/categories?type=EXPENSE|INCOME&inactive=1` (ADR 9.2). Sem `type` ou com valor inválido, abre Despesas. Trocar de aba mantém `inactive`. Voltar e avançar restauram aba e opção.

### 3.3 Layout por breakpoint

```
>= md (a partir de xl, à direita do menu lateral)
+-------------------------------------------------------------------------------------------+
| Categorias                                                              [ Nova categoria ] |
| Cada categoria vale para um tipo de lançamento. Renomear muda o nome em todos os           |
| lançamentos, inclusive nos antigos.                                                        |
|                                                                                            |
|  Despesas   Receitas                                                                       |
|  ‾‾‾‾‾‾‾‾                                                                                  |
| Categorias de despesa                                                                      |
| 6 ativas · 1 inativa                                       [x] Mostrar inativas            |
| +-------------------------------------------------------------+                            |
| | Alimentação                              Renomear  Inativar |                            |
| | Assinaturas                              Renomear  Inativar |                            |
| | Lazer                                    Renomear  Inativar |                            |
| | ...                                                         |                            |
| |-------------------------------------------------------------|                            |
| | Inativas (1)                                                |  linha de grupo            |
| | Academia  [ø Inativa]                    Renomear  Reativar |  texto --text-muted        |
| +-------------------------------------------------------------+                            |
|  lista com largura máxima de 720px, alinhada à esquerda                                    |
+-------------------------------------------------------------------------------------------+

< md (360px)
+----------------------------------+
| Categorias                       |
| [       Nova categoria       ]   |  largura total, 48px
| Cada categoria vale para um tipo |
| de lançamento. Renomear muda ... |
| [ Despesas  |  Receitas ]        |  segmented (abas < md)
| Categorias de despesa            |  h2
| 6 ativas · 1 inativa             |
| [x] Mostrar inativas             |  44px
| +------------------------------+ |
| | Alimentação                  | |
| | [Renomear]  [Inativar]       | |  terciários 44px
| +------------------------------+ |
| | Assinaturas                  | |
| | [Renomear]  [Inativar]       | |
| +------------------------------+ |
| Inativas (1)                     |  h2
| +------------------------------+ |  borda tracejada
| | Academia                     | |  --text-muted
| | [ø Inativa]                  | |
| | [Renomear]  [Reativar]       | |
| +------------------------------+ |
+----------------------------------+
```

| Breakpoint | Lista | Ações |
|---|---|---|
| < `sm` | itens `.glass-flat` empilhados (12px entre itens); nome e selo na linha 1 (o selo quebra para baixo se não couber); ações na linha 2 | terciários de 44px em linha (`flex-wrap`, gap 8px) |
| `sm` a `md` | igual, com ações à direita do nome quando couberem | idem |
| >= `md` | um contêiner `.glass-flat` com linhas de 56px e divisória `--border`; largura máxima de 720px | terciários de 44px à direita, numa linha |

- Contagem: com a opção desligada, "6 ativas" (a API não devolve inativas nesse caso). Com a opção ligada, "6 ativas · 1 inativa". Plural explícito ("1 ativa", "2 inativas").
- Nome: Inter 500 16 `--text`, que quebra linha (`overflow-wrap: anywhere`), sem reticências (até 50 caracteres). Inativa: `--text-muted` e selo "Inativa" (DB1, DB2).
- O cabeçalho da página segue a Feature A 6.2: botão à direita a partir de `sm`, abaixo do texto e com largura total abaixo de `sm`. Na demo o botão não existe e o título ocupa a linha (Feature A 7.2).
- Abas: o `Tabs` existente (links, ativação manual, D18 do design de lançamentos), com `aria-label="Tipo de categoria"`. O painel tem `role="tabpanel"`.

### 3.4 Linha da categoria

| Ação | Quando aparece | Efeito |
|---|---|---|
| "Renomear" | sempre, inclusive em inativa (RF02) | abre o modal de renomear (3.6) |
| "Inativar" | categoria ativa | executa direto, sem confirmação (P01, 3.7) |
| "Reativar" | categoria inativa | executa direto (3.7) |

- Nome acessível: texto visível + nome oculto ("Renomear Academia", "Inativar Academia"), começando pelo texto visível (WCAG 2.5.3).
- Semântica: `<ul>` com `<li>` por categoria. Os grupos são duas listas com título (`h3` visível "Inativas (1)"; no mobile, `h2` como na Feature A). O nome é o rótulo do item, e o selo está no mesmo `li`. Leitura: "Academia, Inativa, Renomear Academia, botão".
- A categoria não mostra contagem nem total de lançamentos (fora de escopo).

### 3.5 Nova categoria (`CategoryFormDialog`, modo criar, RF01, CA01-CA03)

```
+----------------------------------------------+
| Nova categoria de despesa                    |  h2 (tipo = aba ativa, P14)
|                                              |
| Nome *                                       |
| [______________________________]             |
| Até 50 caracteres.                    42/50  |  contador a partir de 40
|                                              |
| (409 inativa)                                |
| (!) Já existe uma categoria de despesa       |  --danger-text, ligado ao campo
|     inativa com este nome.                   |
|     [ Reativar "Viagem" ]                    |  secundário 44px
|                                              |
|                  [Cancelar] [Criar categoria] |
+----------------------------------------------+
< sm: largura total menos 16px de cada lado; botões empilhados, primário em cima.
```

- O tipo não é campo: o título diz qual é, e ele vem da aba ativa (P14). Abrir "Nova categoria" na aba Receitas mostra "Nova categoria de receita".
- Campo Nome: `TextField`, `autocomplete="off"`, obrigatório, sem `maxLength` (o limite é em code points), contador "n/50" a partir de 40 (`--danger-text` acima de 50). O cliente não normaliza: a API apara e colapsa espaços, e a lista mostra o nome devolvido ("  Alimentação  " vira "Alimentação", CA01).
- Validação e foco: padrão 3.4 da Feature A (sem erro antes do primeiro envio, todos de uma vez no envio, foco no primeiro inválido).
- Mensagens: `REQUIRED` "Informe o nome."; `TOO_LONG` "Use até 50 caracteres."; 409 com `existing.active = true`: "Já existe uma categoria de despesa com este nome." (CA03, "LAZER"); 409 com `existing.active = false`: "Já existe uma categoria de despesa inativa com este nome." e o botão secundário **"Reativar "<nome existente>""** abaixo da mensagem (CA03, "viagem"). Nada é criado (P04).
- "Reativar "Viagem"": chama `reactivateCategory(existing.id)` com o botão em carregando ("Reativando…") e o campo em somente leitura. No sucesso, o modal fecha, sai o toast "Categoria "Viagem" reativada.", a lista é revalidada e o foco vai para a linha de "Viagem" (que agora está entre as ativas). No erro, aparece a mensagem inline acima dos botões.
- Enviar: "Criando…", campo `readOnly`, `Esc` ignorado durante o envio (`busy`). O clique no scrim não fecha (há dado digitado).
- Sucesso: o modal fecha, a lista é revalidada, a linha nova recebe o destaque estático `.row-highlight` com o selo "Novo" (rev. 4 do design de lançamentos), sai o toast "Categoria "Pets" criada." e o foco vai para o nome da linha nova (`tabindex="-1"`).
- Rede ou 5xx: `InlineAlert` `danger` acima dos botões, "Não foi possível salvar agora. Verifique sua conexão e tente novamente.", com o valor preservado.
- Foco inicial: campo Nome. Ao cancelar, o foco volta para "Nova categoria".

### 3.6 Renomear (`CategoryFormDialog`, modo renomear, RF02, CA04, CA05)

- Título "Renomear "Mercado"". Campo Nome preenchido e selecionado. Ajuda fixa: "O novo nome aparece em todos os lançamentos, inclusive nos antigos."
- Botão "Salvar" ("Salvando…"). As mensagens são as da 3.5, exceto o 409 de inativa: "Já existe uma categoria de despesa inativa com este nome.", **sem** botão de reativar (reativar a outra não resolve o renomear).
- Trocar só maiúsculas e minúsculas ("Casa" para "CASA") é aceito normalmente (CA05).
- Sucesso: o modal fecha, sai o toast "Categoria renomeada para "Supermercado".", a lista é revalidada (a posição pode mudar pela ordem do nome) e o foco vai para o "Renomear" da mesma categoria, localizada pelo id. Sem mudança efetiva: toast "Nenhuma alteração.".
- 404 `CATEGORY_NOT_FOUND`: o modal fecha, sai o toast de erro "Categoria não encontrada. A lista foi atualizada." e a lista é recarregada.

### 3.7 Inativar e reativar (RF03, CA06, CA07)

- **Inativar** (sem confirmação, P01): o botão da linha entra em carregando ("Inativando…", `aria-busy`), e os outros botões da linha ficam inertes durante o envio.
  - Sucesso com "Mostrar inativas" desligado: a linha sai da lista. O toast diz "Categoria "Academia" inativada. Ela não aparece mais em novos lançamentos, e os lançamentos antigos continuam com ela." O foco vai para o "Renomear" da próxima linha. Se ela era a última, vai para o da anterior, e se a lista ficou vazia, vai para o h2 do painel.
  - Sucesso com a opção ligada: a linha passa para "Inativas", o toast é o mesmo e o foco vai para o "Reativar" dessa linha.
- **Reativar** (sem confirmação): "Reativando…". No sucesso, a linha volta para as ativas, sai o toast "Categoria "Academia" reativada." e o foco vai para o "Inativar" da linha.
- As duas operações são idempotentes, então um duplo envio por corrida resulta em sucesso sem erro. O botão ignora novos acionamentos enquanto está em carregando.
- Erros: 404, toast "Categoria não encontrada. A lista foi atualizada." e recarga; rede, toast "Não foi possível concluir agora. Verifique sua conexão e tente novamente." e a linha não muda. Sessão expirada: Feature A 8 ("mutação expirada sem diálogo").

### 3.8 Somente leitura (demo, P07, RF20)

`/demo/categories` é a mesma tela, sem "Nova categoria", "Renomear", "Inativar" e "Reativar" no DOM (`<WriteOnly>`). As linhas ficam só com o nome e o selo, sem coluna de ações. Abas e "Mostrar inativas" funcionam. O vazio não tem CTA.

---

## 4. Campo Categoria no drawer "Novo lançamento" (RF06-RF08, CA09-CA12, T5)

Substitui o combobox de texto livre da 3.9.1 do design de lançamentos. O layout do drawer não muda: o campo fica na mesma posição, com a mesma altura e os mesmos estados de controle.

### 4.1 Comportamento

- **Fonte:** `listCategories(type, { includeInactive: true })`, carregada com o drawer para os dois tipos (ou ao trocar o tipo). As opções selecionáveis são só as **ativas do tipo atual**. As inativas servem só para detectar "Reativar e usar" (ADR 9.4).
- **Valor:** o campo tem dois estados. "Escolhida" significa que há um id e o input mostra o nome atual. "Digitando" significa que não há id. Editar o texto de uma categoria escolhida volta para "digitando" (o id é descartado).
- **Trocar o tipo** (Despesa ou Receita) limpa o campo (texto e id) se havia algo. Abaixo do campo aparece a linha `role="status"` `--text-muted` "Categoria limpa: escolha uma categoria de receita." (ou "de despesa"), que some na próxima edição (CA09). O foco não se move.
- **Opções**, de cima para baixo:
  1. ativas do tipo que **contêm** o texto, sem diferenciar maiúsculas de minúsculas (com o campo vazio, todas as ativas);
  2. depois de uma divisória `--border`, **no máximo uma** das opções abaixo (DB10):
     - `Criar categoria "<texto aparado>"`, quando o texto não vazio não coincide pela chave com nenhuma categoria do tipo, ativa ou inativa (CA10);
     - `Reativar e usar "<nome da inativa>"` com o selo "Inativa", quando o texto coincide pela chave com uma inativa do tipo (CA11, "viagem" mostra `Reativar e usar "Viagem"`);
     - nenhuma, quando o texto coincide pela chave com uma ativa. Nesse caso a ativa correspondente é a **primeira** opção e já vem como opção ativa (CA11, "ALIMENTAÇÃO" mostra "Alimentação").
- **Blur** (DB9): se o campo está em "digitando" e o texto coincide pela chave com uma ativa do tipo, ela é escolhida sem aviso. Em qualquer outro caso o texto fica como está, sem criar nada.
- **Teclado e ponteiro:** os mesmos da rev. 4 (setas, `Home`/`End`, `Enter` escolhe a opção ativa, `Esc` fecha só a lista, `Tab` fecha e segue, chevron "Mostrar categorias"). `Enter` sem opção ativa não faz nada.

```
Categoria *
[via|____________________________v]
+----------------------------------+
| (nenhuma ativa contém "via")     |
|----------------------------------|
| Criar categoria "via"            |  peso 500
+----------------------------------+

Categoria *
[viagem|_________________________v]
+----------------------------------+
| Reativar e usar "Viagem"         |
|                     [ø Inativa]  |  selo dentro da opção
+----------------------------------+

Categoria *
[Pets____________________(spinner)]  somente leitura enquanto cria
(v) Categoria "Pets" criada e selecionada.   role="status", --success-text
```

Quando nenhuma ativa contém o texto, não há linha de aviso na lista: a lista mostra só a opção final. Com o campo vazio e sem nenhuma ativa do tipo, aparece a linha desabilitada "Nenhuma categoria de despesa ainda. Digite para criar." (ou "de receita").

### 4.2 Escolher "Criar" ou "Reativar e usar"

| Passo | Criar | Reativar e usar |
|---|---|---|
| Ao escolher | A lista fecha. O input fica `readOnly` com spinner à direita e `aria-busy="true"`, e o anúncio polite é "Criando categoria Pets…" | Igual, com "Reativando categoria Viagem…" |
| Chamada | `createCategory({ name, type })` | `reactivateCategory(id)` |
| Sucesso | O campo fica "escolhida" com o nome **devolvido pela API** e a linha `role="status"` `--success-text` com ícone diz "Categoria "Pets" criada e selecionada." | "Categoria "Viagem" reativada e selecionada." |
| 409 com ativa (corrida) | Escolhe a existente: "A categoria "Pets" já existia e foi selecionada." (`role="status"`) | - |
| 409 com inativa (corrida) | A lista reabre com `Reativar e usar "<nome>"` como opção ativa, e o erro `--danger-text` diz "Já existe uma categoria inativa com este nome." | - |
| 400 | Erro no campo: "Informe a categoria." ou "A categoria deve ter no máximo 50 caracteres." Texto preservado. | - |
| 404 | - | "Esta categoria não existe mais. Digite para criar outra." e as opções são recarregadas |
| Rede ou 5xx | Erro no campo: "Não foi possível criar a categoria. Tente novamente." Texto preservado. | "Não foi possível reativar a categoria. Tente novamente." |

- A categoria criada ou reativada continua existindo se o lançamento não for salvo (P03). A UI não avisa disso: a categoria aparece na tela de categorias como qualquer outra.
- Enquanto a criação ou a reativação está em andamento, "Salvar lançamento" fica indisponível (`aria-disabled`), para não enviar sem `categoryId`.
- A mensagem de sucesso some na próxima edição do campo (mesmo padrão do "+ Novo cartão", 3.9.3 do design de lançamentos).

### 4.3 Validação ao salvar e erros da API

| Situação | Mensagem no campo Categoria |
|---|---|
| Vazio | "Informe a categoria." |
| Texto sem escolha (não coincide com ativa) | "Escolha uma categoria da lista ou crie uma nova." |
| 404 `CATEGORY_NOT_FOUND` | "Esta categoria não existe mais. Escolha outra." (as opções são recarregadas) |
| 422 `CATEGORY_INACTIVE` (inativada em outra aba) | "Esta categoria foi inativada. Escolha outra ou digite o nome para reativá-la." (as opções são recarregadas e o campo volta a "digitando" com o texto) |
| 422 `CATEGORY_TYPE_MISMATCH` (defensivo) | "Esta categoria não é do tipo do lançamento. Escolha outra." |

A precedência e o foco seguem a 3.9.2 do design de lançamentos: 400 por campo primeiro e foco no primeiro inválido.

### 4.4 Estados do campo

| Estado | Apresentação |
|---|---|
| Carregando opções | O campo fica utilizável. A lista mostra uma linha desabilitada "Carregando categorias…" com spinner. Criar fica disponível (o 409 resolve a duplicata). |
| Erro ao carregar | Abaixo do campo, "Não foi possível carregar as categorias." e o terciário "Tentar novamente". Digitar oferece só `Criar categoria "<texto>"`: o 409 escolhe a ativa existente ou oferece reativar a inativa. |
| Sem categorias do tipo | "Nenhuma categoria de despesa ainda. Digite para criar." |
| Enviando o lançamento | Somente leitura, e a lista não abre (rev. 4). |

### 4.5 Cartão no drawer (RF12, CA15, CA16)

- O select de Cartão lista **só cartões ativos**. Se todos estiverem inativos, vale o estado "Nenhum cartão cadastrado." da 3.9.1, com o texto "Nenhum cartão ativo." e o mesmo botão "+ Novo cartão".
- 422 `CARD_INACTIVE` ao salvar: erro no campo Cartão, "Este cartão foi inativado. Escolha outro.", e a lista de cartões é recarregada.
- Painel "+ Novo cartão": 409 com `existing.active = false` mostra no campo Nome "Já existe um cartão inativo com esse nome. Para usá-lo, reative-o em Cartões." O painel não sai do drawer (os dados do lançamento ficam intactos). Não há "Reativar e usar" no painel (PB3 recusado): reativar cartão continua só em `/cards`.

---

## 5. Cartões (`/cards`, RF12, RF13, P05, CA15, CA16)

### 5.1 Hierarquia

1. "Cartões" + "Novo cartão".
2. Ajuda atual + opção "Mostrar inativos".
3. Cards ativos e, com a opção ligada, o grupo "Inativos (n)".

### 5.2 Layout por breakpoint

```
>= lg (a partir de xl, à direita do menu lateral)
+-----------------------------------------------------------------------------------+
| Cartões                                                         [ + Novo cartão ]  |
| Compras até o dia de fechamento entram na fatura ...                               |
| [x] Mostrar inativos                                                               |
| +--------------------------+ +--------------------------+ +----------------------+ |
| | Itaú Click               | | Nubank                   | | ...                  | |
| | Fecha dia 5 · Vence 12   | | Fecha dia 25 · Vence 5   | |                      | |
| | [Editar] [Inativar]      | | [Editar] [Inativar]      | |                      | |
| | Ver despesas do mês >    | | Ver despesas do mês >    | |                      | |
| +--------------------------+ +--------------------------+ +----------------------+ |
| Inativos (1)                                                                  h2   |
| +- - - - - - - - - - - - - + borda tracejada                                       |
| ' Cartão Antigo [ø Inativo]'  nome --text-muted                                    |
| ' Fecha dia 10 · Vence 20  '                                                       |
| ' [Editar] [Reativar]      '                                                       |
| ' Ver despesas do mês >    '                                                       |
| +- - - - - - - - - - - - - +                                                       |
+-----------------------------------------------------------------------------------+

< md (360px)
+----------------------------------+
| Cartões                          |
| [ + Novo cartão            ]     |
| Compras até o dia de ...         |
| [x] Mostrar inativos             |
| +------------------------------+ |
| | Nubank                       | |
| | Fecha dia 25 · Vence dia 5   | |
| | [Editar]  [Inativar]         | |
| | Ver despesas do mês >        | |
| +------------------------------+ |
| Inativos (1)                     |
| +- - - - - - - - - - - - - - - + |
| ' Cartão Antigo                ' |
| ' [ø Inativo]                  ' |
| ' Fecha dia 10 · Vence dia 20  ' |
| ' [Editar]  [Reativar]         ' |
| ' Ver despesas do mês >        ' |
| +- - - - - - - - - - - - - - - + |
+----------------------------------+
```

- A grade é a mesma (1, 2 ou 3 colunas). Com grupos (DB3), cada grupo tem `h2` ("Ativos (2)" só quando o grupo de inativos existe; sem ele, a lista fica como hoje, sem título de grupo) e os nomes dos cartões passam a `h3`.
- Ações do card ativo: "Editar" (secundário), "Inativar" (secundário) e "Ver despesas do mês" (terciário). Card inativo: "Editar" (P05), "Reativar" (secundário) e "Ver despesas do mês" (o histórico continua consultável).
- Nomes acessíveis: "Editar Nubank", "Inativar Nubank", "Reativar Cartão Antigo". Texto oculto do card inativo: "Cartão Antigo, inativo · Fecha dia 10 · Vence dia 20".
- URL: `/cards?inactive=1`.

### 5.3 Inativar cartão (confirmação, P01)

```
+----------------------------------------------+
| Inativar o cartão Nubank?                    |
|                                              |
| O cartão deixa de aparecer para novos        |
| lançamentos. O histórico e as faturas        |
| continuam, e faturas com pendências          |
| continuam podendo ser pagas na aba Faturas.  |
| Você pode reativá-lo depois.                 |
|                                              |
| [erro, se houver]                            |
|                  [Voltar] [Inativar cartão]  |
+----------------------------------------------+
```

- `AlertDialog` sem a linha de irreversível (DB7), com foco inicial em "Voltar", `Esc` cancela e o envio mostra "Inativando…".
- Sucesso: o diálogo fecha e sai o toast "Cartão "Nubank" inativado.". Com a opção desligada, o card some e o foco vai para o "Editar" do próximo card (ou do anterior; sem cards, para "Novo cartão"). Com a opção ligada, o card vai para "Inativos" e o foco vai para o "Reativar" dele.
- 404: o diálogo fecha, sai o toast "Este cartão não existe mais. A lista foi atualizada." e a lista é recarregada. Rede: erro inline acima dos botões, "Não foi possível inativar agora. Tente novamente."

### 5.4 Reativar cartão

Sem confirmação. "Reativando…" no botão. No sucesso, o card volta aos ativos, sai o toast "Cartão "Cartão Antigo" reativado." e o foco vai para o "Inativar" dele. Erros: os mesmos da 3.7.

### 5.5 Drawer "Novo cartão" / "Editar cartão" (RF13, P04, P05)

- 409 `CARD_NAME_TAKEN` com `existing.active = true`: mensagem atual, "Já existe um cartão com esse nome.".
- Com `existing.active = false`, **no criar**: "Já existe um cartão inativo com esse nome." e o secundário **"Reativar "<nome>""** abaixo da mensagem (CA16). No sucesso, o drawer fecha sem criar nada, sai o toast "Cartão "Nubank" reativado." e o foco vai para o card reativado (entre os ativos).
- Com `existing.active = false`, **no editar**: só a mensagem, sem botão.
- Editar um cartão inativo funciona como hoje. A ajuda da edição (DR2) não muda.

---

## 6. Cancelar e reativar lançamento (RF14-RF17, RF19, P01, P12, P13)

### 6.1 Regra de exibição das ações (`entryActions(entry, mode)`)

Uma função pura e testada decide o que cada linha mostra (ADR 9.5). Em `readOnly` (demo), todas as ações de escrita somem.

| Lançamento | Seleção (checkbox) | Ação principal | "Cancelar" | "Reativar" | Metadado na célula de ação |
|---|---|---|---|---|---|
| Despesa PIX `PENDING` | sim | "Pagar" / "Marcar como pago" | sim | - | - |
| Despesa CARD `PENDING` | sim | "Pagar" / "Marcar como pago" | sim | - | - |
| Despesa PIX `PAID` | desabilitado (P12, como hoje) | - | sim | - | "Pago em 24/10/2026" |
| Despesa CARD `PAID` | desabilitado | - | **não** (CA18) | - | "Pago em 24/10/2026" |
| Receita `RECEIVED` | não existe | - | sim | - | - |
| Qualquer `CANCELED` | **não existe** (nem desabilitado, CA23) | - | - | sim | "Cancelado em 29/10/2026 · estava paga" (ou "pendente" ou "recebida", de `statusBeforeCancel`) |

### 6.2 Aba Despesas: linhas e colunas

**Tabela (>= `md`)**

| Coluna | Mudança |
|---|---|
| Seleção | Vazia em cancelados (a célula existe, sem controle). "Selecionar todos os pendentes" ignora cancelados. |
| Descrição | Cancelado: descrição e segunda linha em `--text-muted`. |
| Valor | Cancelado: `--text-muted` + `line-through` + texto oculto "fora dos totais" (DB2, PB1 aprovado). |
| Status | Cancelado: `StateTag` "Cancelado" no lugar do `StatusBadge`. |
| Ação | 160px em `md`, com os dois botões **empilhados** (44px cada); 220px a partir de `lg`, em linha. "Pagar" ou "Marcar como pago" (secundário) + "Cancelar" (terciário, ícone de círculo cortado). PIX pago: "Pago em…" + "Cancelar". Cancelado: metadado + "Reativar" (secundário). |

```
>= lg
| [ ] Conserto        Alimentação · PIX   15/11/2026   200,00  (o) Pendente  [Marcar como pago] (ø) Cancelar |
|     Farmácia        Saúde · PIX         05/11/2026    80,00  (v) Pago      Pago em 05/11/2026  (ø) Cancelar |
|     Livro           Lazer · Nubank      03/11/2026    50,00  (v) Pago      Pago em 05/11/2026               |
|     Fone            Lazer · Nubank      02/11/2026  ~~300,00~~ [ø Cancelado] Cancelado em 29/10/2026 ·      |
|     (--text-muted)                                                          estava pendente  [Reativar]     |
```

**Cards (< `md`)**

```
+------------------------------------------+
| [ ]  Conserto                   Pendente |
|      Alimentação · 15/11/2026 · PIX      |
|                              R$ 200,00   |
| [   Marcar como pago   ]   (ø) Cancelar  |  secundário flexível + terciário 44px
+------------------------------------------+
+------------------------------------------+
|      Farmácia                       Pago |
|      Saúde · 05/11/2026 · PIX            |
|                               R$ 80,00   |
| Pago em 05/11/2026 às 09:00  (ø) Cancelar|
+------------------------------------------+
+- - - - - - - - - - - - - - - - - - - - - +  borda tracejada --border-strong
'      Fone                 [ø Cancelado]  '  texto --text-muted
'      Lazer · 02/11/2026 · Nubank         '
'                           ~~R$ 300,00~~  '
'      Cancelado em 29/10/2026 ·           '
'      estava pendente                     '
' [            Reativar                  ] '  secundário, largura total
+- - - - - - - - - - - - - - - - - - - - - +
```

Cancelado sem área de seleção: a coluna de 44px do checkbox fica vazia para manter o alinhamento das descrições.

### 6.3 Aba Receitas

- A tabela (>= `md`) ganha a coluna **Ação** (160px): "Cancelar" (terciário) em `RECEIVED`; metadado + "Reativar" em `CANCELED`. Na demo a coluna não existe (como hoje).
- Os cards (< `md`) ganham a linha de ação: "Cancelar" (terciário, alinhado à direita) ou metadado + "Reativar" (secundário, largura total).
- O selo, o estilo atenuado e o valor riscado são os da aba Despesas. Não há seleção.

### 6.4 Opção "Mostrar cancelados" (RF19, DB4, DB5, DB13)

```
>= md, aba Despesas
| Despesas de novembro de 2026                                    Atualizando…  |
| Status [Todos|Pendente|Pago]  Categoria [v]  Cartão [v]  Limpar filtros       |
| [x] Mostrar cancelados                                                         |
| Subtotal · todas as despesas do mês: 3 despesas exibidas (inclui canceladas)   |
|   Total R$ 150,00 · Pago R$ 100,00 · Pendente R$ 50,00                         |
|   Cancelados não entram no subtotal.                                           |

< md, aba Despesas
| Despesas de novembro de 2026     |
| [ Filtros (1) ]   [Limpar]       |
| [x] Mostrar cancelados           |  fora da folha, aplica ao mudar
| Subtotal ...                     |
```

- Posição: linha própria logo abaixo dos filtros, nas três abas. Na aba Faturas (que não tem filtros), fica abaixo da ajuda "Cada fatura aparece no mês em que vence."
- Mudar a opção navega (`canceled=1` entra ou sai da URL), volta à página 1, limpa a seleção e põe o painel em "Atualizando" (D11). Anúncio polite: "Mostrando 3 despesas de novembro de 2026, incluindo canceladas." ou "…sem canceladas.".
- Subtotal (D21): os valores nunca mudam (CA23, CA27). Com a opção ligada, a contagem vira "n despesas exibidas (inclui canceladas)" (ou "receitas"), porque a contagem vem do total paginado, e abaixo aparece "Cancelados não entram no subtotal." `--text-muted` 12.
- DB13: com a opção ligada e Status "Pendente" ou "Pago", aparece abaixo da opção a nota `--text-muted` 14 (`role="status"` ao surgir): "Com o status Pendente, os cancelados não aparecem. Escolha Status "Todos" para vê-los."
- A opção não conta em "Filtros (n)", e "Limpar filtros" não a desliga (DB4).

### 6.5 Aba Faturas (RF16, RF19, DR7, CA17, CA24)

- Totais, contagem ("Ver 2 despesas"), datas e "Pagar fatura" nunca consideram cancelados (vêm da API). Uma fatura só com cancelados some da aba (CA17). Se a aba fica sem faturas, vale o vazio atual.
- Lista expandida (somente leitura): com a opção ligada, os cancelados aparecem na ordem normal, com o `StateTag` na coluna Status, texto atenuado e valor riscado, **sem ações**. O rótulo do disclosure continua com a contagem de efetivas ("Ver 2 despesas"). Quando a lista mostra cancelados, uma linha de rodapé `--text-muted` diz "Inclui 1 despesa cancelada, fora do total da fatura." (contada no cliente sobre a lista carregada, só para exibição).
- Mudar a opção mantém os blocos como estão (expandidos ou recolhidos) e recarrega as listas já expandidas.
- Cartão inativo: o bloco da fatura aparece normalmente, com "Pagar fatura" (CA15). Não há selo no bloco (P06).

### 6.6 Confirmação de cancelamento (`CancelEntryDialog`, RF14, P01, DB6, DB7)

`AlertDialog` com foco inicial em "Voltar", `Esc` cancela, sem a linha de irreversível. O corpo começa sempre pela identificação: descrição, valor (`Money`), data e forma ("PIX" ou "Nubank · Fatura nov/26").

| Caso | Título | Texto |
|---|---|---|
| Despesa `PENDING` PIX | "Cancelar a despesa "Conserto"?" | "Ela sai dos totais do mês e não poderá ser paga. Continua no histórico (use "Mostrar cancelados") e pode ser reativada depois." |
| Despesa `PENDING` cartão | "Cancelar a despesa "Fone"?" | "Ela sai dos totais do mês e da fatura Nubank de nov/26 e não poderá ser paga. Continua no histórico e pode ser reativada depois, desde que a fatura não tenha pagamento." |
| Despesa PIX `PAID` | "Cancelar a despesa paga "Farmácia"?" | "Esta despesa foi paga em 05/11/2026. O valor sai dos totais do mês, inclusive do total pago. **Isto não é um estorno:** nenhum valor volta para você. Se reativá-la depois, ela volta como paga." |
| Receita `RECEIVED` | "Cancelar a receita "Freela"?" | "O valor sai dos totais do mês. **Isto não é um estorno:** nada é devolvido. Se reativá-la depois, ela volta como recebida." |

```
+----------------------------------------------+
| Cancelar a despesa paga "Farmácia"?          |
|                                              |
| R$ 80,00 · 05/11/2026 · PIX                  |  --text-muted
|                                              |
| Esta despesa foi paga em 05/11/2026. O valor |
| sai dos totais do mês, inclusive do total    |
| pago. Isto não é um estorno: nenhum valor    |
| volta para você. Se reativá-la depois, ela   |
| volta como paga.                             |
|                                              |
| [erro, se houver]                            |
|             [Voltar] [Cancelar lançamento]   |
+----------------------------------------------+
< sm: botões empilhados, primário em cima.
```

- O "Isto não é um estorno" fica em negrito (Inter 600), em `--text`. Peso e texto marcam o ponto sem depender de cor.
- O botão de confirmação é primário (não há variante de perigo no design system). Envio: "Cancelando…", e `Esc` é ignorado.

| Resposta | Comportamento |
|---|---|
| Sucesso (inclusive idempotente) | O diálogo fecha. Resumo, painel, faturas e dashboard são revalidados. Toast: "Despesa "Conserto" cancelada. Ela saiu dos totais do mês." ou "Receita "Freela" cancelada. Ela saiu dos totais do mês." Foco: com a opção desligada, a linha some e o foco vai para a primeira ação da próxima linha (ou da anterior; lista vazia, h2 do painel). Com a opção ligada, o foco vai para o "Reativar" da mesma linha. |
| 422 `ENTRY_NOT_CANCELABLE` (`CARD_INVOICE_PAID`, corrida) | O diálogo fecha, sai o toast de erro "Despesa de cartão já paga não pode ser cancelada, porque a fatura dela já foi paga. Nada foi alterado." e a lista é revalidada (a linha passa a "Pago", sem "Cancelar"). |
| 404 | O diálogo fecha, sai o toast "Este lançamento não foi encontrado. A lista foi atualizada." e a lista é revalidada. |
| 400, 5xx, rede | O diálogo fica aberto com o erro inline: "Não foi possível cancelar. Nada foi alterado. Tente novamente." |
| 401 | Feature A 8 (diálogo aberto). |

### 6.7 Reativar lançamento (RF15, CA19, CA20)

- Sem confirmação. O "Reativar" da linha entra em carregando ("Reativando…", `aria-busy`) e ignora novos acionamentos (Q2 do ADR).
- Sucesso: a linha volta ao estado anterior, com o selo e o atenuado removidos. Toast: "Despesa "Farmácia" reativada como paga.", "…como pendente." ou "Receita "Freela" reativada como recebida." Resumo, faturas e dashboard são revalidados. O foco vai para a primeira ação da linha reativada ("Marcar como pago" ou "Cancelar"). Se a linha deixa de aparecer (Status filtrado), o foco vai para o h2 do painel.
- **422 `INVOICE_HAS_PAYMENTS`** (DB8): banner persistente acima da lista (`role="alert"`, com fechar 44x44): ""Fone" não pode ser reativada porque a fatura Nubank de nov/26 já tem pagamento. Reativá-la reabriria uma fatura já paga." A linha continua cancelada e o foco fica no "Reativar". Um banner por vez: uma ação nova substitui o anterior, e trocar de mês, aba ou filtro o descarta.
- 422 `NOT_CANCELED` (lista desatualizada): toast informativo "Este lançamento já estava ativo. A lista foi atualizada." e revalidação.
- 404, rede, 401: como no cancelamento (toast; sem diálogo).

### 6.8 Pagamento com cancelado (RF17, CA21)

A UI não oferece pagar cancelados. Estes casos só ocorrem com a lista desatualizada:
- Individual, 422 `ENTRY_NOT_PAYABLE` com `canceledIds`: o diálogo fecha, sai o toast de erro "Este lançamento foi cancelado e não pode ser pago. A lista foi atualizada." e a lista é revalidada.
- Lote, 422 `ENTRIES_NOT_PAYABLE`: o banner da 3.10 do design de lançamentos ganha a variante "Nenhuma despesa foi alterada. Há lançamentos cancelados na seleção:" com as descrições. Se houver também receitas, as duas listas aparecem, cada uma com o seu título. A seleção é mantida sem os cancelados.

---

## 7. Filtros de categoria e cartão (RF09, P06, CA06, CA25)

| Filtro | Opções |
|---|---|
| Categoria (Despesas e Receitas) | "Todas as categorias", as ativas do tipo da aba e, num `<optgroup label="Inativas">`, as inativas **com lançamentos** (`inUse`), cada uma com o sufixo " (inativa)". Combobox com busca acima de 10 itens (como hoje), com o mesmo agrupamento e o selo "Inativa" na opção. |
| Cartão (Despesas) | "Todos", "PIX", separador, cartões ativos e, num `<optgroup label="Inativos">`, os inativos com o sufixo " (inativo)". |

- O valor na URL passa a ser o id (`categoryId` no lugar de `category`, ADR 9.5). Um id inexistente segue o padrão do cartão: "Categoria não encontrada" selecionada e vazio com "Remover filtro de categoria".
- Uma categoria inativa sem lançamentos não aparece no filtro (ela não teria resultado).
- Nas linhas de lançamento, o nome da categoria ou do cartão inativo aparece **sem** marcação (RF08, P06), sempre com o nome atual (CA04).
- O dashboard não muda visualmente. A categoria inativa aparece no donut e na tabela alternativa como qualquer outra (RF10). A chave estável do item passa a ser `categoryId` (ADR 9.7).

---

## 8. Modo demonstração (RF20, CA25)

| Tela | Na demo |
|---|---|
| `/demo/entries` | Sem "Cancelar" e sem "Reativar". A coluna Ação da aba Receitas não existe. Na aba Despesas, a coluna Ação continua só com os metadados ("Pago em…", "Cancelado em… · estava paga"). "Mostrar cancelados", os selos, o atenuado e os filtros com inativas funcionam. |
| `/demo/cards` | Sem "Novo cartão", "Editar", "Inativar" e "Reativar". "Mostrar inativos", o grupo "Inativos" e o selo funcionam. |
| `/demo/categories` | 3.8. Entra na navegação principal da demo (2). |
| `/demo/dashboard` | Sem mudança. |

- Nada é desabilitado e nenhum diálogo existe no DOM (DA7 da Feature A). Os vazios não têm CTA de escrita.
- O dataset demo (P08) garante que os estados com marcação existam na demo: categoria inativa com lançamentos, cartão inativo e cancelados (pendente, PIX pago e receita).

---

## 9. Estados por tela

| Tela ou bloco | Carregando | Erro | Vazio | Sucesso |
|---|---|---|---|---|
| `/categories` | `loading.tsx`: título e botão reais, abas reais, h2 e contagem em skeleton, 6 linhas de skeleton (contêiner a partir de `md`, itens abaixo). `aria-busy` + "Carregando categorias". | `BlockErrorBoundary` no painel: "Não foi possível carregar as categorias." + "Tentar novamente" (abas e cabeçalho utilizáveis). Erros de ação: 3.5-3.7. | Sem categorias do tipo: `EmptyState` "Nenhuma categoria de despesa" (ou "de receita"), com a descrição "Crie categorias para organizar seus lançamentos. Você também pode criá-las ao registrar um lançamento." e o botão "Nova categoria" (fora da demo). Só inativas, com a opção desligada: "Nenhuma categoria de despesa ativa", "Categorias inativas aparecem com "Mostrar inativas"." e "Nova categoria". Com a opção ligada e sem inativas, o grupo "Inativas" não é renderizado. | Toasts (3.5-3.7), destaque da linha nova, foco por ação. |
| Troca de aba ou da opção em `/categories` | "Atualizando" (D11) no painel; skeleton só na primeira visita da aba | idem | idem | - |
| `/cards` | Atual (3 cards skeleton) | Atual | Sem cartões: vazio atual. Só inativos com a opção desligada: "Nenhum cartão ativo", "Cartões inativos aparecem com "Mostrar inativos"." e "Novo cartão". | Toasts (5.3-5.5) |
| Abas Despesas e Receitas com "Mostrar cancelados" | "Atualizando" ao mudar a opção | Atual | Com a opção ligada: textos atuais. Com a opção desligada: o vazio atual ganha a linha `--text-muted` "Lançamentos cancelados ficam ocultos. Use "Mostrar cancelados" para vê-los.", sempre (sem consultar se existem cancelados no mês). | Toasts (6.6, 6.7) |
| Aba Faturas | Atual | Atual | Atual (fatura só de cancelados some) | - |
| Campo Categoria do drawer | 4.4 | 4.4 | 4.4 | "Categoria … criada e selecionada." |
| Diálogos novos | Botão primário em carregando, campo `readOnly` | Inline acima dos botões ou no campo | - | Fecham e revalidam |
| Linhas em ação direta (inativar categoria, reativar) | Botão em carregando, outros botões da linha inertes | Toast ou banner (DB8) | - | Toast e foco definido |
| `/demo/*` | Skeletons atuais, `DemoBanner` desde o primeiro quadro | `error.tsx` atual | Não deve ocorrer (seed). Se ocorrer, vazios sem CTA | - |
| Navegação principal (item "Categorias") | Feature A 17.11 | Feature A 17.11 | - | - |

Após qualquer mutação desta feature, nenhuma região mostra número antigo. Revalidação por ação: categoria (`/categories`, `/entries`, `/dashboard`), cartão (`/cards`, `/entries`), lançamento (`/entries` com resumo, painel e faturas, e `/dashboard`).

---

## 10. Componentes

### 10.1 Existentes reaproveitados

| Componente | Arquivo | Uso | Mudança |
|---|---|---|---|
| `Tabs` | `components/ui/tabs.tsx` | Abas Despesas e Receitas da tela de categorias | Nenhuma |
| `Checkbox` | `components/ui/checkbox.tsx` | Base do `VisibilityToggle` | Nenhuma |
| `AlertDialog` | `components/ui/dialogs.tsx` | Cancelar lançamento, inativar cartão | Usa a prop opcional da linha de irreversível (Feature A 10.1). `cancelLabel="Voltar"` (já existe a prop) |
| `ModalDialog` | `components/ui/modal-dialog.tsx` | `CategoryFormDialog` | Nenhuma |
| `TextField`, `FieldShell` | `components/ui/fields.tsx` | Nome da categoria | Nenhuma (aceita `counter`) |
| `SelectField` | `components/ui/fields.tsx` | Filtros de categoria e cartão | Aceita `<optgroup>` nos filhos (sem mudança esperada) |
| `CategoryCombobox` | `components/ui/combobox.tsx` | Campo Categoria do drawer | **Alterado** (4): valor por id, opções tipadas (categoria, criar, reativar e usar), estado ocupado, linha de status, seleção por chave no blur |
| `StatusBadge`, `Icon` | `components/ui/status.tsx` | Coluna Status, item "Categorias" da navegação | **Alterado**: `CANCELED` renderiza o `StateTag` "Cancelado". O `Icon` ganha o círculo cortado (se a Feature A ainda não o tiver incluído) e a etiqueta (se ainda não existir, Feature A 17.12) |
| `InlineAlert`, `EmptyState`, `Skeleton`, `BlockErrorBoundary` | `components/ui/states.tsx`, `block-error-boundary.tsx` | Banners, vazios, carregando | Nenhuma |
| `Toast` | `components/ui/toast.tsx` | Sucessos e erros | Nenhuma |
| `MainNav` | `components/main-nav.tsx` | Menu lateral e drawer de navegação (Feature A 17) | **Alterado**: item novo "Categorias" com ícone de etiqueta. `AppHeader` não muda |
| `WriteOnly` | Feature A | Todas as ações novas | Nenhuma |
| `ExpenseFilters`, filtro de categoria de Receitas, `CardFilter` | `features/entries/*` | Filtros | **Alterado**: `categoryId`, `optgroup` de inativas, sufixos (7) |
| `ExpensesTable`/`ExpenseCard`, `IncomeTable`/`IncomeCard`, `InvoiceExpenseList` | `features/entries/*` | Linhas | **Alterado**: estilo cancelado, ações por `entryActions`, coluna Ação em Receitas |
| `TabSubtotal` | `features/entries/*` | Subtotal | **Alterado**: contagem "exibidas (inclui canceladas)" e nota (6.4) |
| `BatchErrorAlert` | `features/entries/*` | 422 de lote | **Alterado**: variante de cancelados (6.8) |
| `CardsList`/`CardItem`, `CardDrawer`, `CardFields` | `features/cards/*` | `/cards` | **Alterado**: grupos, ações Inativar e Reativar, 409 com reativar (5) |
| `NewEntryDrawer`, `InlineNewCardPanel` | `features/entries/*` | Drawer | **Alterado**: só cartões ativos, erros novos (4.3, 4.5) |
| `CategoryDonut` | `features/dashboard/*` | Donut | **Alterado** só na chave (`categoryId`) |

### 10.2 Novos

| Componente | Local sugerido | Tipo | Responsabilidade |
|---|---|---|---|
| `StateTag` | `components/ui/state-tag.tsx` | server | Selo "Cancelado", "Inativo" ou "Inativa" (DB1) |
| `VisibilityToggle` | `components/visibility-toggle.tsx` | client | Checkbox-opção ligado a um query param (`canceled`, `inactive`), com navegação, anúncio e nota opcional (DB4, DB13) |
| `CategoriesScreen` | `features/categories/categories-screen.tsx` | server | Cabeçalho, ajuda, abas, painel; recebe `AppMode` e `FinanceReader` |
| `CategoryList` | `features/categories/category-list.tsx` | server + client | Grupos, linhas, ações por linha, foco pós-ação (3.3, 3.4, 3.7) |
| `CategoryFormDialog` | `features/categories/category-form-dialog.tsx` | client | Criar e renomear, 409 com "Reativar" (3.5, 3.6) |
| `CancelEntryDialog` | `features/entries/cancel-entry-dialog.tsx` | client | Composição do `AlertDialog` com textos por caso (6.6) |
| `ReactivateEntryButton` | `features/entries/reactivate-entry-button.tsx` | client | Ação direta, carregando, toast e banner de recusa (6.7) |
| `ReactivationErrorAlert` | `features/entries/reactivation-error-alert.tsx` | client | Banner persistente de `INVOICE_HAS_PAYMENTS` (DB8) |
| `InactivateCardDialog` | `features/cards/inactivate-card-dialog.tsx` | client | Confirmação de inativar cartão (5.3) |
| `entryActions` | `features/entries/entry-actions.ts` | função pura | Tabela 6.1 |

---

## 11. Fluxos de interação

### 11.1 Criar e inativar categoria (CA01, CA03, CA06)
1. Ana abre "Categorias" pelo menu lateral (ou pelo drawer de navegação, abaixo de `xl`): aba Despesas, sem categorias, com o vazio e "Nova categoria".
2. Ativa "Nova categoria": modal "Nova categoria de despesa" com foco em Nome. Digita "  Alimentação  " e cria. A linha "Alimentação" aparece com o destaque, sai o toast e o foco vai para a linha.
3. Cria "viagem" com a inativa "Viagem" já existente: "Já existe uma categoria de despesa inativa com este nome." e "Reativar "Viagem"". Ativa o botão: o modal fecha, sai o toast "Categoria "Viagem" reativada." e o foco vai para "Viagem".
4. Ativa "Inativar" em "Academia": a linha some, sai o toast e o foco vai para a próxima linha. Liga "Mostrar inativas": "Academia" aparece em "Inativas (1)" com o selo e "Reativar".

### 11.2 Renomear (CA04, CA05)
1. "Renomear" em "Mercado": modal com o nome selecionado. Digita "Supermercado" e salva: toast, a lista reordena e o foco volta para o "Renomear" de "Supermercado".
2. Em `/entries` de agosto a outubro, as linhas, a lista da fatura e o donut mostram "Supermercado".
3. Renomear "Casa" para "moradia": erro inline de nome existente, e nada muda.

### 11.3 Categoria no drawer (CA09-CA11)
1. Drawer com Despesa: a lista mostra "Alimentação" e "Moradia".
2. Escolhe "Moradia" e troca para Receita: o campo é limpo, aparece "Categoria limpa: escolha uma categoria de receita." e a lista mostra "Salário".
3. Volta para Despesa e digita "Pets": a última opção é `Criar categoria "Pets"`. `Enter`: spinner, depois "Categoria "Pets" criada e selecionada.". Salva o lançamento (CA10).
4. Digita "viagem": aparece só `Reativar e usar "Viagem"` com o selo "Inativa". Escolhe: "Categoria "Viagem" reativada e selecionada.".
5. Digita "ALIMENTAÇÃO" e sai do campo com `Tab`: "Alimentação" é escolhida sem criar nada.

### 11.4 Inativar e reativar cartão (CA15, CA16)
1. Em `/cards`, "Inativar" em "Nubank": diálogo com os efeitos, foco em "Voltar". Confirma: toast, o card some e o foco vai para o próximo card.
2. No drawer "Novo lançamento" com Cartão, "Nubank" não aparece. Na aba Faturas de nov/26, o bloco Nubank continua com "Pagar fatura" e pode ser pago.
3. Em `/cards`, "Novo cartão" com o nome "nubank": "Já existe um cartão inativo com esse nome." e "Reativar "Nubank"".
4. Liga "Mostrar inativos": "Nubank" aparece em "Inativos (1)" com a borda tracejada e o selo. "Reativar": volta aos ativos, e o foco vai para "Inativar".

### 11.5 Cancelar pendente, pago e recebido (CA17, CA18, CA27)
1. Na aba Despesas de nov/26, "Cancelar" em "Conserto" (PIX pendente): diálogo "Cancelar a despesa "Conserto"?", foco em "Voltar". "Cancelar lançamento": "Cancelando…", toast, a linha some, e o resumo e o subtotal caem R$ 200,00.
2. "Cancelar" em "Farmácia" (PIX paga): o diálogo traz "Isto não é um estorno" e "volta como paga". Confirma.
3. "Livro" (cartão pago) não tem "Cancelar", só "Pago em…".
4. Na aba Receitas, "Cancelar" em "Freela": o diálogo traz o texto de receita. Confirma, e o subtotal fica em R$ 5.000,00.
5. Liga "Mostrar cancelados": "Freela" aparece com o selo "Cancelado", o valor riscado e "Reativar". O subtotal continua R$ 5.000,00, com a nota.

### 11.6 Reativar e recusa (CA19, CA20, CA23)
1. Com "Mostrar cancelados" ligado na aba Despesas, "Reativar" em "Farmácia": toast "Despesa "Farmácia" reativada como paga.", e a linha volta a "Pago em 05/11/2026".
2. "Reativar" em "Fone", cuja fatura tem outra despesa paga: banner ""Fone" não pode ser reativada porque a fatura Nubank de nov/26 já tem pagamento…". A linha continua cancelada e o foco fica no botão.
3. Desliga a opção: a lista volta a mostrar só as efetivas, e o banner é descartado.

### 11.7 Visitante na demo (CA25)
1. `/demo/entries`: liga "Mostrar cancelados" e vê os cancelados com selo, sem "Reativar" nem "Cancelar".
2. Filtra por "Academia (inativa)" no filtro de categoria e vê as despesas antigas.
3. `/demo/cards` com "Mostrar inativos": "Cartão Antigo" com o selo, sem ações de escrita. `/demo/categories` (pelo item "Categorias" da navegação da demo): abas e "Mostrar inativas", sem ações.

---

## 12. Responsividade (resumo, 360 e 1280)

| Elemento | < `sm` (360) | `sm` a `md` | >= `md` | >= `lg` (1280) |
|---|---|---|---|---|
| Navegação principal (depende da Feature A 17) | "Categorias" como 4º item do drawer | idem | idem | drawer até 1279px; 4º item do menu lateral fixo a partir de `xl` |
| Tela de categorias | itens empilhados, ações em linha 2, "Nova categoria" com largura total | ações ao lado do nome quando couberem | contêiner de até 720px, linhas de 56px | idem |
| Abas da tela de categorias | segmented de 2 colunas | idem | sublinhadas | idem |
| Modal de categoria e `AlertDialog`s | largura total menos 32px, botões empilhados (primário em cima) | até 480px, botões em linha à direita | idem | idem |
| Cards de `/cards` | 1 coluna, grupos com `h2` | 1 coluna | 2 colunas | 3 colunas |
| Linha de despesa com "Cancelar" | card com botão secundário flexível + terciário | idem | tabela, ações empilhadas (160px) | ações em linha (220px) |
| Receitas, coluna Ação | linha de ação no card | idem | coluna de 160px | idem |
| "Mostrar cancelados" | linha própria, fora da folha de filtros | idem | abaixo dos filtros | idem |
| Combobox de categoria | drawer em tela cheia; lista de até 224px | idem | drawer de 480px | idem |

Zoom de 200% e 320px de largura: nenhum selo é truncado (ele quebra para a linha de baixo), os nomes de categoria quebram linha, e as ações por linha quebram (`flex-wrap`). Não há rolagem horizontal.

---

## 13. Acessibilidade (checklist, RNF07, CA26)

- [ ] Selos com texto real no DOM ("Cancelado", "Inativo", "Inativa"), lidos pelo leitor de tela junto do item. O ícone é `aria-hidden`. A borda tracejada e o texto distinguem o item sem cor (DB1).
- [ ] Atenuado sem opacidade: `--text-muted` (AA validado) e valor riscado com texto oculto "fora dos totais" (DB2). Em `forced-colors`, o selo mantém borda e texto, e o card inativo mantém a borda tracejada.
- [ ] Opções "Mostrar …" como `<input type="checkbox">` com `<label>` e alvo de 44px. A mudança é anunciada por `aria-live="polite"` com a contagem e o contexto. A nota de DB13 é `role="status"`.
- [ ] Combobox: ARIA 1.2 da rev. 4; as opções finais ("Criar…", "Reativar e usar…") são `role="option"` com nome completo ("Reativar e usar Viagem, inativa"). Estado ocupado com `aria-busy` no input e anúncio polite. A linha de resultado é `role="status"`, e os erros usam `aria-describedby` + `aria-invalid`.
- [ ] Limpeza do campo ao trocar o tipo anunciada (`role="status"`), sem mover o foco.
- [ ] Abas da tela de categorias com o `Tabs` (tablist, ativação manual, tabindex móvel), painel com `h2` visível.
- [ ] Listas de categorias e cartões: `<ul>`/`<li>`, títulos de grupo como cabeçalho (`h2` ou `h3`) e contagem no texto do título.
- [ ] Nomes acessíveis das ações incluem o item ("Cancelar Conserto", "Reativar Fone", "Inativar Nubank", "Renomear Academia"), começando pelo texto visível.
- [ ] Diálogos: `role="alertdialog"` (cancelar, inativar cartão) e `role="dialog"` (criar, renomear), rotulados e descritos, foco inicial definido ("Voltar" nos alertas, campo nos formulários), retorno do foco conforme cada seção. `Esc` é ignorado durante o envio.
- [ ] Foco nunca se perde quando um item some da lista (3.7, 5.3, 6.6). O destino é sempre um elemento existente.
- [ ] Banner de recusa de reativação com `role="alert"`, persistente e com fechar 44x44.
- [ ] Tabelas: o `<caption>` oculto da aba Despesas ou Receitas ganha ", incluindo canceladas" quando a opção está ligada.
- [ ] Item "Categorias" da navegação com `aria-current="page"` em `/categories` e `/demo/categories` (Feature A 17.14).
- [ ] Contraste: só pares já validados (seção 1). axe sem violações em 360px e 1280px, claro e escuro, nos estados do CA26: tela de categorias vazia, com dados, com inativas e com erro inline; combobox com "Criar" e com "Reativar e usar"; Despesas e Receitas com cancelados; `/cards` com inativos; os três textos do diálogo de cancelamento e o de inativar cartão.
- [ ] Nenhum elemento de escrita no DOM da demo.

---

## 14. Microcopy

| Onde | Texto |
|---|---|
| Navegação | "Categorias" (item do menu lateral e do drawer) · login: "Entre para continuar em Categorias." |
| Tela de categorias | "Categorias" · "Nova categoria" · "Cada categoria vale para um tipo de lançamento. Renomear muda o nome em todos os lançamentos, inclusive nos antigos." · abas "Despesas", "Receitas" · "Categorias de despesa" / "Categorias de receita" · "{n} ativas · {m} inativa(s)" · "Mostrar inativas" · "Inativas ({n})" · selo "Inativa" · "Renomear" · "Inativar" · "Reativar" · "Inativando…" · "Reativando…" |
| Modal de categoria | "Nova categoria de despesa" / "Nova categoria de receita" · "Renomear "{nome}"" · "Nome" · "Até 50 caracteres." · "O novo nome aparece em todos os lançamentos, inclusive nos antigos." · "Criar categoria" · "Criando…" · "Salvar" · "Salvando…" · "Cancelar" · "Reativar "{nome}"" |
| Erros de nome | "Informe o nome." · "Use até 50 caracteres." · "Já existe uma categoria de {despesa\|receita} com este nome." · "Já existe uma categoria de {despesa\|receita} inativa com este nome." |
| Toasts de categoria | "Categoria "{nome}" criada." · "Categoria renomeada para "{nome}"." · "Nenhuma alteração." · "Categoria "{nome}" inativada. Ela não aparece mais em novos lançamentos, e os lançamentos antigos continuam com ela." · "Categoria "{nome}" reativada." · "Categoria não encontrada. A lista foi atualizada." |
| Vazios de categoria | "Nenhuma categoria de {despesa\|receita}" · "Crie categorias para organizar seus lançamentos. Você também pode criá-las ao registrar um lançamento." · "Nenhuma categoria de {despesa\|receita} ativa" · "Categorias inativas aparecem com "Mostrar inativas"." · "Não foi possível carregar as categorias." · "Tentar novamente" |
| Campo Categoria | "Selecione ou digite uma nova" · "Criar categoria "{texto}"" · "Reativar e usar "{nome}"" · "Nenhuma categoria de {despesa\|receita} ainda. Digite para criar." · "Carregando categorias…" · "Categoria "{nome}" criada e selecionada." · "Categoria "{nome}" reativada e selecionada." · "A categoria "{nome}" já existia e foi selecionada." · "Categoria limpa: escolha uma categoria de {despesa\|receita}." · "Informe a categoria." · "A categoria deve ter no máximo 50 caracteres." · "Escolha uma categoria da lista ou crie uma nova." · "Esta categoria não existe mais. Escolha outra." · "Esta categoria foi inativada. Escolha outra ou digite o nome para reativá-la." · "Esta categoria não é do tipo do lançamento. Escolha outra." · "Já existe uma categoria inativa com este nome." · "Não foi possível criar a categoria. Tente novamente." · "Não foi possível reativar a categoria. Tente novamente." |
| Cartões | "Mostrar inativos" · "Inativos ({n})" · selo "Inativo" · "Inativar" · "Reativar" · "Inativar o cartão {nome}?" · "O cartão deixa de aparecer para novos lançamentos. O histórico e as faturas continuam, e faturas com pendências continuam podendo ser pagas na aba Faturas. Você pode reativá-lo depois." · "Voltar" · "Inativar cartão" · "Inativando…" · "Cartão "{nome}" inativado." · "Cartão "{nome}" reativado." · "Já existe um cartão inativo com esse nome." · "Reativar "{nome}"" · "Nenhum cartão ativo" · "Cartões inativos aparecem com "Mostrar inativos"." · drawer: "Este cartão foi inativado. Escolha outro." · painel: "Já existe um cartão inativo com esse nome. Para usá-lo, reative-o em Cartões." |
| Lançamentos | "Cancelar" · "Reativar" · selo "Cancelado" · "Cancelado em {data} · estava {paga\|pendente\|recebida}" · "Mostrar cancelados" · "{n} despesas exibidas (inclui canceladas)" · "Cancelados não entram no subtotal." · "Com o status {Pendente\|Pago}, os cancelados não aparecem. Escolha Status "Todos" para vê-los." · "Lançamentos cancelados ficam ocultos. Use "Mostrar cancelados" para vê-los." · Faturas: "Inclui {n} despesa(s) cancelada(s), fora do total da fatura." |
| Diálogo de cancelamento | títulos e textos da 6.6 · "Voltar" · "Cancelar lançamento" · "Cancelando…" · "Não foi possível cancelar. Nada foi alterado. Tente novamente." |
| Toasts de lançamento | "Despesa "{d}" cancelada. Ela saiu dos totais do mês." · "Receita "{d}" cancelada. Ela saiu dos totais do mês." · "Despesa "{d}" reativada como {paga\|pendente}." · "Receita "{d}" reativada como recebida." · "Despesa de cartão já paga não pode ser cancelada, porque a fatura dela já foi paga. Nada foi alterado." · "Este lançamento não foi encontrado. A lista foi atualizada." · "Este lançamento já estava ativo. A lista foi atualizada." · "Este lançamento foi cancelado e não pode ser pago. A lista foi atualizada." |
| Banners | ""{d}" não pode ser reativada porque a fatura {cartão} de {mmm/aa} já tem pagamento. Reativá-la reabriria uma fatura já paga." · "Nenhuma despesa foi alterada. Há lançamentos cancelados na seleção:" |
| Texto oculto | "fora dos totais" · "Fatura de {mês por extenso}" (atual) |

As mensagens de erro com código conhecido são mapeadas por `code` e `details.reason` (`lib/api/action-result.ts`, ADR 9.3), não pelo texto da API. Para código desconhecido, vale a `message` da resposta.

---

## 15. Rastreabilidade (CA para seção)

| CA | Seção |
|---|---|
| CA01 | 3.3, 3.5, 11.1 |
| CA02 | 3.2, 3.3 (abas independentes por tipo), 3.5 |
| CA03 | 3.5, 11.1 |
| CA04 | 3.6, 7, 11.2 |
| CA05 | 3.6, 11.2 |
| CA06 | 3.7, 4.1, 7, 11.1 |
| CA07 | 3.7 |
| CA08 | 3.6, 3.7 (404 como "não encontrada"); restante é API |
| CA09 | 4.1, 11.3 |
| CA10 | 4.1, 4.2, 11.3 |
| CA11 | 4.1 (DB10), 4.2, 11.3 |
| CA12 | 4.3 (mensagens dos 422 e precedência do 400) |
| CA13, CA14 | API (sem UI) |
| CA15 | 4.5, 5.3, 6.5, 11.4 |
| CA16 | 5.2, 5.4, 5.5, 11.4 |
| CA17 | 6.4, 6.5, 6.6, 11.5 |
| CA18 | 6.1, 6.6, 11.5 |
| CA19 | 6.7, 11.6 |
| CA20 | 6.7 (DB8), 11.6 |
| CA21 | 6.8 |
| CA22 | API (a UI trata os 422 resultantes em 6.6 e 6.8) |
| CA23 | 6.1, 6.2, 6.4, 11.6 |
| CA24 | 6.5 |
| CA25 | 2, 3.8, 8, 11.7 |
| CA26 | 1, 9, 12, 13 |
| CA27 | 6.3, 6.4, 11.5 |

---

## 16. Pontos para aprovação

Decididos pelo usuário (2026-10-29):

- **PB1 - Valor riscado nos cancelados: aprovado.** Além do selo "Cancelado" e do texto em `--text-muted`, o valor do lançamento cancelado aparece riscado (`line-through`), com o texto oculto "fora dos totais" (DB2).
- **PB2 - Grupos "Inativas" e "Inativos" em categorias e cartões: aprovado** (DB3), junto com a PA8 da Feature A.
- **PB3 - "Reativar e usar" no painel "+ Novo cartão" do drawer: recusado.** O painel só avisa: "Já existe um cartão inativo com esse nome. Para usá-lo, reative-o em Cartões." (4.5). Reativar cartão continua só em `/cards`.

Pendente: a entrada "Categorias" na navegação (seção 2 e linha "Navegação principal" da seção 12) depende do layout global da Feature A (seção 17, pontos PL1-PL3). Não há ponto de aprovação próprio desta feature.
