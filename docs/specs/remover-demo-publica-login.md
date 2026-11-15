# Spec: Remover a demonstração pública e entrar sempre pelo login (com dica e rotina de exclusão da conta demo)

**Impacto em UI: sim.** No web, saem as telas públicas `/demo/entries`, `/demo/dashboard` e `/demo/cards` e os elementos que só existem nelas (faixa de demonstração, selo "Demonstração", botão "Entrar" do cabeçalho na demo, estado somente leitura). A tela `/login`, que já existe, perde o link "Ver demonstração" e ganha uma dica com a credencial da conta demo. O ui-designer entra só para a dica (texto, posição, acessibilidade) e para o rótulo do campo de identificação, que passa a aceitar também o usuário `demo` (B1). No app mobile não há tela nova; mudam os textos sobre a limpeza da conta demo (B2, B5) e as notas de revisão da App Store. A rotina de exclusão de dados da conta demo não tem UI.

- Data: 2026-11-14
- Branch: `review/demo`
- Status: bloqueantes B1-B5 decididos (rev. 2); requisitos, critérios e tarefas reescritos conforme as decisões (rev. 3); técnicas T1-T9 com o architect.
- Revisões:
  - **rev. 1 (2026-11-14):** versão inicial, com B1-B5 em aberto. Inclui o requisito adicional do usuário: "crie também uma rotina de exclusão de dados para o usuário demo" (RF15-RF19). A antiga pergunta sobre excluir também o registro do usuário da demonstração pública virou premissa (P11) para respeitar o limite de 5 bloqueantes.
  - **rev. 2 (2026-11-14):** B1-B5 decididos pelo usuário, todos pela sugestão padrão (seção 8.1): B1 (a) alias `demo`; B2 sim, dataset de exemplo como estado inicial; B3 escrita mantida; B4 dica só com a conta demo habilitada; B5 rotina diária às 03:00 America/Sao_Paulo, sem revogar sessões, mais execução manual.
  - **rev. 3 (2026-11-14):** os trechos condicionais ("se B1 for (a)", "se B2 for (a)", "se B5 decidir...") foram reescritos de forma afirmativa, seguindo as decisões da rev. 2: linha de impacto em UI, linguagem ubíqua, RF09-RF11, RF14-RF17, RF19, RNF01, RNF04, RNF05, RNF09, CA10, CA11, CA12, CA17-CA19, CA24, CA25, T3, T5, T9, P06, P07, P08 e as tarefas 3, 8, 11, 13, 15, 16, 20-23. O CA20 e a tarefa 12 ficam marcados como "não se aplica"; o item de revogação de sessões da T9 também. A tarefa 1 está concluída. Nenhum ID foi renumerado nem removido.
- Referências: `docs/specs/autenticacao-autorizacao.md` (modo demonstração, RF37, CA41, CA43), `docs/adr/0005-autenticacao-autorizacao-demo.md` (§2.3, §6.5, §7.6, §9.3, §9.6), `docs/specs/mobile-app.md` (rev. 3: B5, B7, B8, B9, RF34-RF36, RF39, P21, P22, P24), `docs/adr/0011-app-mobile-ios.md` (§3.3-§3.5, §5.3, §5.4, §6.1 N4), `docs/api/finance.md`, `docs/api/identity.md`.

## 1. Contexto

Pedido do usuário (literal): "remova as rotas demo, exclua os dados, sem usuario agora direciona para pagina de login, crie uma tela de login e coloque um texto para testar use o usuario demo demo".

Requisito adicional (literal): "crie também uma rotina de exclusão de dados para o usuário demo". Interpretação adotada: uma rotina que apaga os dados criados na conta demo (a que entra com demo/demo) e, se a conta tiver dados de exemplo (B2), restaura o conjunto base, para que cada pessoa que testar encontre o estado inicial.

Hoje o produto tem **duas** coisas chamadas "demo", e esta feature mexe nas duas de formas diferentes:

| | Demonstração pública (sai) | Conta demo / showcase (fica) |
|---|---|---|
| Dono | `DEMO_USER_ID` (`01900000-...-0000000000d1`), `kind = DEMO`, e-mail `demo@finance.invalid` | `SHOWCASE_USER_ID` (`01900000-...-0000000000d2`), `kind = SHOWCASE`, e-mail `demo@showcase.invalid` |
| Login | Não tem senha nem login (CHECK `users_demo_chk`) | Login real por e-mail e senha (`SHOWCASE_ACCOUNT_PASSWORD`) |
| Acesso | Sem autenticação, por `GET /api/demo/*` e `/demo/*` no web | Sessão normal, rotas protegidas |
| Dados | Dataset gerado em código (`buildDemoDataset`), 12 meses + fatura seguinte, 2 cartões | Nasce vazia; limpeza diária às 03:00 SP apaga lançamentos e cartões |
| Escrita | Nenhuma (somente leitura) | Sim (`MANAGE_EXPENSES`); não troca senha nem perfil |
| Quem usa | Web (visitante sem sessão) | App mobile (revisor da Apple) e web |

### 1.1 API (`api/`)

- **Rotas públicas da demonstração:** `presentation/http/demo.controller.ts`, `@Public()` + `@Controller('demo')`, com 10 GETs (`entries/initial-month`, `entries/expenses`, `entries/incomes`, `categories`, `cards`, `invoices`, `cards/:cardId/invoices/:referenceMonth/entries`, `summary`, `dashboard/monthly-series`, `dashboard/category-distribution`), todos lendo `DEMO_USER_ID` via `FinanceReadHandlers`. `FinanceReadHandlers` também é usado pelos controllers protegidos, então **fica**.
- **Geração dos dados da demonstração:**
  - `finance/application/demo/demo-dataset.ts` (`buildDemoDataset`, `DEMO_TEMPLATE_VERSION`), `refresh-demo-dataset.ts` (`RefreshDemoDataset`), `demo-dataset-store.ts` (port);
  - `finance/infrastructure/demo/prisma-demo-dataset-store.ts`: sob advisory lock, apaga todos os lançamentos e cartões do dono e recria o dataset, registrando âncora e versão em `demo_datasets`. Só reescreve se a âncora (mês) ou a versão mudaram;
  - `identity/application/use-cases/bootstrap/ensure-demo-user.ts` (`EnsureDemoUser`) e `User.demo()` em `identity/domain/user/user.ts`;
  - chamados pelo seed (`bootstrap/seed/run-seed.ts`) e por duas tarefas do agendador de manutenção em `app.module.ts` (`ensure-demo-user` e `refresh-demo-dataset`, por intervalo).
- **Banco:** tabela `demo_datasets` (sem FK para `users`), valor `DEMO` no enum `user_kind`, CHECK `users_demo_chk`. `entries.user_id` e `cards.user_id` são `RESTRICT`; `sessions.user_id` é `CASCADE`. O usuário `DEMO_USER_ID` tem hoje 2 cartões e os lançamentos do dataset no banco de produção.
- **O que existe como "dado" de um usuário:** só **lançamentos** (`entries`) e **cartões** (`cards`). **Categorias** não têm tabela: são derivadas dos lançamentos (spec de autenticação, §1). **Faturas** também não têm tabela: são agregações dos lançamentos no cartão por mês de referência. Além disso, o usuário tem **sessões** (`sessions`), que não são dados financeiros.
- **Conta demo (showcase):**
  - `ShowcaseAccount` (`identity/domain/user/showcase-account.ts`), `EnsureShowcaseAccount` (seed, idempotente, liga/desliga pela env, restaura a senha se divergir);
  - senha curta permitida só por `PlainPassword.forShowcaseAccount` (1-72 code points, sem o mínimo de 8). Com `SHOWCASE_ACCOUNT_PASSWORD=demo`, a senha `demo` **já funciona hoje**, sem mudar a política geral de senha;
  - login exige e-mail válido: `login-with-password.ts` passa o identificador por `EmailAddress.create`; `demo` sem `@` cai em `INVALID_CREDENTIALS`. O alias `demo` sem `@` foi **removido por decisão do usuário** na rev. 3 da spec mobile (B5);
  - capacidades (`account-capabilities.ts`): `SHOWCASE` tem só `MANAGE_EXPENSES` (cria, paga, edita e exclui os próprios lançamentos; não troca senha nem perfil; não administra usuários).
