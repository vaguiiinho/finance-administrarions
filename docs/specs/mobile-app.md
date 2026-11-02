# Spec: Aplicativo mobile (iOS) com React Native

**Impacto em UI: sim.** Um app novo para iPhone, com telas de entrar, dashboard, finanças (despesas, receitas e faturas, com pagar, pagar em lote, editar e excluir), nova despesa (à vista e parcelada), nova receita e Ajustes (com troca de senha opcional). O ui-designer entra no fluxo. No web, as mudanças visuais são: as páginas públicas de política de privacidade e suporte que a App Store exige (T-W1); "Editar" e "Excluir" passam a aparecer também para usuários `USER` (B6, RF38); e "Alterar senha" fica oculto para a conta demo (B8, P19).

- Data: 2026-11-02
- Branch: `feat/moble`
- Revisões:
  - **rev. 1 (2026-11-02):** versão inicial, com B1-B5 em aberto.
  - **rev. 2 (2026-11-02):** B1-B5 decididas pelo usuário (seção 8.1). API exposta por HTTPS atrás do nginx de produção. Sessão de 24 h igual à do web, **sem refresh** (saem renovação, `SessionFamily`, T4 e as tarefas correspondentes). O app passa a pagar, editar e excluir lançamentos (RF26-RF31). A troca **obrigatória** de senha sai do app (o RF03 é substituído pelo RF32), e entra uma troca **opcional** em Ajustes (RF33). Entra a conta demo para o revisor da Apple (RF34-RF36). O modo demo baseado em `/api/demo/*` sai do escopo do app. DM1-DM10 do design aceitos e incorporados. Surgiram novos bloqueantes: B6, B7 e B8.
  - **rev. 3 (2026-11-02):** B6, B7 e B8 decididas pelo usuário (seção 8.1).
    - **B6:** qualquer usuário (`ADMIN` ou `USER`) edita e exclui os **próprios** lançamentos, no app e no web (RF29, RF38, CA50-CA53, tarefas 5b e 13b).
    - **B5 (ajuste do login):** a conta demo entra com o e-mail `demo@showcase.invalid` e a senha `demo`. O alias `demo` sem `@` foi removido. Não há exceção de formato no login; só a exceção de tamanho de senha, restrita a essa conta (RF34, CA44, CA45).
    - **B8:** a conta demo não troca a própria senha. Ajustes esconde a opção, e a API recusa com 403 `FORBIDDEN` (RF33, CA48).
    - **B7:** um job diário às 03:00 America/Sao_Paulo apaga os lançamentos da conta demo (RF39, CA54).
    - **R13** resolvido no ADR 0011: o web chama a API por um listener interno do nginx.
    - **Design:** DM11 substituído por B6. DM12-DM16 aceitos como padrão e incorporados (RF26-RF28, RF37). O pagamento em lote entra no app (DM16; sai a premissa P14).
    - Surgiu um bloqueante novo, B9 (cartões na limpeza diária).
- Referências: `docs/specs/autenticacao-autorizacao.md` (RF01-RF08, RF45, RNF02, RNF04), `docs/adr/0005-autenticacao-autorizacao-demo.md` (§6.1, §6.2, §6.5, §9.2), `docs/adr/0011-app-mobile-ios.md` (rev. 2: §3.3-§3.5, §5.3, §6.1, §6.2, §6.5, §9, §10.10, §10.11), `docs/design/mobile-app.md` (DM1-DM16), `docs/api/finance.md`, `docs/specs/despesas-parceladas.md`, `docs/specs/lancamentos-financeiros.md`, `docs/adr/0007-listagem-mes-e-status-padrao.md`, `docs/adr/0009-mes-inicial-fatura-pendente-mais-antiga.md`, `docs/adr/0010-despesas-parceladas.md`, `docs/design/design-system.md`.

## 1. Contexto

Pedido do usuário: "crie uma versão mobile usando o react-native; a ideia é disponibilizar na loja de aplicativo, pode inicialmente para iPhone. Funcionalidades: criar despesas, criar receitas, fazer login, visualizar dashboard, visualizar finanças."

O que existe hoje e importa para esta feature:

### 1.1 API (`api/`)

- **Autenticação já é por token, não por cookie.** `POST /api/auth/login` devolve `{ user, session: { token, expiresAt } }` (`identity/presentation/http/presenters/user.presenter.ts`). As rotas protegidas leem `Authorization: Bearer <token>` (`authentication.policy.ts`). O cookie httpOnly `fa_session` existe só no web, que funciona como BFF (ADR 0005 §6.1 e §9.2). Um cliente nativo pode usar o mesmo contrato sem mudar o mecanismo de autenticação.
- **Sessão:** token opaco guardado no banco (`sessions`: `id`, `user_id`, `token_digest`, `created_at`, `expires_at`). Dura **24 h fixas, sem renovação** (`domain/session/session-policy.ts`). Não existe refresh token, e esta feature **não** cria um (B2). A tabela não identifica o tipo de cliente (web ou mobile) nem o aparelho.
- `GET /api/auth/me` devolve o usuário atual (`id`, `name`, `email`, `role`, `mustChangePassword`). `POST /api/auth/logout` encerra a sessão do Bearer enviado.
- **Troca de senha:** `PUT /api/account/password` com `{ currentPassword, newPassword }` (corpo estrito). Erros por campo: `currentPassword` `REQUIRED`/`INCORRECT`; `newPassword` `REQUIRED`/`TOO_SHORT`/`TOO_LONG`/`SAME_AS_CURRENT`. Falhas de senha atual contam no limite `password-change-user-failures` (429). Com sucesso, a sessão usada continua válida e **todas as outras sessões do usuário são encerradas** (`change-own-password.ts`, `deleteAllOfUserExcept`), inclusive as do web e de outros aparelhos.
- **Troca obrigatória de senha:** enquanto ela estiver pendente (`mustChangePassword = true`), toda rota protegida responde 403 `PASSWORD_CHANGE_REQUIRED`, exceto `GET /api/auth/me`, `PUT /api/account/password` e `POST /api/auth/logout` (`@AllowDuringPasswordChange`, RF07 da spec de autenticação). O login em si funciona e devolve token com `mustChangePassword: true`. A redefinição de senha pelo administrador encerra todas as sessões do usuário, então quem está logado recebe 401 (não 403) na próxima chamada.
- **Política de senha** (`domain/user/value-objects/plain-password.ts`): ao **definir** uma senha, 8 a 72 code points (`TOO_SHORT`/`TOO_LONG`). Ao **conferir** (login, senha atual), não há regra de tamanho (`forVerification`). Portanto a senha `"demo"` (4 caracteres) **não pode ser definida** pelas regras atuais, mas conferiria no login se o hash existisse. Essa é a única exceção que a conta demo exige (RF34).
- **Login por e-mail** (`login-with-password.ts`): o identificador passa por `EmailAddress.create`, que exige o formato `local@dominio.tld`. Identificador fora do formato cai em `INVALID_CREDENTIALS`. Como a conta demo entra com um e-mail válido (`demo@showcase.invalid`, B5 rev. 3), o login **não** precisa de exceção de formato.
- **Usuário demo existente (não confundir):** `DEMO_USER_ID` (`shared/domain/well-known-ids.ts`), e-mail `demo@finance.invalid`, tipo `DEMO`, **sem senha e sem login**. Ele é o dono do **dataset demo público** servido pelas rotas `GET /api/demo/*` (somente leitura, sem autenticação) e é recriado pelo seed (`EnsureDemoUser` + `RefreshDemoDataset` em `bootstrap/seed/run-seed.ts`) e pelo agendador de manutenção (`maintenance.scheduler.ts`), que reescreve os dados dele. A **conta demo** desta feature (RF34) é outra conta (no ADR 0011, `UserKind = SHOWCASE`, `SHOWCASE_USER_ID`).
- **Limite de tentativas:** 20 requisições de autenticação por IP por minuto e 5 falhas por e-mail em 15 min, com 429 `TOO_MANY_ATTEMPTS` e `retryAfterSeconds`. O limitador fica em memória (`in-memory-attempt-limiter.ts`). O IP vem de `req.ip` com `trust proxy` (`TRUST_PROXY`, padrão `loopback, uniquelocal`), alimentado pelo `X-Forwarded-For` que o BFF repassa.
- **Hoje a API não é exposta publicamente** (RF45, ADR 0005 D11). Esta feature muda isso (B1 decidida): a API passa a ser exposta por HTTPS pelo nginx de produção.
- Não há CORS configurado (`configure-app.ts`). Um app nativo não precisa de CORS.
- **Endpoints do finance reaproveitados sem mudança de contrato** (`docs/api/finance.md`):
  - leitura: `GET /api/entries/initial-month`, `GET /api/entries/expenses`, `GET /api/entries/incomes`, `GET /api/invoices`, `GET /api/cards/:cardId/invoices/:referenceMonth/entries`, `GET /api/categories`, `GET /api/cards`, `GET /api/summary`, `GET /api/dashboard/monthly-series`, `GET /api/dashboard/category-distribution`;
  - criação: `POST /api/entries` e `POST /api/entries/installments`;
  - **pagar:** `POST /api/entries/:id/pay` (individual, idempotente; 404 `ENTRY_NOT_FOUND`, 422 `ENTRY_NOT_PAYABLE` para receita), `POST /api/entries/pay` (lote de 1 a 100, atômico) e `POST /api/cards/:cardId/invoices/:referenceMonth/pay` (paga todas as pendentes da fatura; sem pendências, 200 com `paidCount: 0`; 404 `CARD_NOT_FOUND`). Exigem só sessão, qualquer nível;
  - **editar:** `PUT /api/entries/:id` com `{ description, category, date, amount }` (só despesas; tipo, forma, cartão e status não mudam; 422 `ENTRY_NOT_EDITABLE` para receita e `PAID_CARD_EXPENSE_DATE_LOCKED` ao mudar a data de despesa paga no cartão). **Hoje exige nível `ADMIN`** (`@RequireRole('ADMIN')`, 403 `FORBIDDEN`). B6 muda isso: o contrato de entrada e saída não muda, só a autorização;
  - **excluir:** `DELETE /api/entries/:id` (só despesas, pendentes ou pagas, definitiva, 204; 422 `ENTRY_NOT_DELETABLE` para receita). **Hoje exige nível `ADMIN`**; B6 muda isso como no editar.
- **Parcelas não são uma entidade editável à parte:** cada parcela criada por `POST /api/entries/installments` é uma despesa comum. Não há rota para editar ou excluir a série inteira; pagar, editar e excluir agem parcela por parcela.
- **Receitas** não podem ser pagas, editadas nem excluídas pela API (nascem `RECEIVED`).
- Isolamento por dono, precedência de erros (401 > 403 > 400 > 404 > 422) e formato `{ code, message, details }` já existem e valem igualmente para o app. Um id de lançamento de outro usuário responde 404, como um id inexistente.

### 1.2 Web (`web/`)

- É um Next.js App Router que atua como BFF. Leituras são feitas por RSC e mutações por Server Actions. O navegador nunca chama a API.
- **Ações sobre lançamentos que o web oferece** (`web/app/(protected)/entries/actions.ts`, `web/features/entries/_components/`):
  - **Despesas** (`expenses-list.tsx`): "Marcar como pago" individual em despesa pendente, com confirmação; seleção de pendentes e "Marcar como pago (N)" em lote; "Editar despesa" (gaveta `edit-expense-drawer.tsx`: Descrição, Categoria, Data, Valor; data travada em despesa paga no cartão, com o texto "A data de uma despesa paga no cartão não pode ser alterada."); "Excluir despesa" com confirmação. **Hoje editar e excluir só aparecem para `ADMIN`** (`canManageExpenses`, `web/app/(protected)/entries/page.tsx`), coerente com a API. B6 muda isso (RF38).
  - **Faturas** (`invoice-block.tsx`): "Pagar fatura" com confirmação; a lista da fatura é só leitura, com o atalho "Pagar despesas individualmente na aba Despesas".
  - **Receitas:** sem ações de escrita sobre itens existentes.
  - Textos de retorno: `paidFeedback` e `invoicePaidFeedback` (`web/lib/entries/feedback.ts`), "Despesa atualizada.", "Despesa excluída.", "Esta despesa não foi encontrada. A lista foi atualizada.", "Este cartão não foi encontrado. Nada foi alterado.", "Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente.", "Não foi possível pagar a fatura. Nenhuma despesa foi alterada. Tente novamente.".
- Regras de UI que valem a pena replicar ou compartilhar com o app:
  - `web/lib/entries/form.ts`: validação de apoio, montagem do payload e mapeamento de erros de campo;
  - `web/lib/money/decimal.ts`: máscara pt-BR para string decimal;
  - `web/lib/dates/format.ts`: mês corrente em America/Sao_Paulo;
  - `web/lib/dashboard/chart-data.ts`;
  - `web/lib/entries/feedback.ts`.
- O dashboard do web usa **Recharts**, que é uma biblioteca DOM/SVG para web e não roda em React Native (ver T3).

### 1.3 Repositório e deploy

