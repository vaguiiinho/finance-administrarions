# Spec: Autenticação, autorização, gestão de usuários e modo demonstração

**Impacto em UI: sim.** Telas novas (entrar, trocar senha, meu perfil e gestão de usuários), navbar com botão "Entrar" ou menu da conta (avatar com inicial e menu suspenso no estilo do Chrome), rotas de demonstração somente leitura com aviso, e estados somente leitura nas telas existentes. O ui-designer entra no fluxo.

- Data: 2026-10-28 (rev. 2: 2026-10-29, decisões B1-B5 aplicadas)
- Branch: `feat/auth-authorized`
- Referências: `docs/specs/lancamentos-financeiros.md` (rev. 3), `docs/adr/0001-lancamentos-financeiros.md` (§9.2, estratégia de dados), `docs/adr/0005-autenticacao-autorizacao-demo.md`, `docs/design/autenticacao-autorizacao.md`, `docs/api/finance.md`, `docs/design/design-system.md`.
- Feature relacionada: `docs/specs/categorias-inativacao.md` (Feature B: categoria como entidade, inativação de cartão e cancelamento de lançamento). Depende desta.

### Histórico de revisões

- **rev. 2 (2026-10-29):** cadastro público removido (`/register` e tudo ligado a ele); entra a entidade Usuário com níveis `ADMIN` e `USER` e gestão de usuários feita só por administrador; primeiro administrador vem de variáveis de ambiente, com troca obrigatória de senha; dados existentes passam a pertencer a ele; telas "Trocar senha" e "Meu perfil"; demo só de visualização (sem botões de escrita e sem convite); sessão de 24 h; API não exposta publicamente. B1-B5 decididas.
- **rev. 1 (2026-10-28):** versão inicial.

## 1. Contexto

Hoje a aplicação é monousuário e não tem autenticação (`docs/api/finance.md`: "Não há autenticação"). Os pontos do código que importam para esta feature:

- **api** (`api/src/modules/finance`): existe só o contexto `finance`. As tabelas `cards` e `entries` não têm dono. O nome do cartão é único no banco inteiro (`cards_name_key_uq` em `name_key`). A grafia canônica da categoria vale para o banco inteiro: `PrismaCategoryCatalog.findByKey` busca o primeiro uso em `entries`, sem filtro. Todos os read models (despesas, receitas, categorias, cartões, faturas, resumo, dashboard) agregam sobre a tabela inteira.
- **Operações que existem hoje:**
  - lançamentos: criar, listar receitas e despesas, pagar uma, pagar em lote;
  - cartões: criar, listar, editar (PUT);
  - faturas: listar, ver despesas, pagar;
  - categorias: só listagem. São derivadas dos lançamentos e não existe tabela nem CRUD de categoria;
  - resumo e dashboard.
  - A edição administrativa de despesas foi incluída posteriormente (ver `docs/api/finance.md`); a API continua isolando os dados pelo proprietário autenticado. Exclusão de lançamento e de cartão não existe. Categoria como entidade, inativação de cartão e cancelamento de lançamento ficam para a Feature B (`docs/specs/categorias-inativacao.md`).
- **web** (`web/app/(app)/`): telas `/entries`, `/dashboard` e `/cards` dentro do grupo `(app)`, e `/` redireciona para `/entries`. O navegador nunca chama a API. Leituras são feitas por RSC e mutações por Server Actions (`entries/actions.ts`, `cards/actions.ts`) via `web/lib/api/http.ts`, que roda só no servidor (`API_URL`), ou seja, um BFF. A navbar fica em `web/components/app-header.tsx`: marca, `MainNav` e `ThemeToggle`.
- **Deploy:** o workflow (`.github/workflows/deploy.yml`) e o `web/Dockerfile` ainda injetam `NEXT_PUBLIC_API_URL` no web, o que sugere uma API acessível pelo navegador e contradiz o BFF (ADR 0001 §9.2, ADR 0005 D11).

O pedido, já com as decisões do usuário:
1. Só usuário autenticado cria, lista e altera os próprios lançamentos, cartões e categorias, dentro das operações que existem hoje.
2. Não há cadastro público. Contas são criadas e geridas por um administrador. O primeiro administrador vem da configuração do primeiro deploy.
3. Quem não está logado só lê dados de exemplo, sem nenhum botão de escrita.
4. Rotas públicas e rotas protegidas ficam separadas.
5. A navbar mostra "Entrar" para quem não está logado e, para quem está, um avatar redondo com a inicial do nome e um menu suspenso, no estilo do Chrome.

## 2. Linguagem ubíqua