- **Rotina de exclusão que já existe (spec mobile RF39, B7, B9):**
  - `PurgeShowcaseData` (`finance/application/use-cases/maintenance/purge-showcase-data.ts`) calcula o último 03:00 de São Paulo e chama o port `ShowcaseDataPurger`. Recebe o dono por parâmetro; o `finance` não conhece o conceito de conta demo;
  - `PrismaShowcaseDataPurger` apaga, numa transação, os lançamentos do dono **criados antes** desse corte e depois os cartões criados antes do corte que não tenham mais lançamentos;
  - registrada em `app.module.ts` como tarefa `purge-showcase-data` com `schedule: { kind: 'daily', at: 03:00 }`, `ownerId = SHOWCASE_USER_ID`, e log "lançamentos removidos: N; cartões removidos: M";
  - o agendador é próprio (`bootstrap/maintenance.scheduler.ts`, `setInterval`/`setTimeout`, **sem** `@nestjs/schedule`), roda só no processo HTTP, e executa as tarefas diárias **também na subida** da API (recuperação de execução perdida, segura por causa do corte);
  - **não** revoga sessões (premissa P22 da spec mobile) e **não** restaura nada: a conta fica vazia;
  - **não existe** hoje um comando manual para disparar a limpeza (a P24 da spec mobile previa um; em `bootstrap/scripts/` só há `recover-admin.ts`);
  - se a conta passar a ter dados de exemplo (B2), essa rotina, como está, os apagaria e deixaria a conta vazia até outra coisa restaurá-los.

### 1.2 Web (`web/`)

- `web/lib/auth/route-policy.ts` (`decideRoute`, chamado por `web/proxy.ts`): `/` sem cookie redireciona para `/demo/entries` (CA41). Rotas protegidas sem cookie já vão para `/login?next=...`. `web/app/page.tsx` repete a regra como fallback.
- Rotas públicas da demonstração: `web/app/(public)/demo/{layout,actions,entries,dashboard,cards}`.
- Código que só existe para a demonstração: `DEMO_MODE` e o modo `"demo"` (`web/lib/app-mode.ts`, `web/components/app-mode.tsx`), `buildDemo()` em `web/lib/api/finance-reader.ts`, `demo-banner*.tsx`, `demo-chip.tsx`, `read-only.tsx` (`WriteOnly`), `sign-in-button.tsx` e `lib/auth/sign-in-href.ts` (botão "Entrar" do cabeçalho na demo), além de ramos `demo`/`basePath` em `app-header`, `app-sidebar`, `main-nav`, `nav-drawer`, `app-footer` e nas telas de `features/entries`, `features/dashboard` e `features/cards`. Há testes de componente, e2e Playwright (`e2e/demo-shell.pw.ts` e outros) e o stub (`e2e/stub-api/server.mjs`) cobrindo a demo.
- **Tela de login já existe** (`web/app/(auth)/login/page.tsx`, `login-form.tsx`, `_components/auth-card.tsx`): campos "E-mail" (`type="email"`, `noValidate`) e "Senha", banners de credencial inválida, 429 e sessão expirada. No rodapé estão "Não tem acesso ou esqueceu a senha? Fale com um administrador." e o link **"Ver demonstração"** para `/demo/entries`, que precisa sair. O pedido "crie uma tela de login" é atendido ajustando essa tela, sem criar outra (premissa P01).
- `/privacy` e `/support` são públicas e continuam assim (exigidas pela App Store). `/privacy` já diz que os lançamentos e cartões da conta de demonstração são apagados todos os dias às 03:00.

### 1.3 App mobile (`mobile/`)

- **Não consome `/api/demo/*`** (o modo demonstração sem login saiu na rev. 2 da spec mobile). A remoção das rotas não quebra o app.
- Usa a conta demo: e-mail `demo@showcase.invalid` e senha `demo` (testes em `__tests__/screens/auth.test.tsx`, fluxo Maestro `e2e/maestro/demo-account-actions.yaml`, notas de revisão no `mobile/README.md`), e mostra o aviso de limpeza diária (`DEMO_CLEANUP_TEXT`) no Dashboard e em Ajustes.
- O impacto depende de B1 (identificador `demo`), B2 (dados de exemplo) e B5 (periodicidade e sessões da rotina): o login passa pela API, então um alias valeria no app sem mudança de código; textos que digam "a conta nasce vazia" ou "apagada às 03:00" mudam se a regra mudar; se a rotina revogar sessões, o app recebe 401 e volta ao login (comportamento atual de sessão encerrada, RF04 da spec mobile).

## 2. Linguagem ubíqua

| Termo | Definição |
|---|---|
| **Demonstração pública** | Modo atual em que um visitante sem sessão vê dados de exemplo somente leitura em `/demo/*` (web) e `GET /api/demo/*` (API). **Deixa de existir** nesta feature. |
| **Usuário da demonstração pública** | Usuário interno `DEMO_USER_ID`, `kind = DEMO`, sem senha e sem login, dono dos dados da demonstração pública. Ele e os dados dele são excluídos (RF05, P11). |
| **Dataset de exemplo (conjunto base)** | Conjunto de cartões e lançamentos gerado em código por `buildDemoDataset` (12 meses até o mês âncora, mais a fatura do mês seguinte, 2 cartões). Hoje pertence ao usuário da demonstração pública; passa a ser o estado inicial da conta demo (B2). |
| **Conta demo** | Usuário real `SHOWCASE_USER_ID`, `kind = SHOWCASE`, nome "Conta de demonstração", e-mail canônico `demo@showcase.invalid`, alias de login `demo` (B1), senha definida por `SHOWCASE_ACCOUNT_PASSWORD`. Compartilhada por quem conhece a credencial. É a conta que a dica do login indica. |
| **Conta demo habilitada** | Estado em que a conta demo existe e está `ACTIVE` (env `SHOWCASE_ACCOUNT_PASSWORD` preenchida no seed). Sem a env, o seed a inativa. |
| **Estado inicial da conta demo** | O que a conta demo contém logo depois da rotina de exclusão: o dataset de exemplo ancorado no mês corrente em America/Sao_Paulo (B2). |
| **Dados da conta demo** | Lançamentos (despesas, parcelas e receitas, pendentes ou pagos) e cartões cujo dono é a conta demo. Categorias e faturas são derivadas dos lançamentos e somem ou voltam junto com eles. Sessões não são dados e a rotina não as revoga (B5). |
| **Rotina de exclusão da conta demo** | Processo que leva a conta demo de volta ao estado inicial: apaga os dados da conta demo e restaura o dataset de exemplo. Roda todos os dias às 03:00 America/Sao_Paulo (B5) e pode ser disparada manualmente (RF17). Substitui e amplia a "limpeza diária da conta demo" da spec mobile (RF39). |
| **Execução agendada** | Disparo automático da rotina todos os dias às 03:00 America/Sao_Paulo (B5). |
| **Execução manual** | Disparo da rotina por um operador (ex.: antes de enviar uma versão do app para revisão), fora do horário agendado. Não é exposta por HTTP. |
| **Identificador de login** | O que a pessoa digita no primeiro campo do login: um e-mail ou o alias `demo` (B1). |
| **Alias `demo`** | Identificador `demo` (sem `@`), aceito só no login, que corresponde à conta demo (B1). Não é um e-mail e não é gravado em lugar nenhum. |
| **Dica da conta demo** | Texto na tela de login com a credencial da conta demo: "Para testar, use o usuário demo e a senha demo." Aparece só com a conta demo habilitada (B4). |
| **Rota protegida** | Rota do web que exige sessão: `/entries`, `/dashboard`, `/cards`, `/account`, `/admin` (e subcaminhos). |

## 3. Requisitos funcionais

### Remoção da demonstração pública