- Não existe workspace de monorepo nem pasta `mobile/`. `api/` e `web/` têm `package.json` próprios.
- `.github/workflows/deploy.yml` publica as imagens da API e do web no Docker Hub. Não há pipeline de build iOS.
- Em produção há um **proxy nginx** na frente dos serviços (B1). A API passa a ser publicada por ele. O web passa a chamar a API por um listener interno do mesmo nginx (ADR 0011 §6.1, requisito N3).

## 2. Linguagem ubíqua

| Termo | Definição |
|---|---|
| **App mobile** | Aplicativo React Native para iPhone, distribuído por TestFlight e depois pela App Store. Cliente da API, como o BFF web. |
| **Cliente** | Quem consome a API: `WEB` (o BFF Next.js) ou `MOBILE` (o app). |
| **Proxy de borda (nginx)** | O nginx de produção que termina o TLS e encaminha as requisições públicas para a API. É o único proxy em que o `trust proxy` da API confia para ler o IP do cliente (B1). |
| **Listener interno do nginx** | Entrada do nginx acessível só pela rede interna, usada pelo BFF web para chamar a API. Mantém um único proxy confiável para a API (ADR 0011 §6.1, N3). |
| **Token de sessão** | Credencial opaca devolvida pelo login e enviada como `Authorization: Bearer`. No app, fica só no armazenamento seguro do iOS. |
| **Armazenamento seguro** | Keychain do iOS, acessível só pelo app e com o aparelho desbloqueado. Não inclui AsyncStorage, arquivos, logs nem variáveis em memória persistidas. |
| **Sessão mobile** | Sessão aberta pelo app. Mesmo prazo do web: 24 h fixas desde o login, sem renovação (B2). Ao expirar, o app manda para o login. |
| **Despesa à vista** | Despesa criada por `POST /api/entries` (PIX paga ou pendente, ou no cartão). |
| **Despesa parcelada** | Série de 2 a 36 despesas mensais criada por `POST /api/entries/installments`. O valor informado é o total. Depois de criada, cada **parcela** é uma despesa comum. |
| **Receita** | Lançamento `INCOME`: sempre PIX, nasce `RECEIVED`. Não pode ser paga, editada nem excluída. |
| **Finanças** | Área do app com as listas do mês de referência (Despesas, Receitas e Faturas), com subtotal e as ações de pagar, pagar em lote, editar e excluir que o web oferece (B3). Equivale à tela `/entries` do web. |
| **Próprio lançamento** | Lançamento cujo dono é o usuário logado. Todas as ações (ler, pagar, editar, excluir) só alcançam os próprios lançamentos; o de outro usuário responde 404. |
| **Marcar como pago** | Ação sobre uma despesa pendente que a torna `PAID` (`POST /api/entries/:id/pay`). |
| **Pagar em lote** | Marcar como pagas várias despesas pendentes selecionadas de uma vez (1 a 100), tudo ou nada (`POST /api/entries/pay`, DM16). |
| **Pagar fatura** | Ação sobre uma fatura que marca como pagas todas as despesas pendentes daquele cartão e mês de referência (`POST /api/cards/:cardId/invoices/:referenceMonth/pay`). |
| **Editar despesa** | Alteração de descrição, categoria, data e valor de uma despesa própria (`PUT /api/entries/:id`). Tipo, forma, cartão e status não mudam. Permitida a qualquer nível (B6). |
| **Excluir despesa** | Remoção definitiva de uma despesa própria, pendente ou paga (`DELETE /api/entries/:id`). Permitida a qualquer nível (B6). Não há recuperação depois do envio. |
| **Desfazer** | No app, opção oferecida por alguns segundos depois de editar ou excluir (DM14). Na exclusão, o envio à API só acontece quando o prazo de desfazer termina; na edição, desfazer envia os valores anteriores. Pagar não tem desfazer. |
| **Dashboard** | Resumo do mês (receitas, despesas pagas e pendentes, saldo realizado e saldo previsto), evolução de 12 meses e distribuição por categoria. |
| **Mês de referência** | `YYYY-MM` usado nas listas e no dashboard. Para despesa no cartão, é o mês do vencimento da fatura. |
| **Mês inicial** | Mês sugerido por `GET /api/entries/initial-month` para abrir Finanças. |
| **Valor monetário** | String decimal com duas casas (`"1234.56"`). No app, é exibido e digitado como `R$ 1.234,56`. Nunca é convertido para `number` para cálculo ou envio. |
| **Data civil** | `YYYY-MM-DD` (data do lançamento, fechamento, vencimento). É exibida como `dd/mm/aaaa`, sem conversão de fuso. |
| **Instante** | Timestamp ISO 8601 UTC (`paidAt`, `createdAt`). É exibido em America/Sao_Paulo. |
| **Troca obrigatória pendente** | Estado do usuário com `mustChangePassword = true` (senha temporária). Não é resolvido no app: o app orienta a trocar pelo site (B4, RF32). |
| **Troca de senha opcional** | Troca da própria senha feita por escolha do usuário, em Ajustes (RF33). Não disponível para a conta demo (B8). |
| **Conta demo** | Usuário real, nível `USER`, que entra com o e-mail `demo@showcase.invalid` e a senha `demo` (B5). Compartilhada por qualquer pessoa que conheça a credencial. Nasce sem dados, pode usar todas as ações sobre os próprios lançamentos, não administra usuários e não troca a própria senha (B8). No ADR 0011: `UserKind = SHOWCASE`, nome "Conta de demonstração". |
| **Limpeza diária da conta demo** | Job que apaga todos os lançamentos da conta demo todos os dias às 03:00 America/Sao_Paulo (B7, RF39). |
| **Dataset demo público** | Dados de exemplo do usuário interno `DEMO_USER_ID` (`demo@finance.invalid`, sem login), servidos sem autenticação por `GET /api/demo/*` e usados pela demonstração do web. **Não** é a conta demo e não é usado pelo app. |
| **Build de loja** | Binário assinado e enviado ao App Store Connect, distribuído por TestFlight ou pela App Store. |
| **Versão mínima suportada** | Menor versão do app que a API aceita. Abaixo dela, o app pede atualização (T7, 426 `APP_UPDATE_REQUIRED` no ADR 0011). |

## 3. Requisitos funcionais

### Autenticação

- **RF01 - Entrar.** Tela com E-mail, Senha (com a opção mostrar/ocultar) e "Entrar". Chama `POST /api/auth/login`. Com sucesso e sem troca obrigatória pendente, o token é gravado no armazenamento seguro e o usuário vai para o Dashboard. Com troca pendente, vale o RF32. Os erros seguem o web:
  - `INVALID_CREDENTIALS`: banner genérico "E-mail ou senha inválidos.";
  - 400: erro no campo;
  - 429: "Muitas tentativas. Tente novamente em N min." com base em `retryAfterSeconds`.

  O botão mostra o estado de carregando e impede envio duplo. O campo E-mail usa o teclado de e-mail e a mesma validação de apoio do web; não há caso especial para a conta demo, que entra com um e-mail válido (RF34). Não existe "Criar conta" (RF06 da spec de autenticação). Há o texto "Não tem acesso ou esqueceu a senha? Fale com um administrador."
- **RF02 - Sessão persistida.** Ao abrir o app com um token salvo, o app valida o token com `GET /api/auth/me` antes de mostrar dados:
  - válido e sem troca pendente: vai para o Dashboard;
  - válido com `mustChangePassword = true`: aplica o RF32;
  - 401: apaga o token e mostra o login;
  - sem rede: mostra o erro de conexão com "Tentar novamente", sem apagar o token.
- **RF03 - (Substituído pelo RF32 na rev. 2.)** A troca obrigatória de senha não é feita no app (B4).
- **RF04 - Sessão expirada ou encerrada.** A sessão mobile dura 24 h fixas, como a do web, e não é renovada (B2). Qualquer 401 numa chamada protegida (expiração, inativação, senha redefinida pelo administrador, troca de senha em outro cliente, logout em outro lugar):
  - apaga o token;
  - mostra "Sua sessão expirou. Entre novamente.";
  - volta ao login.

  O app não tenta renovar a sessão. Se a sessão expirar durante um envio de formulário ou uma ação (pagar, editar, excluir), nada é alterado pelo app além do que a API confirmou, e os valores digitados não precisam ser preservados (premissa P09).
- **RF05 - Sair.** Um item "Sair" em Ajustes chama `POST /api/auth/logout` com o token, apaga o token do armazenamento seguro, limpa os dados em cache e volta ao login. Se a chamada falhar por rede, o app sai localmente mesmo assim. Uma exclusão com desfazer pendente é enviada antes de sair (DM14, RF28).
- **RF06 - Usuário atual.** O app mostra o nome, o e-mail e a inicial do usuário (mesma regra de inicial do web, RF40). Meu perfil e gestão de usuários ficam fora (seção 6). A troca de senha opcional entra (RF33), exceto para a conta demo (B8).

### Dashboard

- **RF07 - Dashboard do mês.** Abre no mês corrente (America/Sao_Paulo) e tem um seletor de mês (anterior/próximo). O mês do Dashboard é independente do mês de Finanças (DM10). Mostra:
  - cartões de resumo de `GET /api/summary`: Receitas, Despesas (total, pagas, pendentes), Saldo realizado e **Saldo previsto** (DM1, mesmo nome do web). Saldos negativos aparecem como "-R$ 150,00" com o indicador textual "Negativo" (DM4), não só por cor;
  - gráfico de evolução de 12 meses (`GET /api/dashboard/monthly-series`) com receitas e despesas por mês;
  - distribuição por categoria (`GET /api/dashboard/category-distribution`) em rosca ou barras, com legenda de categoria, valor e percentual. Mês sem despesas mostra o estado vazio.
- **RF08 - Carregamento e erro por bloco.** Cada bloco (resumo, série, categorias) tem um esqueleto de carregamento e um erro independente com "Tentar novamente", como os `BlockErrorBoundary` do web. Puxar para atualizar (pull-to-refresh) recarrega os três blocos.

### Finanças (leitura)

- **RF09 - Mês inicial.** Ao abrir Finanças sem mês escolhido, o app usa `GET /api/entries/initial-month`.
  - `advance = NEXT_PENDING` ou `NO_PENDING_AHEAD`: mostra o aviso equivalente ao do web (ADR 0007/0009).
  - Falha ou timeout de 1,5 s: usa o mês corrente, sem aviso.
- **RF10 - Abas.** Finanças tem três abas: **Despesas**, **Receitas** e **Faturas**, com seletor de mês compartilhado entre elas.
- **RF11 - Despesas.** `GET /api/entries/expenses`. Filtros:
  - status: **Todos, Pendente ou Pago** (DM2), com **Pendente** como padrão (DM3, ADR 0007);
  - cartão: um cartão ou "PIX";
  - categoria.

  Cada item mostra descrição, categoria, data (`dd/mm/aaaa`), valor, forma (PIX ou nome do cartão) e status (texto, não só cor), e as ações do RF26-RF29 e RF37 conforme o item. O subtotal (total, pago, pendente) considera os filtros. A paginação é por rolagem infinita, com `pageSize` 20, e respeita a ordenação da API.
- **RF12 - Receitas.** `GET /api/entries/incomes`, com filtro de categoria, subtotal e paginação como no RF11. Receitas não têm ações de escrita (DM12).
- **RF13 - Faturas.** `GET /api/invoices?month=` com o filtro de status **Todos, Pendente ou Pago** (DM2), padrão **Pendente** (DM3); "Todos" é a ausência do parâmetro. Cada fatura mostra cartão, fechamento, vencimento, quantidade, total, pago e pendente, e a ação "Pagar fatura" (RF30). Tocar numa fatura abre o detalhe dentro da pilha da aba Finanças (DM8) e mostra as despesas dela (`GET /api/cards/:cardId/invoices/:referenceMonth/entries`).
- **RF14 - Estados.** Cada aba tem um estado vazio próprio ("Nenhuma despesa em novembro de 2026."), um carregamento e um erro com "Tentar novamente". O pull-to-refresh recarrega a aba ativa e o subtotal.

### Criação de lançamentos

- **RF15 - Ponto de entrada.** Um botão "Novo" visível em Dashboard e Finanças abre a escolha: "Despesa", "Despesa parcelada" ou "Receita". Cada opção abre um formulário em tela ou folha modal.
- **RF16 - Nova despesa.** Campos e regras iguais a `web/lib/entries/form.ts` e ao contrato de `POST /api/entries`:
  - Descrição: 1-120 caracteres;
  - Categoria: 1-50, com sugestões de `GET /api/categories`, aceitando texto novo;
  - Data: padrão hoje em America/Sao_Paulo, com seletor nativo;
  - Valor: teclado decimal (`decimal-pad`) com vírgula, formatado com milhar ao sair do campo (DM9), maior que zero e até R$ 9.999.999.999,99;
  - Forma de pagamento: PIX ou Cartão;
  - Cartão: obrigatório se a forma for Cartão, com a lista de `GET /api/cards`;
  - "Ainda não paguei": só em PIX.

  A linha "Status inicial" usa os mesmos textos do web. O payload segue `buildCreateEntryPayload`:
  - `paid: false` só em PIX com "Ainda não paguei";
  - `cardId` só em Cartão;
  - nunca `status`, `referenceMonth` nem `userId`.