| Termo | Definição |
|---|---|
| **Usuário** | Pessoa com conta: nome, e-mail (único, sem diferenciar maiúsculas de minúsculas), senha, nível e situação. Identificado por UUID v7. Só é criado por um administrador (ou pela inicialização do primeiro administrador). |
| **Nível** | Papel do usuário no sistema: `ADMIN` (administrador) ou `USER` (usuário comum). Não altera o acesso a dados financeiros: os dois níveis só veem os próprios dados. |
| **Administrador (ADMIN)** | Usuário que, além de usar o próprio financeiro, gerencia contas: cria, edita, inativa, reativa e redefine a senha de usuários. Não vê dados financeiros de outros usuários. |
| **Usuário comum (USER)** | Usuário sem acesso à gestão de usuários. |
| **Situação** | `ATIVO` ou `INATIVO`. Usuário inativo não consegue entrar e não tem sessões abertas. Os dados dele são mantidos. |
| **Inativar / Reativar** | Mudar a situação para `INATIVO` / `ATIVO`. Não há exclusão de usuário. |
| **Último administrador ativo** | O único usuário com nível `ADMIN` e situação `ATIVO` no momento. Não pode ser inativado nem rebaixado. |
| **Primeiro administrador** | Administrador criado automaticamente no primeiro deploy a partir de `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Recebe todos os dados financeiros que já existiam no banco. |
| **Senha temporária** | Senha definida pelo administrador ao criar o usuário ou ao redefinir a senha dele (ou vinda de `ADMIN_PASSWORD`, no primeiro administrador). Vale só até a troca obrigatória. |
| **Troca obrigatória de senha** | Estado do usuário que entrou com senha temporária. Enquanto não trocar a senha, ele só acessa a tela "Trocar senha" e "Sair". |
| **Redefinir senha** | Ação do administrador que define uma nova senha temporária para um usuário, liga a troca obrigatória e encerra todas as sessões dele. |
| **Trocar senha** | Ação do próprio usuário: informa a senha atual e a nova. É obrigatória após senha temporária e opcional depois. |
| **Meu perfil** | Tela em que o próprio usuário altera o nome. E-mail e nível só são alterados pelo administrador. |
| **Gestão de usuários** | Área restrita a administradores para listar, criar, editar, inativar, reativar e redefinir a senha de usuários. |
| **Visitante** | Quem acessa sem sessão válida. Só vê o modo demonstração e a tela de entrar. |
| **Login (entrar)** | Troca de e-mail e senha válidos de um usuário ativo por uma sessão. |
| **Sessão** | Estado autenticado de um navegador. Dura 24 horas a partir do login, sem renovação, e é representada por um cookie httpOnly. Pode ser encerrada antes por logout, inativação ou redefinição de senha. |
| **Logout (sair)** | Encerramento da sessão do navegador atual. |
| **Dono (owner)** | O usuário a quem pertence um cartão ou um lançamento (`userId`). Todo dado financeiro tem exatamente um dono. |
| **Isolamento por dono** | Regra pela qual um usuário só enxerga, altera e agrega dados de que é dono, qualquer que seja o nível. Recurso de outro dono é tratado como inexistente (404). |
| **Catálogo de categorias do usuário** | Conjunto das categorias já usadas nos lançamentos de um usuário. A grafia canônica (primeiro uso) é definida por usuário. |
| **Modo demonstração (demo)** | Conjunto de rotas públicas, somente de visualização, que exibem dados de exemplo de um usuário demo. |
| **Usuário demo** | Usuário reservado do sistema, dono dos dados de exemplo. Não aceita login, não aparece na gestão de usuários e não é alterável por nenhuma rota. |
| **Dados de exemplo (seed demo)** | Cartões e lançamentos fictícios do usuário demo, com datas relativas ao mês atual, para que lista, faturas, resumo e dashboard tenham conteúdo. |
| **Rota pública** | Rota acessível sem sessão: `/demo/*`, `/login` e as rotas de autenticação da API (login). |
| **Rota protegida** | Rota que exige sessão: `/entries`, `/dashboard`, `/cards`, `/account`, `/account/password`, `/admin/users` e todas as rotas de dados da API, exceto as de demo. |
| **Rota de administrador** | Rota protegida que, além da sessão, exige nível `ADMIN`: `/admin/users` e as rotas de gestão de usuários da API. |
| **Menu da conta** | Botão redondo na navbar com a inicial do nome do usuário. Abre um menu suspenso com nome, e-mail, "Meu perfil", "Trocar senha", "Usuários" (só administrador) e "Sair". |
| **Inicial do usuário** | Primeiro caractere visível (grafema) do nome normalizado, em maiúscula. Acentos são preservados ("álvaro" vira "Á"). |

## 3. Requisitos funcionais

### Conta e sessão

- **RF01 - Entrar.** E-mail e senha. Com credenciais válidas de um usuário **ativo**, abre-se uma sessão e o usuário vai para o destino `next`, se for um caminho interno protegido, ou para `/entries`. Se o usuário estiver com troca obrigatória de senha, vai para `/account/password` (RF07), preservando o `next` para depois da troca. Com credenciais inválidas, usuário inativo ou usuário demo, a resposta é única e genérica ("E-mail ou senha inválidos."), sem revelar se o e-mail existe ou se a conta está inativa.
- **RF02 - Sair.** O item "Sair" do menu da conta encerra a sessão do navegador atual e leva para `/demo/entries`. Depois de sair, voltar pelo histórico ou recarregar uma rota protegida não mostra dados (redireciona para `/login`).
- **RF03 - Usuário atual.** A API expõe o usuário da sessão (id, nome, e-mail, nível e se a troca de senha é obrigatória) para a navbar e para o roteamento do web. Senha e hash nunca saem da API.
- **RF04 - Expiração da sessão.** A sessão dura **24 horas a partir do login**, sem renovação por uso. Uma leitura com a sessão expirada ou encerrada redireciona para `/login?next=<rota atual>`. Uma mutação com a sessão expirada ou encerrada não é executada: o usuário vê a mensagem "Sua sessão expirou. Entre novamente." e é levado ao login.
- **RF05 - Usuário logado na tela de entrar.** Acessar `/login` com sessão válida redireciona para `/entries` (ou para `/account/password`, se houver troca obrigatória).
- **RF06 - Sem cadastro público.** Não existe tela nem rota de API de cadastro aberto. `/register` não existe (responde a página de não encontrado) e nenhuma tela oferece "Criar conta".

### Senha e perfil do próprio usuário

- **RF07 - Troca obrigatória de senha.** Um usuário que entra com senha temporária (criado pelo administrador, com senha redefinida ou o primeiro administrador) fica com troca obrigatória até trocar a senha. Enquanto isso:
  - no web, qualquer rota protegida redireciona para `/account/password`; o menu da conta oferece só "Sair";
  - na API, toda rota protegida, exceto usuário atual, trocar senha e logout, responde **403 `PASSWORD_CHANGE_REQUIRED`**, antes de qualquer validação de corpo ou query.
- **RF08 - Trocar senha.** Em `/account/password`, o usuário informa a senha atual, a nova senha e a confirmação. Regras:
  - a nova senha segue as regras de senha (P02);
  - a nova senha precisa ser diferente da atual;
  - a confirmação precisa ser igual à nova senha (validada no web);
  - a senha atual errada gera erro no campo, e conta para o limite de tentativas (RNF04).

  Com sucesso: a troca obrigatória é desligada, as **outras** sessões do usuário são encerradas, a sessão atual continua, e o usuário vê a confirmação "Senha alterada." Se a troca era obrigatória, vai para o `next` preservado ou para `/entries`.
- **RF09 - Meu perfil.** Em `/account`, o usuário vê nome, e-mail e nível, e altera apenas o **nome** (mesmas regras do RF12). E-mail e nível aparecem só para leitura, com a indicação "Para alterar, fale com um administrador." A tela tem um atalho para "Trocar senha". Enviar `email`, `role` ou outro campo além do nome gera `UNKNOWN_FIELD`.

### Gestão de usuários (somente administrador)

- **RF10 - Acesso restrito.** Só usuários com nível `ADMIN` acessam a gestão de usuários.
  - API: usuário `USER` recebe **403 `FORBIDDEN`** nas rotas de gestão, antes de validação de corpo ou query (e depois do 401 e do 403 `PASSWORD_CHANGE_REQUIRED`).
  - Web: `/admin/users` mostra a página de não encontrado para usuário `USER`, e o item "Usuários" não aparece no menu da conta.
  - O nível é verificado a cada requisição: promover ou rebaixar vale a partir da próxima requisição do usuário afetado, sem precisar sair.
- **RF11 - Listar usuários.** Em `/admin/users`, o administrador vê todos os usuários (ativos e inativos), exceto o usuário demo, com nome, e-mail, nível, situação, se há troca de senha pendente e data de criação (America/Sao_Paulo). Usuários inativos ficam visualmente distintos dos ativos, sem depender só de cor. A lista **não** mostra nenhum dado financeiro (contagens, totais, cartões, categorias).
- **RF12 - Criar usuário.** Campos:
  - nome: 1 a 60 caracteres, normalizado com NFC, trim e espaços colapsados;
  - e-mail: formato válido, até 254 caracteres, normalizado com trim e minúsculas, único entre todos os usuários (inclusive inativos e o demo);
  - nível: `ADMIN` ou `USER`, obrigatório;
  - senha temporária: regras de senha (P02), definida pelo administrador.

  O usuário nasce ativo, com troca obrigatória de senha e sem nenhum dado financeiro. E-mail já usado responde 409 `EMAIL_TAKEN`. O administrador comunica a senha temporária fora do sistema (P13).
- **RF13 - Editar usuário.** O administrador altera nome, e-mail (único, mesmas regras) e nível de qualquer usuário, inclusive o próprio, respeitando o RF17. A senha não é alterada por esta ação. Alterar o e-mail não encerra sessões; o novo e-mail vale para o próximo login.
- **RF14 - Inativar usuário.** Muda a situação para `INATIVO` e **encerra imediatamente todas as sessões** do usuário: a próxima requisição dele, em qualquer navegador, responde 401 e o web leva ao login. A partir daí, o login dele responde `INVALID_CREDENTIALS`. Os dados financeiros do usuário são mantidos sem alteração. Inativar um usuário já inativo não muda nada e responde sucesso.
- **RF15 - Reativar usuário.** Muda a situação para `ATIVO`. O usuário volta a entrar com a senha que tinha (e com a troca obrigatória, se ela estava pendente). Os dados dele reaparecem intactos. Reativar um usuário já ativo não muda nada e responde sucesso.
- **RF16 - Redefinir senha.** O administrador define uma nova senha temporária (regras de senha) para outro usuário. Efeitos: a senha anterior deixa de valer, a troca obrigatória é ligada e **todas as sessões** do usuário são encerradas. Vale também para usuário inativo (a nova senha passa a valer quando ele for reativado). O administrador não redefine a própria senha por esta ação: usa "Trocar senha" (RF17).
- **RF17 - Proteções.**
  - O administrador não pode inativar a si mesmo nem redefinir a própria senha pela gestão: **422 `CANNOT_TARGET_SELF`**.
  - Não é possível inativar nem rebaixar para `USER` o **último administrador ativo**: **422 `LAST_ADMIN`**. Isso vale também para o administrador que tenta rebaixar a si mesmo.
  - A regra se mantém sob concorrência: duas ações simultâneas nunca podem deixar o sistema sem administrador ativo.
  - Com mais de um administrador ativo, um administrador pode rebaixar a si mesmo; ele perde o acesso à gestão na próxima requisição.
- **RF18 - Usuário inexistente ou reservado.** Um id que não existe, ou o id do usuário demo, responde **404 `USER_NOT_FOUND`** em todas as rotas de gestão.
- **RF19 - Administrador sem acesso a dados financeiros alheios.** Nenhuma rota, de gestão ou do `finance`, devolve dados financeiros de outro usuário a um administrador. No `finance`, o administrador é um usuário como outro qualquer (RF22-RF26).

### Primeiro administrador e dados existentes

- **RF20 - Inicialização do primeiro administrador.** No primeiro deploy, se não existir nenhum usuário além do demo, o sistema cria um administrador ativo com `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`, aplicando as regras de nome, e-mail e senha, com troca obrigatória de senha.
  - A inicialização é idempotente: se já existir algum usuário além do demo, as variáveis são ignoradas e nada é criado nem sobrescrito, mesmo que os valores mudem.
  - Se a inicialização for necessária e alguma variável faltar ou for inválida, a API não sobe e informa, no log, quais variáveis faltam ou são inválidas, sem exibir a senha.
  - Depois da inicialização, as variáveis podem ser removidas do ambiente.
- **RF21 - Dados existentes.** Todos os cartões e lançamentos que já existem no banco passam a pertencer ao primeiro administrador. Eles não viram dados da demo. Depois da migração, nenhum cartão ou lançamento fica sem dono.

### Autorização e isolamento por dono

- **RF22 - Rotas de dados exigem sessão.** Todas as rotas atuais da API (`/api/entries*`, `/api/categories`, `/api/cards*`, `/api/invoices`, `/api/summary`, `/api/dashboard/*`) exigem usuário autenticado. Sem sessão válida, respondem **401 `UNAUTHENTICATED`** antes de qualquer validação de corpo ou query.
- **RF23 - Escrita com dono.** Cartões e lançamentos criados recebem como dono o usuário autenticado. O dono nunca vem do corpo da requisição: um campo `userId` no corpo gera `UNKNOWN_FIELD`, como já acontece com campos desconhecidos.
- **RF24 - Leituras isoladas.** Listagens, subtotais, paginação, faturas, resumo, série mensal, distribuição por categoria e a lista de categorias consideram só dados do usuário autenticado, qualquer que seja o nível.
- **RF25 - Recurso de outro dono é inexistente.** Para o usuário B, um recurso do usuário A se comporta como inexistente:
  - `PUT /api/cards/:id` com cartão de outro dono: 404 `CARD_NOT_FOUND`;
  - `POST /api/entries` com `cardId` de outro dono: 404 `CARD_NOT_FOUND`;
  - `POST /api/entries/:id/pay` com lançamento de outro dono: 404 `ENTRY_NOT_FOUND`;
  - `POST /api/entries/pay` com ids de outro dono: 404 `ENTRIES_NOT_FOUND`, com esses ids em `missingIds`, e nada é alterado;
  - faturas (`.../invoices/:referenceMonth/entries` e `.../pay`) de cartão de outro dono: 404 `CARD_NOT_FOUND`;
  - filtro `cardId` com cartão de outro dono em `GET /api/entries/expenses`: lista vazia, igual ao cartão inexistente de hoje.

  A precedência de erros atual (400 > 404 > 422, e 409 depois de 400 e 404) se mantém, com 401 antes de todas e 403 logo depois do 401.
- **RF26 - Unicidade por dono.** O nome do cartão é único **por usuário**: dois usuários podem ter "Nubank" e o mesmo usuário continua sem poder repetir (409 `CARD_NAME_TAKEN`). A grafia canônica da categoria (primeiro uso, sem diferenciar maiúsculas de minúsculas) é calculada **por usuário**.
- **RF27 - Operações cobertas.** A proteção vale para todas as operações que existem hoje (criar, listar e pagar lançamentos; criar, listar e editar cartões; listar categorias; faturas; resumo; dashboard). As operações novas da Feature B (categorias, inativação de cartão, cancelamento de lançamento) nascem com o mesmo isolamento, mas são especificadas lá.

### Modo demonstração

- **RF28 - Dados de exemplo.** Existe um usuário demo com dados de exemplo:
  - pelo menos 2 cartões com fechamento e vencimento diferentes;
  - receitas e despesas PIX (pagas e pendentes);
  - despesas no cartão em pelo menos 2 faturas;
  - pelo menos 5 categorias;
  - dados cobrindo os 12 meses que terminam no **mês atual** e o mês seguinte (fatura futura). As datas acompanham o mês corrente; valores e descrições são fixos e realistas em BRL.

  O seed é idempotente: rodar de novo não duplica dados.
- **RF29 - Leitura pública da demo.** A API expõe, sem autenticação, **apenas leituras** sobre os dados do usuário demo, com o mesmo contrato de resposta das leituras protegidas: despesas, receitas, categorias, cartões, faturas, despesas de uma fatura, resumo, série mensal e distribuição por categoria. Nenhuma rota pública de demo aceita escrita. Um método diferente de GET em rota de demo responde 404 `ROUTE_NOT_FOUND` (comportamento atual de rota inexistente).
- **RF30 - Telas da demo.** O web oferece `/demo/entries`, `/demo/dashboard` e `/demo/cards`, com os mesmos layouts e query params (mês, aba, filtros, paginação) das telas protegidas. Navegar, trocar o mês, filtrar, paginar e expandir faturas funciona.
- **RF31 - Demo só de visualização.** Nas telas da demo **não aparecem** (nem desabilitados):
  - "Novo lançamento";
  - "+ Novo cartão";
  - "Editar" cartão;
  - checkboxes de seleção de despesas, "Pagar", "Pagar selecionadas" e "Pagar fatura".

  Não há convite nem diálogo que simule uma ação de escrita. Nenhuma ação da demo dispara Server Action de escrita.
- **RF32 - Aviso de demonstração.** Toda tela da demo mostra um aviso persistente e não modal: "Você está vendo dados de exemplo." Para o visitante, a única ação do aviso é "Entrar".
- **RF33 - Navegação da demo.** Na demo, os links da `MainNav` apontam para `/demo/entries`, `/demo/dashboard` e `/demo/cards`, com o item ativo indicado como hoje.

### Rotas do web

- **RF34 - Rotas públicas e protegidas separadas.**
  - Públicas: `/demo/entries`, `/demo/dashboard`, `/demo/cards` e `/login`.
  - Protegidas: `/entries`, `/dashboard`, `/cards`, `/account` e `/account/password`.
  - De administrador: `/admin/users`.
  - Visitante em rota protegida ou de administrador: redireciona para `/login?next=<caminho com query>`.
  - `/` redireciona o usuário logado para `/entries` e o visitante para `/demo/entries`.
- **RF35 - `next` seguro.** O parâmetro `next` só é aceito se for um caminho relativo interno que começa com `/` e não com `//`, e que aponta para uma rota protegida ou de administrador. Qualquer outro valor é ignorado e o destino vira `/entries`. Se o `next` apontar para rota de administrador e o usuário for `USER`, ele vê a página de não encontrado (RF10).
- **RF36 - Logado na demo.** O usuário logado pode abrir `/demo/*` (P07). Nesse caso, a navbar mostra o menu da conta e o aviso da demo oferece "Ir para meus dados" no lugar de "Entrar".

### Navbar

- **RF37 - Botão "Entrar".** Sem sessão, a navbar mostra, à direita e junto do alternador de tema, um botão "Entrar" que leva a `/login`. Se a página atual for de demo, leva a `/login?next=<rota protegida equivalente>`, ou seja, `/demo/cards` vira `next=/cards`. Não há "Criar conta" na navbar.
- **RF38 - Menu da conta.** Com sessão, o botão "Entrar" não aparece. No lugar dele há um botão circular com a inicial do usuário e nome acessível "Conta de <nome>". Ao ativá-lo, abre um menu suspenso ancorado no botão (estilo Chrome) com:
  - cabeçalho com a inicial ampliada, o nome e o e-mail (truncados com reticências, com o texto completo disponível);
  - "Meu perfil" (`/account`);
  - "Trocar senha" (`/account/password`);
  - "Usuários" (`/admin/users`), só para administrador;
  - "Sair".

  Com troca obrigatória pendente, o menu tem só o cabeçalho e "Sair".
- **RF39 - Interação do menu.** O menu:
  - abre com clique, Enter, Espaço ou seta para baixo;
  - fecha com Esc, com clique fora, ao escolher um item ou ao navegar;
  - ao fechar com Esc, devolve o foco ao botão;
  - segue o padrão ARIA *menu button* (`aria-haspopup`, `aria-expanded`), com foco no primeiro item ao abrir e navegação por setas.
- **RF40 - Inicial.** A inicial é o primeiro grafema do nome normalizado, em maiúscula. Se o nome começar com algo que não é letra (emoji, dígito), usa-se o primeiro grafema mesmo assim (P05). Alterar o nome em "Meu perfil" ou pela gestão atualiza a inicial na próxima navegação.

### Telas

- **RF41 - `/login`.** Campos E-mail e Senha, botão "Entrar", link "Ver demonstração" e o texto "Não tem acesso ou esqueceu a senha? Fale com um administrador." Não há link "Criar conta". Erros:
  - de campo, inline;
  - de credenciais, em banner único;
  - de excesso de tentativas, com mensagem própria.

  O botão mostra estado de carregando e impede envio duplo.
- **RF42 - `/account/password` (Trocar senha).** Campos Senha atual, Nova senha (com a regra de tamanho visível) e Confirmar nova senha, e botão "Salvar nova senha". Com troca obrigatória, a tela explica "Defina uma nova senha para continuar." e não oferece "Cancelar" nem outra navegação além de "Sair". Erros de campo ficam inline.
- **RF43 - `/account` (Meu perfil).** Campo Nome editável, e-mail e nível só leitura, botão "Salvar" e atalho "Trocar senha". Confirmação após salvar.
- **RF44 - `/admin/users` (Usuários).** Lista do RF11 com a ação "Novo usuário" e, por usuário, as ações "Editar", "Redefinir senha" e "Inativar" ou "Reativar", conforme a situação.
  - Criar e editar usam formulário com Nome, E-mail, Nível e, só na criação, Senha temporária.
  - "Inativar" e "Redefinir senha" pedem confirmação explícita, informando as consequências (sessões encerradas; troca obrigatória).
  - Ações bloqueadas pelo RF17 não aparecem para o próprio administrador (inativar e redefinir a si mesmo); a de último administrador mostra a mensagem de `LAST_ADMIN` quando tentada.
  - Erros de campo inline; `EMAIL_TAKEN` no campo E-mail ("Este e-mail já está em uso.").

### Deploy

- **RF45 - API não exposta publicamente.** A API só é acessível pelo servidor do web (BFF). O web não recebe nenhuma URL pública da API: `NEXT_PUBLIC_API_URL` deixa de existir no `web/Dockerfile`, no workflow de deploy e no código.

## 4. Requisitos não funcionais

- **RNF01 - Senha.** Armazenada só como hash com algoritmo adaptativo e salt (ADR 0005, D2). Nunca vai para logs, respostas, mensagens de erro nem eventos. Vale também para senhas temporárias e para `ADMIN_PASSWORD`.
- **RNF02 - Cookie de sessão.** `httpOnly`, `SameSite=Lax`, `Secure` fora do ambiente local, `Path=/`, com expiração igual à da sessão (24 h). O token nunca fica acessível ao JavaScript do navegador e nunca vai para a URL.
- **RNF03 - Segredos por ambiente.** Segredos de sessão vêm de variáveis de ambiente. A API não sobe sem eles e o `.env.example` documenta os nomes (inclusive `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`), sem valores reais.
- **RNF04 - Proteção contra força bruta.** Login e troca de senha (senha atual) têm limite de tentativas por IP e por conta. A referência é 5 falhas por e-mail (ou por usuário, na troca de senha) em 15 minutos e 20 requisições por IP por minuto. Acima do limite, a resposta é 429 `TOO_MANY_ATTEMPTS`, com `details: { retryAfterSeconds }`.
- **RNF05 - Sem enumeração.** Login com e-mail inexistente, senha errada, usuário inativo ou usuário demo dá a mesma resposta (401 `INVALID_CREDENTIALS`) e tempo de resposta equivalente (o hash é verificado mesmo quando não há senha a comparar). Recurso de outro dono dá o mesmo 404 de um recurso inexistente.
- **RNF06 - Isolamento garantido na persistência.** Toda consulta e escrita de dados financeiros filtra pelo dono na camada de infraestrutura. Nenhum read model agrega sem filtro de dono. Há teste de integração (Postgres real) com dois usuários para cada read model e repositório. As consultas da gestão de usuários não leem tabelas financeiras.
- **RNF07 - Desempenho.** O RNF06 da spec de origem (p95 < 300 ms com 100 mil lançamentos e 20 cartões) continua valendo **por usuário**, com pelo menos 2 usuários no banco. Login: p95 < 500 ms, incluindo o hash.
- **RNF08 - CSRF.** As mutações continuam só por Server Actions (o navegador não chama a API). O web confere a origem das Server Actions e o logout não pode ser disparado por GET.
- **RNF09 - Acessibilidade.** As telas novas (login, trocar senha, meu perfil, usuários, diálogos de confirmação), o menu da conta, o aviso de demo e os estados somente leitura atendem WCAG 2.1 AA nos dois temas, sem violações no axe (como no RNF11 da spec de origem). Alvos de toque têm pelo menos 44 px, inclusive o avatar. O foco é visível, o avatar não depende só de cor e a situação "Inativo" na lista não depende só de cor.
- **RNF10 - Formato de erros.** Os erros novos seguem `{ code, message, details }`, com `message` em pt-BR. Datas e IDs seguem as decisões padrão: UTC na API, UUID v7.
- **RNF11 - Arquitetura.** Usuário, autenticação e gestão de usuários ficam num contexto próprio, separado de `finance` (ADR 0005, D5). `domain` não importa NestJS, Prisma nem bibliotecas de hash ou token: hash, token e relógio são ports. As regras de nível, situação, troca obrigatória e último administrador ficam no domínio.
- **RNF12 - Testes.** Unitários para domain e use cases (login, troca de senha, perfil, gestão de usuários com todas as proteções, inicialização do primeiro administrador, regras de nome, e-mail e senha, isolamento nos use cases); integração com testcontainers para repositórios e read models com dois usuários, para o encerramento de sessões e para a regra do último administrador sob concorrência; e2e com supertest para 401, 403 (`FORBIDDEN` e `PASSWORD_CHANGE_REQUIRED`), 404 entre donos, 409, 422, 429 e rotas de demo; Playwright + axe para navbar, login, troca obrigatória, perfil, gestão de usuários, demo e redirecionamentos. Cobertura de pelo menos 80% em domain e application.
- **RNF13 - Observabilidade e trilha de auditoria.** São registrados em log, com horário e IP:
  - login com sucesso, login com falha e bloqueio por limite (id do usuário, se houver);
  - troca de senha (id do usuário);
  - ações de gestão: criar, editar (campos alterados, sem valores sensíveis), inativar, reativar e redefinir senha, com id do administrador e id do usuário afetado;
  - inicialização do primeiro administrador.

  E-mail só em hash ou mascarado, e senha nunca.
- **RNF14 - Efeito imediato.** Inativação, redefinição de senha e mudança de nível valem na próxima requisição do usuário afetado, em qualquer navegador, sem depender de expiração de cache ou de token.
- **RNF15 - Consistência do último administrador.** A garantia de pelo menos um administrador ativo vale com requisições concorrentes (ver T14).

## 5. Critérios de aceite

### Conta e sessão

**CA01 - Login com sucesso e `next` (RF01, RF35)**
- Given a usuária ativa "ana@exemplo.com", sem troca pendente, com a senha "segredo123"
- When ela entra por `/login?next=/cards`
- Then a sessão é aberta (cookie httpOnly definido) e o navegador vai para `/cards`.

**CA02 - `next` malicioso (RF35)**
- Given `/login?next=//evil.com` ou `next=https://evil.com` ou `next=/demo/entries`
- When o login dá certo
- Then o navegador vai para `/entries`.

**CA03 - Credenciais inválidas sem enumeração (RF01, RNF05)**
- Given a usuária ativa "ana@exemplo.com" e o usuário inativo "bruno@exemplo.com" com a senha "segredo123"
- When alguém entra com "ana@exemplo.com" e senha errada, depois com "naoexiste@exemplo.com", depois com "bruno@exemplo.com" e a senha correta, e depois com o e-mail do usuário demo
- Then as quatro respostas são 401 `INVALID_CREDENTIALS` com a mesma `message` e os mesmos `details`, e a tela mostra o banner "E-mail ou senha inválidos.".

**CA04 - Limite de tentativas (RNF04)**
- Given 5 falhas de login para "ana@exemplo.com" nos últimos 15 minutos
- When se tenta de novo, mesmo com a senha correta
- Then a API responde 429 `TOO_MANY_ATTEMPTS` com `retryAfterSeconds` > 0 e a tela informa quando tentar novamente.

**CA05 - Logout (RF02)**
- Given Ana logada em `/entries`
- When ela abre o menu da conta e escolhe "Sair"
- Then o cookie de sessão é removido, a sessão deixa de valer na API, o navegador vai para `/demo/entries`, a navbar mostra "Entrar", e abrir `/entries` (inclusive pelo botão voltar com recarga) redireciona para `/login?next=/entries`.

**CA06 - Sessão de 24 h sem renovação (RF04)**
- Given que Ana entrou às 10:00 de 2026-11-01 (America/Sao_Paulo) e usou a aplicação continuamente
- When ela recarrega `/dashboard?month=2026-10` às 10:00 de 2026-11-02
- Then é redirecionada para `/login?next=%2Fdashboard%3Fmonth%3D2026-10`; às 09:59 do mesmo dia a sessão ainda valia.
- And, se a sessão expirar com o drawer "Novo lançamento" aberto e ela salvar, nada é criado, ela vê "Sua sessão expirou. Entre novamente." e vai para o login.

**CA07 - Logado em `/login` e sem cadastro (RF05, RF06)**
- Given Ana logada
- When ela abre `/login`
- Then é redirecionada para `/entries`.
- And `/register` responde a página de não encontrado, para visitante e para logado, e nenhuma tela (login, navbar, aviso da demo) mostra "Criar conta".
- And não existe rota de cadastro na API: `POST` em qualquer caminho de cadastro responde 404 `ROUTE_NOT_FOUND`.

### Senha e perfil

**CA08 - Troca obrigatória no primeiro acesso (RF07)**
- Given a usuária "carla@exemplo.com" criada pelo administrador com a senha temporária "Temp1234"
- When ela entra por `/login?next=/cards`
- Then vai para `/account/password`, que explica "Defina uma nova senha para continuar.", e o menu da conta só oferece "Sair".
- And abrir `/entries` ou `/cards` redireciona de volta para `/account/password`.
- And, na API, `GET /api/summary` com a sessão dela responde 403 `PASSWORD_CHANGE_REQUIRED`, inclusive com query inválida, enquanto usuário atual, trocar senha e logout funcionam.

**CA09 - Trocar senha com sucesso (RF08)**
- Given Carla na troca obrigatória, com outra sessão aberta em outro navegador
- When ela informa a senha atual "Temp1234", a nova "MinhaSenha9" e a confirmação igual
- Then vê "Senha alterada.", vai para `/cards` (o `next` preservado), a troca obrigatória deixa de existir, a outra sessão responde 401 na próxima requisição e a sessão atual continua válida.
- And, depois, o login com "Temp1234" falha e com "MinhaSenha9" funciona sem troca obrigatória.

**CA10 - Erros na troca de senha (RF08, RNF04)**
- Given Ana logada em `/account/password`
- When ela envia senha atual errada; depois nova senha igual à atual; depois nova senha "1234567"; depois confirmação diferente
- Then a API responde 400 `VALIDATION_ERROR` com `currentPassword: INCORRECT`, `newPassword: SAME_AS_CURRENT` e `newPassword: TOO_SHORT` nos respectivos casos; a confirmação diferente é barrada no web ("As senhas não conferem.") sem chamar a API; a senha não muda.
- And a 6ª senha atual errada em 15 minutos responde 429 `TOO_MANY_ATTEMPTS`.

**CA11 - Editar o próprio nome (RF09, RF40)**
- Given Ana Souza (USER) logada em `/account`
- When ela altera o nome para "  ana   lima "
- Then o nome salvo é "ana lima", a tela confirma, e a navbar passa a mostrar a inicial "A" e "ana lima" no menu.
- And uma requisição de perfil com `email` ou `role` no corpo responde 400 `UNKNOWN_FIELD` nesses campos, e nada muda.

### Primeiro administrador e dados existentes

**CA12 - Inicialização do primeiro administrador (RF20)**
- Given um banco migrado sem usuários além do demo, e `ADMIN_NAME="Vagner"`, `ADMIN_EMAIL="Admin@Exemplo.com"`, `ADMIN_PASSWORD="Inicial123"`
- When a API sobe
- Then existe um usuário "Vagner", "admin@exemplo.com", nível `ADMIN`, ativo, com troca obrigatória; o login com "Inicial123" leva a `/account/password`.
- When a API sobe de novo com `ADMIN_EMAIL="outro@exemplo.com"` e outra senha
- Then nenhum usuário é criado ou alterado, e a senha já trocada continua valendo.

**CA13 - Variáveis ausentes ou inválidas (RF20)**
- Given um banco sem usuários além do demo e `ADMIN_PASSWORD` ausente (ou `ADMIN_EMAIL="admin@"`)
- When a API sobe
- Then ela não inicia, o log aponta a variável ausente ou inválida e a senha não aparece no log.
- And, se já existir um administrador, a ausência das três variáveis não impede a API de subir.

**CA14 - Dados existentes vão para o primeiro administrador (RF21)**
- Given um banco com cartões e lançamentos sem dono, anterior a esta feature
- When a migração e a inicialização rodam
- Then todos esses cartões e lançamentos pertencem ao primeiro administrador, nenhum fica sem dono, os totais que ele vê depois da troca de senha são iguais aos de antes da migração, e nenhum deles aparece na demo.

### Gestão de usuários

**CA15 - Usuário comum sem acesso à gestão (RF10)**
- Given Ana (USER) logada
- When ela abre `/admin/users` e chama as rotas de gestão da API (inclusive com corpo inválido)
- Then o web mostra a página de não encontrado, o menu da conta não tem "Usuários", e a API responde 403 `FORBIDDEN`, não 400.

**CA16 - Criar usuário (RF12)**
- Given o administrador Vagner logado em `/admin/users`
- When ele cria o nome "  Carla   Dias ", o e-mail " Carla@Exemplo.com ", nível `USER` e a senha temporária "Temp1234"
- Then o usuário aparece na lista como "Carla Dias", "carla@exemplo.com", `USER`, ativo, com troca de senha pendente, e sem nenhum dado financeiro; o primeiro login dela segue o CA08.

**CA17 - E-mail duplicado (RF12, RF13)**
- Given os usuários "ana@exemplo.com" (ativa) e "bruno@exemplo.com" (inativo)
- When o administrador cria um usuário com "ANA@exemplo.com", ou outro com "bruno@exemplo.com", ou edita Carla para "ana@exemplo.com", ou cria um usuário com o e-mail do usuário demo
- Then a API responde 409 `EMAIL_TAKEN` com `details.fields[0] = { field: "email", code: "EMAIL_TAKEN", ... }`, o formulário mostra "Este e-mail já está em uso." no campo E-mail, e nada muda.

**CA18 - Validação ao criar usuário (RF12)**
- Given o formulário "Novo usuário"
- When se envia nome vazio, e-mail "ana@", nível "ROOT" e senha "1234567"
- Then a API responde 400 `VALIDATION_ERROR` com os quatro campos acumulados (`name: REQUIRED`, `email: INVALID_FORMAT`, `role: INVALID_VALUE`, `password: TOO_SHORT`) e nenhum usuário é criado. Uma senha com 73 caracteres gera `password: TOO_LONG`.

**CA19 - Editar nome, e-mail e nível (RF13, RF10)**
- Given Ana (USER) com uma sessão aberta
- When o administrador altera o nome dela para "Ana Lima", o e-mail para "ana.lima@exemplo.com" e o nível para `ADMIN`
- Then a lista mostra os novos valores; na próxima requisição de Ana, sem sair, o menu mostra "Usuários" e `/admin/users` abre; o próximo login dela é com "ana.lima@exemplo.com".
- When o administrador rebaixa Ana para `USER`
- Then, na próxima requisição dela, as rotas de gestão respondem 403 `FORBIDDEN` e "Usuários" some do menu.

**CA20 - Inativar encerra sessões e mantém dados (RF14)**
- Given Bruno (USER) ativo, com sessões abertas em dois navegadores e lançamentos em 2026-11
- When o administrador confirma "Inativar" para Bruno
- Then a próxima requisição de Bruno, em qualquer um dos navegadores, responde 401 e o leva ao login; o login dele responde `INVALID_CREDENTIALS`; a lista mostra Bruno como inativo, distinto dos ativos; os lançamentos dele continuam no banco sem alteração.
- And inativar Bruno de novo responde sucesso sem mudar nada.

**CA21 - Reativar (RF15)**
- Given Bruno inativo, com a senha "segredo123" e sem troca pendente
- When o administrador reativa Bruno
- Then Bruno entra com "segredo123", sem troca obrigatória, e vê os mesmos lançamentos de antes da inativação.

**CA22 - Redefinir senha (RF16)**
- Given Ana logada em dois navegadores
- When o administrador confirma "Redefinir senha" para Ana com a senha temporária "Nova1234"
- Then as duas sessões de Ana respondem 401 na próxima requisição, o login com a senha antiga falha, o login com "Nova1234" leva à troca obrigatória (CA08), e a lista mostra a troca pendente.

**CA23 - Administrador não age sobre si mesmo (RF17)**
- Given o administrador Vagner e outro administrador ativo
- When Vagner tenta inativar a si mesmo ou redefinir a própria senha pela API de gestão
- Then a resposta é 422 `CANNOT_TARGET_SELF` e nada muda; na tela, essas ações não aparecem na linha dele.

**CA24 - Último administrador ativo (RF17, RNF15)**
- Given Vagner como único administrador ativo (e Carla como administradora inativa)
- When alguém tenta rebaixar Vagner para `USER`, inclusive ele mesmo
- Then a resposta é 422 `LAST_ADMIN`, a tela mostra a mensagem e nada muda.
- Given Vagner e Ana como administradores ativos
- When Vagner inativa Ana e, ao mesmo tempo, Ana rebaixa Vagner
- Then no máximo uma das ações tem sucesso; a outra responde 422 `LAST_ADMIN` (ou 401, se a sessão foi encerrada), e ao final existe pelo menos um administrador ativo.
- And, com dois administradores ativos, Vagner pode rebaixar a si mesmo e perde o acesso à gestão na próxima requisição.

**CA25 - Administrador não vê dados financeiros alheios (RF19, RF11)**
- Given o administrador Vagner com receita de 1000.00 em 2026-11, e Ana (USER) com o cartão C e receita de 5000.00 em 2026-11
- When Vagner consulta a lista de usuários, os detalhes de Ana na gestão, o resumo de 2026-11 e `GET /api/cards/C/invoices/2026-11/entries`
- Then a gestão não traz nenhum campo financeiro, o resumo mostra income "1000.00", e a fatura do cartão C responde 404 `CARD_NOT_FOUND`.

**CA26 - Usuário inexistente ou demo (RF18)**
- Given um UUID v7 que não existe e o id do usuário demo
- When o administrador edita, inativa, reativa ou redefine a senha com esses ids
- Then a resposta é 404 `USER_NOT_FOUND`, e o usuário demo não aparece na lista.

### Autorização e isolamento

**CA27 - 401 sem sessão (RF22)**
- Given nenhuma credencial na requisição (ou um token inválido, adulterado, expirado ou encerrado)
- When se chama qualquer rota protegida da API (dados, perfil, troca de senha ou gestão), inclusive com corpo inválido
- Then a resposta é 401 `UNAUTHENTICATED` (`details: null`), e não um 400 ou 403.

**CA28 - Dono atribuído na criação (RF23)**
- Given Ana logada
- When ela cria o cartão "Nubank" e uma despesa PIX
- Then os dois ficam com Ana como dono. Um corpo com `userId` responde 400 `UNKNOWN_FIELD` no campo `userId`.

**CA29 - Listagens e agregados isolados (RF24)**
- Given que Ana tem receita de 5000.00 e despesa de 600.00 em 2026-11, e Bruno tem receita de 100.00 e despesa de 50.00 em 2026-11
- When Ana consulta resumo, despesas, receitas, faturas, série mensal, distribuição por categoria, categorias e cartões de 2026-11
- Then ela vê só os próprios dados (resumo: income "5000.00", expenses.total "600.00"), e nenhum valor, categoria ou cartão de Bruno aparece.

**CA30 - Recurso de outro dono é 404 (RF25)**
- Given o cartão C e o lançamento L de Bruno
- When Ana chama `PUT /api/cards/C`, `POST /api/entries` com `cardId: C`, `POST /api/entries/L/pay`, `GET /api/cards/C/invoices/2026-11/entries` e `POST /api/cards/C/invoices/2026-11/pay`
- Then as respostas são 404 `CARD_NOT_FOUND` ou `ENTRY_NOT_FOUND`, iguais às de um id inexistente, e nenhum dado de Bruno muda.

**CA31 - Lote com ids de outro dono (RF25)**
- Given a despesa pendente A1 de Ana e a despesa B1 de Bruno
- When Ana chama `POST /api/entries/pay` com `ids: [A1, B1]`
- Then a resposta é 404 `ENTRIES_NOT_FOUND` com `missingIds: [B1]`, e nem A1 nem B1 são pagas.

**CA32 - Nome de cartão único por usuário (RF26)**
- Given que Bruno tem o cartão "Nubank"
- When Ana cria "nubank"
- Then o cartão é criado (201). Se Ana tentar criar "NUBANK" de novo, recebe 409 `CARD_NAME_TAKEN`.

**CA33 - Categoria canônica por usuário (RF26)**
- Given que Bruno usou primeiro a categoria "alimentação"
- When Ana cria um lançamento com "Alimentação" e depois outro com "ALIMENTAÇÃO"
- Then os dois lançamentos de Ana ficam com "Alimentação", o de Bruno continua "alimentação", e `GET /api/categories` de cada um mostra só a própria grafia.

### Modo demonstração

**CA34 - Seed idempotente e atual (RF28)**
- Given o banco migrado
- When o seed demo roda duas vezes
- Then existe exatamente um usuário demo, os cartões e lançamentos não se duplicam, e as leituras da demo têm dados nos 12 meses que terminam no mês atual e numa fatura do mês seguinte.
- And, quando o mês corrente (America/Sao_Paulo) muda, a demo continua com dados até o novo mês atual.

**CA35 - Leitura pública da demo (RF29)**
- Given nenhum cookie
- When se chama a leitura de demo de resumo, despesas, receitas, faturas, cartões, categorias e dashboard
- Then as respostas são 200, com o mesmo formato das rotas protegidas, contendo só dados do usuário demo.

**CA36 - Demo não aceita escrita (RF29)**
- Given nenhum cookie, ou um usuário logado (de qualquer nível)
- When se envia POST, PUT, PATCH ou DELETE para qualquer caminho de demo da API
- Then a resposta é 404 `ROUTE_NOT_FOUND` e nada é alterado.

**CA37 - Demo não vaza dados de usuários (RF29, RNF06)**
- Given os usuários Ana e Bruno e o primeiro administrador, com dados
- When um visitante percorre todas as leituras da demo, em qualquer mês e com qualquer filtro
- Then nenhum cartão, lançamento, categoria ou total desses usuários aparece.

**CA38 - Telas só de visualização (RF30, RF31, RF32)**
- Given um visitante em `/demo/entries?month=<mês atual>`
- When ele navega pelas abas, troca o mês, filtra por cartão, pagina e expande uma fatura
- Then tudo funciona, o aviso "Você está vendo dados de exemplo." aparece com a única ação "Entrar", e não existem no DOM "Novo lançamento", checkboxes de seleção de despesas, "Pagar", "Pagar selecionadas" nem "Pagar fatura", nem desabilitados.
- And em `/demo/cards` não existem "Novo cartão" nem "Editar".
- And nenhuma interação na demo abre convite, diálogo ou drawer de escrita.

**CA39 - Navegação dentro da demo (RF33)**
- Given um visitante em `/demo/dashboard`
- When ele usa a `MainNav`
- Then os links levam a `/demo/entries`, `/demo/dashboard` e `/demo/cards`, e "Dashboard" está com `aria-current="page"`.

### Rotas do web

**CA40 - Visitante em rota protegida (RF34)**
- Given nenhum cookie
- When ele abre `/cards`, `/account` ou `/admin/users`
- Then é redirecionado para `/login?next=<rota>`, sem que o HTML com dados chegue ao navegador.

**CA41 - Raiz (RF34)**
- Given um visitante, e depois um usuário logado
- When cada um abre `/`
- Then o visitante vai para `/demo/entries` e o logado para `/entries`.

**CA42 - Logado na demo (RF36)**
- Given Ana logada
- When ela abre `/demo/entries`
- Then vê os dados de exemplo (não os dela), a navbar mostra o avatar, e o aviso oferece "Ir para meus dados", que leva a `/entries`, sem "Entrar".

### Navbar

**CA43 - "Entrar" para visitante (RF37)**
- Given um visitante em `/demo/cards`
- When ele olha a navbar em 360 px e em 1280 px
- Then há o botão "Entrar" visível ao lado do alternador de tema, não há avatar nem "Criar conta", e o botão leva a `/login?next=/cards`.

**CA44 - Avatar e menu (RF38, RF39, RF40)**
- Given Ana Souza (ana@exemplo.com, USER) logada
- When ela olha a navbar
- Then "Entrar" não existe no DOM e há um botão circular "A" com nome acessível "Conta de Ana Souza", `aria-haspopup="menu"` e `aria-expanded="false"`.
- When ela ativa o botão por clique ou por Enter
- Then abre o menu com o cabeçalho (inicial, "Ana Souza", "ana@exemplo.com") e os itens "Meu perfil", "Trocar senha" e "Sair", sem "Usuários", com o primeiro item focado e `aria-expanded="true"`.
- When ela pressiona Esc
- Then o menu fecha e o foco volta ao avatar. Clicar fora também fecha.
- And, para um administrador, o menu tem também "Usuários", que leva a `/admin/users`.

**CA45 - Inicial com acento e espaços (RF40)**
- Given um usuário com nome "  álvaro lima"
- When a navbar é renderizada
- Then o avatar mostra "Á".

**CA46 - Acessibilidade das telas novas (RNF09)**
- Given `/login` (vazio, com erro de campo, com banner de credenciais, carregando), `/account/password` (obrigatória e opcional, com erro), `/account`, `/admin/users` (lista com inativo, formulário com erro, diálogos de inativar e redefinir), o menu da conta aberto e uma tela de demo com o aviso
- When cada uma é auditada com axe nos temas claro e escuro, em 360 px e 1280 px
- Then não há violações, os alvos têm pelo menos 44 px e o foco é visível.

### Deploy

**CA47 - API não exposta (RF45)**
- Given o build do web e o workflow de deploy
- When se procura `NEXT_PUBLIC_API_URL` no código, no `web/Dockerfile`, no workflow e no bundle do cliente
- Then não há ocorrências, e o navegador não faz nenhuma requisição direta à API em nenhum fluxo (login, telas protegidas, gestão e demo).

## 6. Fora de escopo

- **Feature B (`docs/specs/categorias-inativacao.md`):** categoria como entidade (criar, renomear, inativar, reativar, separada por tipo), inativação e reativação de cartão, e cancelamento de lançamento. Exclusão de receitas e de cartões continua fora.
- Cadastro público, convite por e-mail ou link e qualquer forma de autocadastro.
- Recuperação de senha pelo próprio usuário (por e-mail ou similar). A única recuperação é a redefinição feita pelo administrador.
- Exclusão de usuário (só inativação) e exclusão ou transferência dos dados de um usuário.
- Acesso do administrador aos dados financeiros de outros usuários, inclusive "entrar como" outro usuário (impersonação), relatórios consolidados e contagens.
- Alteração do próprio e-mail ou nível pelo usuário.
- Níveis além de `ADMIN` e `USER`, permissões finas, compartilhamento de dados entre usuários e contas familiares.
- Expiração da senha temporária por prazo, política de histórico de senhas e regras de composição.
- Tela de trilha de auditoria (a auditoria fica só em log, RNF13).
- Busca, filtros e paginação na lista de usuários (P14).
- Confirmação de e-mail, login social (Google etc.), 2FA e magic link.
- "Sair de todos os dispositivos" acionado pelo próprio usuário e lista de sessões ativas. O encerramento de sessões acontece só nos casos de RF08, RF14 e RF16.
- Foto de avatar: só a inicial.
- Escrever na demo, convite a partir da demo e "sandbox" temporária.
- Internacionalização: tudo continua em pt-BR.

## 7. Riscos

- **R1 - Vazamento entre usuários.** Esquecer o filtro de dono numa query SQL crua (os read models usam `$queryRaw`) expõe dados de terceiros. Mitigação: RNF06 com dois usuários em cada teste de integração e revisão dedicada.
- **R2 - Migração de dados existentes.** As tabelas atuais têm linhas sem dono, e `user_id NOT NULL` exige que o primeiro administrador exista antes do backfill (RF20, RF21). A ordem entre migração, inicialização do administrador e seed da demo precisa ser garantida no deploy (T12). Também é preciso trocar o índice único global de `name_key` por um índice por usuário.
- **R3 - Índices.** Os índices atuais começam por `reference_month` ou `card_id`. Sem `user_id`, as consultas por dono podem violar o RNF07 (T7).
- **R4 - Administrador conhece a senha temporária.** O administrador define a senha temporária e pode redefini-la a qualquer momento. Em tese, poderia redefinir a senha de alguém, entrar, trocar a senha e ver os dados dessa pessoa, contornando o RF19. Mitigação: a troca obrigatória bloqueia os dados até a troca (RF07), a redefinição encerra sessões e fica na trilha de auditoria (RNF13), e o usuário percebe que a senha dele deixou de funcionar. Risco residual aceito (P13).
- **R5 - Ficar sem administrador.** Uma corrida entre inativações e rebaixamentos, ou um erro na inicialização, pode deixar o sistema sem administrador ativo, sem caminho de recuperação pela interface. Mitigação: RF17, RNF15 e teste de concorrência; como último recurso, um procedimento operacional documentado (T15).
- **R6 - Divergência entre telas protegidas e de demo.** Duplicar telas causa drift visual e de comportamento (T10). Com a demo sem botões de escrita, o modo somente leitura precisa remover elementos, e não só desabilitá-los.
- **R7 - Stub de e2e do web.** O stub (`web/e2e/stub-api/server.mjs`) não conhece autenticação, níveis, troca obrigatória nem demo. Os e2e atuais quebram até o stub ser atualizado.
- **R8 - Cache do Next.** Uma renderização ou cache compartilhado entre usuários pode servir dados de um usuário a outro, ou mostrar "Usuários" a quem foi rebaixado. Hoje as leituras usam `cache: "no-store"` e isso precisa continuar valendo para as rotas protegidas e para o usuário atual.
- **R9 - Limite de tentativas em memória.** Um contador em memória zera a cada reinício e não funciona com várias instâncias (T8, ADR 0005 D7).
- **R10 - Segredo do primeiro administrador no ambiente.** `ADMIN_PASSWORD` fica em secrets do CI e no ambiente do container. Mitigação: é temporária (troca obrigatória), não vai para logs e pode ser removida após a inicialização.
- **R11 - API exposta por engano.** Se a API continuar acessível publicamente, o limite por IP pode ser contornado com `X-Forwarded-For` forjado (ADR 0005 D11). Mitigação: RF45 e a tarefa de deploy.

## 8. Perguntas em aberto

### Bloqueantes (mudam regra de negócio) - todas decididas em 2026-10-29

**B1 - "Criar, listar, editar e excluir" inclui operações novas?** **Decidida.**
Esta feature protege só as operações que existem hoje (RF27). Categoria como entidade, inativação de cartão e cancelamento de lançamento vão para a Feature B (`docs/specs/categorias-inativacao.md`), que nasce com o mesmo isolamento por dono.

**B2 - De quem são os dados que já estão no banco? Quem cria usuários?** **Decidida.**
Entra a entidade Usuário com níveis `ADMIN` e `USER`, gerida só por administrador (criar, editar nome, e-mail e nível, inativar, reativar, redefinir senha). O primeiro administrador vem de `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` no primeiro deploy, com troca obrigatória de senha, e recebe todos os dados existentes, que não viram demo. O administrador não vê dados financeiros de outros usuários. Usuários criados ou com senha redefinida recebem senha temporária com troca obrigatória. O usuário altera o próprio nome e a própria senha. Não é possível inativar a si mesmo nem inativar ou rebaixar o último administrador ativo. Inativar encerra todas as sessões e mantém os dados; reativar é permitido (RF07-RF21).

**B3 - O cadastro é aberto a qualquer pessoa?** **Decidida.**
Não. Não há cadastro público: `/register`, o caso de uso de cadastro aberto e os CTAs "Criar conta" saem. O visitante só lê a demo. `EMAIL_TAKEN` continua existindo na criação e edição feitas pelo administrador (RF06, RF12).

**B4 - Na demo, os botões de escrita somem ou aparecem desabilitados?** **Decidida.**
Somem. A demo é só de visualização: sem botões de escrita, sem convite e sem checkboxes de seleção. O aviso e a navbar oferecem só "Entrar" (RF31, RF32, RF37). A proposta PA3 do design (ênfase de "Criar conta") deixa de existir.

**B5 - Os dados de exemplo acompanham o mês atual?** **Decidida.**
Sim. Datas relativas ao mês corrente (12 meses até o atual e mais 1 de fatura futura), com valores e descrições fixos (RF28).

### Técnicas (decisão do architect)

As técnicas T1-T11 da rev. 1 já têm resposta no ADR 0005 (seção 12). Com as decisões do usuário: **D1** (token opaco com sessão no banco, T1/T2), **D12** e **D13** estão aprovadas; **D11** fica decidida como "a API não é exposta publicamente" (RF45). O ADR precisa ser revisado para refletir esta rev. 2 (sem cadastro, níveis, gestão de usuários, sessão de 24 h).

- **T1 - Mecanismo de sessão no BFF.** Resolvida pelo D1 do ADR 0005 (aprovado). *Sugestão para esta revisão:* a sessão no banco passa a guardar a data de expiração fixa de 24 h e a ser encerrável por usuário (todas as sessões) e "todas menos a atual".
- **T2 - Revogação no logout.** Resolvida pelo D1 (revogação real na tabela de sessões).
- **T3 - Hash de senha.** ADR 0005 D2 (argon2id, limite de 72 mantido).
- **T4 - Implementação da demo.** ADR 0005 D3 (usuário demo real e `GET /api/demo/*`).
- **T5 - Datas relativas no seed demo.** ADR 0005 D4.
- **T6 - Fronteira do contexto e propagação do dono.** ADR 0005 D5. *Sugestão:* a gestão de usuários fica no mesmo contexto `identity`, e o `finance` continua sem importar o domínio de `identity`.
- **T7 - Esquema e índices.** ADR 0005 D6. *Sugestão adicional:* a tabela `users` ganha nível, situação e marcador de troca obrigatória.
- **T8 - Limite de tentativas.** ADR 0005 D7. *Sugestão:* reaproveitar o mesmo limitador para a senha atual na troca de senha.
- **T9 - Proteção de rotas no web.** ADR 0005 D8, sem o grupo de cadastro. *Sugestão:* acrescentar a checagem de troca obrigatória e de nível (rota de administrador) no layout protegido, com a decisão definitiva sempre na API (401/403).
- **T10 - Reaproveitar telas na demo.** ADR 0005 D9. *Sugestão:* o modo somente leitura remove os elementos de escrita (B4), sem convite.
- **T11 - Stub de e2e.** ADR 0005 D10. *Sugestão:* o stub ganha níveis, troca obrigatória, rotas de gestão e encerramento de sessões, sem cadastro.
- **T12 - Inicialização do primeiro administrador e ordem no deploy.** *Sugestão:* a migração cria o primeiro administrador a partir das variáveis (ou um passo de bootstrap que roda antes da migração de ownership), garantindo que o backfill de `user_id` tenha dono; o seed da demo roda depois. O `Dockerfile` hoje roda `npx prisma db seed` sem seed configurado (ADR 0005 §13.7).
- **T13 - Aplicação da troca obrigatória.** *Sugestão:* um guard na presentation, depois do de autenticação, que lê o marcador do usuário da sessão e libera só usuário atual, trocar senha e logout.
- **T14 - Garantia do último administrador sob concorrência.** *Sugestão:* a verificação "existe outro ADMIN ativo" e a escrita na mesma transação com bloqueio (por exemplo, `SELECT ... FOR UPDATE` sobre os administradores ativos ou advisory lock), com teste de integração concorrente.
- **T15 - Recuperação operacional sem administrador.** *Sugestão:* documentar um comando de manutenção (fora da API HTTP) que promove ou reativa um usuário como administrador, para o caso extremo do R5.
- **T16 - Nível e situação a cada requisição.** *Sugestão:* a consulta de sessão por requisição (D1) já traz nível, situação e marcador de troca obrigatória do usuário, sem cache, para cumprir o RNF14.

## 9. Premissas adotadas

- **P01** O e-mail é comparado sem diferenciar maiúsculas de minúsculas e armazenado em minúsculas. Não há normalização específica de provedor, como pontos no Gmail.
- **P02** Senha (inclusive temporária e `ADMIN_PASSWORD`): 8 a 72 caracteres, sem regra de composição. Espaços são permitidos e não há trim na senha.
- **P03** A sessão dura **24 horas** a partir do login, sem renovação deslizante e sem "lembrar de mim". Quando expira, é preciso entrar de novo.
- **P04** Recurso financeiro de outro dono responde 404, não 403, conforme a decisão padrão "id inexistente → 404" e o RNF05. Falta de nível para a gestão responde 403 `FORBIDDEN`, porque a rota existe e o usuário está autenticado.
- **P05** A inicial é o primeiro grafema do nome, em maiúscula pelo locale pt-BR. A cor de fundo do avatar é um token fixo do tema e não é derivada do nome.
- **P06** O usuário demo é reservado: login com o e-mail dele responde `INVALID_CREDENTIALS`, o e-mail usa um domínio reservado (`.invalid`), conta como já usado na criação de usuários (`EMAIL_TAKEN`) e não aparece nem é endereçável na gestão (`USER_NOT_FOUND`).
- **P07** O usuário logado pode ver a demo (RF36). Não há redirecionamento forçado de `/demo/*` para as rotas protegidas.
- **P08** Os query params das telas da demo seguem os das telas protegidas, e o mês inicial da demo é o mês atual em America/Sao_Paulo.
- **P09** Os novos códigos de erro são: `UNAUTHENTICATED` (401), `INVALID_CREDENTIALS` (401), `FORBIDDEN` (403), `PASSWORD_CHANGE_REQUIRED` (403), `USER_NOT_FOUND` (404), `EMAIL_TAKEN` (409), `CANNOT_TARGET_SELF` (422), `LAST_ADMIN` (422), `TOO_MANY_ATTEMPTS` (429), e os códigos de campo `TOO_SHORT`, `EMAIL_TAKEN`, `INCORRECT` (senha atual) e `SAME_AS_CURRENT` (nova senha). Os demais códigos continuam os da spec de origem.
- **P10** O contrato das respostas de dados financeiros não muda. Nenhuma resposta do `finance` passa a incluir `userId`.
- **P11** Um novo usuário começa sem nenhum dado, sem cópia dos dados de exemplo.
- **P12** O menu da conta não inclui o alternador de tema, que continua na navbar.
- **P13** A senha temporária é comunicada pelo administrador fora do sistema (o sistema não envia e-mail) e não expira por prazo; deixa de valer quando o usuário a troca ou quando é redefinida. O risco R4 é aceito.
- **P14** A lista de usuários não tem paginação, busca nem filtros nesta entrega (volume esperado pequeno). Ordem: ativos antes dos inativos e, dentro de cada grupo, por nome.
- **P15** Rotas do web: `/account` (Meu perfil), `/account/password` (Trocar senha) e `/admin/users` (Usuários), seguindo o padrão em inglês das rotas atuais. O ponto de entrada da gestão é o item "Usuários" do menu da conta, e não a `MainNav`.
- **P16** Trocar a própria senha encerra as outras sessões do usuário e mantém a atual. Reativar um usuário não liga a troca obrigatória.
- **P17** Alterar e-mail ou nome de um usuário não encerra as sessões dele; mudar o nível vale na próxima requisição (RNF14).
- **P18** Inativar um usuário já inativo, ou reativar um já ativo, é idempotente e responde sucesso.
- **P19** Propostas do design aprovadas pelo usuário: PA1 (`reason=expired` na URL do login), PA2 (aceitar a perda do rascunho do drawer quando a sessão expira, agora com sessão de 24 h), PA4 (chip "Demonstração" na navbar) e PA5 (menu na top layer). PA3 deixa de existir (B4).
- **P20** Na tela de login, a orientação para quem não tem acesso ou esqueceu a senha é procurar um administrador (RF41). Não há canal de contato no sistema.

## 10. Tarefas (ordenadas)

### Banco e identidade
1. [db] Tabela de usuários (id UUID v7, nome, e-mail, chave de e-mail única, hash de senha, nível `ADMIN`/`USER`, situação ativo/inativo, marcador de troca obrigatória, marcador de demo, `created_at` e `updated_at` em UTC) e tabela de sessões com expiração fixa de 24 h (RF12, RF04, T1, T7).
2. [db] Inicialização do primeiro administrador a partir de `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` e migração de ownership: `user_id` em `cards` e `entries`, atribuição de todos os dados existentes ao primeiro administrador, `NOT NULL`, FK, unicidade `(user_id, name_key)` no lugar de `cards_name_key_uq`, garantia de mesmo dono entre lançamento e cartão, e revisão dos índices com `user_id`. Ordem garantida no deploy (RF20, RF21, RF26, R2, R3, T7, T12).
3. [api] Domínio do contexto de identidade: agregado Usuário com nível, situação e troca obrigatória; value objects de nome, e-mail e senha (P02); regras de autoação e de último administrador; erros e ports (`UserRepository`, `SessionRepository`, `PasswordHasher`, `TokenIssuer`, `AttemptLimiter`, relógio), com testes unitários (RF07, RF12-RF18).
4. [api] Use cases de autenticação e conta: login (usuário inativo e demo como `INVALID_CREDENTIALS`, sem enumeração), logout, usuário atual, trocar senha (encerrando as outras sessões) e editar o próprio nome, com testes unitários (RF01-RF04, RF07-RF09, RNF05).
5. [api] Use cases de gestão de usuários: listar, criar, editar, inativar (encerrando sessões), reativar e redefinir senha (encerrando sessões e ligando a troca obrigatória), com `CANNOT_TARGET_SELF`, `LAST_ADMIN` e `USER_NOT_FOUND`, e testes unitários (RF10-RF19).
6. [api] Use case de inicialização do primeiro administrador: idempotente, validação das variáveis e falha de boot com mensagem clara, sem expor a senha, com testes unitários (RF20, CA12, CA13).
7. [api] Infraestrutura de identidade: repositórios Prisma com mapper (usuários e sessões), adaptadores de hash e de token, limitador de tentativas (login e senha atual), com testes de integração (testcontainers), inclusive encerramento de sessões e concorrência do último administrador (RNF01, RNF04, RNF14, RNF15, T8, T14).
8. [api] Presentation: rotas de login, logout, usuário atual, trocar senha, perfil e gestão de usuários; guard global de autenticação com marcação de rotas públicas, guard de troca obrigatória e guard de nível; mapeamento de 401, 403, 404, 409, 422 e 429 no `HttpErrorFilter`; log de auditoria; segredos e variáveis do administrador no boot e `.env.example`. Nenhuma rota de cadastro aberto (RF06, RF22, RNF03, RNF10, RNF13, T13, T16).
9. [api] E2e com supertest da identidade: login e enumeração, 429, troca obrigatória (403), troca de senha, perfil (`UNKNOWN_FIELD`), gestão (403 para USER, 409, 422, 404), inativação e redefinição encerrando sessões, e inexistência de rota de cadastro (CA03-CA27).

### Isolamento no finance
10. [api] Propagar `ownerId` em todos os use cases do `finance` (criar, listar e pagar lançamentos; criar, listar e editar cartões; faturas; resumo; dashboard; categorias), com testes unitários dos casos de outro dono (RF23-RF25, T6).
11. [api] Repositórios, `PrismaCategoryCatalog`, unit of work e todos os read models filtrando por dono, com testes de integração usando dois usuários para cada um (RF24-RF26, RNF06).
12. [api] Controllers do `finance` obtendo o usuário da sessão, e e2e com supertest para 401 em todas as rotas, 404 entre donos (inclusive administrador contra usuário comum), lote com id de outro dono, `UNKNOWN_FIELD` em `userId`, e nome de cartão e categoria por usuário (CA25, CA27-CA33).

### Demo na API
13. [db] Seed idempotente do usuário demo e dos dados de exemplo relativos ao mês atual, conforme RF28 e ADR 0005 D4 (CA34).
14. [api] Rotas públicas somente GET de demo, reutilizando os use cases de leitura com o dono demo, e e2e de leitura, de escrita retornando 404 e de ausência de vazamento (RF29, CA35-CA37, T4).
15. [api] Medir o RNF07 com 2 usuários e volume de referência, e registrar.

### Web
16. [web] Sessão no BFF: guardar o token em cookie httpOnly de 24 h, enviá-lo em `lib/api/http.ts`, tratar 401 (redirect e mensagem de sessão expirada em Server Actions) e 403 `PASSWORD_CHANGE_REQUIRED` (redirect para a troca), e Server Actions de login e logout (RF01-RF04, RNF02, RNF08, T1).
17. [web] Reorganizar as rotas em públicas, protegidas e de administrador, com redirect e `next` seguro, `/` conforme a sessão, `/login` redirecionando quem está logado, redirecionamento para `/account/password` com troca pendente, e página de não encontrado para `/register` e para `/admin/users` com usuário `USER` (RF05, RF06, RF07, RF10, RF34, RF35, T9).
18. [web] Tela `/login` conforme o design, sem "Criar conta", com orientação para falar com um administrador, erros inline, banner, 429 e carregando (RF41).
19. [web] Telas `/account/password` (modo obrigatório e opcional, com confirmação validada no web) e `/account` (nome editável, e-mail e nível só leitura) (RF08, RF09, RF42, RF43).
20. [web] Tela `/admin/users`: lista com situação distinta, formulário de criar e editar, confirmações de inativar e redefinir senha, reativar, ações ocultas para si mesmo e mensagem de `LAST_ADMIN` (RF11-RF17, RF44).
21. [web] Navbar: botão "Entrar" com `next` equivalente para visitante; menu da conta com avatar, inicial, cabeçalho, "Meu perfil", "Trocar senha", "Usuários" (só administrador) e "Sair", e versão reduzida com troca pendente, seguindo o padrão ARIA de menu button (RF37-RF40).
22. [web] Telas da demo `/demo/entries`, `/demo/dashboard` e `/demo/cards` reaproveitando os componentes em modo só de visualização (elementos de escrita e checkboxes removidos, sem convite), aviso de demonstração só com "Entrar" (ou "Ir para meus dados" para logado) e `MainNav` apontando para a demo (RF30-RF33, RF36, T10).
23. [web] Remover `NEXT_PUBLIC_API_URL` do `web/Dockerfile`, do `.github/workflows/deploy.yml` e de qualquer código, e confirmar no deploy que a API não fica acessível publicamente (RF45, CA47, R11).
24. [web] Testes unitários: inicial do nome, validação de `next`, menu da conta (teclado, foco e itens por nível), redirecionamento por troca obrigatória e por nível, modo só de visualização.
25. [web] Atualizar o stub de e2e (autenticação, `me` com nível e troca obrigatória, gestão de usuários, 401, 403 e demo, sem cadastro) e os e2e existentes para autenticar antes; novos Playwright + axe para CA08-CA11, CA15-CA24 e CA38-CA46 (T11, R7).

### Fechamento
26. Code-reviewer, com atenção a R1 (filtro de dono em SQL cru), R4 (auditoria da redefinição), R5 (último administrador) e R8 (cache entre usuários e nível desatualizado).
27. Doc-writer: atualizar `docs/api/finance.md` (autenticação, erros novos, rotas de demo), documentar a API de identidade e de gestão de usuários, README (variáveis de ambiente, inicialização do primeiro administrador, seed demo, API não exposta, procedimento de T15) e CHANGELOG.