- **RF01 - API sem rotas de demonstração.** As 10 rotas `GET /api/demo/*` deixam de existir. Qualquer requisição a `/api/demo/...` responde como rota inexistente (404 `ROUTE_NOT_FOUND` no formato `{ code, message, details }`), com ou sem sessão. Nenhuma rota pública nova de leitura de dados financeiros é criada no lugar.
- **RF02 - Web sem telas de demonstração.** `/demo`, `/demo/entries`, `/demo/dashboard`, `/demo/cards` e qualquer subcaminho de `/demo` deixam de existir no web. Respondem como as demais rotas inexistentes (página 404 do web, premissa P04), com ou sem sessão.
- **RF03 - Sem vestígios de interface da demonstração.** Somem da interface: faixa/aviso de demonstração, selo "Demonstração", botão "Entrar" do cabeçalho exibido na demo, estados somente leitura que só existiam para o visitante e o link "Ver demonstração" da tela de login. Nenhum link do web aponta para `/demo`.
- **RF04 - Fim da geração de dados para o usuário da demonstração pública.** O seed e o agendador de manutenção deixam de criar o usuário `DEMO_USER_ID` e de gerar ou atualizar dados para ele. Depois do deploy, nenhum processo recria esse usuário nem os dados dele.
- **RF05 - Exclusão dos dados da demonstração pública.** No deploy, os dados do usuário `DEMO_USER_ID` são excluídos do banco de forma definitiva: lançamentos, cartões, o registro de controle em `demo_datasets`, as sessões (não deveriam existir) e o próprio registro do usuário (P11). Regras:
  - afeta **somente** `DEMO_USER_ID`; nenhum dado da conta demo (`SHOWCASE_USER_ID`), do primeiro administrador ou de outro usuário é alterado;
  - é idempotente: rodar de novo, ou rodar num banco onde esse usuário nunca existiu (ambiente novo, testes), não falha nem altera nada;
  - roda em todos os ambientes (desenvolvimento, staging, produção), sem depender de ação manual;
  - não há recuperação depois da execução (dados de exemplo regeráveis, sem valor de negócio; risco R2).

  É uma exclusão **única**, de um usuário que deixa de existir. Não confundir com a rotina recorrente da conta demo (RF15-RF19).

### Acesso sem sessão

- **RF06 - Raiz sem sessão vai para o login.** `/` sem cookie de sessão redireciona para `/login` (sem `next`). Com cookie, continua indo para `/entries`. Vale para a decisão no `proxy.ts` e para o fallback de `web/app/page.tsx`. Substitui o CA41 da spec de autenticação.
- **RF07 - Rotas protegidas sem sessão vão para o login.** Comportamento atual, mantido: rota protegida sem cookie redireciona para `/login?next=<caminho+query>`; cookie inválido ou sessão expirada leva ao login com `reason=expired` quando aplicável. Depois de entrar, a pessoa volta ao `next` (se aceito pelo servidor) ou a `/entries`.
- **RF08 - Páginas públicas que continuam públicas.** `/login`, `/privacy` e `/support` continuam acessíveis sem sessão. Nenhuma outra tela de dados fica acessível sem sessão.

### Tela de login

- **RF09 - Tela de login.** A tela `/login` atual é mantida, com o comportamento de hoje (campos, validação de presença, banners de `INVALID_CREDENTIALS`, 429 e sessão expirada, "Entrando…", redirecionamento para `next`). Mudanças:
  - sai o link "Ver demonstração";
  - fica o texto "Não tem acesso ou esqueceu a senha? Fale com um administrador.";
  - entra a dica da conta demo (RF10);
  - o primeiro campo passa a aceitar e-mail ou o usuário `demo` (B1). Rótulo e tipo do campo são definidos pelo ui-designer (ex.: "E-mail ou usuário"); o campo não pode bloquear no navegador um valor sem `@`.
- **RF10 - Dica da conta demo.** Com a conta demo habilitada (B4), a tela de login mostra o texto "Para testar, use o usuário **demo** e a senha **demo**." (texto final com o ui-designer). Regras:
  - é só texto informativo; não preenche os campos sozinha nem faz login automático (um atalho "Preencher" fica fora de escopo, seção 6);
  - é lida por leitor de tela na ordem natural da página, sem roubar o foco do formulário;
  - com a conta demo desabilitada (env vazia, conta inativa), a dica não aparece (B4);
  - aparece também quando a tela de login mostra o banner de sessão expirada ou de erro;
  - pode vir acompanhada de uma linha curta dizendo que a conta é compartilhada e volta ao estado de exemplo todos os dias às 03:00 (texto final com o ui-designer).
- **RF11 - Login com a credencial da dica (B1).** Digitar `demo` no primeiro campo e `demo` na senha entra na conta demo e leva a `/entries` (ou ao `next`). Regras:
  - o alias é `demo`, sem diferenciar maiúsculas e minúsculas e ignorando espaços nas pontas (mesma normalização do e-mail);
  - o alias vale só para a conta demo e só no login (`POST /api/auth/login`), portanto vale também no app mobile;
  - o e-mail canônico `demo@showcase.invalid` continua funcionando, no web e no app;
  - qualquer outro identificador sem `@` continua respondendo `INVALID_CREDENTIALS`, sem enumerar usuários;
  - com a conta demo desabilitada ou inativa, `demo`/`demo` responde `INVALID_CREDENTIALS`, como qualquer credencial inválida;
  - limite de tentativas: o alias e o e-mail canônico da conta demo contam como o mesmo identificador para o limite por identificador, e o limite por IP vale normalmente (ver T3).
- **RF12 - Senha `demo`.** A senha da conta demo continua vindo de `SHOWCASE_ACCOUNT_PASSWORD`, e a senha curta continua aceita só no provisionamento dessa conta (`PlainPassword.forShowcaseAccount`). A política geral de senha (8 a 72 caracteres) não muda para nenhum outro usuário, e nenhuma tela ou rota permite definir `demo` como senha de outra conta. Em todos os ambientes em que a dica aparece, a env precisa valer `demo` (premissa P03, risco R4).

### Conta demo depois da mudança

- **RF13 - O que a conta demo pode fazer.** Sem mudança em relação à spec mobile (RF35); a escrita é mantida (B3): Dashboard, lançamentos, faturas, cartões, criar, pagar, editar e excluir os próprios lançamentos; não administra usuários, não troca a própria senha e não altera o próprio perfil.
- **RF14 - Estado inicial da conta demo (B2).** A conta demo tem o dataset de exemplo como estado inicial:
  - ao ser provisionada (seed), a conta demo recebe o dataset de exemplo ancorado no mês corrente (America/Sao_Paulo), com o mesmo conteúdo que a demonstração pública mostrava hoje;
  - o dataset nunca é gravado em outro usuário;
  - o dataset é gravado só se a conta demo estiver habilitada; desabilitar a conta (env vazia) não apaga dados nem a conta (comportamento atual de inativação).

### Rotina de exclusão de dados da conta demo (requisito adicional)

- **RF15 - O que a rotina faz.** A rotina leva a conta demo de volta ao estado inicial (RF14):
  1. apaga **todos** os dados da conta demo existentes no momento da execução: lançamentos (despesas, parcelas e receitas, pendentes ou pagos, criados por visitantes ou vindos do dataset e depois alterados) e cartões. Categorias e faturas somem junto, porque são derivadas dos lançamentos (P12);
  2. grava o dataset de exemplo ancorado no mês corrente (America/Sao_Paulo) (B2);
  3. **não** encerra as sessões abertas da conta demo (B5): quem está logado continua e vê o estado inicial na próxima atualização.

  Regras:
  - age **só** sobre a conta demo (`SHOWCASE_USER_ID`); nenhum outro usuário é afetado;
  - os passos 1 e 2 são uma operação só (tudo ou nada): se a restauração falhar, nada é apagado e a conta fica como estava;
  - não altera a conta em si: nome, e-mail, nível, status e senha continuam iguais (a senha é responsabilidade do seed, RF36 da spec mobile);
  - é idempotente: rodar duas vezes seguidas deixa a conta no mesmo estado inicial, sem erro;
  - com a conta demo desabilitada (inativa) ou inexistente, a rotina não grava o dataset; só apaga dados que existirem (P13) ou não faz nada;
  - substitui a regra atual de apagar só o que foi criado antes do último 03:00: o objetivo passa a ser "estado inicial", e não "apagar o que é antigo" (ver T9 sobre a recuperação na subida da API).