- **RF17 - Nova despesa parcelada.** Contrato de `POST /api/entries/installments`. Campos: Descrição, Categoria, Data da 1ª parcela, Valor total, Parcelas (2-36), Forma (PIX ou Cartão) e Cartão. Uma prévia mostra a quantidade e o valor de cada parcela, com a diferença de centavos nas primeiras, igual à regra do servidor (ex.: R$ 350,00 em 6x = 2 × R$ 58,34 + 4 × R$ 58,33). O texto informa que todas nascem pendentes. Com sucesso: "6 parcelas criadas."
- **RF18 - Nova receita.** Campos: Descrição, Categoria, Data e Valor. Não há forma de pagamento nem cartão (receita é sempre PIX). Status inicial: recebida.
- **RF19 - Erros do formulário.** O 400 `VALIDATION_ERROR` é mapeado por campo (mesmo mapeamento de `mapApiFieldIssues`). O que não mapeia vai para um resumo no topo. 404 `CARD_NOT_FOUND`: "O cartão escolhido não existe mais." e a lista de cartões é recarregada. Erro de rede ou 5xx: os campos são mantidos e não há falso sucesso. O botão "Salvar" impede envio duplo.
- **RF20 - Após salvar.** O formulário fecha, aparece a confirmação ("Despesa criada.", "Receita criada.", "N parcelas criadas."; para despesa no cartão, uma 2ª linha como a do web, ex.: "Na fatura de nov/26 do Nubank, vence 20/11/2026.", DM5) e os dados do mês afetado são invalidados (resumo, série, categorias, listas, faturas e a lista de categorias).
- **RF21 - Usuário sem cartão.** Se `GET /api/cards` vier vazio, a opção Cartão aparece desabilitada com o texto "Cadastre um cartão no site para usar esta opção." (premissa P04, sem cadastro de cartão no app v1).

### Ações sobre lançamentos existentes (B3, B6)

As ações espelham o web (seção 1.2): mesmas regras e mesmos textos de retorno, com as diferenças de interação aceitas no design (DM12-DM16). Valem para qualquer despesa **própria**, inclusive parcelas (cada parcela é tratada individualmente, DM13) e despesas no cartão. Receitas não têm ações (DM12).

- **RF26 - Marcar como pago (individual).** Despesa `PENDING` oferece "Marcar como pago" na lista de Despesas e no detalhe da fatura. O controle visível é o círculo de status à esquerda da linha, com os atalhos de deslizar para a direita, menu de contexto e ação do VoiceOver (DM15); nenhuma ação existe só no gesto. O acionamento abre sempre uma confirmação com descrição e valor (DM14: pagar não tem desfazer). Confirmado, chama `POST /api/entries/:id/pay`. Resultado:
  - sucesso: confirmação com o texto de `paidFeedback` do web; o item passa a "Pago" (ou sai da lista sob o filtro Pendente) e o mês afetado é invalidado (resumo, série, categorias, listas e faturas);
  - 404: "Esta despesa não foi encontrada. A lista foi atualizada." e a lista é recarregada;
  - 422 `ENTRY_NOT_PAYABLE`: "Receitas não podem ser marcadas como pagas. Nada foi alterado.";
  - rede ou 5xx: "Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente.", sem falso sucesso.

  Despesa já paga não oferece a ação. Mostra "Pago em dd/mm/aaaa" (instante em America/Sao_Paulo).
- **RF27 - Editar despesa.** Ação "Editar" numa despesa (pendente ou paga) abre um formulário com Descrição, Categoria, Data e Valor preenchidos, com as mesmas regras do RF16 para esses campos. Forma, cartão e status aparecem só como informação (DM12). Chama `PUT /api/entries/:id` só com os quatro campos. Regras:
  - em despesa **paga no cartão**, a Data fica desabilitada com o texto "A data de uma despesa paga no cartão não pode ser alterada."; em despesa no cartão pendente, aparece a ajuda "A data de compra pode alterar a fatura do cartão.";
  - sucesso: "Despesa atualizada." com a opção "Desfazer" por alguns segundos (DM14; prazo e textos no design). Desfazer envia um novo `PUT` com os valores anteriores. Os dados do mês de origem **e** do mês de destino são invalidados, se a data mudar o mês de referência;
  - 400: erro por campo (RF19); 404: "Esta despesa não foi encontrada. A lista foi atualizada."; 422 `PAID_CARD_EXPENSE_DATE_LOCKED`: erro no campo Data; 403 `FORBIDDEN`: "Você não tem permissão para editar esta despesa." (não deve ocorrer depois de B6, salvo mudança de regra com o app aberto); rede ou 5xx: campos mantidos, "Não foi possível atualizar a despesa. Tente novamente.".
- **RF28 - Excluir despesa.** Ação "Excluir" numa despesa (pendente ou paga) abre uma confirmação destrutiva com descrição, valor e o aviso de que o lançamento será removido. Confirmado, o item sai da lista e aparece "Despesa excluída." com a opção "Desfazer" (DM14). O `DELETE /api/entries/:id` só é enviado quando o prazo de desfazer termina, ou antes, nos casos definidos no design (app vai para o segundo plano, outra exclusão começa, a pessoa sai da conta). Resultado:
  - Desfazer dentro do prazo: o item volta à lista e nada é enviado;
  - 204: invalidação do mês afetado;
  - 404: a lista é recarregada (a despesa já não existia);
  - 403 `FORBIDDEN`: o item volta e aparece "Você não tem permissão para excluir esta despesa.";
  - rede ou 5xx: o item volta à lista e aparece "Não foi possível excluir a despesa. Tente novamente.".

  Depois do envio confirmado, não há recuperação. Excluir uma parcela não exclui as demais parcelas da série (DM13).
- **RF29 - Quem vê editar e excluir (B6 decidida).** "Editar" e "Excluir" aparecem para **qualquer usuário logado** (`ADMIN`, `USER` e a conta demo), sempre sobre os próprios lançamentos e só em despesas. "Marcar como pago", "Pagar em lote" e "Pagar fatura" também aparecem para qualquer usuário. A regra de visibilidade usa o que a API informa no `me` (no ADR 0011, a lista de capacidades), não o nível. Substitui o DM11.
- **RF30 - Pagar fatura.** Fatura com pendências mostra "Pagar fatura" na aba Faturas e no detalhe. O toque abre uma confirmação com cartão, mês e valor pendente. Confirmado, chama `POST /api/cards/:cardId/invoices/:referenceMonth/pay`. Resultado:
  - sucesso: confirmação com o texto de `invoicePaidFeedback` do web (informativo se `paidCount = 0`); fatura e despesas do mês são invalidadas;
  - 404 `CARD_NOT_FOUND`: "Este cartão não foi encontrado. Nada foi alterado.";
  - rede ou 5xx: "Não foi possível pagar a fatura. Nenhuma despesa foi alterada. Tente novamente.".

  Fatura totalmente paga não mostra a ação. O detalhe da fatura lista as despesas com a ação de marcar como pago individual (DM15) e o atalho para a aba Despesas.
- **RF31 - Proteção contra ação duplicada.** Em todas as ações (pagar, pagar em lote, editar, excluir, pagar fatura, desfazer), o controle de confirmação mostra carregando e impede um segundo envio. Uma ação concluída fecha a confirmação e devolve o foco à lista (VoiceOver).
- **RF37 - Pagar em lote (DM16).** Na aba Despesas, com pendentes na lista, "Selecionar" ativa o modo de seleção nativo: só despesas pendentes são selecionáveis, e a barra inferior mostra a quantidade, o total selecionado e "Marcar como pago (N)". Regras iguais às do web:
  - de 1 a 100 itens; a seleção acima de 100 é barrada antes do envio;
  - confirmação obrigatória (sem desfazer, DM14);
  - chama `POST /api/entries/pay` com os ids; a operação é tudo ou nada;
  - sucesso: sai do modo de seleção, mostra o texto de `paidFeedback` do web para N itens e invalida o mês;
  - 404 `ENTRIES_NOT_FOUND` ou 422 `ENTRIES_NOT_PAYABLE`: nada foi pago; mensagem e recarga da lista;
  - rede ou 5xx: "Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente.", com a seleção mantida.

### Troca de senha

- **RF32 - Usuário com troca obrigatória pendente (B4).** O app não faz a troca obrigatória. Se o login responder com `user.mustChangePassword = true`, se o `GET /api/auth/me` do RF02 vier com esse valor, ou se qualquer chamada responder 403 `PASSWORD_CHANGE_REQUIRED`:
  - o app chama `POST /api/auth/logout` com o token (rota permitida durante a troca), sem esperar o resultado para seguir;
  - não grava o token (ou o apaga, se já gravado) e limpa o cache;
  - mostra na tela de login o aviso "Você precisa definir uma nova senha antes do primeiro acesso. Troque a senha pelo site e depois entre no app com a nova senha." com o botão "Abrir o site", que abre a página de troca de senha do web no navegador do sistema.

  **Escolha registrada:** orientar a troca pelo web, e **não** permitir a troca obrigatória pela tela opcional do RF33. Motivo: a decisão B4 tira a troca obrigatória do app, e liberar a tela opcional para esse caso seria a mesma troca obrigatória por outro caminho. Custo: um usuário novo precisa passar pelo site uma vez antes de usar o app.
- **RF33 - Trocar senha (opcional, em Ajustes).** Item "Trocar senha" em Ajustes abre uma tela com Senha atual, Nova senha e Confirmar nova senha (com mostrar/ocultar) e "Salvar". Regras iguais às da tela `/account/password` do web:
  - confirmação diferente: "As senhas não conferem.", sem chamar a API;
  - nova senha fora de 8-72 caracteres: erro no campo, sem chamar a API;
  - chama `PUT /api/account/password` com `{ currentPassword, newPassword }`;
  - erros por campo: `INCORRECT` em Senha atual ("Senha atual incorreta."), `SAME_AS_CURRENT` em Nova senha ("A nova senha deve ser diferente da atual."), `TOO_SHORT`/`TOO_LONG`; 429 com o tempo de `retryAfterSeconds`; 403 `FORBIDDEN`: mensagem genérica de falta de permissão;
  - sucesso: "Senha alterada.", a sessão do app continua válida e o texto informa que as outras sessões (site e outros aparelhos) foram encerradas.

  **Conta demo (B8 decidida):** o item não aparece em Ajustes. A API recusa a troca de senha da conta demo com **403 `FORBIDDEN`** no formato `{ code, message, details }`, antes de conferir a senha atual e antes de contar tentativas no limite `password-change-user-failures` (ADR 0011 §3.4, §5.3, A4). A senha continua `demo`.

### Conta demo (B5, B7, B8)

- **RF34 - Conta demo.** Existe em produção um usuário real com:
  - login pelo e-mail `demo@showcase.invalid` e senha `demo` (TLD reservado `.invalid`, nunca entregável; mesmo e-mail canônico do ADR 0011 §3.3);
  - nome de exibição "Conta de demonstração" (alinhado ao ADR 0011, P13);
  - nível `USER`, ativo, **sem** troca obrigatória pendente;
  - nenhum dado ao ser criado: sem lançamentos e sem cartões;
  - id próprio, **diferente** de `DEMO_USER_ID` (o dono do dataset demo público), para que o seed e o agendador do dataset público nunca escrevam nos dados dela.

  O login funciona no app e no web pelo fluxo normal do RF01, **sem exceção de formato de e-mail**. Não existe alias `demo` sem `@`: o identificador `demo` responde `INVALID_CREDENTIALS` como qualquer identificador fora do formato. A **única exceção** é aceitar a senha `demo` (menos de 8 caracteres) no provisionamento desta conta. A política geral de senha não muda para nenhum outro usuário, e nenhuma tela ou rota permite definir `demo` como senha de outra conta (CA45).
- **RF35 - O que a conta demo pode fazer.** Tudo o que um usuário comum faz no app sobre os próprios lançamentos: Dashboard, Finanças, criar despesa, despesa parcelada e receita, marcar como pago, pagar em lote, pagar fatura, editar e excluir despesas (B6). Não pode:
  - administrar usuários (criar, editar, inativar, reativar, redefinir senha): ela tem nível `USER`, e as rotas `/api/admin/*` respondem 403 (e não são publicadas pelo nginx no host público, ADR 0011 §6.1 N4);
  - trocar a própria senha (B8, RF33);
  - alterar o próprio perfil (premissa P20, ADR 0011 §3.4).

  Não precisa de cartão pelo app (P04). Cartões criados pelo web seguem B9.
- **RF36 - Provisionamento da conta demo.** A conta é criada por um passo de **seed idempotente**, como o `EnsureDemoUser` atual, e **não** por migration nem por script manual. Regras:
  - se a conta já existe, o passo não altera dados nem nível; a senha só é regravada se divergir da configurada (rede de segurança de B8);
  - o passo só roda quando habilitado por configuração do ambiente, para que a conta exista em produção e no staging do TestFlight, mas possa ser desligada sem deploy de código (no ADR 0011, a variável `SHOWCASE_ACCOUNT_PASSWORD`; a senha não fica no repositório);
  - desligar a conta a inativa (sessões encerradas), sem apagar o usuário;
  - motivo para não usar migration: a migration roda em todo ambiente, não pode ser desligada e gravaria um hash de senha no histórico do schema.
- **RF39 - Limpeza diária da conta demo (B7 decidida).** Um job agendado roda **todos os dias às 03:00 America/Sao_Paulo** e apaga **todos os lançamentos** da conta demo (despesas, parcelas e receitas, pendentes ou pagos), independentemente de quando foram criados. Regras:
  - age só sobre a conta demo; nenhum outro usuário, nem o dataset demo público, é afetado;
  - é idempotente: rodar de novo sem lançamentos não falha nem altera nada;
  - se o job falhar ou a API estiver fora do ar às 03:00, a limpeza acontece na próxima execução (premissa P21);
  - não altera a conta (nível, senha, status) nem encerra as sessões dela (premissa P22);
  - o que acontece com os cartões da conta demo depende de B9;
  - a execução registra em log quantos lançamentos foram apagados, sem dados sensíveis.

  O horário é em America/Sao_Paulo, convertido para UTC pelo agendador (03:00 em São Paulo = 06:00 UTC, sem horário de verão vigente).

### Navegação e ajustes

- **RF22 - Navegação.** Abas inferiores: **Dashboard**, **Finanças** e **Ajustes**. O botão "Novo" fica sempre acessível nas duas primeiras.
- **RF23 - Ajustes.** Mostra:
  - nome e e-mail do usuário (para a conta demo, `demo@showcase.invalid`, P18);
  - "Trocar senha" (RF33; oculto para a conta demo, B8);
  - para a conta demo, um aviso de que a conta é compartilhada e os lançamentos são apagados todos os dias às 03:00 (texto do design);
  - tema (Sistema, Claro ou Escuro);
  - links para Política de privacidade e Suporte (as URLs públicas de T-W1);
  - versão do app;
  - "Sair".

### Web (B6, B8)

- **RF38 - Editar e excluir no web para qualquer usuário (B6 decidida).** Na tela `/entries` do web, "Editar despesa" e "Excluir despesa" passam a aparecer para qualquer usuário logado (`ADMIN`, `USER` e a conta demo), com as mesmas regras, confirmações e textos de hoje. O web segue sem desfazer (DM14 vale só para o app). A regra de visibilidade usa o que a API informa no `me`, como no app (RF29). "Alterar senha" fica oculto no web para a conta demo (P19).

### Publicação

- **RF24 - Distribuição (B5 decidida).** O app é distribuído primeiro por TestFlight e depois pela **App Store pública**. A ficha da loja tem nome, ícone, capturas de iPhone, descrição em pt-BR, categoria Finanças, URL de política de privacidade, URL de suporte e as respostas de privacidade do App Store Connect (dados coletados: e-mail e nome, para funcionalidade do app, sem rastreamento).
- **RF25 - Acesso para revisão da Apple.** As notas de revisão trazem o e-mail `demo@showcase.invalid` e a senha `demo` (RF34), com o texto de que a conta nasce vazia, é limpa diariamente às 03:00 (horário de Brasília) e que o revisor pode criar, pagar, editar e excluir lançamentos. O app não tem modo demonstração sem login.

## 4. Requisitos não funcionais

- **RNF01 - Plataforma.** React Native, só iPhone na v1: retrato, sem layout dedicado para iPad. Versão mínima do iOS e motor JS conforme o ADR 0011 §10.6 (iOS 16, Hermes). O código não deve impedir um build Android futuro (sem APIs exclusivas de iOS fora de adaptadores).
- **RNF02 - Armazenamento seguro do token.**
  - O token de sessão fica só no Keychain, com acessibilidade "após o primeiro desbloqueio, somente neste aparelho" (não sincroniza com o iCloud nem vai para backups de outro aparelho). Não há credencial de renovação (B2).
  - Nunca vai para AsyncStorage, arquivos, logs, crash reports, URL ou deep link.
  - Como o Keychain sobrevive à desinstalação, a primeira execução após uma instalação apaga qualquer token remanescente.
  - A senha digitada (login ou troca) nunca é gravada no aparelho.
- **RNF03 - Transporte.** Só HTTPS (App Transport Security sem exceções em produção), com TLS 1.2 ou superior, terminado no nginx de produção (B1). A URL da API vem da configuração do build por ambiente (dev, staging, produção) e não é editável pelo usuário.
- **RNF04 - Dinheiro.** Os valores trafegam e são guardados como string decimal (`"1234.56"`). A conversão da entrada pt-BR para a string, a divisão das parcelas na prévia e o total da seleção do pagamento em lote usam inteiros em centavos (BigInt ou equivalente), nunca ponto flutuante. A exibição usa `R$`, separador de milhar `.` e decimal `,`, e saldos negativos usam o sinal `-` antes do `R$` ("-R$ 150,00", DM4).
- **RNF05 - Datas.**
  - Instantes UTC são exibidos em America/Sao_Paulo, independentemente do fuso do aparelho.
  - Datas civis (`date`, `closingDate`, `dueDate`) são exibidas sem conversão de fuso.
  - "Hoje" e "mês corrente" são calculados em America/Sao_Paulo.
  - O horário da limpeza diária (RF39) é definido em America/Sao_Paulo, não no fuso do servidor.
  - Isso precisa ser verificado no motor JS do app (suporte a `Intl` com `timeZone` no Hermes/iOS); se faltar, usa-se uma biblioteca de fuso.
- **RNF06 - Erros.** O app interpreta só `code` (nunca `message`) para decidir o comportamento e exibe `message` em pt-BR quando não houver texto próprio. Os erros de rede e de timeout têm uma mensagem própria ("Sem conexão. Verifique sua internet."). O timeout padrão é de 15 s. Uma ação de escrita que der timeout não é reenviada automaticamente.
- **RNF07 - Desempenho.** Abertura a frio até o Dashboard com dados em até 3 s no p90, num iPhone de referência (sugestão: iPhone 12) em 4G. A rolagem das listas mantém 60 fps com 500 itens carregados. As leituras do mesmo mês ficam em cache em memória e são revalidadas ao voltar para a tela, no pull-to-refresh e após qualquer escrita.
- **RNF08 - Acessibilidade.**
  - VoiceOver: rótulos em todos os controles, inclusive nas ações por item ("Marcar como pago: Aluguel", "Editar despesa: Aluguel", "Excluir despesa: Aluguel") e no modo de seleção, e os gráficos têm resumo textual ou tabela alternativa (como o `monthly-chart-a11y` do web).
  - Ações de deslizar e o círculo de status (DM15) têm alternativa acessível (ações do VoiceOver e menu de contexto).
  - O prazo de "Desfazer" (DM14) é maior com o VoiceOver ativo (valores no design).
  - Dynamic Type até pelo menos "Extra Extra Large" sem cortar valores.
  - Alvos de toque de pelo menos 44 × 44 pt.
  - Contraste WCAG 2.1 AA nos dois temas.
  - Status e saldo negativo não dependem só de cor.
  - Respeita "Reduzir movimento".
- **RNF09 - Privacidade.** Sem SDKs de rastreamento ou publicidade na v1, e por isso sem App Tracking Transparency. Sem crash reporting na v1 (ADR 0011 §10.12). O app esconde o conteúdo na tela do alternador de apps (premissa P11).
- **RNF10 - Segurança da API exposta (B1 decidida).**
  - A API é publicada só pelo nginx de produção, por HTTPS. A porta da API não fica acessível diretamente pela internet.
  - O `trust proxy` da API confia **só no nginx** (endereço explícito, não `uniquelocal`), para que um `X-Forwarded-For` forjado não altere o IP usado nos limites de tentativa. O web chama a API por um listener interno do nginx, de modo que o IP real do usuário do site continua chegando à API por um único proxy confiável (R13 resolvido, ADR 0011 §6.1 N2, N3 e N9).
  - Os limites de tentativas (RNF04 da spec de autenticação) continuam valendo por IP real do cliente, tanto no app quanto no web.
  - Respostas 401 continuam com `WWW-Authenticate: Bearer`.
  - Nenhum endpoint novo de escrita é exposto além dos que já existem. As rotas `/api/admin/*` e `/api/demo/*` não são publicadas no host público da API (ADR 0011 §6.1 N4); o web continua alcançando as duas pelo listener interno.
- **RNF11 - Compatibilidade de contrato.** O app consome os contratos atuais. Mudanças na API são só aditivas (campos novos no `me`) ou de autorização (B6, B8); o web atual continua funcionando com a API nova. Mudanças incompatíveis na API precisam considerar que versões antigas do app ficam instaladas: há uma versão mínima suportada (T7) e um aviso de atualização obrigatória.
- **RNF12 - Testes.**
  - API: unitários e e2e para tudo o que for criado ou alterado (exposição/`trust proxy`, conta demo e a exceção de senha, recusa de troca de senha da conta demo, autorização de editar e excluir por qualquer nível com isolamento por dono, limpeza diária, tipo de cliente, versão mínima) e cobertura de pelo menos 80% em domain e application. Integração com Postgres real para o provisionamento da conta demo e para a limpeza diária.
  - Web: testes de componente para a visibilidade de editar e excluir para `USER` e para a ocultação de "Alterar senha" na conta demo.
  - App: unitários para as regras puras (dinheiro, datas, payloads, prévia de parcelas, total da seleção, mapeamento de erros, visibilidade das ações, regras do desfazer) e testes de componente para os formulários, as confirmações de ação, os estados e o fluxo de sessão. E2E em simulador iOS com uma API stub para login, troca pendente, troca opcional, sessão expirada, criação dos três tipos, pagar, pagar em lote, pagar fatura, editar, excluir, desfazer e navegação de Finanças e Dashboard.
- **RNF13 - Observabilidade.** Os eventos de login da API (RNF13 da spec de autenticação) registram o tipo de cliente (`WEB` ou `MOBILE`) e a versão do app, sem dados sensíveis. Logins e escritas da conta demo são identificáveis nos logs de auditoria (pelo id da conta), para acompanhar abuso. Cada execução da limpeza diária registra o resultado (RF39).
- **RNF14 - Idioma.** Só pt-BR na v1.

## 5. Critérios de aceite

### Autenticação e sessão

**CA01 - Login com sucesso (RF01, RNF02)**
- Given a usuária ativa "ana@exemplo.com", sem troca pendente, com a senha "segredo123"
- When ela entra pelo app
- Then o app chama `POST /api/auth/login`, grava o token só no Keychain e abre o Dashboard do mês corrente em America/Sao_Paulo.
- And nenhum log do app, AsyncStorage ou arquivo contém o token ou a senha (verificado por teste que inspeciona o storage e o logger).

**CA02 - Credenciais inválidas sem enumeração (RF01)**
- Given os e-mails "ana@exemplo.com" (senha errada), "naoexiste@exemplo.com" e "bruno@exemplo.com" (inativo)
- When se tenta entrar com cada um
- Then o app mostra o mesmo banner "E-mail ou senha inválidos." nos três casos e não grava token.

**CA03 - Limite de tentativas (RF01)**
- Given 5 falhas de login de "ana@exemplo.com" nos últimos 15 minutos
- When ela tenta de novo
- Then o app mostra a mensagem de excesso de tentativas com o tempo derivado de `retryAfterSeconds` e não grava token.

**CA04 - Reabrir o app com sessão válida (RF02)**
- Given Ana logada há 2 horas, com o app encerrado e o token válido
- When ela abre o app
- Then o app chama `GET /api/auth/me` e abre o Dashboard sem pedir senha.

**CA05 - Sessão expira em 24 h, sem renovação (RF02, RF04, B2)**
- Given Ana entrou pelo app às 08:00 de 2026-11-02
- When ela usa o app às 08:01 de 2026-11-03 (ou abre o app nesse horário)
- Then a API responde 401, o app apaga o token, mostra "Sua sessão expirou. Entre novamente." e exibe o login.
- And o app não chama nenhuma rota de renovação; a única forma de seguir é entrar de novo.
- And o mesmo acontece se a sessão tiver sido encerrada por inativação, senha redefinida ou troca de senha em outro cliente.

**CA06 - Reabrir sem rede (RF02)**
- Given Ana com token salvo e o aparelho em modo avião
- When ela abre o app
- Then aparece "Sem conexão. Verifique sua internet." com "Tentar novamente", e o token não é apagado.

**CA07 - Troca obrigatória pendente no login (RF32, B4)**
- Given a usuária "carla@exemplo.com" com senha temporária "Temp1234" e `mustChangePassword = true`
- When ela entra pelo app com "Temp1234"
- Then o app chama `POST /api/auth/logout`, não grava token no Keychain, continua na tela de login e mostra "Você precisa definir uma nova senha antes do primeiro acesso. Troque a senha pelo site e depois entre no app com a nova senha." com o botão "Abrir o site".
- When ela toca em "Abrir o site"
- Then a página de troca de senha do web abre no navegador do sistema.
- When ela troca a senha pelo site para "MinhaSenha9" e entra no app com ela
- Then o app abre o Dashboard.