- **RF16 - Execução agendada (B5).** A rotina roda automaticamente todos os dias às 03:00 America/Sao_Paulo (06:00 UTC, sem horário de verão vigente). Se a API estiver fora do ar no horário, a execução perdida é feita na próxima oportunidade (mesma garantia de hoje, P21 da spec mobile), sem apagar de forma inesperada dados criados depois do horário perdido por quem está usando (regra exata em T9).
- **RF17 - Execução manual (B5).** Um operador consegue disparar a mesma rotina sob demanda, com o mesmo resultado da execução agendada (ex.: antes de enviar uma versão do app para revisão da Apple ou depois de um abuso). Regras:
  - não é exposta por HTTP nem pelo web (nenhuma rota pública ou administrativa nova);
  - exige acesso ao ambiente de execução da API (mesmo nível de acesso do `recover-admin`);
  - devolve o resultado: quantos lançamentos e cartões foram apagados e quantos foram restaurados.
- **RF18 - Execução única por vez.** Duas execuções simultâneas (agendada e manual, ou duas réplicas) não podem deixar a conta duplicada, vazia por engano ou parcialmente restaurada. Uma execução espera a outra ou é descartada (mecanismo em T9).
- **RF19 - Registro.** Cada execução (agendada ou manual) registra em log: origem (agendada/manual), início, fim, resultado (sucesso/falha), quantidades apagadas e restauradas. Sem dados sensíveis (nunca a senha, nunca o conteúdo dos lançamentos).

## 4. Requisitos não funcionais

- **RNF01 - Arquitetura.** Clean Architecture/DDD do CLAUDE.md. A rotina continua com o `finance` sem conhecer o conceito de conta demo: o dono vem da raiz de composição, como em `PurgeShowcaseData`. A rotina não mexe em sessões (B5), então não depende do `identity`. A regra do alias `demo` (B1) fica em `identity` (domínio/aplicação). Prisma só em `infrastructure`.
- **RNF02 - Exclusão segura.** Tanto a exclusão única do RF05 quanto a rotina recorrente rodam em transação, filtram pelo id literal do dono, respeitam a ordem das FKs `RESTRICT` (lançamentos antes de cartões, cartões antes do usuário no RF05) e registram as quantidades removidas, sem dados sensíveis. RF05: rollback por forward-fix (dados regeráveis).
- **RNF03 - Desempenho da rotina.** Uma execução (apagar + restaurar o dataset de exemplo) termina em poucos segundos com o volume esperado (dataset de exemplo + até alguns milhares de lançamentos de visitantes) e não bloqueia as demais rotas da API além da transação dela. Sugestão de referência: até 10 s com 10.000 lançamentos na conta demo.
- **RNF04 - Compatibilidade.** O app mobile em produção continua funcionando sem nova versão: nenhum contrato usado por ele muda (login, `me`, finance). O alias `demo` é aditivo. Clientes que ainda chamem `/api/demo/*` (nenhum conhecido) passam a receber 404.
- **RNF05 - Segurança.**
  - Nenhuma rota pública nova. A superfície sem autenticação da API diminui (saem 10 GETs). A execução manual da rotina não é exposta por HTTP.
  - O alias `demo` não muda a resposta genérica de credenciais inválidas nem permite enumerar usuários.
  - A credencial `demo`/`demo` é pública por definição; as proteções existentes da conta demo (nível `USER`, sem troca de senha, sem administração, rotina de exclusão, `/api/admin/*` fora do host público) continuam valendo. Ver R1.
- **RNF06 - Datas.** O horário da rotina é definido em America/Sao_Paulo e convertido para UTC pelo agendador, independentemente do fuso do servidor. O mês âncora do dataset restaurado é o mês corrente em America/Sao_Paulo no momento da execução.
- **RNF07 - Acessibilidade.** A dica atende WCAG 2.1 AA (contraste nos dois temas, texto real e não imagem, legível com zoom de 200%). A credencial destacada não depende só de cor.
- **RNF08 - Idioma e textos.** pt-BR, sem emojis. Textos finais com o ui-designer.
- **RNF09 - Testes (CLAUDE.md).**
  - API: e2e (supertest) para a ausência das rotas `/api/demo/*`; unitários para o alias `demo` e para a rotina (orquestração, relógio falso com horário de São Paulo, sessões preservadas, conta inativa); integração com Postgres real (testcontainers) para a exclusão do RF05 (idempotência, não toca outros usuários) e para a rotina (apaga tudo, restaura o dataset, tudo ou nada, não toca outros usuários, não toca sessões, execução concorrente). Cobertura de pelo menos 80% em domain e application.
  - Os testes que existem só por causa da demonstração pública (`test/e2e/demo.e2e-spec.ts`, `test/fakes/demo-fakes.ts`, specs de `RefreshDemoDataset`/`PrismaDemoDatasetStore`, `EnsureDemoUser`, `User.demo`) são removidos ou adaptados junto com o código que testam; nenhum teste é removido sem que o comportamento correspondente também saia. Os testes atuais de `PurgeShowcaseData` e `PrismaShowcaseDataPurger` são adaptados à nova regra (RF15).
  - Web: unitários de `decideRoute` (`/` sem cookie para `/login`), testes de componente da tela de login (sem "Ver demonstração", dica visível só com a conta demo habilitada, campo aceitando `demo`), e2e Playwright do redirecionamento e do login com `demo`/`demo`; remoção dos testes e do stub que cobrem `/demo/*`.
  - Mobile: ajustar testes de tela e o fluxo Maestro que dependem dos textos da limpeza e da conta vazia (B2, B5); acrescentar o caso de login com o alias `demo`.
- **RNF10 - Observabilidade.** RF19 para a rotina; o seed e a exclusão única do RF05 também registram as quantidades em log.

## 5. Critérios de aceite

### API

**CA01 - Rotas de demonstração removidas (RF01)**
- Given a API em execução, com ou sem um Bearer válido
- When se chama `GET /api/demo/entries/expenses?month=2026-11`, `GET /api/demo/summary?month=2026-11` ou qualquer outro caminho sob `/api/demo/`
- Then a resposta é 404 com `{ code: "ROUTE_NOT_FOUND", message, details }` e nenhum dado financeiro é retornado.

**CA02 - Rotas protegidas continuam iguais (RF01)**
- Given a usuária "ana@exemplo.com" logada
- When ela chama `GET /api/entries/expenses?month=2026-11` e `GET /api/summary?month=2026-11`
- Then as respostas são as mesmas de antes da mudança (mesmo contrato, só dados dela).

**CA03 - Exclusão dos dados da demonstração pública (RF05)**
- Given um banco com o usuário `DEMO_USER_ID` dono de 2 cartões e N lançamentos, uma linha em `demo_datasets` para ele, a conta demo `SHOWCASE_USER_ID` com 3 lançamentos e a usuária Ana com 10 lançamentos
- When o deploy aplica a exclusão
- Then não resta o usuário `DEMO_USER_ID` nem lançamento, cartão ou linha de `demo_datasets` dele
- And os 3 lançamentos da conta demo e os 10 de Ana continuam intactos.

**CA04 - Exclusão idempotente (RF05)**
- Given um banco em que `DEMO_USER_ID` nunca existiu, ou em que a exclusão já rodou
- When a exclusão roda de novo
- Then ela termina sem erro e nada é alterado.

**CA05 - Nada recria a demonstração pública (RF04)**
- Given a exclusão já aplicada
- When o seed roda e o agendador de manutenção executa todas as tarefas
- Then `DEMO_USER_ID` não existe no banco e não há dados dele.

### Web

**CA06 - Raiz sem sessão vai para o login (RF06)**
- Given um visitante sem cookie de sessão
- When ele abre `/`
- Then é redirecionado para `/login`, sem passar por `/demo/*`.

**CA07 - Raiz com sessão vai para os lançamentos (RF06)**
- Given Ana com sessão válida
- When ela abre `/`
- Then é redirecionada para `/entries`.