**CA08 - Troca pendente detectada depois do login (RF02, RF32)**
- Given Ana com token válido no Keychain e, por algum motivo, `mustChangePassword = true`
- When ela abre o app (`GET /api/auth/me` devolve `mustChangePassword: true`) ou qualquer leitura responde 403 `PASSWORD_CHANGE_REQUIRED`
- Then o app chama o logout, apaga o token, limpa o cache e mostra o login com o aviso do CA07.
- And, se o administrador redefinir a senha de Ana enquanto ela usa o app, a próxima chamada responde 401 e vale o CA05; ao entrar com a senha temporária, vale o CA07.

**CA09 - Sair (RF05)**
- Given Ana logada
- When ela toca em "Sair" em Ajustes
- Then o app chama `POST /api/auth/logout`, apaga o token do Keychain, limpa o cache e mostra o login. Uma requisição posterior com o token antigo responde 401 na API.
- And, sem rede, o app sai localmente mesmo assim.

**CA10 - Reinstalação (RNF02)**
- Given Ana logada, que desinstala e reinstala o app
- When ela abre o app pela primeira vez após a reinstalação
- Then o app mostra o login (qualquer token remanescente no Keychain foi apagado).

### Dashboard

**CA11 - Resumo do mês (RF07, RNF04)**
- Given Ana com receita de "5000.00", despesa paga de "100.00" e despesa pendente de "500.00" em 2026-11
- When ela abre o Dashboard em 2026-11
- Then vê Receitas "R$ 5.000,00", Despesas "R$ 600,00" (pagas "R$ 100,00", pendentes "R$ 500,00"), Saldo realizado "R$ 4.900,00" e Saldo previsto "R$ 4.400,00".

**CA12 - Saldo negativo (RF07, RNF08)**
- Given um mês em que `balance.projected = "-150.00"`
- When o Dashboard é exibido
- Then o Saldo previsto aparece como "-R$ 150,00", com o indicador "Negativo" (DM4), legível pelo VoiceOver e sem depender só de cor.

**CA13 - Série e categorias (RF07, RNF08)**
- Given o mês 2026-11
- When o Dashboard carrega
- Then o gráfico mostra os 12 meses de 2025-12 a 2026-11 (com zero nos meses sem lançamentos), a distribuição mostra as categorias em ordem decrescente com valor e percentual, e o VoiceOver lê um resumo textual de cada gráfico.
- And, num mês sem despesas, a distribuição mostra o estado vazio.

**CA14 - Erro isolado por bloco (RF08)**
- Given que `GET /api/dashboard/monthly-series` responde 500
- When o Dashboard carrega
- Then o resumo e as categorias aparecem normalmente e só o bloco da série mostra "Não foi possível carregar a evolução mensal." com "Tentar novamente".

**CA15 - Mês corrente no fuso de São Paulo (RNF05)**
- Given o aparelho configurado em UTC, às 01:30 UTC de 2026-12-01 (22:30 de 2026-11-30 em São Paulo)
- When Ana abre o Dashboard
- Then o mês exibido é novembro de 2026, e "hoje" no formulário é 30/11/2026.

### Finanças (leitura)

**CA16 - Mês inicial (RF09, DM10)**
- Given que a API responde `{ currentMonth: "2026-11", month: "2026-12", advance: "NEXT_PENDING" }`
- When Ana abre Finanças pela primeira vez na sessão
- Then a lista abre em dezembro de 2026 com o aviso de avanço, e o Dashboard continua em novembro de 2026.
- And, se a chamada falhar ou passar de 1,5 s, abre em novembro de 2026 sem aviso.

**CA17 - Despesas com filtro e subtotal (RF11, DM2, DM3)**
- Given 45 despesas de Ana em 2026-11, 3 delas pendentes em PIX
- When ela abre a aba Despesas
- Then o filtro de status está em "Pendente".
- When ela filtra Pendente + PIX
- Then vê só essas 3, e o subtotal mostra a soma delas (total, pago "R$ 0,00", pendente).
- When ela escolhe "Todos", remove os outros filtros e rola a lista até o fim
- Then os 45 itens são carregados em páginas de 20, sem itens repetidos ou faltando.

**CA18 - Datas civis sem deslocamento (RNF05)**
- Given uma despesa com `date: "2026-11-01"` e o aparelho em UTC-03 ou UTC+09
- When a lista é exibida
- Then a data aparece como "01/11/2026" nos dois casos.

**CA19 - Faturas (RF13)**
- Given o cartão "Nubank" com fatura 2026-11 (fecha 10/11/2026, vence 20/11/2026, total "600.00", pago "100.00", pendente "500.00", 3 despesas)
- When Ana abre a aba Faturas em 2026-11 (filtro padrão "Pendente") e toca na fatura
- Then vê esses valores e as 3 despesas da fatura numa tela empilhada dentro de Finanças, com a tab bar visível. Com o filtro "Pago", essa fatura não aparece.

**CA20 - Estados vazio e erro (RF14)**
- Given um mês sem receitas
- When Ana abre a aba Receitas
- Then vê o estado vazio. Se a API responder 500, vê o erro com "Tentar novamente", e o pull-to-refresh recarrega.

### Criação

**CA21 - Despesa PIX paga (RF16, RF20)**
- Given Ana em Finanças, em 2026-11
- When ela cria Despesa "Aluguel", categoria "Moradia", data 05/11/2026, valor "1.500,00", PIX, sem marcar "Ainda não paguei"
- Then o app envia `{ type: "EXPENSE", description: "Aluguel", category: "Moradia", date: "2026-11-05", amount: "1500.00", paymentMethod: "PIX" }` (sem `paid`), mostra "Despesa criada.", e o resumo, a lista de despesas e o dashboard de 2026-11 refletem o novo valor sem reiniciar o app.

**CA22 - Despesa PIX pendente e despesa no cartão (RF16, RF20)**
- Given Ana com o cartão "Nubank"
- When ela cria uma despesa PIX com "Ainda não paguei", e depois uma despesa no cartão "Nubank"
- Then a primeira é enviada com `paid: false` e aparece como pendente; a segunda é enviada com `cardId` e sem `paid`, aparece pendente na fatura calculada pela API, e a confirmação tem a 2ª linha com a fatura e o vencimento (DM5).
- And a opção "Ainda não paguei" não aparece para Cartão nem para Receita.

**CA23 - Valor com teclado decimal e limites (RF16, RNF04, DM9)**
- Given o campo Valor
- When Ana digita "1234,5", "0,00" e "10.000.000.000,00"
- Then o primeiro é enviado como `"1234.50"` (e exibido "1.234,50" ao sair do campo), o segundo mostra "Informe um valor maior que zero." e o terceiro mostra "O valor máximo é R$ 9.999.999.999,99.", sem chamar a API nos dois últimos.

**CA24 - Despesa parcelada (RF17)**
- Given o formulário "Despesa parcelada"
- When Ana informa o total "350,00", 6 parcelas, PIX e a data 31/01/2027
- Then a prévia mostra "2 × R$ 58,34 e 4 × R$ 58,33" e informa que todas nascem pendentes.
- When ela salva
- Then o app envia `amount: "350.00"`, `installments: 6`, mostra "6 parcelas criadas.", e a lista de 2027-02 mostra a parcela com data 28/02/2027.
- And parcelas fora de 2-36 são barradas no campo antes do envio.

**CA25 - Receita (RF18)**
- Given o formulário "Receita"
- When Ana cria "Salário", "Trabalho", 05/11/2026, "5.000,00"
- Then o app envia `{ type: "INCOME", ..., paymentMethod: "PIX" }`, sem `cardId` nem `paid`, e a receita aparece como recebida na aba Receitas, sem ações de pagar, editar ou excluir.

**CA26 - Erros da API no formulário (RF19)**
- Given um formulário de despesa no cartão
- When a API responde 400 com `fields: [{ field: "category", code: "TOO_LONG" }]`, ou 404 `CARD_NOT_FOUND`, ou a rede cai
- Then, respectivamente: o erro aparece no campo Categoria; aparece "O cartão escolhido não existe mais." e a lista de cartões é recarregada; aparece a mensagem de conexão. Nos três casos, os campos continuam preenchidos e nada é anunciado como criado.

**CA27 - Envio duplo (RF19, RF31)**
- Given um formulário válido
- When Ana toca "Salvar" duas vezes rapidamente
- Then só uma requisição é enviada e só um lançamento é criado.

**CA28 - Sem cartão cadastrado (RF21)**
- Given Ana sem cartões
- When ela abre "Despesa"
- Then a opção Cartão está desabilitada com o texto "Cadastre um cartão no site para usar esta opção."

### Ações sobre lançamentos

**CA34 - Marcar como pago (RF26, DM15)**
- Given a despesa PIX pendente "Internet", "R$ 120,00", em 2026-11
- When Ana toca no círculo de status de "Internet" (ou usa o deslizar, o menu de contexto ou a ação do VoiceOver) e confirma
- Then o app chama `POST /api/entries/:id/pay` uma única vez, mostra a confirmação de `paidFeedback`, a despesa passa a "Pago" (sob o filtro "Pendente", sai da lista), e o resumo de 2026-11 mostra "R$ 120,00" a mais em pagas e a menos em pendentes, sem reiniciar o app.
- And, se ela cancelar a confirmação, nenhuma requisição é feita.
- And não é oferecido "Desfazer" depois do pagamento.

**CA35 - Marcar como pago: despesa removida em outro cliente (RF26)**
- Given a despesa "Internet" visível no app e excluída pelo site
- When Ana toca em "Marcar como pago" e confirma
- Then a API responde 404, o app mostra "Esta despesa não foi encontrada. A lista foi atualizada." e a lista é recarregada sem o item.

**CA36 - Pagar parcela individual (RF26)**
- Given uma série de 6 parcelas pendentes de "Notebook", com a 2ª parcela em 2026-12
- When Ana marca como paga a parcela de 2026-12
- Then só essa parcela passa a "Pago"; as outras 5 continuam pendentes.

**CA37 - Pagar fatura (RF30)**
- Given a fatura "Nubank" 2026-11 com 2 despesas pendentes ("R$ 500,00") e 1 paga
- When Ana toca em "Pagar fatura" e confirma
- Then o app chama `POST /api/cards/:cardId/invoices/2026-11/pay`, mostra a confirmação de `invoicePaidFeedback`, a fatura passa a pendente "R$ 0,00" (e sai da lista sob o filtro "Pendente") e as 2 despesas aparecem como pagas na aba Despesas.
- And uma fatura sem pendências não mostra "Pagar fatura".
- And, se a API responder 404 `CARD_NOT_FOUND`, aparece "Este cartão não foi encontrado. Nada foi alterado."

**CA38 - Editar despesa (RF27, B6)**
- Given a usuária Ana, de nível `USER`, e a despesa própria PIX pendente "Mercado", "Alimentação", 15/10/2026, "R$ 230,00"
- When ela edita o valor para "230,50" e a data para 02/11/2026 e salva
- Then o app envia `PUT /api/entries/:id` com `{ description: "Mercado", category: "Alimentação", date: "2026-11-02", amount: "230.50" }` (sem tipo, forma, cartão nem status), recebe 200, mostra "Despesa atualizada." com "Desfazer", a despesa sai da lista de 2026-10 e aparece na de 2026-11, e os resumos dos dois meses são atualizados.

**CA39 - Data travada em despesa paga no cartão (RF27)**
- Given uma despesa paga no cartão "Nubank"
- When o usuário abre "Editar"
- Then o campo Data está desabilitado com o texto "A data de uma despesa paga no cartão não pode ser alterada.", e os demais campos podem ser editados.
- And, se a API mesmo assim responder 422 `PAID_CARD_EXPENSE_DATE_LOCKED`, o erro aparece no campo Data e nada é anunciado como salvo.

**CA40 - Excluir despesa (RF28, B6, DM14)**
- Given a usuária Ana, de nível `USER`, e a despesa própria paga "Cinema", "R$ 60,00", em 2026-11
- When ela toca em "Excluir", lê o aviso e confirma
- Then o item sai da lista e aparece "Despesa excluída." com "Desfazer".
- When o prazo de desfazer termina sem toque
- Then o app chama `DELETE /api/entries/:id` uma única vez, recebe 204 e o resumo de 2026-11 mostra "R$ 60,00" a menos em pagas.
- And, se ela cancelar a confirmação, nada é enviado.

**CA41 - Excluir uma parcela (RF28, DM13)**
- Given uma série de 6 parcelas de "Notebook"
- When o usuário exclui a parcela de 2027-01 e o prazo de desfazer termina
- Then só essa parcela some; as outras 5 continuam nas listas dos seus meses. Não é oferecida a escolha "excluir todas".

**CA42 - Visibilidade das ações no app (RF29, B6)**
- Given dois usuários, um `ADMIN` e um `USER`, e a conta demo
- When cada um abre a aba Despesas
- Then "Marcar como pago" aparece para os três em despesas pendentes, e "Editar" e "Excluir" aparecem para os três em todas as despesas próprias (pendentes e pagas).
- And receitas não mostram nenhuma ação para nenhum deles.

**CA55 - Desfazer exclusão (RF28, DM14)**
- Given Ana acabou de confirmar a exclusão da despesa "Cinema" e o toast "Despesa excluída." com "Desfazer" está visível
- When ela toca em "Desfazer"
- Then "Cinema" volta à mesma posição da lista, nenhuma requisição `DELETE` é enviada, e a despesa continua existindo na API e no site.
- And, se ela mandar o app para o segundo plano antes do fim do prazo, o `DELETE` é enviado nesse momento.