**CA08 - Rota protegida sem sessão (RF07)**
- Given um visitante sem cookie
- When ele abre `/dashboard?month=2026-11`
- Then é redirecionado para `/login?next=%2Fdashboard%3Fmonth%3D2026-11`
- When ele entra com credenciais válidas
- Then chega a `/dashboard?month=2026-11`.

**CA09 - Telas de demonstração não existem mais (RF02)**
- Given um visitante com ou sem sessão
- When ele abre `/demo/entries`, `/demo/dashboard` ou `/demo/cards`
- Then não vê dados de exemplo e recebe a página 404 do web (P04).

**CA10 - Tela de login sem link de demonstração e com a dica (RF09, RF10, B1, B4)**
- Given a conta demo habilitada
- When um visitante abre `/login`
- Then vê o campo que aceita e-mail ou usuário (rótulo do ui-designer, ex.: "E-mail ou usuário"), "Senha", "Entrar", o texto "Não tem acesso ou esqueceu a senha? Fale com um administrador." e a dica "Para testar, use o usuário demo e a senha demo."
- And não há link "Ver demonstração" nem qualquer link para `/demo`.

**CA11 - Dica com a conta demo desabilitada (RF10, B4)**
- Given a conta demo desabilitada (sem `SHOWCASE_ACCOUNT_PASSWORD`, conta inativa)
- When um visitante abre `/login`
- Then a dica não aparece
- And, se alguém tentar entrar com `demo`/`demo`, o banner é "E-mail ou senha inválidos.".

**CA12 - Login com a credencial da dica (RF11, B1)**
- Given a conta demo habilitada com a senha `demo`
- When um visitante digita `demo` no primeiro campo e `demo` na senha e toca em "Entrar"
- Then entra como "Conta de demonstração" e chega a `/entries`
- And o mesmo vale para `Demo` e para ` demo ` (com espaços nas pontas), no web e no app mobile.

**CA13 - Login com o e-mail canônico continua funcionando (RF11)**
- Given a conta demo habilitada
- When se entra com `demo@showcase.invalid` e `demo`, no web ou no app mobile
- Then o login funciona como hoje.

**CA14 - Outros identificadores sem `@` continuam inválidos (RF11, RNF05)**
- Given os identificadores `admin`, `ana` e `demo2`
- When se tenta entrar com qualquer um deles e qualquer senha
- Then o banner é "E-mail ou senha inválidos.", igual ao de uma senha errada, e nenhuma sessão é criada.

**CA15 - Política de senha inalterada para os demais (RF12)**
- Given um administrador criando a usuária "bia@exemplo.com"
- When ele define a senha `demo`
- Then a API recusa com erro de campo `TOO_SHORT`, como hoje.

**CA16 - Dica acessível (RF10, RNF07)**
- Given a tela de login no tema claro e no escuro
- When ela é inspecionada com leitor de tela e verificador de contraste
- Then a dica é lida como texto (sem ganhar foco antes do primeiro campo) e tem contraste AA nos dois temas.

### Conta demo e rotina de exclusão

**CA17 - Conta demo com dados de exemplo ao ser provisionada (RF14, B2)**
- Given a env `SHOWCASE_ACCOUNT_PASSWORD=demo` e a conta demo ainda inexistente, em 2026-11-14
- When o seed roda
- Then a conta demo existe, ativa, e `GET /api/summary?month=2026-11` com a sessão dela devolve totais diferentes de zero, com os mesmos valores que a demonstração pública mostrava para novembro de 2026
- And ela tem os 2 cartões do dataset e lançamentos de 2025-12 a 2026-11, mais a fatura de 2026-12.

**CA18 - Rotina agendada volta ao estado inicial (RF15, RF16, B2, B5)**
- Given a conta demo com o dataset de exemplo, mais uma despesa "Teste visitante" e um cartão "Cartão X" criados por um visitante às 15:00 de 2026-11-14
- When a rotina roda às 03:00 de 2026-11-15 (America/Sao_Paulo; 06:00 UTC)
- Then "Teste visitante" e "Cartão X" não existem mais, e os dados da conta são exatamente o dataset de exemplo ancorado em 2026-11
- And as categorias que só existiam por "Teste visitante" não aparecem mais em `GET /api/categories`
- And os dados de Ana não mudam.

**CA19 - Alterações em dados de exemplo são desfeitas (RF15, B2, B3)**
- Given a conta demo com o dataset de exemplo
- When um visitante exclui uma despesa de exemplo, marca outra como paga e edita o valor de uma terceira
- Then as mudanças valem até a próxima execução da rotina, que devolve o dataset exatamente ao estado original.

**CA20 - Conta vazia quando não há dataset (RF15).** **Não se aplica (B2 decidida com dataset de exemplo).** Mantido só para preservar a numeração. Texto original: com B2 (b), a rotina deixaria a conta demo sem lançamentos e sem cartões, com totais zerados.

**CA21 - Tudo ou nada (RF15)**
- Given uma falha de banco durante a restauração do dataset
- When a execução é interrompida
- Then a conta demo fica exatamente como antes da execução (nada apagado, nada parcial), a falha é registrada em log (RF19) e a próxima execução tenta de novo.

**CA22 - Idempotência (RF15)**
- Given a rotina acabou de rodar com sucesso
- When ela roda de novo imediatamente
- Then termina sem erro e a conta continua no mesmo estado inicial.

**CA23 - Só a conta demo é afetada (RF15)**
- Given Ana com 10 lançamentos e 1 cartão, o primeiro administrador com 4 lançamentos e a conta demo com dados de visitantes
- When a rotina roda
- Then só os dados da conta demo mudam; os de Ana e do administrador continuam idênticos.

**CA24 - Sessões preservadas (RF15, B5)**
- Given um visitante logado na conta demo pelo web e outro pelo app
- When a rotina roda
- Then os dois continuam logados (nenhuma chamada seguinte responde 401 por causa da rotina) e veem o estado inicial na próxima atualização
- And o número de sessões da conta demo no banco é o mesmo antes e depois da execução.

**CA25 - Execução manual (RF17)**
- Given um operador com acesso ao ambiente da API
- When ele dispara a rotina manualmente às 14:00 de 2026-11-20
- Then a conta demo volta ao estado inicial como na execução agendada, o resultado (quantidades apagadas e restauradas) é exibido e registrado com origem "manual"
- And não existe rota HTTP que faça isso (`POST`/`GET` em qualquer caminho de manutenção responde 404).

**CA26 - Execuções simultâneas (RF18)**
- Given uma execução agendada em andamento
- When uma execução manual é disparada ao mesmo tempo
- Then ao final a conta tem exatamente um dataset de exemplo (sem cartões ou lançamentos duplicados) e nenhum erro de chave duplicada é exposto.

**CA27 - Execução perdida (RF16)**
- Given a API fora do ar entre 02:30 e 04:00 de 2026-11-15
- When ela sobe às 04:00
- Then a rotina das 03:00 é recuperada conforme a regra de T9, e a conta demo fica no estado inicial ancorado em 2026-11.

**CA28 - Conta demo desabilitada (RF15)**
- Given a conta demo inativa (env vazia)
- When a rotina roda
- Then ela não grava o dataset de exemplo, não reativa a conta e registra o resultado em log.

**CA29 - Virada do mês (RF15, RNF06)**
- Given a conta demo com o dataset ancorado em 2026-11
- When a rotina roda às 03:00 de 2026-12-01 (America/Sao_Paulo)
- Then o dataset restaurado fica ancorado em 2026-12 (12 meses de 2026-01 a 2026-12, mais a fatura de 2027-01).

### Mobile

**CA30 - App em produção continua funcionando (RNF04)**
- Given o app mobile já publicado
- When a API nova é implantada
- Then login (`demo@showcase.invalid`/`demo` e usuários comuns), Dashboard, Finanças e ações funcionam sem atualização do app.

## 6. Fora de escopo