**CA56 - Desfazer edição (RF27, DM14)**
- Given Ana acabou de mudar o valor de "Mercado" de "R$ 230,00" para "R$ 230,50" e o toast com "Desfazer" está visível
- When ela toca em "Desfazer"
- Then o app envia `PUT /api/entries/:id` com os valores anteriores (`amount: "230.00"`, data e demais campos originais), e a lista e o resumo voltam aos valores anteriores.
- And, se esse `PUT` falhar, aparece uma mensagem de erro e a despesa fica com os valores editados.

**CA57 - Pagar em lote (RF37, DM16)**
- Given 3 despesas pendentes de Ana em 2026-11 ("Água" R$ 80,00, "Luz" R$ 150,00, "Gás" R$ 40,00) e 1 paga
- When ela toca em "Selecionar", marca as 3 pendentes e toca em "Marcar como pago (3)" e confirma
- Then a barra mostra o total "R$ 270,00" antes do envio, o app chama `POST /api/entries/pay` com os 3 ids uma única vez, sai do modo de seleção, mostra o texto de `paidFeedback` para 3 itens, e as 3 passam a "Pago".
- And a despesa já paga não pode ser selecionada.
- And, se a API responder 404 `ENTRIES_NOT_FOUND`, nenhuma das 3 é paga, aparece a mensagem e a lista é recarregada.

### Autorização de editar e excluir (B6)

**CA50 - USER edita e exclui o próprio lançamento na API (RF29, tarefa 5b)**
- Given o usuário Bruno, nível `USER`, dono da despesa "Padaria"
- When ele chama `PUT /api/entries/:id` com dados válidos e, depois, `DELETE /api/entries/:id` dessa despesa
- Then a API responde 200 e 204, respectivamente, e não responde 403 `FORBIDDEN`.
- And um `ADMIN` continua editando e excluindo os próprios lançamentos como hoje (regressão).

**CA51 - USER não altera lançamento de outro usuário (RF29, tarefa 5b)**
- Given os usuários Ana e Bruno, ambos `USER`, e a despesa "Aluguel" de Ana
- When Bruno chama `PUT /api/entries/:id` ou `DELETE /api/entries/:id` com o id de "Aluguel"
- Then a API responde 404 `ENTRY_NOT_FOUND` nos dois casos (não 403), e "Aluguel" continua com os mesmos dados.
- And o mesmo vale quando o autor da chamada é `ADMIN` ou a conta demo: nenhum nível alcança lançamento de outro usuário.

**CA52 - Receitas continuam sem edição e exclusão (RF29)**
- Given Bruno, nível `USER`, dono da receita "Salário"
- When ele chama `PUT` ou `DELETE /api/entries/:id` com o id da receita
- Then a API responde 422 `ENTRY_NOT_EDITABLE` ou `ENTRY_NOT_DELETABLE`, como hoje para `ADMIN`.

**CA53 - Web mostra editar e excluir para USER (RF38, tarefa 13b)**
- Given Bruno, nível `USER`, logado no site, com a despesa pendente "Padaria" em 2026-11
- When ele abre `/entries` em 2026-11
- Then a linha de "Padaria" mostra "Editar despesa" e "Excluir despesa".
- When ele edita a descrição para "Padaria do bairro" e salva
- Then aparece "Despesa atualizada." e a lista mostra o novo texto.
- When ele exclui "Padaria do bairro" e confirma
- Then aparece "Despesa excluída." e o item sai da lista.
- And o web não oferece "Desfazer" (DM14 vale só para o app).

### Troca de senha opcional

**CA43 - Trocar senha em Ajustes (RF33)**
- Given Ana logada no app e também logada no site
- When ela abre Ajustes > "Trocar senha", informa a senha atual "segredo123", a nova "NovaSenha9" e a confirmação igual, e salva
- Then a API responde 200, o app mostra "Senha alterada." e continua logado, e a próxima requisição do site responde 401.
- And uma confirmação diferente mostra "As senhas não conferem." sem chamar a API.
- And a senha atual errada mostra "Senha atual incorreta." no campo, e a nova igual à atual mostra "A nova senha deve ser diferente da atual.".

### Conta demo

**CA44 - Entrar com a conta demo (RF34, RF25)**
- Given a conta demo provisionada em produção
- When alguém entra no app com o e-mail "demo@showcase.invalid" e a senha "demo"
- Then o app abre o Dashboard da conta demo, sem troca obrigatória.
- And o mesmo login funciona no site.
- And, no primeiro acesso após o provisionamento, Dashboard e Finanças mostram os estados vazios (nenhum lançamento, nenhum cartão).
- And os dados do dataset demo público (`/api/demo/*`) não aparecem na conta demo, e vice-versa.

**CA45 - Exceção restrita à conta demo (RF34)**
- Given a política de senha atual (8 a 72 caracteres) e a validação de e-mail no login
- When um administrador tenta criar um usuário com senha "demo", ou redefinir a senha de alguém para "demo", ou um usuário tenta trocar a própria senha para "demo"
- Then a API responde 400 com `TOO_SHORT`, como hoje.
- And um login com o identificador "demo" (sem `@`) e a senha "demo" responde `INVALID_CREDENTIALS` (não existe alias).
- And um login com qualquer outro identificador sem `@` continua respondendo `INVALID_CREDENTIALS`.

**CA46 - Conta demo usa as ações do app (RF35)**
- Given a conta demo logada no app
- When ela cria uma despesa PIX pendente, uma despesa parcelada e uma receita, marca a despesa como paga, paga duas parcelas em lote, edita uma parcela e exclui outra
- Then todas as operações têm sucesso e afetam só os dados da conta demo.

**CA47 - Conta demo sem administração (RF35)**
- Given um token válido da conta demo
- When se chama `GET /api/admin/users`, `POST /api/admin/users` ou `PUT /api/admin/users/:id` com esse token pela rede interna
- Then a API responde 403 `FORBIDDEN`, e nenhum usuário é criado ou alterado.
- And pelo host público as mesmas rotas respondem 404 (bloqueio no nginx, ADR 0011 §6.1 N4).

**CA48 - Conta demo não troca a senha (RF33, RF35, B8)**
- Given a conta demo logada no app e no site
- When ela abre Ajustes no app, ou o menu da conta no site
- Then "Trocar senha" (app) e "Alterar senha" (site) não aparecem.
- When se chama diretamente `PUT /api/account/password` com o token da conta demo e `{ currentPassword: "demo", newPassword: "OutraSenha9" }`
- Then a API responde **403** com `{ code: "FORBIDDEN", message, details }`, a senha continua "demo" e o login `demo@showcase.invalid`/`demo` segue funcionando.
- And a chamada com `currentPassword` errado também responde 403 `FORBIDDEN` (não 400 `INCORRECT`) e não conta no limite `password-change-user-failures`.

**CA49 - Provisionamento idempotente (RF36)**
- Given o seed com a conta demo habilitada
- When o seed roda duas vezes seguidas, com lançamentos criados pela conta demo entre as duas execuções
- Then existe exatamente uma conta demo, com nível `USER`, e-mail `demo@showcase.invalid`, senha "demo" e os lançamentos preservados.
- When a conta demo é desabilitada na configuração e o seed roda
- Then a conta fica inativa, as sessões dela são encerradas e o login `demo@showcase.invalid`/`demo` responde `INVALID_CREDENTIALS`.

**CA54 - Limpeza diária da conta demo (RF39, B7)**
- Given a conta demo com 5 lançamentos (2 despesas pendentes, 1 paga, 1 parcela e 1 receita), sendo um deles criado às 02:59 de 2026-11-03 (America/Sao_Paulo), e a usuária Ana com 3 lançamentos
- When o job roda às 03:00 de 2026-11-03 em America/Sao_Paulo (06:00 UTC)
- Then os 5 lançamentos da conta demo são apagados, inclusive o criado um minuto antes, e os 3 de Ana continuam intactos.
- And os dados do dataset demo público (`DEMO_USER_ID`) não são alterados pelo job.
- And a conta demo continua ativa, com a mesma senha, e entra normalmente depois da limpeza, vendo Dashboard e Finanças vazios.
- And o job não roda em outro horário do dia (ex.: às 03:00 UTC).
- And rodar o job de novo sem lançamentos termina sem erro e sem alterações.

### Isolamento e segurança

**CA29 - Isolamento por dono no app**
- Given Ana e Bruno com dados em 2026-11
- When Ana usa o app
- Then nenhum valor, categoria, cartão ou lançamento de Bruno aparece em nenhuma tela, e nenhuma ação de Ana (pagar, pagar em lote, editar, excluir, pagar fatura) com o id de um item de Bruno o altera (a API responde 404). Isso é garantido pela API (CA51 e o CA29 da spec de autenticação) e aqui é verificado por e2e do app contra a API stub com dois usuários.

**CA30 - HTTPS obrigatório (RNF03)**
- Given um build de produção
- When se inspeciona o `Info.plist` e a configuração do app
- Then não há exceção de App Transport Security, e a URL da API de produção começa com `https://`.

**CA31 - Limite por IP real atrás do nginx (RNF10)**
- Given a API exposta atrás do nginx, com `trust proxy` restrito a ele
- When um cliente faz 21 logins em 1 minuto variando o cabeçalho `X-Forwarded-For`
- Then a 21ª requisição responde 429. O cabeçalho forjado não reinicia o limite.
- And uma requisição que chega à API sem passar pelo nginx não é aceita pela rede pública (a porta da API não está exposta).

**CA58 - Login pelo site usa o IP real do usuário (RNF10, R13)**
- Given o web chamando a API pelo listener interno do nginx (ADR 0011 §6.1 N3)
- When 25 usuários diferentes, de IPs diferentes, entram pelo site no mesmo minuto
- Then nenhum deles recebe 429, porque a API conta as tentativas pelo IP de cada usuário, e não pelo IP do container do web.

### Publicação

**CA32 - Build no TestFlight (RF24)**
- Given o pipeline de build iOS configurado com a conta Apple Developer
- When uma versão é gerada a partir da branch principal
- Then o build assinado aparece no TestFlight com o número de versão e o build incrementado, apontando para a API de produção (ou staging, conforme o canal).

**CA33 - Requisitos de loja (RF24, RF25)**
- Given a ficha do App Store Connect
- When ela é enviada para revisão
- Then tem as URLs públicas (HTTPS) de privacidade e suporte acessíveis sem login, as respostas de privacidade preenchidas, capturas de iPhone e, nas notas de revisão, o e-mail "demo@showcase.invalid", a senha "demo" e o aviso da limpeza diária às 03:00.
- And, no momento do envio, a conta demo está ativa e entra com sucesso pelo build enviado.

## 6. Fora de escopo (v1)

- Android e iPad (layout dedicado).
- Renovação de sessão (refresh token), sessão mais longa no mobile e login com biometria (B2).
- Troca **obrigatória** de senha no app (B4): é feita no site.
- Ações sobre a série de parcelas inteira (editar ou excluir todas de uma vez). Não existem na API nem no web (DM13).
- Editar ou excluir receitas (não existem na API).
- Editar ou excluir lançamentos de outro usuário, por qualquer nível, inclusive `ADMIN` (B6).
- "Desfazer" no web e "desmarcar pago" em qualquer cliente (DM14).
- Alias de login sem `@` para a conta demo (removido na rev. 3).
- Criar, editar e listar cartões como tela própria (o app só lê a lista para o formulário).
- Meu perfil e gestão de usuários (continuam no web).
- **Modo demonstração sem login baseado em `/api/demo/*`** (sugerido na rev. 1): substituído pela conta demo (B5). As rotas `/api/demo/*` e a demonstração do web continuam como estão; o app não as usa.
- Cadastro público e "esqueci a senha" (não existem no produto).
- Notificações push, widgets, Siri/Shortcuts, Apple Watch.
- Modo offline com fila de criação ou de ações (o app exige conexão para escrever).
- Internacionalização além de pt-BR.
- Versão web do app (Expo Web/React Native Web) e, portanto, CORS.
- Mudanças visuais no web, exceto as páginas públicas de T-W1, editar e excluir para `USER` (RF38) e a ocultação de "Alterar senha" para a conta demo (P19).

## 7. Riscos

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | **A API passa a ser pública** (reverte RF45/D11) e a superfície de ataque aumenta. | Alto | B1 decidida: só HTTPS pelo nginx, porta da API fechada, `trust proxy` só no nginx, limites de tentativa mantidos, nenhuma rota nova de escrita, `/api/admin/*` e `/api/demo/*` bloqueadas no host público (ADR 0011 §6.1 N4). |
| R2 | **Sessão de 24 h sem renovação** obriga a entrar de novo todo dia no celular. | Médio: experiência pior que a de apps de banco | Aceito pelo usuário (B2). Mensagem clara no RF04. Reavaliar após o beta do TestFlight. |
| R3 | **Reprovação na App Store por app "privado"** (sem cadastro, contas só por administrador; diretrizes 2.1 e 3.2). | Alto para a publicação | Conta demo funcional nas notas de revisão (RF25); app completo (criar, pagar, editar, excluir); TestFlight antes. Evitar enviar para revisão perto das 03:00 (limpeza diária). |
| R4 | **Conta Apple Developer** (anual, paga, em nome de pessoa física ou jurídica) e um Mac/serviço de build para assinar. | Bloqueia a publicação | Confirmar a titularidade (tarefa 2) e usar build em nuvem (ADR 0011 §10.1, EAS). |
| R5 | **Recharts não roda em React Native**, e o CLAUDE.md fixa Recharts para gráficos. | Médio | Exceção registrada no ADR 0011 §10.5 (gifted-charts só no mobile). |
| R6 | **Fuso e `Intl` no motor JS** (Hermes) podem não formatar America/Sao_Paulo como no web. | Médio | RNF05 + CA15/CA18 com o aparelho em fusos diferentes; plano B no ADR 0011 §10.6. |
| R7 | **Keychain sobrevive à desinstalação**: um token antigo pode reaparecer. | Baixo/médio | RNF02 + CA10. |
| R8 | **Limitador de tentativas em memória**: com mais de uma réplica da API exposta, o limite fica por instância. | Médio | Válido com uma réplica (ADR 0011 D8); `limit_req` recomendado no nginx (N8). |
| R9 | **Versões antigas do app** ficam instaladas e quebram com mudanças de contrato. | Médio | Versão mínima suportada + aviso de atualização (T7, 426). |
| R10 | **Duplicação de regras** (dinheiro, payload, parcelas, feedback) entre web e mobile pode divergir. | Médio | Cópia sincronizada com verificação de deriva em CI (ADR 0011 §10.3). |
| R11 | **Exigência de exclusão de conta** (diretriz 5.1.1(v)) vale para apps que permitem criar conta. Este app não permite, mas um revisor pode questionar. | Baixo | Texto nas notas de revisão; link de suporte para pedir exclusão ao administrador. |
| R12 | **Credencial fraca e pública em produção (`demo@showcase.invalid`/`demo`).** Qualquer pessoa entra. Riscos: (a) abuso de armazenamento e escrita em volume; (b) conteúdo ofensivo ou dados pessoais digitados por terceiros e vistos pelo revisor ou por outros visitantes; (c) troca da senha trancando o revisor fora; (d) bloqueio da conta por 5 falhas de login em 15 min bem na hora da revisão; (e) uso da sessão demo como ponto de partida para explorar a API exposta; (f) precedente de exceção à política de senha. | Alto | Nível `USER` (sem administração; CA47) e `/api/admin/*` bloqueado no host público; isolamento por dono; conta própria, separada do dataset demo público; (c) resolvido por B8 (403 `FORBIDDEN`, CA48) e restauração da senha no seed (RF36); (a) e (b) limitados pela limpeza diária (B7, RF39), com janela de até 24 h; (d) tratado no ADR 0011 §3.4 (sem bloqueio por identificador para essa conta, mantido o limite por IP), a confirmar na T12; interruptor por configuração (RF36); exceção de senha restrita a essa conta e coberta por teste (CA45); auditoria das ações da conta (RNF13). |
| R13 | **`trust proxy` só no nginx x BFF web.** **Resolvido** no ADR 0011 §6.1 (N3, N9) e §13: o web chama a API por um listener interno do nginx, que repassa o IP real do usuário; a API continua confiando só no nginx. | - | Mudança só de ambiente no web (`API_URL`), sem código (ADR 0011 §8, §9). Verificado pelo CA31 e pelo CA58. |
| R14 | ~~Editar e excluir só para ADMIN conflita com B3 e B5.~~ **Resolvido por B6.** | - | RF29, RF38, CA50-CA53. |
| R15 | **Exclusão definitiva pelo celular** (toque acidental). | Médio | Confirmação destrutiva obrigatória (RF28); deslize completo não exclui direto; "Desfazer" antes do envio (DM14, CA55). |
| R16 | **Mais usuários podem excluir dados** (B6): um `USER` que antes não excluía passa a poder apagar os próprios lançamentos, sem recuperação depois do envio. | Médio | Confirmação no web e no app; "Desfazer" no app; isolamento por dono (CA51): ninguém apaga dado de outro usuário. |
| R17 | **Exclusão adiada pelo "Desfazer"** (DM14): se o app for encerrado à força ou perder a rede no prazo do desfazer, a exclusão pode não chegar à API e a despesa reaparece. | Baixo | Envio antecipado ao ir para o segundo plano e ao sair (design 5.16); falha de rede devolve o item à lista com mensagem. Premissa P23. |
| R18 | **Limpeza diária em horário fixo** (B7): conteúdo de um visitante fica visível a outros por até 24 h; e quem estiver usando a conta às 03:00 vê os dados sumirem. | Baixo | Aviso em Ajustes (RF23) e nas notas de revisão (RF25); horário de baixo uso. |

## 8. Perguntas em aberto

### 8.1 Bloqueantes (mudam regra de negócio)

**B1 - Como o app alcança a API? Decidido.**
- **Decisão:** em produção a API fica atrás do proxy nginx. A API é exposta por HTTPS via esse nginx, e o `trust proxy` confia só nele (RNF10, CA31). A porta da API não é publicada diretamente. O web chama a API pelo listener interno do nginx (R13, resolvido no ADR 0011 §6.1).

**B2 - Por quanto tempo o usuário fica logado no app? Decidido.**
- **Decisão:** mesmo prazo do web, 24 h fixas desde o login. Não há refresh token, rotação nem família de sessões. Ao expirar, o app manda para o login (RF04, CA05).

**B3 - O que "visualizar finanças" inclui? Decidido.**
- **Decisão:** não é só leitura. O app oferece as ações que o web oferece sobre lançamentos: marcar como pago (individual e em lote, DM16), pagar fatura, editar despesa e excluir despesa, inclusive para parcelas (uma a uma) e despesas no cartão (RF26-RF31, RF37, CA34-CA42, CA55-CA57).

**B4 - Usuário com troca obrigatória de senha usa o app? Decidido.**
- **Decisão:** a troca obrigatória não é feita no app. Ao detectar a troca pendente, o app encerra a sessão e orienta a trocar pelo site, com o botão "Abrir o site" (RF32, CA07, CA08). Há uma troca **opcional** em Ajustes (RF33, CA43), que não é oferecida para resolver a troca obrigatória.

**B5 - Distribuição e acesso do revisor? Decidido (ajustado na rev. 3).**
- **Decisão:**
  - TestFlight primeiro e depois App Store pública (RF24);
  - conta demo real, login pelo e-mail `demo@showcase.invalid` e senha `demo`, sem dados, nível `USER`, que pode usar todas as ações sobre os próprios lançamentos, menos a administração de usuários e a troca de senha (RF34, RF35);
  - **sem exceção de formato no login** e sem alias `demo` sem `@` (removido na rev. 3); a única exceção é o tamanho da senha `demo`, aceita só no provisionamento dessa conta (RF34, CA45);
  - provisionamento por seed idempotente habilitado por configuração (RF36);
  - o modo demonstração sem login via `/api/demo/*` sai do escopo do app (seção 6);
  - riscos e mitigações da credencial fraca em R12.
- A titularidade da conta Apple Developer não foi informada: fica como premissa P15 e é confirmada na tarefa 2.

**B6 - Quem pode editar e excluir despesas? Decidido (rev. 3).**
- **Decisão:** qualquer usuário (`ADMIN` ou `USER`, inclusive a conta demo) edita e exclui os **próprios** lançamentos, no app e no web. O isolamento por dono continua: lançamento de outro usuário responde 404 para qualquer nível (CA51). Substitui o DM11 do design. Impacto: tarefa 5b (API) e tarefa 13b (web); RF29, RF38, CA42, CA50-CA53.

**B7 - Os dados criados na conta demo são apagados periodicamente? Decidido (rev. 3).**
- **Decisão:** sim. Um job apaga os lançamentos da conta demo todos os dias às 03:00 America/Sao_Paulo (RF39, CA54). O ADR 0011 rev. 2 descreve "24 h após a criação de cada registro"; a decisão do usuário é horário fixo diário, e o ADR é alinhado em paralelo.

**B8 - A conta demo pode trocar a própria senha? Decidido (rev. 3).**
- **Decisão:** não. "Trocar senha" fica oculto em Ajustes (app) e "Alterar senha" no menu da conta (web, P19). A API recusa `PUT /api/account/password` da conta demo com **403 `FORBIDDEN`** (ADR 0011 §3.4, §3.7, A4), antes de conferir a senha atual. O seed restaura a senha se ela divergir da configurada (RF36). CA48.

**B9 - A limpeza diária também apaga os cartões da conta demo?** (novo, rev. 3) B7 fala em "lançamentos". O app não cadastra cartões (P04), mas um visitante pode criar cartões pela conta demo no site, com nomes ofensivos ou dados pessoais, e eles ficariam para sempre e apareceriam para o revisor.
- Opções:
  - (a) sim: depois de apagar os lançamentos, o job apaga também todos os cartões da conta demo, e ela volta ao estado "sem dados" da criação;
  - (b) não: só lançamentos; cartões persistem até limpeza manual.
- **Sugestão padrão:** (a). Mantém a promessa de "conta vazia" do RF34 e das notas de revisão, e o ADR já previa apagar cartões junto (port `ShowcaseDataPurger`).

### 8.2 Técnicas (decisão do architect)

A maior parte foi decidida no ADR 0011 rev. 2. Ficam registradas aqui para rastreio; as que dependem das decisões da rev. 3 estão marcadas.

- **T1 - Expo ou React Native puro?** Decidido no ADR 0011 §10.1: Expo com prebuild, EAS Build e EAS Submit.
- **T2 - Estrutura do repositório e compartilhamento de código.** Decidido no ADR 0011 §10.2 e §10.3: `mobile/` na raiz, cópia sincronizada com verificação de deriva em CI.
- **T3 - Biblioteca de gráficos no mobile.** Decidido no ADR 0011 §10.5: `react-native-gifted-charts`, exceção ao Recharts só no mobile.
- **T4 - (Removida na rev. 2.)** Renovação de sessão não existe (B2).
- **T5 - Versão mínima do iOS e do motor JS.** Decidido no ADR 0011 §10.6: iOS 16, Hermes, verificação de `Intl` no simulador e plano B com polyfills.
- **T6 - Exposição da API pelo nginx (B1).** Decidido no ADR 0011 §6.1 e §8 (N1-N10, `TRUST_PROXY` obrigatório em produção). O conflito R13 foi resolvido pelo listener interno do nginx (N3).
- **T7 - Versão mínima suportada do app.** Decidido no ADR 0011 §10.7: cabeçalho `X-Client` e 426 `APP_UPDATE_REQUIRED`.
- **T8 - Crash reporting.** Decidido no ADR 0011 §10.12: nenhum SDK na v1.
- **T9 - Estado, cache e invalidação.** Decidido no ADR 0011 §10.8: TanStack Query em memória, invalidação ampla após qualquer mutação financeira.
- **T10 - Pipeline de CI do mobile.** Decidido no ADR 0011 §10.12.
- **T11 - API stub para os e2e do app.** Decidido no ADR 0011 §10.12. **Rev. 3:** o stub precisa do login `demo@showcase.invalid`, do 403 `FORBIDDEN` na troca de senha da conta demo, de editar e excluir para `USER` e do pagamento em lote.
- **T12 - Proteções extras da conta demo.** Parcialmente decidido no ADR 0011 §3.4. **Rev. 3, a revisar pelo architect:** com o alias removido, a isenção do bloqueio por identificador (5 falhas em 15 min) passa a valer para o e-mail `demo@showcase.invalid`, e não mais para o alias `demo`; limite de volume de escrita da conta demo (sugestão: não na v1, já que a limpeza é diária).
- **T13 - Como implementar a exceção da conta demo.** **Rev. 3:** só resta a exceção de senha (`PlainPassword.forShowcaseAccount`, ADR 0011 §3.5). O `LoginIdentifier` com alias do ADR rev. 2 deixa de ser necessário, porque o login usa o e-mail.
- **T14 - Autorização de editar e excluir depois de B6 (rev. 3).** Como expressar "qualquer usuário autenticado sobre os próprios lançamentos" e o que o `me` devolve para o cliente decidir a visibilidade (RF29, RF38). Sugestão: manter as capacidades do ADR 0011 §3.4, com `MANAGE_EXPENSES` concedida a `REGULAR` (`ADMIN` e `USER`) e `SHOWCASE`, e `CHANGE_OWN_PASSWORD` negada a `SHOWCASE`.
- **T15 - Agendamento da limpeza diária (rev. 3).** Como disparar o job às 03:00 America/Sao_Paulo com o agendador de manutenção atual (que hoje roda em intervalo), como evitar execução dupla com mais de uma réplica e como recuperar uma execução perdida. Sugestão: tarefa no `MaintenanceScheduler` (ADR 0011 S9) com horário calculado em America/Sao_Paulo e execução de recuperação na subida se a última limpeza tiver mais de 24 h.
- **T16 - Exclusão adiada pelo "Desfazer" (rev. 3).** Onde fica a exclusão pendente no app (estado em memória, fila) e como se comporta com o encerramento do app, 401 e troca de mês, seguindo o design 5.16.

### 8.3 Premissas adotadas