- Criar uma tela de login nova ou redesenhar a atual: a tela existente é mantida e só ajustada (RF09).
- Cadastro público, "esqueci a senha" e login social.
- Botão "Preencher"/"Entrar como demo" que preenche ou envia a credencial automaticamente.
- Dica da conta demo no app mobile (o revisor da Apple recebe a credencial nas notas de revisão; P07).
- Mudar a política geral de senha.
- Remover o valor `DEMO` do enum `user_kind` do PostgreSQL (não é removível sem recriar o tipo; fica inofensivo). A limpeza de código que trata `kind = DEMO` é decisão técnica (T4).
- Mudar as permissões da conta demo além do que B3 decidir.
- Disparar a rotina de exclusão pelo web, por uma tela de administração ou por qualquer rota HTTP.
- Rotina de exclusão para outros usuários (só a conta demo).
- Limite de volume de escrita da conta demo (continua como na spec mobile, T12).
- Mudanças em `/privacy` e `/support`, salvo ajuste de texto sobre a conta demo (P08).

## 7. Riscos

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | **Credencial pública e trivial (`demo`/`demo`) exibida na própria tela de login**, agora vista por qualquer visitante do site, não só pelo revisor da Apple. Aumenta abuso: conteúdo ofensivo ou dados pessoais visíveis a outros visitantes, volume de escrita, tentativas de login que disparam o limite por identificador. | Alto | Nível `USER`, sem troca de senha e de perfil, sem administração; rotina de exclusão (RF15) com periodicidade definida em B5 e execução manual (RF17); isenção do bloqueio por identificador já existente para a conta demo, mantido o limite por IP; aviso de conta compartilhada; interruptor pela env (B4 a). |
| R2 | **Exclusão definitiva e irreversível** dos dados de `DEMO_USER_ID` (RF05) e, a cada execução, dos dados da conta demo (RF15). Um filtro errado apagaria dados de usuários reais. | Alto se errar, baixo se certo | Filtro por id literal, transação, testes de integração que provam que outros usuários não mudam (CA03, CA23), backup do banco antes do deploy (P05). |
| R3 | **A rotina atual apaga e não restaura**: se B2 for (a) e a restauração não for feita na mesma operação, a conta fica vazia depois de cada execução. | Médio | RF15 exige apagar e restaurar como uma operação só (CA18, CA21). |
| R4 | **Dica fixa e senha configurável divergem**: a dica diz `demo`, mas a env pode ter outro valor em algum ambiente, e o login com a dica falha. | Médio | P03 e T2. |
| R5 | **Reversão de decisão anterior (alias `demo`)**: a rev. 3 da spec mobile removeu o alias por decisão do usuário; reintroduzir muda o ADR 0011 (§3.3, §3.5, T13). | Médio | B1 explícita, com alternativas sem alias. |
| R6 | **Notas de revisão da App Store desatualizadas**: se B1, B2 ou B5 mudarem a credencial, o "nasce vazia" ou o horário da limpeza, o revisor encontra algo diferente do que as notas dizem. Uma execução no meio da revisão também pode confundir o revisor. | Médio para a publicação | Atualizar `mobile/README.md` e as notas antes do próximo envio; execução manual (RF17) antes de enviar; evitar enviar perto do horário da rotina. |
| R7 | **Recuperação na subida da API apaga dados de quem está testando**: hoje a tarefa diária roda também a cada subida (deploy, reinício). Com a nova regra "apagar tudo e restaurar", cada deploy zeraria a conta no meio do uso. | Médio | T9: a recuperação na subida só roda se a última execução bem-sucedida for anterior ao último horário agendado. |
| R8 | **Mais de uma réplica da API** executaria a rotina em paralelo (o agendador é por processo). | Baixo hoje (uma réplica) | RF18, CA26 e T9 (lock no banco). |
| R9 | **Remoção ampla no web** (modo `demo` espalhado por cabeçalho, navegação, telas e testes) pode quebrar as telas protegidas se feita de forma incompleta. | Médio | Testes de componente e e2e das telas protegidas como regressão; remoção em tarefas pequenas. |
| R10 | **Links externos e favoritos para `/demo/*`** deixam de funcionar. | Baixo | P04 (404 do web). |

## 8. Perguntas em aberto

### 8.1 Bloqueantes (mudam regra de negócio)

**B1 - Como a pessoa digita "demo" no login? Decidido (rev. 2).**
- **Decisão:** opção (a). O identificador `demo` é aceito como alias da conta demo, só no login (web e app, porque a regra fica na API). O e-mail canônico `demo@showcase.invalid` continua valendo. A dica fica "use o usuário demo e a senha demo" (RF09-RF11, CA12-CA14).
- Contexto: o login é por e-mail; `demo` não é e-mail válido e hoje responde "E-mail ou senha inválidos.". O alias `demo` sem `@` foi removido por decisão sua na rev. 3 da spec mobile.
- Opções:
  - (a) aceitar o identificador `demo` como alias da conta demo, só no login (web e app, porque a regra fica na API). O e-mail canônico `demo@showcase.invalid` continua valendo. O campo passa a se chamar algo como "E-mail ou usuário". A dica fica "use o usuário demo e a senha demo";
  - (b) trocar o e-mail da conta demo por um mais fácil de digitar (ex.: `demo@demo.invalid`) e exibir esse e-mail na dica. Exige mudar a constante, o CHECK `users_showcase_chk` (migration), o app e as notas de revisão;
  - (c) manter tudo como está e exibir na dica "use o e-mail demo@showcase.invalid e a senha demo". Nenhuma mudança na API.
- **Sugestão padrão:** (a). É o que você pediu literalmente ("usuário demo demo"), não exige mudar dados nem o app, e o e-mail canônico continua funcionando para quem já o usa (revisor da Apple). Custo: reverte a remoção do alias da rev. 3 e exige atualizar o ADR 0011 (R5). Se preferir não mexer na API, (c).
- A senha `demo` não é bloqueante: ela já é aceita só para a conta demo, pela env (RF12, P03).

**B2 - A conta demo passa a ter dados de exemplo (estado inicial com o conjunto base)? Decidido (rev. 2).**
- **Decisão:** sim, opção (a). O estado inicial da conta demo é o dataset de exemplo que a demonstração pública mostrava (reaproveitando o gerador); o seed o grava e a rotina de exclusão apaga tudo e o restaura (RF14, RF15, CA17-CA19).
- Contexto: hoje ela nasce vazia e é zerada todo dia às 03:00. Com a demonstração pública removida, quem entra pela dica veria tudo vazio.
- Opções:
  - (a) sim: o estado inicial é o mesmo dataset de exemplo que a demonstração pública mostrava (reaproveitando o gerador); o seed o grava e a rotina de exclusão apaga tudo e o restaura (RF14, RF15);
  - (b) não: o estado inicial é a conta vazia; o visitante cria os próprios dados para testar, e a rotina só apaga.
- **Sugestão padrão:** (a). Preserva a experiência de "ver o produto funcionando" que a demonstração pública oferecia, agora atrás do login. Efeitos: a spec mobile (RF34 "nasce sem dados", RF25 notas de revisão), `/privacy` e os textos do app (`DEMO_CLEANUP_TEXT`) passam a dizer "volta ao estado de exemplo" em vez de "é apagada".

**B3 - A conta demo pode escrever ou fica somente leitura? Decidido (rev. 2).**
- **Decisão:** opção (a), escrita mantida como hoje (`MANAGE_EXPENSES`), com a rotina de exclusão desfazendo tudo periodicamente (RF13, CA19).
- Contexto: hoje ela pode criar, pagar, editar e excluir os próprios lançamentos e cadastrar cartões (`MANAGE_EXPENSES`, decisão da spec mobile para o revisor da Apple). A demonstração pública que sai era somente leitura.
- Opções:
  - (a) manter escrita, como hoje, com a rotina de exclusão desfazendo tudo periodicamente;
  - (b) somente leitura (sem criar, pagar, editar, excluir nem cadastrar cartão). A rotina passaria a ser só uma rede de segurança.
- **Sugestão padrão:** (a). A Apple exige que o revisor consiga usar o app (spec mobile, R3), a rotina de exclusão limita o abuso, e (b) quebraria o app publicado para o revisor.