- **P01:** só pt-BR, só retrato, só iPhone.
- **P02:** o app não tem cadastro nem "esqueci a senha" (coerente com RF06 da spec de autenticação).
- **P03:** os contratos de entrada e saída do finance não mudam; o que muda é só a autorização de editar e excluir (B6).
- **P04:** sem cadastro de cartão no app. Usuário sem cartão usa PIX ou cadastra pelo site (RF21). Vale também para a conta demo.
- **P05:** a categoria segue a regra de grafia canônica da API; o app só sugere a partir de `GET /api/categories`.
- **P06:** o tema segue o sistema por padrão, com escolha manual em Ajustes. Fundo sólido e superfícies opacas, fonte do sistema (DM6, DM7).
- **P07:** o administrador usa o app como qualquer usuário. Nenhuma função de gestão de usuários no app.
- **P08:** o logout do app encerra só a sessão do app, não as do web. A troca de senha opcional encerra as outras sessões (comportamento atual da API).
- **P09:** quando a sessão expira durante um envio ou ação, o formulário não é preservado após o novo login.
- **P10:** a abertura de Finanças usa o mês inicial só na primeira vez de cada sessão do app. Depois, mantém o último mês escolhido enquanto o app estiver aberto. O mês do Dashboard é independente (DM10).
- **P11:** o conteúdo fica oculto no alternador de apps (proteção de dados financeiros), sem bloqueio por biometria.
- **P12:** a API de staging, se existir, segue o mesmo contrato e também tem a conta demo habilitada (com a mesma limpeza diária). O build de TestFlight interno pode apontar para ela.
- **P13:** nome de exibição da conta demo: "Conta de demonstração" (alinhado ao ADR 0011 §3.3). O e-mail `demo@showcase.invalid` usa um domínio reservado e não recebe mensagens.
- **P14:** ~~pagamento em lote fora da v1~~. **Removida na rev. 3:** o DM16 foi aceito e o pagamento em lote entra no app (RF37).
- **P15:** a conta Apple Developer fica em nome do dono do projeto; a confirmação (pessoa física ou jurídica) é feita na tarefa 2.
- **P16:** a página "Abrir o site" do RF32 é a tela de troca de senha do web; se o usuário não estiver logado no site, o web o leva ao login primeiro (comportamento atual).
- **P17:** confirmações de pagar, excluir e pagar fatura são diálogos nativos de confirmação (ou folha de ação), conforme o ui-designer; os textos seguem o web.
- **P18:** Ajustes mostra o e-mail `demo@showcase.invalid` para a conta demo (com o alias removido, não há motivo para exibir "demo").
- **P19:** B8 vale também no web: "Alterar senha" fica oculto para a conta demo no menu da conta (ADR 0011 §9). A rota da página, se acessada direto, mostra a mensagem genérica de falta de permissão ao receber 403.
- **P20:** a conta demo também não altera o próprio perfil (nome), pelo mesmo motivo de B8 (conta compartilhada). Já definido no ADR 0011 §3.4; o app não tem tela de perfil, então afeta só o web.
- **P21:** a limpeza diária que não rodar às 03:00 (API fora do ar, falha) é feita na execução seguinte do agendador; não há reprocessamento manual obrigatório.
- **P22:** a limpeza diária não encerra as sessões da conta demo; quem estiver logado vê as listas vazias na próxima atualização.
- **P23:** DM12-DM16 foram aceitos como padrão. Onde o design do app difere do web (círculo de status do DM15, modo de seleção do DM16 e "Desfazer" do DM14), vale o design para o app; o web não muda por causa deles.
- **P24:** além do job diário, há um modo manual de disparar a mesma limpeza (para usar antes de enviar uma versão para revisão). A forma (comando, script) é do architect.

## 9. Tarefas (ordenadas)

Tags: `[api]` backend NestJS (inclui exposição/deploy da API), `[db]` schema, migrations e seed, `[web]` Next.js, `[mobile]` app React Native.

### Fase 0 - Decisões e pré-requisitos
1. Responder B9 e registrar nesta spec. B1-B8 já decididas (rev. 2 e rev. 3).
2. `[mobile]` Confirmar a conta Apple Developer (P15), o bundle id (ex.: `br.<dominio>.finance`), o nome do app e o acesso ao App Store Connect.
3. `[mobile]` Conferir no ADR 0011 as decisões de T1, T2, T3, T5, T9, T11 e T16 (exclusão adiada).
4. `[api]` O architect atualiza o ADR 0011 com as decisões da rev. 3: T12, T13 (sem alias), T14 (autorização de B6), T15 (job das 03:00) e o código 403 `FORBIDDEN` de B8.

### Fase 1 - Backend
5. `[api]` Expor a API pelo nginx (B1, ADR 0011 §6.1 e §8): checklist N1-N10, porta da API fechada, `TRUST_PROXY` de produção só com o nginx e obrigatório em produção, listener interno para o web (R13). E2e do CA31.
5b. `[api]` Autorização de editar e excluir (B6): `PUT` e `DELETE /api/entries/:id` deixam de exigir `ADMIN` e passam a valer para qualquer usuário autenticado (inclusive a conta demo), mantendo o isolamento por dono (404 para lançamento de outro usuário) e os 422 de receita. O `me` informa ao cliente que o usuário pode editar e excluir (T14). Unitários e e2e (CA50, CA51, CA52; regressão de `ADMIN`). Atualizar `docs/api/finance.md`.
6. `[db]` Provisionamento da conta demo (RF36): enum/CHECK da conta (ADR 0011 §7), passo idempotente no seed, habilitado por configuração, com e-mail `demo@showcase.invalid`, nível `USER`, sem troca obrigatória, sem dados e id próprio, distinto de `DEMO_USER_ID`; desabilitar inativa e encerra sessões; restaura a senha se divergir. Integração com Postgres real (CA49).
7. `[api]` Exceção de senha da conta demo (RF34, T13): senha `demo` aceita só no provisionamento; login pelo e-mail sem nenhuma exceção de formato e sem alias. Unitários e e2e (CA44, CA45).
8. `[api]` Restrições da conta demo (B8): `PUT /api/account/password` responde 403 `FORBIDDEN` antes de conferir a senha atual e sem contar tentativas; perfil bloqueado (P20); proteções de T12. Unitários e e2e (CA47, CA48).
9. `[api]` Limpeza diária da conta demo (B7, RF39, T15): job às 03:00 America/Sao_Paulo que apaga todos os lançamentos da conta demo (e os cartões, conforme B9), idempotente, com log do resultado e o disparo manual de P24. Unitários com relógio falso (horário em SP) e integração com Postgres real (CA54).
10. `[api]` Identificação do cliente nas requisições de login (`WEB`/`MOBILE` e a versão do app) e auditoria das ações da conta demo (RNF13), sem mudar o contrato de resposta.
11. `[api]` Versão mínima suportada do app (T7): verificação e 426 `APP_UPDATE_REQUIRED` no formato `{ code, message, details }`. Unitários e e2e.
12. `[api]` Atualizar `docs/api/finance.md`, a documentação de identidade e o checklist de deploy do nginx (doc-writer).

### Fase 2 - Web
13. `[web]` T-W1: páginas públicas `/privacy` (política de privacidade, mencionando a conta demo compartilhada e a limpeza diária) e `/support` (contato), sem login, acessíveis via HTTPS, para a ficha da App Store.
13b. `[web]` Editar e excluir para qualquer usuário (B6, RF38): "Editar despesa" e "Excluir despesa" aparecem para `USER` e para a conta demo, usando o que a API informa no `me` (no lugar de `role === "ADMIN"`). Server Actions tratam 404 de lançamento de outro usuário com a mensagem existente. Testes de componente e e2e (CA53).
13c. `[web]` Conta demo (B8, P19, P20): esconder "Alterar senha" (e "Perfil") no menu da conta; tratar 403 `FORBIDDEN` nas Server Actions de conta. Testes de componente (CA48).
14. `[web]` Apontar o `API_URL` do BFF para o listener interno do nginx (R13, ADR 0011 §8 e §9). Mudança de ambiente, sem código; verificação manual do CA58 após o deploy.

### Fase 3 - App mobile (fundação)
15. `[mobile]` Criar o projeto em `mobile/` (T1/T2), com TypeScript estrito, lint, testes unitários, configuração por ambiente (URL da API) e ATS sem exceções (CA30).
16. `[mobile]` Regras puras compartilhadas ou portadas, com testes:
    - dinheiro: entrada pt-BR (DM9) para string decimal, formatação, centavos e total da seleção do lote;
    - datas: SP, data civil e mês corrente;
    - payloads e validação dos três formulários de criação, do formulário de edição e da troca de senha;
    - prévia de parcelas;
    - textos de feedback (`paidFeedback`, `invoicePaidFeedback`, DM5);
    - visibilidade das ações por item conforme o `me` (RF29, B6);
    - mapeamento de erros (CA15, CA18, CA23, CA24).
17. `[mobile]` Cliente HTTP:
    - Bearer e `X-Client`;
    - timeout, sem reenvio automático de escrita;
    - interpretação de `code`;
    - tratamento central de 401 (RF04), 403 `PASSWORD_CHANGE_REQUIRED` (RF32), 426 e 429;
    - erro de rede.
18. `[mobile]` Armazenamento seguro do token no Keychain, com limpeza na primeira execução após instalar (CA01, CA10).
19. `[mobile]` Tema, tokens de design e componentes base (botão, campo, campo de valor, seletor de data, seletor de mês, abas, segmentos de status, círculo de status, barra de seleção, diálogo de confirmação, toast com "Desfazer", estados vazio, erro e esqueleto), seguindo o ui-designer e DM1-DM16. Inclui acessibilidade (RNF08).

### Fase 4 - App mobile (funcionalidades)
20. `[mobile]` Login e sessão: tela de entrar, sessão persistida com `me`, sem rede, sessão expirada em 24 h e sair (CA01-CA06, CA09).
21. `[mobile]` Troca obrigatória pendente: logout, aviso e "Abrir o site" (CA07, CA08).
22. `[mobile]` Navegação por abas (Dashboard, Finanças e Ajustes) e Ajustes, com o aviso da conta demo (RF22, RF23).
23. `[mobile]` Troca de senha opcional em Ajustes, oculta para a conta demo (CA43, CA48).
24. `[mobile]` Dashboard: resumo, série de 12 meses, distribuição por categoria, seletor de mês, erro por bloco, pull-to-refresh e resumo textual dos gráficos (CA11-CA15).
25. `[mobile]` Finanças: mês inicial com aviso, aba Despesas com filtros (padrão Pendente), subtotal e rolagem infinita (CA16-CA18).
26. `[mobile]` Finanças: abas Receitas e Faturas, com o detalhe da fatura na pilha de Finanças (CA19, CA20).
27. `[mobile]` Nova despesa e nova receita, com categorias e cartões (CA21-CA23, CA25-CA28).
28. `[mobile]` Despesa parcelada com prévia (CA24).
29. `[mobile]` Marcar como pago individual pelo círculo de status, deslizar, menu de contexto e VoiceOver (CA34-CA36).
29b. `[mobile]` Pagar em lote com o modo de seleção (CA57).
30. `[mobile]` Pagar fatura, na lista e no detalhe (CA37).
31. `[mobile]` Editar despesa, com a trava de data em despesa paga no cartão, a visibilidade de RF29 e o "Desfazer" (CA38, CA39, CA42, CA56).
32. `[mobile]` Excluir despesa com confirmação destrutiva e exclusão adiada com "Desfazer" (CA40-CA42, CA55).
33. `[mobile]` Invalidação de cache após criar, pagar, pagar em lote, editar, excluir e desfazer, e confirmações (RF20, RF26-RF30, RF37).
34. `[mobile]` Aviso de atualização obrigatória (T7).

### Fase 5 - Qualidade e publicação
35. `[mobile]` E2E em simulador iOS contra a API stub (T11), cobrindo login, troca pendente, troca opcional, sessão expirada, os três formulários, pagar, pagar em lote, pagar fatura, editar, excluir, desfazer, a conta demo (inclusive como `USER` editando e excluindo), dois usuários (CA29), Finanças e Dashboard, além da auditoria de acessibilidade (VoiceOver e Dynamic Type).
36. `[mobile]` Pipeline de CI (T10): testes e build EAS e envio ao TestFlight (CA32).
37. `[db]` `[api]` Habilitar a conta demo em produção (e no staging, P12), conferir a limpeza diária e verificar o login `demo@showcase.invalid`/`demo` contra o build de TestFlight (CA44, CA54).
38. `[mobile]` Ficha da App Store: ícone, splash, capturas, descrição, respostas de privacidade, URLs de T-W1 e notas de revisão com `demo@showcase.invalid`/`demo` e o aviso da limpeza diária (CA33).
39. `[mobile]` Beta interno no TestFlight, correções e envio para revisão da App Store, com a conta demo limpa (P24) e ativa no momento do envio, longe do horário da limpeza.
40. `[api]` `[web]` `[mobile]` Atualizar o README e a documentação (doc-writer): como rodar o app, variáveis por ambiente, conta demo (como habilitar, limpar e desligar), limpeza diária, nova regra de editar e excluir e fluxo de release.