**B4 - A dica aparece sempre ou só quando a conta demo está habilitada? Decidido (rev. 2).**
- **Decisão:** opção (a). A dica aparece só quando a conta demo estiver habilitada; com ela desligada, a dica some (RF10, CA10, CA11). Como o web descobre isso fica em T2.
- Contexto: a conta pode ser desligada pela env (sem deploy de código).
- Opções:
  - (a) só quando a conta demo estiver habilitada; com ela desligada, a dica some;
  - (b) sempre.
- **Sugestão padrão:** (a). Evita mostrar uma credencial que não funciona (CA11) e permite tirar a dica de produção sem novo deploy, só desligando a conta. Como o web descobre isso é técnico (T2).

**B5 - Periodicidade da rotina de exclusão e o que acontece com quem está logado. Decidido (rev. 2).**
- **Decisão:** opções (a) + (i). A rotina roda uma vez por dia, às 03:00 America/Sao_Paulo, **sem revogar** as sessões da conta demo (quem está logado continua e vê o estado inicial na próxima atualização), mais a execução manual sob demanda (RF16, RF17, CA18, CA24, CA25).
- Contexto: com a credencial na tela de login, mais gente usa a conta ao mesmo tempo; quanto maior o intervalo, mais tempo o conteúdo de um visitante fica visível para outros. Quanto menor, maior a chance de os dados sumirem no meio de um teste.
- Periodicidade, opções:
  - (a) uma vez por dia, às 03:00 America/Sao_Paulo (como hoje);
  - (b) a cada N horas (ex.: a cada 1 h ou 6 h);
  - (c) por inatividade (ex.: 30 min depois da última atividade na conta).
- Sessões, opções:
  - (i) não revogar: quem está logado continua e vê o estado inicial na próxima atualização (como hoje, P22 da spec mobile);
  - (ii) revogar todas as sessões da conta demo a cada execução: todos voltam ao login.
- **Sugestão padrão:** (a) + (i). Mantém o que já está decidido, implantado e comunicado (spec mobile B7/P22, `/privacy`, app, notas de revisão), o horário tem baixo uso, e a execução manual (RF17) cobre abuso pontual e a preparação para a revisão da Apple. Revogar sessões (ii) não protege dados (a conta é compartilhada e a senha é pública) e só derruba quem estiver testando. Se o abuso aparecer na prática, reduzir o intervalo para (b) é uma mudança pequena.
- O que conta como "dados" não é bloqueante: lançamentos e cartões, que é tudo o que o usuário possui; categorias e faturas são derivadas dos lançamentos e somem junto (P12).

### 8.2 Técnicas (decisão do architect)

- **T1 - Mecanismo da exclusão única (RF05).** Migration de dados SQL versionada (roda em todo ambiente, uma vez, idempotente) ou passo idempotente no seed. Sugestão: migration de dados, porque a exclusão é única e deve valer em qualquer ambiente sem depender da env. Avaliar o destino da tabela `demo_datasets` junto com T5 (pode servir de controle da âncora/versão do dataset da conta demo ou ser removida).
- **T2 - Como o web decide mostrar a dica e com qual texto (B4, R4).** Opções: env do web (só no servidor), campo público novo na API ou texto fixo. Sugestão: env no servidor do web, sem rota pública nova na API; documentar que ela anda junto com `SHOWCASE_ACCOUNT_PASSWORD`.
- **T3 - Alias `demo` no login (B1).** Onde mora a regra (sugestão: value object de identificador de login em `identity/domain`, resolvendo `demo` para o e-mail canônico da conta demo antes do lookup); chave do limite por identificador (sugestão: sempre o e-mail canônico, mantendo a isenção atual da conta demo); impacto no ADR 0011 §3.3, §3.5 e T13.
- **T4 - Limpeza de código do tipo `DEMO`.** O que fazer com `User.demo()`, `kind = DEMO` em `UserKind`/`session-principal-lookup`/`AccountCapabilities`, CHECK `users_demo_chk` e o valor do enum. Sugestão: remover do domínio e da aplicação, manter o valor no enum do banco (não removível) e trocar o CHECK por um que proíba `kind = DEMO`.
- **T5 - Reaproveitamento do gerador na conta demo (B2).** Renomear `buildDemoDataset`/`RefreshDemoDataset`/`DemoDatasetStore` para algo neutro (ex.: dataset de exemplo), já que o "demo" antigo sai; o `PrismaDemoDatasetStore` já faz "apagar tudo do dono e recriar sob advisory lock", o que é quase o que RF15 pede, mas hoje só reescreve se a âncora/versão mudou. Sugestão: uma operação de "restaurar sempre" no mesmo store, usada pela rotina, e a variante "só se estiver desatualizado" usada pelo seed.
- **T6 - Modo `demo` no web.** Remover a abstração `AppMode`/`basePath`/`readOnly` inteira ou só o valor `demo`. Sugestão: remover o modo `demo` e simplificar onde a abstração deixa de ter mais de um valor, sem refatorações fora do necessário.
- **T7 - nginx e checklist de deploy.** A regra N4 do ADR 0011 bloqueia `/api/demo/*` no host público; com as rotas removidas, a regra pode sair ou ficar como defesa extra. Atualizar `web/test/deploy-api-not-exposed.spec.ts` e o checklist conforme a decisão.
- **T8 - Documentação de decisões.** Registrar no ADR 0005 que o §6.5 (demonstração pública) foi substituído, e no ADR 0011 as mudanças de B1, B2 e B5 e a nova regra da rotina. Sugestão: um ADR curto novo que supersede o §6.5 do ADR 0005 e o §5.4 do ADR 0011 na parte da limpeza.
- **T9 - Mecanismo da rotina de exclusão (RF15-RF18).**
  - Agendamento: manter o `MaintenanceScheduler` próprio da API (tarefa `daily` já existente, `DailyTimeCalculator` em America/Sao_Paulo) ou adotar `@nestjs/schedule`, ou ainda um cron externo (host/contêiner) chamando um script. Sugestão: manter o `MaintenanceScheduler` (já em produção, testado, sem dependência nova; `@nestjs/schedule` não é usado no projeto) e reaproveitar a tarefa `purge-showcase-data` às 03:00, trocando a regra "criados antes do corte" por "apagar tudo e restaurar".
  - Recuperação na subida (R7): sugestão de só executar na subida se a última execução bem-sucedida for anterior ao último horário agendado, o que exige guardar a data da última execução (ex.: na própria tabela de controle do dataset).
  - Execução manual (RF17): sugestão de um script em `bootstrap/scripts/` no mesmo padrão do `recover-admin` (contexto sem HTTP, sem iniciar o agendador), com comando npm documentado.
  - Concorrência (RF18): sugestão de advisory lock no Postgres por dono, como o `PrismaDemoDatasetStore` já faz.
  - ~~Revogação de sessões~~: **não se aplica (B5 sem revogação).**
  - Reaproveitamento: `PurgeShowcaseData` (use case e port) e `PrismaShowcaseDataPurger` são reaproveitáveis como base; o que muda é a regra de corte, a restauração na mesma transação e o lock.

### 8.3 Premissas adotadas

- **P01:** "crie uma tela de login" é atendido pela tela `/login` existente, ajustada (RF09); não há tela nova.
- **P02:** depois de entrar pela dica, a conta demo vai para `/entries`, como qualquer usuário.
- **P03:** em todo ambiente em que a dica aparece, `SHOWCASE_ACCOUNT_PASSWORD=demo`. A senha continua fora do repositório como valor de env, embora seja pública. A política geral de senha não muda.
- **P04:** `/demo/*` responde com a página 404 do web (não redireciona para `/login`), como qualquer rota inexistente. Se preferir redirecionar favoritos antigos, é uma troca simples.
- **P05:** há backup do banco de produção antes do deploy desta feature (prática de deploy, não código).
- **P06:** na virada do mês, o dataset da conta demo acompanha o novo mês na execução das 03:00 do dia 1º (CA29); entre 00:00 e 03:00 do dia 1º, continua ancorado no mês anterior.
- **P07:** o app mobile não ganha a dica na tela de login; a credencial continua nas notas de revisão (`mobile/README.md`). O alias `demo` funciona no app sem mudança de código, porque a regra fica na API.
- **P08:** os textos sobre a conta demo em `/privacy`, no app (`DEMO_CLEANUP_TEXT`) e nas notas de revisão passam a dizer que a conta é compartilhada e volta ao estado de exemplo todos os dias às 03:00 (horário de Brasília), em vez de "é apagada".
- **P09:** o texto "Não tem acesso ou esqueceu a senha? Fale com um administrador." continua na tela de login, junto da dica.
- **P10:** a remoção não muda nenhum contrato das rotas protegidas nem do `me`.
- **P11:** "exclua os dados" inclui o próprio registro do usuário `DEMO_USER_ID` (além de lançamentos, cartões e `demo_datasets`): sem rotas e sem gerador, ele não tem função. (Era bloqueante; virou premissa pelo limite de 5.)
- **P12:** "dados" da conta demo, para a rotina, são lançamentos e cartões. Categorias e faturas não têm armazenamento próprio e acompanham os lançamentos. Sessões não são dados (B5). A conta em si (nome, e-mail, nível, status, senha) nunca é alterada pela rotina.
- **P13:** com a conta demo desabilitada, a rotina continua apagando dados que existirem nela (para não deixar conteúdo de visitantes guardado), mas não restaura o dataset.
- **P14:** a rotina de exclusão desta spec substitui a limpeza diária da spec mobile (RF39, B7, B9); a spec mobile é atualizada para apontar para cá.

## 9. Tarefas (ordenadas)

Tags: `[api]` backend NestJS, `[db]` schema, migrations e seed, `[web]` Next.js, `[mobile]` app React Native.

### Fase 0 - Decisões
1. ~~Responder B1-B5 e registrar nesta spec.~~ **Concluída** (rev. 2; texto reescrito na rev. 3).
2. `[api]` Architect: decidir T1-T9 e registrar em ADR (supersede do §6.5 do ADR 0005; ajustes no ADR 0011 conforme B1, B2 e B5).
3. `[web]` ui-designer: texto e posição da dica, rótulo e tipo do primeiro campo (e-mail ou usuário `demo`) e remoção do link "Ver demonstração" na tela de login.

### Fase 1 - API e banco: remoção da demonstração pública
4. `[api]` Remover `DemoController` e o registro dele no módulo `finance`; ajustar o comentário de `@Public()`. E2e: `/api/demo/*` responde 404 `ROUTE_NOT_FOUND` (CA01) e regressão das rotas protegidas (CA02). Remover `test/e2e/demo.e2e-spec.ts` e o que for só dele em `test/fakes/demo-fakes.ts`.
5. `[api]` Retirar do seed (`run-seed.ts`) e do agendador (`app.module.ts`) as tarefas `ensure-demo-user` e `refresh-demo-dataset` para `DEMO_USER_ID` (RF04). Teste do agendador e do seed (CA05).
6. `[db]` Exclusão única dos dados de `DEMO_USER_ID` (RF05, P11, T1): lançamentos, cartões, `demo_datasets` e o usuário; idempotente, transacional, só esse id. Integração com Postgres real (CA03, CA04).
7. `[api]` Limpeza de código do tipo `DEMO` conforme T4 (`EnsureDemoUser`, `User.demo`, `DEMO_USER_ID`, ramos de `kind = DEMO`), com os testes correspondentes ajustados.

### Fase 2 - API e banco: conta demo e rotina de exclusão
8. `[api]` Dataset de exemplo como estado inicial da conta demo (RF14, B2, T5): renomear/adaptar o gerador e o store para uso neutro; o seed grava o dataset quando a conta estiver habilitada. Unitários e integração (CA17).
9. `[db]` Persistência de controle da rotina (T5, T9): âncora/versão do dataset da conta demo e data da última execução bem-sucedida (reaproveitando ou substituindo `demo_datasets`). Migration e teste de integração.
10. `[api]` Rotina de exclusão (RF15, RF18): adaptar `PurgeShowcaseData`/`ShowcaseDataPurger`/`PrismaShowcaseDataPurger` para "apagar todos os lançamentos e cartões da conta demo e restaurar o estado inicial" numa transação, com lock por dono, sem tocar em sessões e com o comportamento de conta inativa (P13). Unitários com relógio falso (horário em SP) e integração com Postgres real (CA18, CA19, CA21-CA24, CA26, CA28, CA29).
11. `[api]` Agendamento (RF16, B5, T9): manter a tarefa `purge-showcase-data` diária às 03:00 America/Sao_Paulo no `MaintenanceScheduler`, chamando a nova rotina, com a regra de recuperação na subida (R7). Unitários do agendador (CA27).
12. ~~`[api]` Revogação das sessões da conta demo ao final de cada execução.~~ **Não se aplica (B5 sem revogação).** Mantida só para preservar a numeração; o CA24 verifica que as sessões são preservadas.
13. `[api]` Execução manual (RF17, B5, T9): script sem HTTP no padrão do `recover-admin`, com comando npm documentado, mesmo resultado da execução agendada e saída com as quantidades apagadas e restauradas. Teste do script e e2e provando que não há rota HTTP (CA25).
14. `[api]` Log de cada execução (RF19, RNF10): origem, resultado e quantidades, sem dados sensíveis. Coberto nos testes das tarefas 10, 11 e 13.
15. `[api]` Alias `demo` no login (RF11, B1, T3): normalização, só para a conta demo, mesma resposta genérica para outros identificadores, chave do limite por identificador. Unitários e e2e (CA12-CA15).
16. `[api]` Atualizar `docs/api/finance.md` (sai a seção da demonstração pública), `docs/api/identity.md` (alias `demo` no login), `api/.env.example` e o runbook da execução manual (doc-writer).

### Fase 3 - Web
17. `[web]` `decideRoute` e `web/app/page.tsx`: `/` sem cookie redireciona para `/login` (RF06). Unitários e `proxy.spec.ts` (CA06, CA07, CA08).
18. `[web]` Remover `web/app/(public)/demo/*` e `buildDemo()` de `finance-reader.ts` (RF02). E2e: `/demo/*` sem dados (CA09).
19. `[web]` Remover o modo `demo` e os componentes que só existem para ele (`demo-banner*`, `demo-chip`, `read-only`, `sign-in-button`/`sign-in-href` se não tiverem outro uso, ramos `demo`/`basePath` no cabeçalho, navegação, rodapé e telas), conforme T6 (RF03). Ajustar ou remover os testes de componente, o stub e os e2e Playwright de demo; regressão das telas protegidas.
20. `[web]` Tela de login (RF09, RF10, B1, B4, T2): remover "Ver demonstração"; primeiro campo aceitando e-mail ou `demo` (sem bloqueio de formato no navegador); dica "Para testar, use o usuário demo e a senha demo." visível só com a conta demo habilitada. Testes de componente e e2e do login com `demo`/`demo` (CA10, CA11, CA12, CA16).
21. `[web]` Ajustar o texto da conta de demonstração em `/privacy` para "volta ao estado de exemplo todos os dias às 03:00" (P08). Atualizar `web/README.md` e `web/.env.example`.

### Fase 4 - Mobile
22. `[mobile]` Ajustar `DEMO_CLEANUP_TEXT` e textos relacionados para "a conta é compartilhada e volta ao estado de exemplo todos os dias às 03:00 (horário de Brasília)" (B2, B5, P08); ajustar testes de tela e o fluxo Maestro `demo-account-actions.yaml` (que hoje espera a conta vazia) e acrescentar o login com o alias `demo`.
23. `[mobile]` Atualizar `mobile/README.md` e as notas de revisão da App Store: usuário `demo` (ou e-mail `demo@showcase.invalid`) e senha `demo` (B1), a conta tem dados de exemplo (B2), volta ao estado de exemplo todos os dias às 03:00 de Brasília (B5) e a orientação de rodar a execução manual antes de enviar para revisão. Regressão do CA30 contra a API nova.

### Fase 5 - Fechamento
24. `[api]` `[web]` Tester verifica todos os CAs (exceto o CA20, que não se aplica); code-reviewer; doc-writer atualiza `CHANGELOG.md`, os ADRs (T8) e as specs afetadas (`autenticacao-autorizacao.md` CA41; `mobile-app.md` RF25, RF34, RF39, P22 e P24, conforme B1, B2 e B5).
