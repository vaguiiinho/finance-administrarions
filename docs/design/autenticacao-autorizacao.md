# Design: Autenticação, conta, gestão de usuários e modo demonstração

> **Nota de atualização (ADR 0013 / `docs/design/remover-demo-publica-login.md`, 2026-11-14):** a demonstração pública (`/demo/*`, visitante sem login, `DemoBanner`, chip "Demonstração", botão "Entrar" da navbar, modo somente leitura, `basePath` `/demo`) foi **removida**; o link "Ver demonstração" também. A raiz `/` sem sessão vai para `/login`, e "Sair" leva a `/login`. O login ganhou o rótulo condicional "E-mail ou usuário" e a dica da conta demo (`demo`/`demo`, só com `DEMO_ACCOUNT_HINT=on`). As seções afetadas abaixo trazem uma nota própria (2.1, 2.2, 2.5, 3.1, 3.2, 3.6, 3.7, 7, 8, 9, 11.1, 11.10 e as referências à demo da seção 17); o texto original é mantido como histórico.

- Data: 2026-10-28 (rev. 2: 2026-10-29; rev. 3: 2026-10-29)
- Branch: `feat/auth-authorized`
- Autor: ui-designer
- Status: **Aprovado** (2026-10-29), inclusive a seção 17 (layout global), com PL1-PL3 aprovados pelo usuário.
- Entradas: `docs/specs/autenticacao-autorizacao.md` (rev. 2: RF01-RF45, RNF09, CA01-CA47, B1-B5, P01-P20), `docs/adr/0005-autenticacao-autorizacao-demo.md` (rev. 2, seção 9), `docs/design/design-system.md` (rev. 7, vidro fosco), `docs/design/superficies-vidro-fosco.md`, `docs/design/lancamentos-financeiros.md` (shell 2.x, estados dos controles 1.8, componentes 6.x).
- Escopo: só `web/`. Nenhuma mudança de contrato da API. Nenhum token de cor novo.

### Histórico de revisões

- **rev. 3 (2026-10-29):** PA6, PA7 e PA8 aprovados e aplicados (6.4, 6.6, DA14). Nova seção 17, **Proposta**: a navegação principal sai da navbar e vai para um menu lateral (`AppSidebar`, fixo a partir de `xl`, drawer com botão de menu abaixo disso); a navbar fica com marca, tema e conta/"Entrar"; entra um footer global. Some a linha 2 de links da navbar no mobile. Seções 2.1, 2.5-2.7, 3.2, 4.2, 5.2, 7.1, 9, 10, 11, 12, 13 e 14 ajustadas para remeter à 17.
- **rev. 2 (2026-10-29):** sai o cadastro público (`/register`, `RegisterForm`, CTAs "Criar conta") e sai o `DemoInvite`: a demo passa a ser só de visualização, sem elementos de escrita no DOM, e o aviso e a navbar oferecem só "Entrar" (B3, B4; PA3 extinto). Sessão de 24 h (P03). Entram as telas "Trocar senha" (`/account/password`, inclusive o modo obrigatório pós-login), "Meu perfil" (`/account`) e "Usuários" (`/admin/users`), e o menu da conta ganha "Meu perfil", "Trocar senha" e "Usuários" (só administrador). PA1, PA2, PA4 e PA5 aprovados (P19).
- **rev. 1 (2026-10-28):** versão inicial.

---

## 0. Decisões de design

| Id | Decisão | Motivo |
|---|---|---|
| DA1 | No lado direito da navbar a ordem é `[tema] [Entrar \| avatar]`. O avatar fica na ponta direita, como no Chrome. | A posição da conta no canto é a convenção mais reconhecível. O tema continua fora do menu (P12). |
| DA2 | O avatar é um botão circular de 44x44 preenchido com `--primary-strong`, borda 1px `--primary-border` e inicial em `--on-primary`. A cor é fixa por tema, não derivada do nome (P05). | Usa um par de contraste já validado. A borda e a letra garantem que o botão não dependa só de cor (RNF09). |
| DA3 | O menu da conta é um popover **opaco** (`--surface`) na *top layer* (`popover="manual"`) ou em portal, nunca descendente posicionado da navbar (PA5 aprovado). | A navbar é vidro com `backdrop-filter`, e o design system proíbe popover dentro de vidro ("Empilhamento"). |
| DA4 | O cabeçalho do menu (inicial ampliada, nome e e-mail) fica **fora** do `role="menu"`, que contém só os itens. O menu aponta para o cabeçalho com `aria-describedby`. | Filhos de `menu` só podem ser `menuitem`, `group` ou `separator`. |
| DA5 | `/login` usa um shell mínimo (marca e tema, **sem menu lateral e sem botão de menu**), com um card de vidro centralizado de até 420px e o footer global sem links (17.8). | Formulário curto; a ausência da navegação principal deixa claro que a pessoa está fora das telas de dados. |
| DA6 | Dentro de cards de vidro com formulário (login, trocar senha, meu perfil), o formulário fica em contexto opaco (`data-surface="opaque"`). Título e links ficam sobre o vidro. | Evita vidro dentro de vidro (rev. 7) e reaproveita pares de contraste já calculados. |
| DA7 | **(rev. 2)** Na demo, todo elemento de escrita e os checkboxes de seleção **não são renderizados** (`<WriteOnly>`, ADR 9.6). Colunas e áreas que só existiam para eles somem, sem espaço vazio. | B4/RF31: nada desabilitado, nenhum convite, nenhum controle "morto". |
| DA8 | O `DemoBanner` fica no topo da coluna de conteúdo, entre a navbar e o `<main>` (17.9), rola com a página, é persistente e não é sticky. | No mobile a faixa de abas de `/entries` já gruda abaixo da navbar; um aviso sticky roubaria altura em 360px. |
| DA9 | Erro de credenciais em banner no topo do formulário, senha limpa e foco nela. O 429 usa banner de aviso com o horário de liberação e o botão principal fica indisponível até lá. Vale para login e para trocar senha. | Tentativa rápida sem reenvio cego durante o bloqueio. |
| DA10 | A sessão expirada é comunicada **no login** por `?reason=expired` (PA1 aprovado) e, na mutação, também inline no diálogo antes do redirecionamento. | O redirecionamento troca de layout e um toast se perderia. |
| DA11 | **(rev. 2, ajustada na rev. 3)** Com troca obrigatória pendente, o shell protegido entra em **modo restrito**: sem menu lateral e sem botão de menu, marca sem link, menu da conta só com cabeçalho e "Sair" e footer sem links. | RF07/RF38/RF42: a única saída da tela é "Sair". Links que só redirecionariam de volta seriam ruído. |
| DA12 | **(rev. 2)** "Meu perfil" e "Trocar senha" usam o shell protegido normal (com o menu lateral, 17) com uma coluna de conteúdo de até 560px, e não o shell de autenticação. | São telas de quem já está dentro; a navegação e o menu da conta continuam disponíveis (exceto no modo restrito). |
| DA13 | **(rev. 2)** Em `/admin/users`, criar e editar usam o `Drawer` existente (lateral a partir de `md`, tela cheia abaixo). Redefinir senha usa um modal de formulário; inativar usa o `AlertDialog`; reativar é direto, sem confirmação. | Mesmo padrão de "Novo lançamento" e "Editar cartão". A spec exige confirmação só para inativar e redefinir (RF44); reativar é reversível e sem efeito colateral. |
| DA14 | **(rev. 2; PA8 aprovado)** A lista de usuários é dividida em dois grupos com título visível, "Ativos" e "Inativos (n)", e cada linha mostra a situação com ícone e texto. A linha inativa tem o nome em `--text-muted`. | RF11/RNF09: inativo distinto **sem depender só de cor** (posição, título de grupo, texto e ícone). |
| DA15 | **(rev. 2)** Ações bloqueadas para si mesmo ("Inativar" e "Redefinir senha" na própria linha) **não são renderizadas**. A linha do próprio administrador leva o marcador "(você)". "Editar" continua disponível. | RF44/CA23. O marcador explica a ausência das ações. |
| DA16 | **(rev. 2)** `LAST_ADMIN` não é antecipado na interface: o campo Nível e o botão "Inativar" aparecem normalmente para o último administrador ativo, e a mensagem aparece quando a ação é tentada. | RF44 pede a mensagem "quando tentada"; antecipar exigiria contar administradores no cliente, o que fica desatualizado sob concorrência (RF17). |

As decisões do layout global (DL1-DL8) estão na seção 17.0.

---

## 1. Fundamentos usados (sem token novo)

Tudo usa os tokens e papéis de `tokens.css` e `glass.css`. Nenhuma cor literal.

| Elemento | Material | Tokens |
|---|---|---|
| Navbar | Vidro de barra (`.glass-bar`) | `--bar-bg`, borda `--card-border` |
| Avatar (botão) | Preenchido | `--primary-strong` (hover `-hover`, pressionado e expandido `-active`), borda `--primary-border`, texto `--on-primary`, foco `--focus-ring` |
| Menu da conta | Opaco | `--surface`, borda 1px `--border-strong`, raio 12px, sombra de menu (`0 8px 24px -8px var(--shadow-color), 0 2px 6px var(--shadow-color)`), item hover `--surface-2`, item com foco `--surface-active` |
| Card de login, trocar senha e meu perfil | Vidro (`.card`) | `--card-bg`, `--card-border`, `--card-shadow` |
| Conteúdo dos formulários | Opaco (`data-surface="opaque"`) | `.field` com `--input-bg`; `InlineAlert` com `--surface` |
| Lista de usuários | Vidro plano (`.glass-flat`, contêiner da tabela e itens mobile) | `--card-bg`, `--card-border`; `thead` sticky com `--bar-bg` |
| Drawer de usuário, modal de redefinir senha, `AlertDialog` | Opaco (top layer) | `--surface`, `--scrim`, borda `--border-strong` |
| `DemoBanner` | Vidro (como `InlineAlert` `tone="info"`) | borda `--border-strong` e borda esquerda 3px `--accent`, ícone `--accent`, texto `--text` |
| Banner 429 | `InlineAlert` `tone="warning"` (novo tom) | borda `--warning` e borda esquerda 3px, ícone relógio `--warning-text`, texto `--text` |
| Menu lateral, drawer de navegação, footer | 17.10 | sem token novo |

Indicadores da lista de usuários (sempre ícone 16px + texto, nunca só cor):

| Indicador | Ícone | Texto | Cor do texto e ícone |
|---|---|---|---|
| Nível ADMIN | escudo | "Administrador" | `--text` |
| Nível USER | pessoa | "Usuário comum" | `--text-muted` |
| Situação ativa | check | "Ativo" | `--success-text` |
| Situação inativa | círculo cortado | "Inativo" | `--text-muted` |
| Troca pendente | chave com relógio | "Troca de senha pendente" | `--warning-text` |
| Sem pendência | traço | "Em dia" (texto visível) | `--text-muted` |

Tipografia: títulos em Space Grotesk 600 (h1 24px abaixo de `md`, 32px a partir de `md`; h2 20px). Corpo em Inter 14 e 16. Inicial do avatar em Space Grotesk 600, 18px no botão e 22px no cabeçalho do menu.

Motion: o menu abre com fade e escala de 0,98 para 1, em 150ms ease-out, origem no canto superior direito; fecha sem animação. Drawer e modais seguem o comportamento atual do `ModalDialog`. Com `prefers-reduced-motion`, nada anima.

---

## 2. Navbar e shells

### 2.1 Layout por breakpoint

> **Nota de atualização (ADR 0013):** a variante "visitante (demo)" e o chip "Demonstração" (navbar e cabeçalho do drawer) deixaram de existir. A navbar tem uma única forma: botão de menu, marca, tema e avatar.

**(rev. 3)** A navbar passa a ter **uma linha só em todos os breakpoints**: à esquerda, o botão de menu (abaixo de `xl`), a marca e o chip "Demonstração"; à direita, `[tema] [Entrar | avatar]`. Os links da navegação principal saem da navbar e vão para o menu lateral ou para o drawer de navegação (seção 17, Proposta). A linha 2 de links no mobile deixa de existir.

```
>= xl (1280), visitante (demo)
+--------------------------------------------------------------------------------+
| Finanças [Demonstração]                                         [sol] [Entrar] |
+--------------------------------------------------------------------------------+

>= xl, logado (protegido, conta, usuários ou demo)
+--------------------------------------------------------------------------------+
| Finanças                                                         [sol]  (A)    |
+--------------------------------------------------------------------------------+

sm a xl (640-1279), logado: o botão de menu aparece à esquerda da marca
+--------------------------------------------------------------------------------+
| [≡] Finanças                                                     [sol]  (A)    |
+--------------------------------------------------------------------------------+

Modo restrito (troca obrigatória, DA11), qualquer breakpoint: sem botão de menu
+--------------------------------------------------------------------------------+
| Finanças                                                         [sol]  (A)    |
+--------------------------------------------------------------------------------+

< sm (360px), visitante                < sm, logado                         < sm, modo restrito
+----------------------------------+  +----------------------------------+  +----------------------------------+
| [≡] Finanças      [sol] [Entrar] |  | [≡] Finanças          [sol]  (A) |  | Finanças              [sol]  (A) |
+----------------------------------+  +----------------------------------+  +----------------------------------+
| (olho) Você está vendo dados de  |   56px, fixa, sem linha 2
|        exemplo.                  |
| [            Entrar            ] |   DemoBanner (2.5), rola
+----------------------------------+
```

- O grupo da direita é `flex` com `gap: 8px`. "Entrar" e o avatar ocupam o mesmo lugar e nunca coexistem; com sessão, "Entrar" não existe no DOM (CA44). Não há "Criar conta" em lugar nenhum (RF06, CA07, CA43).
- Chip "Demonstração" (`.chip`, texto `--accent`, PA4 aprovado) ao lado da marca só em `/demo/*` e só a partir de `sm`. Abaixo de `sm` ele aparece no cabeçalho do drawer de navegação (17.6).
- Marca: em `/demo/*` aponta para `/demo/entries`; nas telas protegidas, `/account*` e `/admin/users`, para `/entries`; no shell de autenticação, para `/`. **No modo restrito a marca é texto, sem link** (DA11).
- A navegação principal (`MainNav` com `basePath`, RF33, CA39) e a regra do item ativo estão em 17.4 e 17.7. Em `/account`, `/account/password` e `/admin/users` nenhum item fica ativo.
- Em 360px a linha cabe com folga: padding 16px, botão de menu (44px), gap 8px, marca (~80px), tema (44px), gap 8px, "Entrar" (~84px) ou avatar (44px), padding 16px, cerca de 300px no pior caso.

### 2.2 Botão "Entrar" (`SignInButton`, RF37, CA43)

> **Nota de atualização (ADR 0013):** seção **obsoleta**. `SignInButton` e `signInHref` foram removidos junto com a demonstração pública; o avatar nunca é substituído por "Entrar".

- `<a>` com aparência de `Button` secundário, altura mínima 44px, padding horizontal 16px, "Entrar" em Inter 500 16.
- Secundário porque o "Entrar" primário da dobra é o do `DemoBanner`; assim não há dois primários iguais lado a lado.
- Destino: em `/demo/<x>` (e subcaminhos), `/login?next=/<x>`, só com o caminho (ids e filtros da demo não existem nos dados do usuário); em outra rota pública, `/login`.

### 2.3 Avatar (`UserAvatar` dentro do `AccountMenu`, RF38, RF40, CA44, CA45)

- `<button type="button">` circular de 44x44, sem halo transparente (o alvo é de fato 44px).
- Conteúdo: `userInitial(name)` (ADR 9.7) com `aria-hidden="true"`. Emoji e dígito aparecem como vierem; um grafema largo é centralizado sem corte (`overflow: visible`, `line-height: 1`).
- Nome acessível `aria-label="Conta de <nome completo>"`; `title="<nome> (<e-mail>)"` no hover.
- ARIA: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` (só quando aberto).

| Estado | Visual |
|---|---|
| Padrão | fundo `--primary-strong`, borda `--primary-border`, inicial `--on-primary` |
| Hover | `--primary-strong-hover` |
| Pressionado ou expandido | `--primary-strong-active`; no expandido, anel de 2px `--primary-border` com offset 2px ("aberto" sem depender só da cor) |
| Foco (`:focus-visible`) | `--focus-ring` com `--focus-offset`, circular |
| Saindo | inalterado; o feedback fica no item "Sair" |

A inicial e o nome no menu vêm do `getCurrentUser()` do layout; depois de salvar o nome em "Meu perfil" ou de um administrador editá-lo, a próxima navegação já mostra o valor novo (RF40, CA11).

### 2.4 Menu da conta (`AccountMenu`, RF38, RF39, CA44)

**Anatomia** (largura 288px; abaixo de `sm`, `min(288px, 100vw - 16px)`):

```
Completo (USER: sem "Usuários")          Modo restrito (troca obrigatória)
                              (A)                                     (A)
          +--------------------------+           +--------------------------+
          |  (A)  Ana Souza          |           |  (C)  Carla Dias         |
          |  48px ana@exemplo.com    |           |  48px carla@exemplo.com  |
          +--------------------------+           +--------------------------+
          |  [pessoa]  Meu perfil    |           |  [->]  Sair              |
          |  [chave]   Trocar senha  |           +--------------------------+
          |  [grupo]   Usuários      |  <- só ADMIN
          +--------------------------+  divisória (role="separator")
          |  [->]      Sair          |
          +--------------------------+
```

- Posição: 8px abaixo do botão, borda direita alinhada à do botão; se faltar espaço, a 8px da borda da viewport. Nunca sai da tela em 360px. Recalculada ao abrir e no `resize`.
- Cabeçalho (fora do `role="menu"`, DA4, `id="account-menu-header"`): círculo de 48px com a inicial em 22px (`aria-hidden`), nome em Inter 600 16 `--text`, e-mail em Inter 400 14 `--text-muted`, cada um numa linha com reticências; texto completo no DOM e em `title`. Padding 16px.
- Itens: linhas de 44px, padding horizontal 16px, ícone 20px `--text-muted`, texto Inter 500 16 `--text`; hover `--surface-2`; foco `--surface-active` + `--focus-ring` interno (`outline-offset: -2px`).
  - "Meu perfil" (`/account`), "Trocar senha" (`/account/password`) e "Usuários" (`/admin/users`, só `role === 'ADMIN'`) são `<a role="menuitem">` dentro de `<li role="none">`. O item da página atual leva `aria-current="page"` e um marcador visual (barra de 3px `--accent` à esquerda), além da cor.
  - "Usuários" é o **único** ponto de entrada da gestão (P15); ele não entra no menu lateral (DL4).
  - Divisória 1px `--border` antes de "Sair", com `role="separator"` dentro do menu.
  - "Sair": `<button role="menuitem" type="submit">` num `<form action={logoutAction}>` (nunca por GET, RNF08). Carregando: spinner no lugar do ícone, "Saindo…", `aria-busy="true"`, novos acionamentos ignorados, menu aberto até a navegação terminar.
- Modo restrito: o menu tem só o cabeçalho e "Sair" (RF38, CA08).
- Semântica: `ul role="menu" aria-labelledby="<id do botão>" aria-describedby="account-menu-header"`. Anúncio ao abrir: "Conta de Ana Souza, menu. Ana Souza, ana@exemplo.com. Meu perfil, item de menu, 1 de 3."
- Nível e situação são lidos a cada requisição (RF10): se a pessoa for promovida ou rebaixada, "Usuários" aparece ou some na próxima navegação, sem sair (CA19).

**Teclado e foco** (padrão APG *Menu Button*):

| Onde | Tecla | Efeito |
|---|---|---|
| Botão (fechado) | `Enter`, `Espaço`, `↓` | Abre e foca o primeiro item |
| Botão (fechado) | `↑` | Abre e foca o último item ("Sair") |
| Botão (aberto) | clique, `Enter`, `Espaço` | Fecha; foco fica no botão |
| Menu | `↓` / `↑` | Próximo / anterior, com volta circular |
| Menu | `Home` / `End` | Primeiro / último |
| Menu | `Enter` (e `Espaço` nos botões) | Ativa o item |
| Menu | `Esc` | Fecha e **devolve o foco ao botão** |
| Menu | `Tab` / `Shift+Tab` | Fecha e deixa o foco seguir a ordem natural |
| Menu | letra (type-ahead) | Foca o próximo item que começa com a letra ("M", "T", "U", "S") |

**Fechamento:** clique ou toque fora (`pointerdown` fora do botão e do menu, como no `MonthPicker`) sem mover o foco; ao escolher um item; ao navegar (mudança de `usePathname`); `Esc`. Rolar a página não fecha. Abrir o drawer de navegação com o menu aberto fecha o menu (o toque no botão de menu é um `pointerdown` fora).

**Erro ao sair:** o `logoutAction` ignora falha da API e sempre apaga o cookie. Se a Server Action não responder (rede), o item volta ao normal, o menu continua aberto e sai um toast de erro: "Não foi possível sair. Verifique sua conexão e tente novamente."

### 2.5 Aviso de demonstração (`DemoBanner`, RF32, RF36, CA38, CA42)

> **Nota de atualização (ADR 0013):** seção **obsoleta**. `DemoBanner` e `DemoBannerAction` foram removidos. O único aviso sobre a conta demo é a dica da tela de login (design `remover-demo-publica-login.md`, 2.4).

Em todas as telas `/demo/*`, no topo da coluna de conteúdo (à direita do menu lateral a partir de `xl`, 17.9), antes do `<main>`, margem superior 16px (24px a partir de `md`). Está no layout, então aparece também em loading e erro.

```
>= md, visitante
+--------------------------------------------------------------------------------+
| (olho) Você está vendo dados de exemplo.                              [Entrar] |
|        Os dados são fictícios e não podem ser alterados.                       |
+--------------------------------------------------------------------------------+

< md, visitante
+----------------------------------+
| (olho) Você está vendo dados de  |
|        exemplo.                  |
|        Os dados são fictícios e  |
|        não podem ser alterados.  |
| [            Entrar            ] |  largura total, 44px
+----------------------------------+

Logado (qualquer breakpoint; < md o botão vai para baixo com largura total)
| (olho) Você está vendo dados de exemplo.                    [Ir para meus dados] |
|        Seus lançamentos não aparecem aqui.                                       |
```

- Visual do `InlineAlert` `tone="info"`, ícone de olho 20px `--accent`. Linha 1 em Inter 600 14/16 `--text` com o texto exato da spec; linha 2 em Inter 400 14 `--text-muted`.
- Ação única por variante (RF32): visitante, "Entrar" (primário, `/login?next=<equivalente>`, mesmo cálculo do 2.2); logado, "Ir para meus dados" (primário, `/entries`). Links com aparência de botão, altura mínima 44px.
- `<section aria-labelledby="demo-banner-title">` (landmark *region*), sem `role="alert"`/`status` (conteúdo estático). Sem botão de fechar. Ordem de foco: depois da navbar e do menu lateral, antes do conteúdo; "Pular para o conteúdo" pula o banner.

### 2.6 Shell de autenticação (`(auth)/layout.tsx`)

```
+----------------------------------+
| Finanças                   [sol] |  mesma barra de vidro, sem botão de menu, sem menu lateral e sem conta
+----------------------------------+
|  (card de login)                 |
|  ...                             |
|  ------------------------------  |
|  Finanças · © 2026               |  footer global, sem links (17.8)
|  Versão 0.1.0                    |
+----------------------------------+
```

Mesma altura e material da navbar, com "Pular para o conteúdo". Só `/login` usa este shell (`/register` não existe e cai no `not-found` global, CA07, que também usa este shell).

### 2.7 Shell protegido em modo restrito (troca obrigatória, DA11)

- `(protected)/layout.tsx` já redireciona tudo para `/account/password` (ADR 9.4). O `AppHeader` recebe o usuário e, com `mustChangePassword`, renderiza sem botão de menu, com a marca como texto e o menu reduzido (2.4). O layout **não** renderiza o menu lateral, e o footer sai sem links (17.4, 17.8). A coluna de conteúdo ocupa a largura do container de 1280px, como no shell de autenticação.
- Ao concluir a troca, a navbar, o menu lateral e o footer precisam voltar ao modo completo **sem recarregar a página**: o frontend deve garantir que o layout seja re-renderizado (por exemplo, revalidando o layout na action) antes de exibir o destino.

---

## 3. Tela `/login` (RF01, RF05, RF41, CA01-CA04, CA07)

### 3.1 Hierarquia de informação

> **Nota de atualização (ADR 0013):** o item 6 deixa de oferecer "Ver demonstração"; passa a ser só a orientação "Não tem acesso ou esqueceu a senha? Fale com um administrador.". Entre o botão "Entrar" e o rodapé do card entra a dica da conta demo, apenas com `DEMO_ACCOUNT_HINT=on`. O rótulo do primeiro campo é "E-mail ou usuário" com a dica e "E-mail" sem ela (`type="text"`, `autoComplete="username"`).

1. Título (h1) "Entrar".
2. Contexto, quando houver: sessão expirada (`reason=expired`) ou destino ("Entre para continuar em Cartões.").
3. Banner do formulário (credenciais, 429, rede), só quando houver.
4. Campos.
5. Ação primária.
6. Orientação e caminho alternativo: "Não tem acesso ou esqueceu a senha? Fale com um administrador." e "Ver demonstração".

### 3.2 Layout por breakpoint

> **Nota de atualização (ADR 0013):** o rodapé do card tem só a orientação (sem o link "Ver demonstração" nos esboços abaixo), e a dica da conta demo aparece logo abaixo do botão "Entrar" (ver `remover-demo-publica-login.md`, 2.2).

```
< sm (360px)                         >= sm (até 1280+)
+----------------------------------+ +------------------------------------------------+
| Finanças                   [sol] | | Finanças                                 [sol] |
+----------------------------------+ +------------------------------------------------+
|  +----------------------------+  | |         +--------------------------+           |
|  | Entrar                     |  | |         | Entrar                   |           |
|  | Acesse seus lançamentos,   |  | |         | Acesse seus lançamentos, |           |
|  | cartões e faturas.         |  | |         | cartões e faturas.       |           |
|  | [banner, se houver]        |  | |         | [banner]                 |           |
|  | E-mail                     |  | |         | E-mail                   |           |
|  | [______________________]   |  | |         | [______________________] |           |
|  | Senha                      |  | |         | Senha                    |           |
|  | [__________________][olho] |  | |         | [________________][olho] |           |
|  | [         Entrar        ]  |  | |         | [        Entrar        ] |           |
|  | ------------------------   |  | |         | ------------------------ |           |
|  | Não tem acesso ou esqueceu |  | |         | Não tem acesso ou        |           |
|  | a senha? Fale com um       |  | |         | esqueceu a senha? Fale   |           |
|  | administrador.             |  | |         | com um administrador.    |           |
|  | Ver demonstração           |  | |         | Ver demonstração         |           |
|  +----------------------------+  | |         +--------------------------+           |
|  ------------------------------  | | ---------------------------------------------- |
|  Finanças · © 2026               | | Finanças · © 2026 · Versão 0.1.0               |
|  Versão 0.1.0                    | |                                                |
+----------------------------------+ +------------------------------------------------+
```

| Breakpoint | Container | Card |
|---|---|---|
| < `sm` | `px-4`, margem superior 24px | largura total, padding 20px, raio 12px |
| `sm` a `lg` | centralizado, margem superior 64px | `max-width: 420px`, padding 32px |
| >= `lg` | centralizado verticalmente no espaço entre a navbar e o footer (`min-height: calc(100dvh - var(--navbar-h))` na coluna, com o footer empurrado para o fim, 17.8), margem mínima 64px | igual |

- 24px entre blocos, 16px entre campos. Botão primário com largura total e 48px.
- Rodapé do card: divisória `--border`; a orientação é texto simples em `--text-muted` 14 (não é link: não há canal no sistema, P20); "Ver demonstração" é link terciário `--accent` com alvo de 44px. Por isso o footer global do login não repete o link (17.8).
- Com teclado virtual no mobile o card rola normalmente; nada fixo no rodapé.

### 3.3 Elementos

| Elemento | Especificação |
|---|---|
| h1 | "Entrar" |
| Subtítulo | "Acesse seus lançamentos, cartões e faturas." (`--text-muted`) |
| Contexto | Com `next` válido: "Entre para continuar em <Lançamentos \| Dashboard \| Cartões \| Meu perfil \| Trocar senha \| Usuários>." no lugar do subtítulo. Com `reason=expired`: banner info (3.5) |
| E-mail | `TextField`, `type="email"`, `autocomplete="email"`, `inputmode="email"`, `autocapitalize="none"`, `spellcheck="false"`, obrigatório. Sem foco automático, exceto após erro (3.4) |
| Senha | `PasswordField` (10.2), `autocomplete="current-password"`, obrigatório |
| `next` | `<input type="hidden" name="next">` com o valor bruto; o servidor valida (`safeNext`) |
| Ação | `Button variant="primary" type="submit"` "Entrar"; carregando "Entrando…" |
| `<form noValidate>` | Validação própria |

Validação no cliente (só presença, D13): "Informe o e-mail." e "Informe a senha.". Sem validação de formato no login.

Destino após sucesso: `next` seguro ou `/entries`; com troca obrigatória, `/account/password?next=<next seguro>` (RF01, CA08).

### 3.4 Momento da validação e foco (padrão para todos os formulários desta feature)

- **Antes do primeiro envio:** nenhum erro enquanto se digita ou sai do campo.
- **No envio:** valida tudo e mostra todos os erros de uma vez; foco no primeiro campo inválido. Mensagem com `role="alert"`, ligada por `aria-describedby`, campo com `aria-invalid="true"` (padrão do `FieldShell`).
- **Depois de um envio com erro:** cada campo revalida a cada mudança e o erro some quando o valor fica válido; erro novo só aparece em outro envio.
- **Erros do servidor** (400, 409): mesma apresentação e regra de foco; valores preservados (exceto os casos de senha abaixo).
- **Credenciais inválidas** (401): banner; e-mail mantido, senha limpa, foco em Senha (DA9).

### 3.5 Banners do formulário (login e trocar senha)

No topo do formulário, no máximo um por vez; novo envio substitui o anterior.

| Situação | Componente | Texto | Papel |
|---|---|---|---|
| 401 `INVALID_CREDENTIALS` | `InlineAlert` `danger` | "E-mail ou senha inválidos." (exato, CA03) | `role="alert"` |
| 429 `TOO_MANY_ATTEMPTS` | `InlineAlert` `warning`, ícone relógio | "Muitas tentativas. Tente novamente em 3 minutos, às 14:32." | `role="alert"` |
| 429, depois do prazo | mesmo banner, troca o texto | "Você já pode tentar novamente." | texto num `role="status"` |
| Sessão expirada (`reason=expired`) | `InlineAlert` `info` | "Sua sessão expirou. Entre novamente." | `role="status"` |
| Rede ou 5xx | `InlineAlert` `danger` | Login: "Não foi possível entrar agora. Verifique sua conexão e tente novamente." | `role="alert"` |

**Regras do 429 (CA04, CA10):** texto calculado uma vez a partir de `retryAfterSeconds` ("em N segundos" abaixo de 60s; "em N minutos" arredondado para cima a partir de 60s; sempre ", às HH:MM" em America/Sao_Paulo), sem contagem ao vivo. Botão primário com `aria-disabled="true"` e `aria-describedby` para o banner até o prazo; um timer libera o botão e troca o texto. Campos editáveis; a senha **não** é limpa (não foi avaliada).

### 3.6 Loading e envio duplo

> **Nota de atualização (ADR 0013):** o último item ("Ver demonstração" continua ativo) deixou de se aplicar; o link não existe mais. A dica da conta demo permanece visível durante o envio.

- `useActionState`; enquanto `pending`, o botão mostra spinner e texto de carregando, `aria-busy="true"`, sem mudar cores.
- `Button` ignora cliques em `loading` e o `onSubmit` ignora `Enter` enquanto `pending` (RF41).
- Campos `readOnly` durante o envio (cursor `progress`).
- No sucesso, o carregando continua até a navegação terminar.
- "Ver demonstração" continua ativo.

### 3.7 `next` e títulos

> **Nota de atualização (ADR 0013):** os títulos "... (demonstração) · Finanças" deixaram de existir com as telas `/demo/*`. `/demo/<x>` agora cai no não encontrado global; o `next` só carrega rotas protegidas.

- A UI nunca mostra o `next` bruto; o texto de contexto só aparece se o `next` passar no `safeNext` do servidor e for mapeado para o rótulo da tela.
- `document.title`: "Entrar · Finanças", "Trocar senha · Finanças", "Meu perfil · Finanças", "Usuários · Finanças", "Lançamentos (demonstração) · Finanças", "Dashboard (demonstração) · Finanças", "Cartões (demonstração) · Finanças".

---

## 4. Tela `/account/password` - Trocar senha (RF07, RF08, RF42, CA08-CA10)

### 4.1 Hierarquia de informação

1. h1 "Trocar senha".
2. No modo obrigatório: explicação "Defina uma nova senha para continuar." (texto exato) e, abaixo, "Você entrou com uma senha temporária. Depois de salvar, você segue para <tela>." (só quando o destino é conhecido; senão, sem a segunda frase).
3. Banner (429 ou rede), quando houver.
4. Campos: Senha atual, Nova senha (com a regra visível), Confirmar nova senha.
5. Ação primária "Salvar nova senha" e, só no modo opcional, "Cancelar".

### 4.2 Layout por breakpoint

```
< sm (360px), modo obrigatório           >= md, modo opcional (abaixo de xl; a partir de xl o menu lateral fica à esquerda)
+----------------------------------+     +--------------------------------------------------+
| Finanças              [sol]  (C) |     | [≡] Finanças                            [sol] (A)|
+----------------------------------+     +--------------------------------------------------+
|  Trocar senha                    |     |  Trocar senha                                     |
|  +----------------------------+  |     |  +------------------------------------------+     |
|  | (i) Defina uma nova senha  |  |     |  | Senha atual                              |     |
|  |     para continuar.        |  |     |  | [______________________________][olho]   |     |
|  |     Você entrou com uma    |  |     |  | Nova senha                               |     |
|  |     senha temporária...    |  |     |  | [______________________________][olho]   |     |
|  | Senha atual                |  |     |  | (o) De 8 a 72 caracteres.                |     |
|  | [__________________][olho] |  |     |  | Confirmar nova senha                     |     |
|  | Nova senha                 |  |     |  | [______________________________][olho]   |     |
|  | [__________________][olho] |  |     |  |                [Cancelar] [Salvar nova   |     |
|  | (o) De 8 a 72 caracteres.  |  |     |  |                            senha]        |     |
|  | Confirmar nova senha       |  |     |  +------------------------------------------+     |
|  | [__________________][olho] |  |     |  coluna de até 560px, alinhada à esquerda        |
|  | [   Salvar nova senha   ]  |  |     |  ------------------------------------------------ |
|  +----------------------------+  |     |  Finanças · © 2026 · Versão 0.1.0  Ver demonstr. |
|  ------------------------------  |     +--------------------------------------------------+
|  Finanças · © 2026               |
|  Versão 0.1.0                    |  footer sem links no modo restrito
+----------------------------------+
```

| Breakpoint | Coluna | Card | Ações |
|---|---|---|---|
| < `sm` | largura total, `px-4`, margem superior 24px | padding 20px | empilhadas, largura total, primária em cima, 48px |
| `sm` a `md` | largura total até 560px | padding 24px | em linha, à direita |
| >= `md` | `max-width: 560px`, alinhada à esquerda na coluna de conteúdo, margem superior 32px | padding 32px | em linha, à direita |

- O h1 fica fora do card, como nas outras telas protegidas. No modo obrigatório, a explicação é um `InlineAlert` `tone="info"` com `role="status"` dentro do card, acima dos campos.
- Formulário em contexto opaco (DA6).

### 4.3 Campos e mensagens

| Campo | Especificação | Erros |
|---|---|---|
| Senha atual | `PasswordField`, `autocomplete="current-password"`, obrigatório | `REQUIRED` "Informe a senha atual."; `INCORRECT` "Senha atual incorreta." (campo limpo, foco nele) |
| Nova senha | `PasswordField` com indicador de tamanho, `autocomplete="new-password"`, ajuda sempre visível "De 8 a 72 caracteres." | `REQUIRED` "Informe a nova senha."; `TOO_SHORT` "A senha precisa ter pelo menos 8 caracteres."; `TOO_LONG` "A senha pode ter no máximo 72 caracteres."; `SAME_AS_CURRENT` "A nova senha deve ser diferente da atual." |
| Confirmar nova senha | `PasswordField`, `autocomplete="new-password"`, obrigatório | `REQUIRED` "Confirme a nova senha."; diferente: "As senhas não conferem." (só no web, sem chamar a API, CA10) |

- Ordem de verificação no cliente: presença e tamanho da nova senha e igualdade da confirmação; só então a action chama a API.
- Erros do servidor seguem 3.4. No `INCORRECT`, Nova senha e Confirmação são preservadas.
- 429 (6ª senha atual errada em 15 min, CA10): banner de aviso (3.5); o botão fica indisponível até o prazo.

### 4.4 Modos

| | Obrigatório (`mustChangePassword`) | Opcional |
|---|---|---|
| Shell | modo restrito (2.7) | protegido normal (com menu lateral, 17) |
| Explicação | "Defina uma nova senha para continuar." | sem explicação; subtítulo opcional "Depois de salvar, as outras sessões abertas são encerradas." em `--text-muted` |
| Ações | só "Salvar nova senha" (sem "Cancelar", RF42) | "Salvar nova senha" e "Cancelar" (link terciário para `/account`) |
| Sucesso | toast de sucesso "Senha alterada." e navegação para o `next` preservado ou `/entries`; navbar, menu lateral e footer voltam ao modo completo (CA09) | campos limpos, toast "Senha alterada." e foco no h1; a pessoa continua na tela |
| `next` | `<input type="hidden" name="next">` preservado desde o login | ignorado |

- O toast precisa ser visível no destino: o `ToastProvider` do layout protegido persiste na navegação no cliente, então o toast deve ser emitido de forma que sobreviva à troca de página.
- No sucesso as outras sessões são encerradas (P16); não há mensagem extra além do subtítulo do modo opcional.

### 4.5 Loading

Igual a 3.6: "Salvar nova senha" vira "Salvando…" com spinner; campos `readOnly`; "Cancelar" e o menu da conta continuam ativos.

---

## 5. Tela `/account` - Meu perfil (RF09, RF43, CA11)

### 5.1 Hierarquia de informação

1. h1 "Meu perfil".
2. Card "Dados da conta": Nome (editável), E-mail e Nível (só leitura) com a indicação "Para alterar, fale com um administrador."
3. Ação "Salvar".
4. Card "Senha": texto "Troque sua senha quando quiser." e o atalho "Trocar senha".

### 5.2 Layout por breakpoint

```
< sm (360px)                              >= md (abaixo de xl; a partir de xl o menu lateral fica à esquerda)
+----------------------------------+      +--------------------------------------------------+
| [≡] Finanças          [sol]  (A) |      | [≡] Finanças                            [sol] (A)|
+----------------------------------+      +--------------------------------------------------+
|  Meu perfil                      |      |  Meu perfil                                       |
|  +----------------------------+  |      |  +------------------------------------------+     |
|  | Dados da conta             |  |      |  | Dados da conta                           |     |
|  | Nome                       |  |      |  | Nome                                     |     |
|  | [Ana Souza______________]  |  |      |  | [Ana Souza_________________________]     |     |
|  | E-mail                     |  |      |  | E-mail          ana@exemplo.com          |     |
|  | ana@exemplo.com            |  |      |  | Nível           Usuário comum            |     |
|  | Nível                      |  |      |  | Para alterar, fale com um administrador. |     |
|  | Usuário comum              |  |      |  |                                 [Salvar] |     |
|  | Para alterar, fale com um  |  |      |  +------------------------------------------+     |
|  | administrador.             |  |      |  +------------------------------------------+     |
|  | [         Salvar        ]  |  |      |  | Senha                                    |     |
|  +----------------------------+  |      |  | Troque sua senha quando quiser.          |     |
|  +----------------------------+  |      |  |                           [Trocar senha] |     |
|  | Senha                      |  |      |  +------------------------------------------+     |
|  | Troque sua senha quando    |  |      |  coluna de até 560px                              |
|  | quiser.                    |  |      +--------------------------------------------------+
|  | [      Trocar senha     ]  |  |
|  +----------------------------+  |
+----------------------------------+
```

Mesma grade da 4.2 (coluna de 560px a partir de `md`, 16px entre os cards no mobile, 24px a partir de `md`). Cada card tem h2 (20px). A partir de `sm`, E-mail e Nível ficam em duas colunas (rótulo 140px, valor) num `<dl>`; abaixo de `sm`, empilhados. O footer global (17.8) fica abaixo dos cards.

### 5.3 Elementos

| Elemento | Especificação |
|---|---|
| Nome | `TextField`, `autocomplete="name"`, `autocapitalize="words"`, obrigatório, sem `maxLength` (o limite é em code points); contador "52/60" visível a partir de 50 caracteres (`--danger-text` acima de 60). Erros: `REQUIRED` "Informe seu nome."; `TOO_LONG` "Use até 60 caracteres." |
| E-mail e Nível | `<dl>` com `<dt>`/`<dd>` em texto, **não** inputs desabilitados (leitura limpa por leitor de tela, sem foco inútil). Nível como "Administrador" ou "Usuário comum", com o ícone do 1 |
| Indicação | "Para alterar, fale com um administrador." em `--text-muted` 14, logo após o `<dl>` |
| Salvar | `Button variant="primary" type="submit"`; carregando "Salvando…" |
| Trocar senha | link com aparência de `Button` secundário para `/account/password` |

### 5.4 Sucesso e erro

- Sucesso: o campo mostra o valor normalizado devolvido pela API ("ana lima" em CA11), toast de sucesso "Perfil atualizado." e a navbar passa a mostrar a nova inicial e o nome no menu (refresh do layout, ADR 9.5).
- Erros de campo inline (3.4). Rede ou 5xx: `InlineAlert` `danger` no topo do card "Não foi possível salvar agora. Verifique sua conexão e tente novamente.", valor digitado preservado.
- 401 e 403 `PASSWORD_CHANGE_REQUIRED`: fluxos da seção 8.

---

## 6. Tela `/admin/users` - Usuários (RF10-RF19, RF44, CA15-CA26)

Só para `ADMIN`. Para `USER`, a rota mostra a página de não encontrado e o item "Usuários" não existe no menu (CA15). A tela usa o shell protegido normal; nenhum item do menu lateral fica ativo nela (17.7).

### 6.1 Hierarquia de informação

1. h1 "Usuários" e resumo "4 usuários · 1 inativo" (`--text-muted`).
2. Ação primária "Novo usuário".
3. Nota fixa curta: "Administradores gerenciam contas, mas não veem dados financeiros de outras pessoas." (`--text-muted` 14; evita a expectativa de ver dados alheios, RF19).
4. Grupo "Ativos" e grupo "Inativos (n)" (DA14, PA8 aprovado), cada um com, por usuário: nome (e "(você)"), e-mail, nível, situação, troca de senha, criado em, ações.

A lista **não** mostra nenhum dado financeiro (RF11, CA25). Sem busca, filtros nem paginação (P14). Ordem: ativos antes de inativos e, em cada grupo, por nome (ordem da API).

### 6.2 Layout por breakpoint

```
>= md (tabela; a partir de xl, à direita do menu lateral)
+--------------------------------------------------------------------------------------------+
| Usuários                                                                   [Novo usuário]  |
| 4 usuários · 1 inativo                                                                     |
| Administradores gerenciam contas, mas não veem dados financeiros de outras pessoas.        |
| +----------------------------------------------------------------------------------------+ |
| | Usuário                 | Nível          | Situação | Senha            | Criado em | Ações| |
| |-------------------------+----------------+----------+------------------+-----------+------| |
| | Ativos (3)                                                                             | |
| | Vagner (você)           | [esc] Admin... | [v] Ativo| - Em dia         | 28/10/2026| Editar |
| | vagner@exemplo.com      |                |          |                  |           |      | |
| | Ana Souza               | [p] Usuário... | [v] Ativo| [k] Troca de     | 29/10/2026| Editar  Redefinir senha  Inativar |
| | ana@exemplo.com         |                |          | senha pendente   |           |      | |
| | Inativos (1)                                                                           | |
| | Bruno Lima (muted)      | [p] Usuário... | [o] Inativo | - Em dia      | 29/10/2026| Editar  Redefinir senha  Reativar |
| +----------------------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------------------+

< md (lista, 360px)
+----------------------------------+
| Usuários                         |
| 4 usuários · 1 inativo           |
| [        Novo usuário        ]   |  largura total, 48px
| Administradores gerenciam ...    |
|                                  |
| Ativos (3)                       |  h2
| +------------------------------+ |
| | Vagner (você)                | |
| | vagner@exemplo.com           | |
| | [esc] Administrador          | |
| | [v] Ativo · - Em dia         | |
| | Criado em 28/10/2026         | |
| | [Editar]                     | |
| +------------------------------+ |
| | Ana Souza                    | |
| | ana@exemplo.com              | |
| | [p] Usuário comum            | |
| | [v] Ativo                    | |
| | [k] Troca de senha pendente  | |
| | Criado em 29/10/2026         | |
| | [Editar] [Redefinir senha]   | |
| | [Inativar]                   | |
| +------------------------------+ |
|                                  |
| Inativos (1)                     |  h2
| +------------------------------+ |
| | Bruno Lima                   | |
| | ...                          | |
| | [Editar] [Redefinir senha]   | |
| | [Reativar]                   | |
| +------------------------------+ |
+----------------------------------+
```

| Breakpoint | Lista | Ações por usuário |
|---|---|---|
| < `md` | itens em `.glass-flat`, 12px entre itens, títulos de grupo h2 | botões secundários de 44px em linha que quebra (`flex-wrap`, gap 8px); no mobile ocupam pelo menos metade da largura cada |
| `md` a `lg` | tabela; colunas "Usuário" (nome sobre e-mail), "Nível", "Situação", "Senha", "Ações"; "Criado em" vai para baixo do e-mail, em 12px `--text-muted` | botões terciários de 44px de altura, em linha que quebra dentro da célula |
| >= `lg` | tabela com todas as colunas, incluindo "Criado em" | idem, normalmente numa linha só |

- Tabela dentro do contêiner `.glass-flat` com `thead` sticky (`--bar-bg`, z-index 10), como as tabelas de lançamentos. Cada grupo é um `<tbody>` com uma linha de título `<th scope="rowgroup" colspan>` ("Ativos (3)", "Inativos (1)"), Inter 600 14 `--text`, fundo `--card-bg-2`.
- Cabeçalho da página: h1 e resumo à esquerda, "Novo usuário" à direita a partir de `sm`; abaixo de `sm`, o botão vai para baixo do resumo com largura total.
- E-mails longos quebram (`overflow-wrap: anywhere`) em vez de truncar: aqui o e-mail é o dado principal de identificação.
- "Criado em" no formato `dd/mm/aaaa` em America/Sao_Paulo, a partir do `createdAt` UTC.

### 6.3 Linha do usuário

- **Nome:** Inter 500 16 `--text`; inativo em `--text-muted` (DA14). O próprio administrador leva " (você)" em `--text-muted` 14.
- **Indicadores:** os do 1 (ícone + texto). Troca pendente aparece tanto para ativos quanto para inativos (RF16: redefinir vale para inativo).
- **Ações (RF44):**

| Ação | Quando aparece | Efeito |
|---|---|---|
| "Editar" | sempre (inclusive na própria linha) | abre o drawer de edição (6.5) |
| "Redefinir senha" | todos, **exceto** a própria linha (DA15) | abre o modal (6.6) |
| "Inativar" | situação ativa, **exceto** a própria linha (DA15) | abre o `AlertDialog` (6.7) |
| "Reativar" | situação inativa | executa direto (6.8) |

- Nome acessível de cada ação inclui o usuário: texto visível "Editar" com sufixo visualmente oculto " Ana Souza" (o nome acessível começa pelo texto visível, WCAG 2.5.3).
- O último administrador ativo **não** tem tratamento especial (DA16).

### 6.4 Formulário de usuário (criar e editar, `UserFormDrawer`)

```
Drawer (>= md: lateral 480px; < md: tela cheia)
+------------------------------------------+
| Novo usuário                         [x] |  header
+------------------------------------------+
| [banner de erro geral, se houver]        |
| Nome                                     |
| [______________________________]         |
| E-mail                                   |
| [______________________________]         |
| Nível                                    |
| ( ) Usuário comum  (o) Administrador     |  SegmentedControl (radiogroup)
| Administradores gerenciam contas, mas    |
| não veem dados financeiros de outras     |
| pessoas.                                 |
| Senha temporária             (só criar)  |
| [Temp1234______________________][olho]   |  visível por padrão (PA6)
| (o) De 8 a 72 caracteres.                |
| A pessoa precisará trocá-la no primeiro  |
| acesso. Informe-a fora do sistema.       |
+------------------------------------------+
|                  [Cancelar] [Criar usuário] |  footer fixo
+------------------------------------------+
```

| Campo | Criar | Editar | Especificação | Erros |
|---|---|---|---|---|
| Nome | sim | sim | `TextField`, `autocomplete="off"`, contador a partir de 50 | `REQUIRED` "Informe o nome."; `TOO_LONG` "Use até 60 caracteres." |
| E-mail | sim | sim | `TextField`, `type="email"`, `autocomplete="off"`, `autocapitalize="none"`, `spellcheck="false"` | `REQUIRED` "Informe o e-mail."; `INVALID_FORMAT` "Informe um e-mail válido, como nome@exemplo.com."; `TOO_LONG` "Use até 254 caracteres."; `EMAIL_TAKEN` "Este e-mail já está em uso." (CA17) |
| Nível | sim, sem valor inicial | sim, valor atual | `SegmentedControl` com "Usuário comum" e "Administrador" (`role="radiogroup"`, rótulo "Nível"); ajuda fixa sobre o que o administrador faz | `REQUIRED` "Escolha o nível."; `INVALID_VALUE` "Escolha um nível válido."; `LAST_ADMIN` "É preciso manter pelo menos um administrador ativo." |
| Senha temporária | sim | não existe | `PasswordField` com indicador de tamanho, **visível por padrão** (PA6), `autocomplete="off"`, ajuda "A pessoa precisará trocá-la no primeiro acesso. Informe-a fora do sistema." | `REQUIRED` "Informe a senha temporária."; `TOO_SHORT` / `TOO_LONG` como em 4.3 |

- Títulos: "Novo usuário" e "Editar <nome>". Botão: "Criar usuário" ("Criando…") e "Salvar alterações" ("Salvando…").
- Validação e foco: 3.4, com o 400 acumulado da API (CA18) mostrado nos quatro campos de uma vez. `EMAIL_TAKEN` (409) vai para o campo E-mail com foco nele. `LAST_ADMIN` (422, editar) vai para o campo Nível com foco no grupo; nada é salvo (CA24).
- **Editando a si mesmo** com outro nível selecionado ("Usuário comum"), aparece abaixo do Nível o aviso `InlineAlert` `warning` (`role="status"`): "Você deixará de ter acesso à gestão de usuários." Não bloqueia (RF17 permite com outro administrador ativo).
- Rede ou 5xx: `InlineAlert` `danger` no topo do corpo do drawer: "Não foi possível salvar agora. Verifique sua conexão e tente novamente."; valores preservados.
- Fechar com alterações não salvas: segue o comportamento já existente do drawer de lançamentos (confirmação de descarte via `onEscape`), se aplicável; sem regra nova.
- Foco inicial: campo Nome. Ao fechar, o foco volta ao gatilho ("Novo usuário" ou "Editar" da linha).
- **Senha temporária (PA6 aprovado):** o campo começa **visível** (texto em claro), com o botão do `PasswordField` para ocultar (`aria-pressed="true"` no início), e usa `autocomplete="off"`. Assim o administrador lê a senha para comunicá-la fora do sistema (P13) e o navegador não oferece salvá-la como credencial dele. É a única vez que ela aparece; depois do envio, a interface nunca a mostra de novo (a API não a devolve).

**Sucesso:**
- Criar: o drawer fecha, a lista é atualizada, a nova linha recebe o destaque de "recém-criado" existente (`.row-highlight`) e sai o toast de sucesso "Usuário criado: Carla Dias. Informe a senha temporária a essa pessoa." O foco vai para a nova linha (nome), como no "Novo cartão".
- Editar: o drawer fecha, a linha atualiza e sai o toast "Alterações salvas." Foco volta ao "Editar" da linha.
- **Editar a si mesmo para "Usuário comum" (PA7 aprovado)**, com outro administrador ativo: o drawer fecha e a pessoa é levada para `/entries` com o toast "Alterações salvas. Você não tem mais acesso à gestão de usuários.", em vez de ver a página de não encontrado no próximo carregamento de `/admin/users`. A action de edição informa que o alvo era o próprio ator; o layout é revalidado e "Usuários" some do menu da conta.

### 6.5 Edição (detalhes)

- O drawer de edição abre com os valores da lista (sem `GET` extra). Se a API responder 404 `USER_NOT_FOUND` (CA26), o drawer fecha, sai o toast de erro "Usuário não encontrado. A lista foi atualizada." e a lista é recarregada.
- Mudar e-mail ou nome não encerra sessões (P17); não há aviso extra.

### 6.6 Redefinir senha (`ResetPasswordDialog`, RF16, CA22)

Modal de formulário (`ModalDialog variant="modal"`, `role="dialog"`), largura até 480px; abaixo de `sm`, largura total menos 16px de cada lado.

```
+----------------------------------------------+
| Redefinir senha de Ana Souza                 |  h2
|                                              |
| - A senha atual de Ana Souza deixa de valer. |
| - Todas as sessões abertas dela serão        |
|   encerradas agora.                          |
| - No próximo acesso, ela precisará definir   |
|   uma nova senha.                            |
| (inativo: "A nova senha passa a valer quando |
|  a conta for reativada.")                    |
|                                              |
| Nova senha temporária                        |
| [Nova1234______________________][olho]       |  visível por padrão (PA6)
| (o) De 8 a 72 caracteres.                    |
| Informe-a a essa pessoa fora do sistema.     |
|                                              |
| [erro, se houver]                            |
|                     [Cancelar] [Redefinir senha] |
+----------------------------------------------+
< sm: botões empilhados com largura total, primário em cima.
```

- Lista de consequências com `<ul>`, em `--text`. A pessoa é referida pelo nome, sem pronome de gênero no texto real ("A senha atual de Ana Souza deixa de valer.", "Todas as sessões abertas serão encerradas agora.", "No próximo acesso, será preciso definir uma nova senha.").
- O campo de senha segue a PA6 (visível por padrão, `autocomplete="off"`).
- Foco inicial no campo de senha (é um formulário). `Esc` e "Cancelar" fecham e devolvem o foco ao "Redefinir senha" da linha; clique no scrim **não** fecha (há dado digitado). Durante o envio, `Esc` é ignorado (comportamento `busy` do `ModalDialog`).
- Envio: "Redefinindo…". Erros de campo inline. `CANNOT_TARGET_SELF` (só em corrida ou lista desatualizada) e outros 422 aparecem como texto de erro (`role="alert"`) acima dos botões, como no `AlertDialog`: "Você não pode executar esta ação na sua própria conta."
- Sucesso: modal fecha, linha mostra "Troca de senha pendente", toast "Senha de Ana Souza redefinida. Informe a nova senha temporária a essa pessoa." Foco volta ao gatilho.

### 6.7 Inativar (`AlertDialog`, RF14, CA20)

```
+----------------------------------------------+
| Inativar Bruno Lima?                         |
|                                              |
| Bruno Lima não conseguirá mais entrar, e     |
| todas as sessões abertas serão encerradas    |
| agora. Os dados financeiros são mantidos.    |
| Você pode reativar a conta depois.           |
|                                              |
| [erro, se houver]                            |
|                         [Cancelar] [Inativar] |
+----------------------------------------------+
```

- Reaproveita o `AlertDialog` (foco inicial em "Cancelar", `Esc` cancela, erro inline). **Alteração necessária:** a linha fixa "Esta ação não pode ser desfeita." precisa ser opcional (prop), porque inativar é reversível (10.1).
- Envio: "Inativando…".
- `LAST_ADMIN` (CA24): o diálogo continua aberto com o erro "É preciso manter pelo menos um administrador ativo."; o botão sai do carregando. `CANNOT_TARGET_SELF`: idem com a mensagem do 6.6.
- Sucesso: diálogo fecha, a linha migra para o grupo "Inativos", o resumo atualiza e sai o toast "Bruno Lima foi inativado." Como a linha mudou de posição, o foco vai para o "Reativar" dessa linha (o gatilho original não existe mais).
- Idempotente (P18): se já estava inativo, o resultado é o mesmo, sem erro.

### 6.8 Reativar (RF15, CA21)

- Sem confirmação (DA13). O botão "Reativar" da linha entra em carregando ("Reativando…", `aria-busy`); os outros botões da linha ficam inertes durante o envio.
- Sucesso: a linha volta para "Ativos", toast "Bruno Lima foi reativado." e foco no "Inativar" da linha. A troca pendente, se havia, continua visível.
- Erro: toast de erro com a `message` da API (ou o texto de rede padrão); a linha não muda.

### 6.9 Erros transversais da gestão

| Situação | O que a pessoa vê |
|---|---|
| 403 `FORBIDDEN` numa ação (foi rebaixado enquanto a tela estava aberta) | Toast de erro "Você não tem permissão para esta ação." e refresh; a página vira não encontrado e "Usuários" some do menu (ADR 9.5) |
| 404 `USER_NOT_FOUND` | Toast "Usuário não encontrado. A lista foi atualizada." e recarga da lista |
| 401 | Fluxo de sessão expirada (8) |
| 403 `PASSWORD_CHANGE_REQUIRED` | Redireciona para `/account/password` (8) |
| Rede ou 5xx | Inline no drawer ou diálogo aberto; toast quando não há diálogo (reativar) |

Depois de qualquer ação bem-sucedida, a lista é recarregada do servidor (a ordem e o resumo vêm da API).

---

## 7. Modo demonstração `/demo/*` (RF28-RF33, RF36, B4)

> **Nota de atualização (ADR 0013):** seção **obsoleta** (histórico). As rotas `/demo/*`, o estado somente leitura (`WriteOnly`) e o `AppMode` foram removidos do web. A conta demo agora é uma conta comum (`SHOWCASE`) com escrita (`MANAGE_EXPENSES`); o controle de escrita é por `me.capabilities`.

### 7.1 Hierarquia

1. Navbar (chip "Demonstração" a partir de `sm`).
2. Menu lateral (a partir de `xl`) ou drawer de navegação, com os itens apontando para `/demo/*` (17.4).
3. `DemoBanner`.
4. A tela igual à protegida (cabeçalho, resumo, abas, listas, gráficos), com os mesmos layouts por breakpoint e query params, **sem** elementos de escrita.
5. Footer sem links (17.8).

### 7.2 O que muda em cada tela (DA7, RF31, CA38)

| Tela | Elemento | Na demo |
|---|---|---|
| `/demo/entries` | "Novo lançamento" (cabeçalho, versão compacta na faixa de abas) | **Não renderizado.** O cabeçalho fica só com título e seletor de mês; na faixa de abas compacta, o espaço não é reservado |
| | Checkbox de cada despesa e "selecionar todas" | Não renderizados; a coluna some e o grid se reorganiza (a tabela começa pela descrição; no mobile, o item não tem área de seleção) |
| | Barra de lote e "Pagar selecionadas" | Não renderizadas |
| | "Pagar" da linha | Não renderizado. Se a coluna de ações só continha "Pagar", a coluna inteira some; o status continua visível pelo `StatusBadge` |
| | "Pagar fatura" | Não renderizado; o bloco da fatura mostra total e status normalmente |
| | Expandir fatura | Funciona (`loadDemoInvoiceEntries`) |
| | Mês, abas, filtros, paginação | Funcionam (CA38) |
| | Estados vazios | Texto do vazio atual **sem** o CTA "Novo lançamento" |
| `/demo/cards` | "+ Novo cartão" e "Editar" | Não renderizados; os cards mostram nome, fechamento e vencimento |
| | Vazio | Texto atual sem CTA |
| `/demo/dashboard` | Tudo é leitura | Sem mudança |

- Nenhum gatilho fica desabilitado, nenhum diálogo, drawer ou convite abre na demo, e nenhuma Server Action de escrita é chamada (RF31). Destaque de "recém-criado" e toasts de sucesso nunca ocorrem. (O drawer de navegação, 17.6, não é de escrita e funciona na demo.)
- O cabeçalho das telas não pode "pular" quando o botão some: alinhamentos que dependiam do botão à direita passam a usar `justify-content: space-between` com o seletor de mês, ou o título ocupa a linha inteira.

---

## 8. Sessão expirada, troca obrigatória e redirecionamentos

> **Nota de atualização (ADR 0013):** nas linhas da tabela, "Sair" leva a `/login` (antes `/demo/entries`), e `/` sem sessão vai para `/login` (antes `/demo/entries`); `/` com sessão continua indo para `/entries`.

| Situação | O que a pessoa vê | Detalhe |
|---|---|---|
| Visitante abre rota protegida ou de administrador (CA40) | `/login?next=<rota>` com "Entre para continuar em <tela>." | Redirecionamento do servidor (`proxy`), sem flash de conteúdo |
| Leitura com sessão expirada ou encerrada (CA06, CA20, CA22) | `/login?next=...&reason=expired` com o banner "Sua sessão expirou. Entre novamente." | Vale também quando a sessão foi encerrada por inativação ou redefinição: a mensagem é a mesma (não revela o motivo) |
| Mutação com sessão expirada e diálogo aberto (drawer "Novo lançamento", "Editar cartão", confirmação de pagamento, drawer e diálogos de usuários, trocar senha, meu perfil) | 1) `InlineAlert` `danger` "Sua sessão expirou. Entre novamente." substitui o erro comum e o botão sai do carregando. 2) 1,5s depois (ou ao ativar o link "Entrar novamente" no alerta), `router.replace(loginUrl)`. 3) O login repete a mensagem | Nada é salvo. O rascunho é perdido (PA2 aprovado; sessão de 24 h). Com movimento reduzido também se espera 1,5s |
| Mutação expirada sem diálogo ("Pagar" na linha, "Reativar") | Toast de erro com a mesma mensagem e redirecionamento imediato | O toast é anunciado antes de sair |
| Login com troca obrigatória (CA08) | `/account/password?next=<next seguro>` em modo restrito | |
| Troca obrigatória e tentativa de abrir outra rota (CA08) | Volta para `/account/password` | Pelo layout e pelo 403 `PASSWORD_CHANGE_REQUIRED` dos readers (ADR 9.4) |
| Mutação com 403 `PASSWORD_CHANGE_REQUIRED` (senha redefinida enquanto a pessoa estava logada não ocorre, pois a redefinição encerra sessões; o caso é defensivo) | Redirecionamento para `/account/password` | |
| `USER` abre `/admin/users` (CA15) ou `next=/admin/users` | Página de não encontrado | |
| Logado abre `/login` (CA07) | `/entries` (ou `/account/password` com troca pendente) | Sem tela intermediária |
| `/register` (CA07) | Página de não encontrado, para visitante e logado | |
| Sair (CA05) | `/demo/entries` com "Entrar" na navbar e o `DemoBanner` | Sem toast; o anúncio de rota lê o novo título |
| Voltar pelo histórico depois de sair | Login com `next` | Páginas protegidas dinâmicas e sem cache |
| `/` (CA41) | Visitante para `/demo/entries`; logado para `/entries` | |

Mensagem única de sessão expirada: "Sua sessão expirou. Entre novamente." (RF04).

---

## 9. Estados por tela

> **Nota de atualização (ADR 0013):** a linha `/demo/*` deixou de existir.

| Tela ou bloco | Carregando | Erro | Vazio | Sucesso |
|---|---|---|---|---|
| Navbar (conta) | Usuário vem do servidor com o layout: sem skeleton de avatar nem flash de "Entrar" | Falha do `/auth/me` no layout protegido segue o fluxo de sessão inválida (login) | - | - |
| Menu lateral, drawer de navegação e footer | 17.11 | 17.11 | 17.11 | - |
| `/login` | Formulário estático, sem `loading.tsx`; envio em 3.6 | Banners (3.5) e erros de campo (3.4) | - | Navegação para o destino |
| `/account/password` | `loading.tsx` com skeleton do card (3 campos e botão); envio em 4.5 | Campo (4.3), banner 429 e rede; `error.tsx` padrão ("Tentar novamente") se o layout falhar | - | Toast "Senha alterada." e destino (4.4) |
| `/account` | `loading.tsx` com skeleton dos dois cards | Inline no card (5.4); `error.tsx` padrão | - | Toast "Perfil atualizado." e navbar atualizada |
| `/admin/users` | `loading.tsx`: título, botão "Novo usuário" desabilitado visualmente como skeleton e 4 linhas de skeleton (tabela a partir de `md`, itens abaixo) | `error.tsx` no bloco da lista: "Não foi possível carregar os usuários." com "Tentar novamente" (padrão `BlockErrorBoundary`); erros de ação em 6.4-6.9 | Só o próprio administrador: a lista mostra a linha dele e, abaixo, `EmptyState` "Você é o único usuário." com a descrição "Use “Novo usuário” para dar acesso a outras pessoas." e o botão "Novo usuário". Sem inativos, o grupo "Inativos" não é renderizado | Toasts (6.4-6.8), destaque da nova linha, foco conforme cada ação |
| Drawer e diálogos de usuários | Botão primário em carregando, campos `readOnly` | Inline (campo ou texto acima dos botões) | - | Fecham e atualizam a lista |
| Menu da conta | "Saindo…" no item | Toast de rede (2.4) | - | - |
| `/demo/*` | Skeletons atuais; o `DemoBanner` aparece desde o primeiro quadro | `error.tsx` atual de cada tela; o banner continua | Não deve ocorrer (seed com 12+1 meses). Se ocorrer, vazios atuais **sem** CTAs de escrita | - |
| `/entries` de usuário novo (P11) | Atual | Atual | Vazios atuais ("Nenhum lançamento em …" com "Novo lançamento") | Atual |

Os skeletons usam `Skeleton` (`--skeleton`) e anunciam "Carregando…" uma vez por região (`aria-busy` no contêiner), como nas telas existentes.

---

## 10. Componentes

### 10.1 Existentes reaproveitados

| Componente | Arquivo | Uso nesta feature | Mudança |
|---|---|---|---|
| `Button`, `IconButton` | `components/ui/button.tsx` | Formulários, banner, ações da lista, olho da senha, botão de menu e fechar do drawer de navegação | Nenhuma. Links com aparência de botão usam `.btn`/`.btn-primary` num `<a>` |
| `TextField`, `FieldShell` | `components/ui/fields.tsx` | Nome, e-mail, senhas | Nenhuma (aceita `aside` e `counter`) |
| `SegmentedControl` | `components/ui/segmented-control.tsx` | Campo Nível | Nenhuma esperada; precisa aceitar estado de erro (`aria-invalid` + mensagem via `FieldShell`). Se não aceitar, ajuste mínimo |
| `InlineAlert` | `components/ui/states.tsx` | Banners, explicação do modo obrigatório, aviso de auto-rebaixamento, sessão expirada em diálogos, base do `DemoBanner` | **Alterado:** novo `tone="warning"` (borda `--warning`, ícone `--warning-text`) |
| `EmptyState`, `Skeleton` | `components/ui/states.tsx` | Vazio e carregando da lista de usuários e das telas de conta | Nenhuma |
| `BlockErrorBoundary` | `components/ui/block-error-boundary.tsx` | Erro do bloco da lista de usuários | Nenhuma |
| `ModalDialog` | `components/ui/modal-dialog.tsx` | `ResetPasswordDialog`, `NavDrawer` | **Alterado (17.12):** nova variante de drawer à esquerda para a navegação; o comportamento (foco preso, `Esc`, scrim, devolução do foco) é o atual |
| `AlertDialog` | `components/ui/dialogs.tsx` | Inativar usuário | **Alterado:** a linha fixa "Esta ação não pode ser desfeita." vira opcional (prop, padrão ligado para não mudar os usos atuais) |
| `Drawer` | `components/ui/drawer.tsx` | Criar e editar usuário | Nenhuma |
| `ToastProvider` | `components/ui/toast.tsx` | Sucessos e erros sem diálogo | Nenhuma. Precisa existir nos layouts protegido, de demo e de autenticação |
| `ThemeToggle` | `components/theme/theme-toggle.tsx` | Navbar e shell de autenticação | Nenhuma |
| `MainNav` | `components/main-nav.tsx` | Menu lateral e drawer de navegação (17) | **Alterado:** prop `basePath` (RF33); lista vertical com ícone e texto; aviso ao navegar (para o drawer fechar); deixa de ser usado na navbar (17.12) |
| `AppHeader` | `components/app-header.tsx` | Navbar | **Alterado:** props `user` e `mode`; sai a `MainNav` e sai a linha 2 do mobile; botão de menu abaixo de `xl` (17.6); slot da direita (`SignInButton` ou `AccountMenu`); marca por `basePath`; chip "Demonstração"; modo restrito (2.7) |
| `NavProvider`, `NavLink` | `components/navigation.tsx` | Telas da demo | Nenhuma |
| `Icon` | `components/ui/status.tsx` | Indicadores da lista, itens do menu lateral, botão de menu | **Alterado:** novos ícones (escudo, pessoa, círculo cortado, chave com relógio, traço; e os do 17.12) |
| Telas de lançamentos, cartões e dashboard | movidas para `web/features/*` (ADR 9.1) | Protegido e demo | **Alterado:** elementos de escrita e checkboxes envolvidos por `<WriteOnly>`; hrefs com `basePath`; colunas condicionais |
| `.chip`, `.card`, `.glass-flat`, `.glass-bar`, `.row-highlight`, `.spinner` | `globals.css` | Chip da demo, cards, lista de usuários, menu lateral, destaque, spinners | Nenhuma |

### 10.2 Novos

| Componente | Local sugerido | Tipo | Responsabilidade |
|---|---|---|---|
| `SignInButton` | `components/sign-in-button.tsx` | client | Link "Entrar" com `next` equivalente (2.2) |
| `AccountMenu` | `components/account-menu.tsx` | client | Avatar, popover na top layer, itens por nível e modo restrito, teclado, foco, fechamento (2.4) |
| `UserAvatar` | `components/user-avatar.tsx` | server/client | Círculo com a inicial, `size="md"` (44) ou `"lg"` (48), sempre `aria-hidden` |
| `DemoBanner` | `components/demo-banner.tsx` | server | Aviso persistente, variantes visitante e logado (2.5) |
| `WriteOnly` | `components/read-only.tsx` | client | Não renderiza os filhos em `readOnly` (ADR 9.6) |
| `AppModeProvider`, `useAppMode` | `components/app-mode.tsx` | client | Contexto `AppMode`, sem visual |
| `AuthCard` | `app/(auth)/_components/auth-card.tsx` | server | Card de vidro com h1, subtítulo, área opaca e rodapé (3.2, DA6) |
| `LoginForm` | `app/(auth)/login/login-form.tsx` | client | Estado, validação, banners e carregando do login |
| `PasswordField` | `components/ui/password-field.tsx` | client | Campo com "Mostrar senha", visibilidade inicial configurável (PA6), indicador de tamanho opcional e aviso de Caps Lock (detalhes abaixo) |
| `useRetryAfter` | `lib/auth/use-retry-after.ts` | hook | `retryAfterSeconds` em texto e horário; libera o botão no prazo (3.5) |
| `ChangePasswordForm` | `features/account/change-password-form.tsx` | client | Modos obrigatório e opcional, confirmação no web, 429 (4) |
| `ProfileForm` | `features/account/profile-form.tsx` | client | Nome editável, e-mail e nível só leitura, atalho de senha (5) |
| `UsersList` | `features/admin-users/users-list.tsx` | server + client | Grupos, tabela (>= `md`) e itens (< `md`), ações por linha (6.2, 6.3) |
| `UserRoleLabel`, `UserStatusLabel`, `PasswordPendingLabel` | `features/admin-users/user-labels.tsx` | server | Indicadores com ícone e texto (1) |
| `UserFormDrawer` | `features/admin-users/user-form-drawer.tsx` | client | Criar e editar (6.4, 6.5) |
| `ResetPasswordDialog` | `features/admin-users/reset-password-dialog.tsx` | client | Modal de formulário com consequências (6.6) |
| `DeactivateUserDialog` | `features/admin-users/deactivate-user-dialog.tsx` | client | Composição do `AlertDialog` (6.7) |
| `AppSidebar`, `NavDrawer` (com o botão de menu), `AppFooter` | `components/` | 17.12 | Layout global (17) |

`PasswordField`:

```
Senha
+--------------------------------------+------+
| ••••••••                             | olho |   botão 44x44 dentro da borda do campo
+--------------------------------------+------+
(o) De 8 a 72 caracteres.                          (quando há indicador)
```

- `TextField` com `type="password"` (ou `text` visível), padding direito de 48px.
- Botão: `IconButton` sem borda, `aria-pressed`, `aria-label` fixo "Mostrar senha", `aria-controls` para o input; ícone olho ou olho cortado; foco fica no botão e o cursor do campo é preservado.
- Visibilidade inicial: oculta por padrão; visível nos campos de senha temporária do administrador (PA6).
- Indicador de tamanho (nova senha, senha temporária) na ajuda (`aria-describedby`), texto fixo "De 8 a 72 caracteres.": círculo vazio `--text-muted` fora da faixa; check `--success-text` dentro. Sem anúncio ao vivo.
- Sem medidor de força nem regra de composição (P02); espaços permitidos, sem trim.
- Caps Lock: com o campo focado, ajuda adicional "Caps Lock está ativado." em `--warning-text`, com ícone.

Saem da rev. 1: `RegisterForm`, `DemoInvite` e `WriteAction` com convite.

---

## 11. Fluxos de interação

### 11.1 Visitante conhece a demo e entra

> **Nota de atualização (ADR 0013):** fluxo **substituído**. O visitante abre `/`, é levado a `/login`, lê a dica da conta demo e entra com `demo`/`demo` (ver `remover-demo-publica-login.md`, 2.6). Não há `/demo/entries` nem banner.
1. Abre `/` e vai para `/demo/entries`: banner com "Entrar" e "Entrar" na navbar.
2. Navega por mês, abas e filtros e expande uma fatura. Não há "Novo lançamento", "Pagar" nem checkboxes.
3. Ativa "Entrar" do banner em `/demo/cards`: vai para `/login?next=/cards` com "Entre para continuar em Cartões."
4. Erra a senha: banner "E-mail ou senha inválidos.", senha limpa, foco em Senha.
5. Acerta e cai em `/cards` (CA01).

### 11.2 Primeiro acesso com senha temporária (CA08, CA09)
1. Carla entra por `/login?next=/cards` com "Temp1234".
2. Vai para `/account/password` em modo restrito: sem menu lateral e sem botão de menu, menu da conta só com "Sair", footer sem links, explicação "Defina uma nova senha para continuar."
3. Tenta abrir `/entries` pela barra de endereço: volta para `/account/password`.
4. Preenche senha atual, nova e confirmação diferente: "As senhas não conferem." no campo Confirmar, sem chamar a API.
5. Corrige e salva: "Salvando…", toast "Senha alterada.", navega para `/cards` com navbar, menu lateral e footer completos.

### 11.3 Bloqueio por tentativas
1. Na 6ª falha, banner de aviso "Muitas tentativas. Tente novamente em 15 minutos, às 14:47." e botão indisponível.
2. No horário, o botão é liberado e o banner diz "Você já pode tentar novamente.". O mesmo vale em "Trocar senha" para a senha atual.

### 11.4 Menu da conta por teclado
1. `Tab` até o avatar: "Conta de Ana Souza, botão de menu, recolhido".
2. `Enter`: o menu abre com foco em "Meu perfil"; o cabeçalho é lido como descrição.
3. `↓` até "Trocar senha", `Esc`: menu fecha, foco volta ao avatar (CA44).
4. `↑`: o menu abre em "Sair". `Enter`: "Saindo…" e navegação para `/demo/entries` com "Entrar" na navbar (CA05).

### 11.5 Meu perfil (CA11)
1. Ana abre "Meu perfil" pelo menu.
2. Altera o nome para "  ana   lima " e salva: o campo mostra "ana lima", toast "Perfil atualizado.", o avatar mostra "A" e o menu "ana lima".

### 11.6 Administrador cria um usuário (CA16, CA17)
1. Vagner abre "Usuários" pelo menu da conta e ativa "Novo usuário": drawer com foco em Nome.
2. Envia com e-mail "ana@exemplo.com" já usado: "Este e-mail já está em uso." no campo E-mail, foco nele.
3. Corrige para "carla@exemplo.com", escolhe "Usuário comum", digita "Temp1234" (o campo já está visível, PA6) e cria.
4. O drawer fecha, Carla aparece em "Ativos" com "Troca de senha pendente" e destaque, toast "Usuário criado: Carla Dias. Informe a senha temporária a essa pessoa."

### 11.7 Inativar, reativar e último administrador (CA20, CA21, CA24)
1. Vagner ativa "Inativar" na linha de Bruno: diálogo com as consequências, foco em "Cancelar".
2. Confirma: Bruno vai para "Inativos (1)" com "Inativo" (ícone e texto), toast "Bruno Lima foi inativado.", foco em "Reativar" da linha.
3. Ativa "Reativar": a linha volta para "Ativos", toast, foco em "Inativar".
4. Vagner, único administrador ativo, edita a si mesmo para "Usuário comum": vê o aviso "Você deixará de ter acesso à gestão de usuários.", salva e recebe "É preciso manter pelo menos um administrador ativo." no campo Nível; nada muda.
5. Com Ana já promovida a administradora, Vagner repete o passo 4: o drawer fecha e ele vai para `/entries` com o toast "Alterações salvas. Você não tem mais acesso à gestão de usuários." (PA7).

### 11.8 Redefinir senha (CA22)
1. Vagner ativa "Redefinir senha" na linha de Ana: modal com as consequências e foco no campo.
2. Digita "Nova1234" e confirma: "Redefinindo…", modal fecha, linha com "Troca de senha pendente", toast.
3. Na próxima requisição de Ana, em qualquer navegador, ela vai para o login com "Sua sessão expirou. Entre novamente."

### 11.9 Sessão expira com o drawer aberto
1. A pessoa preenche "Novo lançamento" e salva depois das 24 h.
2. No drawer aparece "Sua sessão expirou. Entre novamente." com "Entrar novamente".
3. Em 1,5s vai para `/login?next=/entries?...&reason=expired`.
4. Entra e volta para a mesma tela e mês; o lançamento precisa ser preenchido de novo (PA2).

### 11.10 Logado visitando a demo (CA42)

> **Nota de atualização (ADR 0013):** fluxo **obsoleto**. Quem está logado e abre `/demo/*` vê o não encontrado global.
1. Ana abre `/demo/dashboard`: avatar na navbar, chip "Demonstração" e banner com "Ir para meus dados".
2. Em `/demo/entries` não há elementos de escrita; "Ir para meus dados" leva a `/entries`.

### 11.11 Navegação principal
Fluxos do menu lateral e do drawer de navegação: 17.13.

---

## 12. Responsividade (resumo, 360 e 1280)

| Elemento | < `sm` (360) | `sm` a `md` | >= `md` | >= `lg` (1280) |
|---|---|---|---|---|
| Navbar | uma linha: `[≡]` + marca; `[sol] [Entrar \| (A)]` à direita | igual + chip | igual, 64px | sem `[≡]` a partir de `xl` (1280) |
| Navegação principal | drawer (17.6) | drawer | drawer | drawer até 1279px; menu lateral fixo a partir de `xl` (17.5) |
| Navbar, modo restrito | sem `[≡]` | sem `[≡]` | sem `[≡]` | sem menu lateral |
| Chip "Demonstração" | oculto na navbar; no cabeçalho do drawer | visível | visível | visível |
| Menu da conta | `min(288px, 100vw - 16px)`, a 8px da borda | 288px ancorado | 288px | 288px |
| `DemoBanner` | texto empilhado, botão de largura total | idem | uma linha, ação à direita | idem, na coluna de conteúdo |
| Card de login | largura total, padding 20px | 420px, padding 32px | idem | centralizado na vertical |
| Trocar senha e Meu perfil | coluna total, ações empilhadas | até 560px, ações à direita | 560px à esquerda, padding 32px | idem |
| Lista de usuários | itens empilhados por grupo, ações em botões que quebram | idem | tabela sem a coluna "Criado em" (vai sob o e-mail) | tabela completa |
| "Novo usuário" | abaixo do resumo, largura total | à direita do título | idem | idem |
| Drawer de usuário | tela cheia | tela cheia | lateral 480px | idem |
| Modal de redefinir e `AlertDialog` | largura total menos 32px, botões empilhados (primário em cima) | até 480px, botões em linha à direita | idem | idem |
| Footer | duas linhas | uma linha | idem | idem, na coluna de conteúdo |

Zoom de 200% e texto ampliado: nenhum truncamento além de nome e e-mail no menu (texto completo disponível). Em 320px (zoom de 400% em 1280) nada gera rolagem horizontal: a tabela de usuários cede lugar aos itens empilhados (o breakpoint é por largura da viewport), banners e cards refluem, e o menu lateral vira drawer.

---

## 13. Acessibilidade (checklist, RNF09, CA44-CA46)

- [ ] Alvos de 44px ou mais: "Entrar", avatar, itens do menu, olho da senha, links do rodapé do card, ações do banner, ações por linha da lista, segmentos do Nível, botões dos diálogos, botão de menu, itens do menu lateral e do drawer, link do footer.
- [ ] Foco visível (`--focus-ring`) em todos os novos controles, nos dois temas; anel circular no avatar, interno nos itens do menu e do menu lateral.
- [ ] Avatar sem depender de cor: letra, borda `--primary-border` e nome "Conta de <nome>".
- [ ] Menu button: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `role="menu"`/`menuitem`/`separator`, setas, `Home`/`End`, type-ahead, `Esc` devolvendo o foco, `Tab` fechando; `aria-current="page"` no item da página atual.
- [ ] Formulários: `<label>` ligado, `aria-required`, `aria-invalid`, `aria-describedby` (erro e ajuda), erros com ícone e texto, foco no primeiro inválido, `autocomplete` correto (`email`, `current-password`, `new-password`, `name`; `off` nos campos do administrador).
- [ ] Nível como `radiogroup` rotulado; erro do grupo ligado por `aria-describedby`.
- [ ] Banners: `role="alert"` para erro e 429; `role="status"` para sessão expirada, liberação do 429, explicação do modo obrigatório e aviso de auto-rebaixamento.
- [ ] Lista de usuários: `<table>` com `<caption>` visualmente oculta "Usuários", `<th scope="col">`, um `<tbody>` por grupo com `<th scope="rowgroup">`; no mobile, `h2` por grupo e itens em `<ul>`. Situação "Inativo" com ícone e texto, nome em `--text-muted` e posição no grupo próprio (nunca só cor).
- [ ] Nomes acessíveis das ações por linha incluem o nome do usuário, começando pelo texto visível.
- [ ] Diálogos: `role="dialog"` (redefinir) e `role="alertdialog"` (inativar), rotulados e descritos, foco preso (nativo), retorno ao gatilho ou ao novo ponto de foco definido em 6.7 e 6.8.
- [ ] `DemoBanner` como landmark *region*, sem live region. Nenhum elemento de escrita no DOM da demo.
- [ ] `document.title` distinto por tela (3.7).
- [ ] Contraste: só pares já validados. `tone="warning"` usa `--warning-text` (texto) e `--warning` (borda, 3:1), já no `tokens.spec.ts`; incluir os pares sobre `--surface` e sobre o vidro de card. `--success-text`, `--warning-text` e `--text-muted` sobre `--card-bg` e `--card-bg-2` (linha de grupo) entram no teste.
- [ ] axe sem violações em 360px e 1280px, claro e escuro, nos estados do CA46, com o drawer de navegação aberto e fechado.
- [ ] `prefers-reduced-motion`: menu e drawer de navegação sem animação. `forced-colors`: avatar mantém borda e letra; menu, linhas de grupo e indicadores mantêm borda, ícone e texto.
- [ ] Layout global: checklist próprio em 17.14.

---

## 14. Microcopy

| Onde | Texto |
|---|---|
| Navbar | "Entrar" · chip "Demonstração" · avatar: "Conta de {nome}" · botão de menu: "Abrir menu de navegação" |
| Menu | {nome} · {e-mail} · "Meu perfil" · "Trocar senha" · "Usuários" · "Sair" · "Saindo…" · erro: "Não foi possível sair. Verifique sua conexão e tente novamente." |
| Menu lateral e drawer | "Principal" (rótulo da navegação) · "Lançamentos" · "Dashboard" · "Cartões" · ("Categorias", Feature B) · "Menu de navegação" (título oculto do drawer) · "Fechar menu de navegação" |
| Footer | "Finanças" · "© {ano}" · "Versão {versão}" · "Ver demonstração" |
| Banner da demo | "Você está vendo dados de exemplo." · "Os dados são fictícios e não podem ser alterados." · "Entrar" · logado: "Seus lançamentos não aparecem aqui." · "Ir para meus dados" |
| Login | "Entrar" · "Acesse seus lançamentos, cartões e faturas." · "Entre para continuar em {tela}." · "E-mail" · "Senha" · "Mostrar senha" · "Entrando…" · "Não tem acesso ou esqueceu a senha? Fale com um administrador." · "Ver demonstração" |
| Trocar senha | "Trocar senha" · "Defina uma nova senha para continuar." · "Você entrou com uma senha temporária. Depois de salvar, você segue para {tela}." · "Depois de salvar, as outras sessões abertas são encerradas." · "Senha atual" · "Nova senha" · "Confirmar nova senha" · "De 8 a 72 caracteres." · "Salvar nova senha" · "Salvando…" · "Cancelar" · "Senha alterada." |
| Meu perfil | "Meu perfil" · "Dados da conta" · "Nome" · "E-mail" · "Nível" · "Administrador" · "Usuário comum" · "Para alterar, fale com um administrador." · "Salvar" · "Salvando…" · "Perfil atualizado." · "Senha" · "Troque sua senha quando quiser." · "Trocar senha" |
| Usuários | "Usuários" · "{n} usuários · {m} inativo(s)" · "Novo usuário" · "Administradores gerenciam contas, mas não veem dados financeiros de outras pessoas." · "Ativos ({n})" · "Inativos ({n})" · "(você)" · "Ativo" · "Inativo" · "Troca de senha pendente" · "Em dia" · "Criado em" · "Editar" · "Redefinir senha" · "Inativar" · "Reativar" · "Você é o único usuário." · "Use “Novo usuário” para dar acesso a outras pessoas." · "Não foi possível carregar os usuários." · "Tentar novamente" |
| Formulário de usuário | "Novo usuário" · "Editar {nome}" · "Senha temporária" · "A pessoa precisará trocá-la no primeiro acesso. Informe-a fora do sistema." · "Criar usuário" · "Criando…" · "Salvar alterações" · "Você deixará de ter acesso à gestão de usuários." · "Usuário criado: {nome}. Informe a senha temporária a essa pessoa." · "Alterações salvas." · "Alterações salvas. Você não tem mais acesso à gestão de usuários." |
| Redefinir senha | "Redefinir senha de {nome}" · "A senha atual de {nome} deixa de valer." · "Todas as sessões abertas serão encerradas agora." · "No próximo acesso, será preciso definir uma nova senha." · "A nova senha passa a valer quando a conta for reativada." · "Nova senha temporária" · "Informe-a a essa pessoa fora do sistema." · "Redefinindo…" · "Senha de {nome} redefinida. Informe a nova senha temporária a essa pessoa." |
| Inativar e reativar | "Inativar {nome}?" · "{nome} não conseguirá mais entrar, e todas as sessões abertas serão encerradas agora. Os dados financeiros são mantidos. Você pode reativar a conta depois." · "Inativando…" · "{nome} foi inativado." · "Reativando…" · "{nome} foi reativado." |
| Erros | 3.3, 3.5, 4.3, 5.3, 6.4 · "É preciso manter pelo menos um administrador ativo." · "Você não pode executar esta ação na sua própria conta." · "Você não tem permissão para esta ação." · "Usuário não encontrado. A lista foi atualizada." · "Caps Lock está ativado." |
| Sessão | "Sua sessão expirou. Entre novamente." · "Entrar novamente" |

Os textos de erro vindos da API com código conhecido são mapeados por código, não por texto; código desconhecido usa a `message` da resposta (pt-BR).

---

## 15. Rastreabilidade (CA para seção)

| CA | Seção |
|---|---|
| CA01, CA02 | 3.3, 3.7, 11.1 |
| CA03 | 3.4, 3.5, 11.1 |
| CA04 | 3.5, 11.3 |
| CA05 | 2.4, 8, 11.4 |
| CA06 | 8, 11.9 |
| CA07 | 2.6, 3, 8 |
| CA08 | 2.4, 2.7, 4.4, 8, 11.2, 17.4 |
| CA09, CA10 | 4.3, 4.4, 11.2, 11.3 |
| CA11 | 2.3, 5, 11.5 |
| CA15 | 2.4, 6, 8 |
| CA16-CA18 | 6.4, 11.6 |
| CA19 | 2.4, 6.4, 6.5 |
| CA20, CA21 | 6.7, 6.8, 11.7 |
| CA22 | 6.6, 11.8 |
| CA23 | 6.3 (DA15), 6.6 |
| CA24 | 6.4, 6.7, 11.7 (DA16) |
| CA25 | 6.1 |
| CA26 | 6.5, 6.9 |
| CA38 | 2.5, 7.2 |
| CA39 | 17.4, 17.7 |
| CA40, CA41 | 8 |
| CA42 | 2.5, 11.10 |
| CA43 | 2.1, 2.2 |
| CA44, CA45 | 2.3, 2.4, 11.4 |
| CA46 | 9, 12, 13, 17.14 |

---

## 16. Pontos para aprovação

Todos os pontos das seções 0 a 15 estão aprovados:

- **PA1** (`reason=expired` na URL do login), **PA2** (perda do rascunho na expiração, com sessão de 24 h), **PA4** (chip "Demonstração") e **PA5** (menu na top layer): aprovados (P19). **PA3** deixou de existir (B4).
- **PA6 - Visibilidade inicial da senha temporária: aprovado.** No "Novo usuário" e no "Redefinir senha", o campo começa visível, com o botão para ocultar, e usa `autocomplete="off"` (6.4, 6.6).
- **PA7 - Destino após rebaixar a si mesmo: aprovado.** O drawer fecha e o administrador vai para `/entries` com o toast "Alterações salvas. Você não tem mais acesso à gestão de usuários." A action de edição informa que o alvo era o próprio ator (6.4, 11.7).
- **PA8 - Lista dividida em grupos "Ativos" e "Inativos": aprovado** (DA14, 6.1-6.3).

Pendentes: só os pontos do layout global, PL1-PL3, em 17.15.

---

## 17. Layout global: menu lateral, navbar e footer (Aprovado)

> **Nota de atualização (ADR 0013):** continuam válidos o menu lateral, o drawer, o item ativo e o footer das telas protegidas. Saíram as variantes `/demo/*` (visitante e logado), o `basePath` `/demo`, o chip "Demonstração", o `DemoBanner` e o link "Ver demonstração" do footer (17.4, 17.6, 17.7, 17.8, 17.13 e PL3 descrevem o que existia).

Status desta seção: **Aprovado** (PL1-PL3, 2026-10-29). Substitui a navbar com links (e a linha 2 de links abaixo de `sm`) do design de lançamentos (shell 2.x) e da rev. 2 deste documento. Vale para todas as telas do web, inclusive as da Feature B (`docs/design/categorias-inativacao.md`, seção 2). Nenhum token novo.

### 17.0 Decisões

| Id | Decisão | Motivo |
|---|---|---|
| DL1 | A navegação principal sai da navbar e vai para um **menu lateral** (`AppSidebar`). A navbar fica com marca (e chip "Demonstração"), alternador de tema e conta ou "Entrar". Abaixo de `xl`, a navbar ganha à esquerda o **botão de menu** (hambúrguer), que abre a mesma navegação num drawer. | Pedido do usuário. A navbar passa a ter uma linha só em todos os breakpoints, e itens novos (como "Categorias") entram sem truncar nem rolar na horizontal. |
| DL2 | O menu lateral fica **fixo (persistente) só a partir de `xl` (1280px)**. Abaixo disso, inclusive em tablets e em 1024px, a navegação fica no drawer. | Os layouts das telas usam breakpoints da viewport (tabela a partir de `md`, coluna de ação de 220px, tabela de usuários completa e 3 colunas de cartões a partir de `lg`). Em 1280px, com menu de 240px e padding de 32px, a coluna de conteúdo tem 976px, mais que os 960px que o `lg` já supõe (1024 − 2 × 32). Com o menu fixo a partir de `lg`, a coluna teria 720px com o layout de `lg` e as tabelas quebrariam. (PL1) |
| DL3 | O menu lateral **não é recolhível**. | São 3 itens (4 com a Feature B). Recolher pede um trilho só de ícones, tooltip e uma preferência persistida, sem ganho real em 1280px. (PL2) |
| DL4 | "Usuários" (só ADMIN) **não** entra no menu lateral: fica só no menu da conta. | P15 da spec. A gestão de contas é administrativa e rara, e não mostra dados financeiros. Assim o menu lateral é o mesmo para USER, ADMIN e demo, e não muda quando alguém é promovido ou rebaixado. |
| DL5 | O menu lateral usa **vidro de barra** (`.glass-bar`), o mesmo material da navbar. O drawer de navegação é **opaco**. | Os pares de texto sobre a barra já estão validados (`--text`, `--text-muted` 4,67, `--accent` 4,52). O menu lateral é uma superfície folha (sem popover nem `position: fixed` dentro), então pode ter `backdrop-filter`. O drawer é overlay e, pela regra, é opaco. |
| DL6 | O **footer** é texto simples sobre o gradiente, no fim da coluna de conteúdo, sem fundo, e não é fixo nem sticky. | Não toma altura em 360px e não cria vidro novo. |
| DL7 | O **login** e o **modo restrito** não têm menu lateral nem botão de menu. O footer aparece em todos os shells, mas só tem link nas telas protegidas normais. | DA5 e DA11/RF42: fora das telas de dados, ou com a troca obrigatória pendente, não há navegação. |
| DL8 | A navbar ocupa a **largura total** da viewport, com padding de 16, 24 (`md`) e 32px (`lg`). Ela não fica mais dentro do container de 1280px. | Assim a marca alinha com os itens do menu lateral em `xl`. Abaixo de 1280px o resultado é o mesmo de hoje. |

### 17.1 Regiões e ordem no DOM

1. Link "Pular para o conteúdo" (primeiro focável, como hoje).
2. `header` (navbar): sticky no topo, z-index 40.
3. `AppSidebar`: `<nav aria-label="Principal">`, só a partir de `xl` e só nos shells que têm navegação (17.4).
4. Coluna de conteúdo: `DemoBanner` (só em `/demo/*`), `<main id="conteudo">` e `<footer>`.
5. `NavDrawer`: `<dialog>` na top layer, montado só quando está aberto (abaixo de `xl`).

O menu lateral e o drawer nunca existem ao mesmo tempo, então há uma só navegação "Principal" na árvore de acessibilidade.

### 17.2 Layout por breakpoint

```
>= xl (1280), logado, /entries
+----------------------------------------------------------------------------------------------+
| Finanças                                                                       [sol]  (A)    |  navbar 64px, largura total
+---------------------+------------------------------------------------------------------------+
|                     |                                                                        |
| ▌[≣] Lançamentos    |  Lançamentos                              [ < nov/26 > ] [Novo lanç.]  |
|  [▥] Dashboard      |  Resumo de novembro ...                                                |
|  [▭] Cartões        |  [ Despesas | Faturas | Receitas ]   faixa de abas, sticky             |
|  [◇] Categorias     |  ...                                                                   |
|      (Feature B)    |                                                                        |
|                     |                                                                        |
|  240px, sticky      |  coluna de conteúdo: centralizada no espaço restante,                  |
|  altura: viewport   |  max-width 1280px, padding 32px (976px úteis em 1280)                  |
|  menos a navbar     |  ------------------------------------------------------------------    |
|                     |  Finanças · © 2026 · Versão 0.1.0                  Ver demonstração    |
+---------------------+------------------------------------------------------------------------+

md a xl (768-1279), logado
+--------------------------------------------------------------+
| [≡] Finanças                                     [sol]  (A)  |  64px
+--------------------------------------------------------------+
|  Lançamentos                       [ < nov/26 > ] [Novo ...] |
|  ...                                                          |
|  ------------------------------------------------------------ |
|  Finanças · © 2026 · Versão 0.1.0             Ver demonstração|
+--------------------------------------------------------------+

< sm (360), visitante em /demo/entries          < sm, drawer aberto
+----------------------------------+            +----------------------------+-----+
| [≡] Finanças      [sol] [Entrar] |  56px      | Finanças [Demonstração] [x]|     |
+----------------------------------+            |----------------------------|scrim|
| (olho) Você está vendo dados de  |  banner    | ▌[≣] Lançamentos           |     |
|        exemplo. ...              |            |  [▥] Dashboard             |     |
| [            Entrar            ] |            |  [▭] Cartões               |     |
|  Lançamentos                     |            |  [◇] Categorias            |     |
|  ...                             |            |                            |     |
| [ Despesas | Faturas | Receitas ]|  gruda     |                            |     |
|  ...                             |  sob a     |                            |     |
|  ------------------------------  |  navbar    |                            |     |
|  Finanças · © 2026               |            +----------------------------+-----+
|  Versão 0.1.0                    |  footer      min(296px, 100vw - 56px)
+----------------------------------+
```

| Região | < `sm` (360) | `sm` a `md` | `md` a `xl` | >= `xl` (1280) |
|---|---|---|---|---|
| Navbar | 56px; `[≡]` marca … tema conta | igual, com o chip "Demonstração" | 64px | sem `[≡]` |
| Navegação principal | drawer | drawer | drawer | menu lateral fixo, 240px |
| Coluna de conteúdo | `px-4` | `px-4` | `px-6` (`md`), `px-8` (`lg`) | à direita do menu, centralizada no espaço restante, `max-width: 1280px`, `px-8` |
| `DemoBanner` | topo da coluna | idem | idem | idem (não passa por baixo do menu) |
| Footer | duas linhas | uma linha, link à direita | idem | idem, dentro da coluna |

- A coluna de conteúdo é um bloco em coluna com `min-height: calc(100dvh - var(--navbar-h))`, e o footer usa `margin-top: auto`. Em páginas curtas (login, vazio, erro) o footer fica no pé da viewport. Em páginas longas, ele fica depois do conteúdo.
- Em telas muito largas (por exemplo 1920px) o menu continua colado à esquerda e a coluna de 1280px fica centralizada no espaço que sobra.

### 17.3 Hierarquia de informação

1. Navbar: identidade e conta (onde estou e quem sou). "Entrar" ou o avatar ficam sempre visíveis.
2. Navegação principal (menu lateral ou drawer): para onde posso ir.
3. Aviso da demonstração, quando houver.
4. Conteúdo da tela.
5. Footer: informação institucional, com pouca ênfase.

### 17.4 Itens e elementos por contexto

| Contexto | Botão de menu (< `xl`) | Menu lateral / drawer | Marca | Direita da navbar | Footer |
|---|---|---|---|---|---|
| Telas protegidas: `/entries`, `/dashboard`, `/cards` (e `/categories`, Feature B) | sim | "Lançamentos", "Dashboard", "Cartões" (e "Categorias"), `basePath` `''` | link para `/entries` | tema e avatar | nome, ano, versão e "Ver demonstração" |
| `/account`, `/account/password` (modo opcional), `/admin/users` | sim | os mesmos itens, nenhum ativo | link para `/entries` | tema e avatar | idem |
| `/demo/*`, visitante | sim | os mesmos itens com `basePath` `/demo` (RF33, CA39), sem nenhum item de administração | link para `/demo/entries` e chip | tema e "Entrar" | nome, ano e versão |
| `/demo/*`, logado | sim | os mesmos itens com `/demo` | idem | tema e avatar | nome, ano e versão |
| Modo restrito (troca obrigatória) | **não** | **não existe** | texto, sem link | tema e avatar (menu só com "Sair") | nome, ano e versão |
| `/login` e o `not-found` global | **não** | **não existe** | link para `/` | tema | nome, ano e versão |

- Ordem fixa dos itens: Lançamentos, Dashboard, Cartões e, com a Feature B, Categorias. A Feature A sai com 3 itens.
- Cada item tem ícone de 20px e texto. O texto é sempre visível, e o ícone é `aria-hidden`.
- "Usuários" fica só no menu da conta (DL4).
- O `not-found` dentro do grupo protegido (por exemplo `/admin/users` para USER) usa o shell protegido normal, com o menu lateral e nenhum item ativo.

### 17.5 Menu lateral fixo (>= `xl`)

- `position: sticky; top: var(--navbar-h); height: calc(100dvh - var(--navbar-h))`, com `overflow-y: auto` (com zoom de texto, a lista rola sem empurrar a página). Largura de 240px.
- Material: `.glass-bar`, com borda direita de 1px no papel `--card-border` (a mesma da borda inferior da navbar). Não tem sombra. No fallback opaco fica `--surface` com `--border`, como a navbar.
- Sem z-index: o menu não se sobrepõe ao conteúdo. Os popovers do conteúdo (grade do `MonthPicker`, z 35) abrem dentro da coluna.
- Lista: padding de 16px no topo e de 12px nas laterais, com 4px entre os itens.
- Item: `<a>` com altura mínima de 44px, padding horizontal de 12px, raio de 8px, ícone de 20px e 12px de gap até o texto em Inter 500 16.

| Estado do item | Visual |
|---|---|
| Repouso | texto e ícone `--text-muted` |
| Hover | fundo `--surface-2` (opaco, como o hover do `.btn` sobre o vidro), texto `--text` |
| Pressionado | fundo `--surface-active` |
| Ativo (página atual) | `aria-current="page"`, barra de 3px `--accent` à esquerda (24px de altura, raio 2px), texto `--text` em Inter 600, ícone `--accent`. Sem fundo, para não ser confundido com o hover |
| Foco (`:focus-visible`) | `--focus-ring` com `outline-offset: -2px` (interno, porque o `overflow` do menu cortaria um anel externo) |

- O item ativo se distingue por três sinais além da cor: a barra, o peso da fonte e `aria-current`.

### 17.6 Botão de menu e drawer de navegação (< `xl`)

**Botão de menu (dentro do `AppHeader`)**
- `IconButton` de 44x44, sem borda, com ícone de hambúrguer de 24px em `--text`. Fica na ponta esquerda da navbar, 8px antes da marca.
- `aria-label="Abrir menu de navegação"`, `aria-haspopup="dialog"`, `aria-expanded` e `aria-controls` (este só quando o drawer está aberto).
- Estados: hover `--surface-2`, pressionado `--surface-active`, foco `--focus-ring`. Quando aberto, o scrim cobre o botão, então ele não precisa de estado "expandido" visível.
- Não é renderizado a partir de `xl`, no modo restrito nem no login.

**Drawer (`NavDrawer`)**
- `ModalDialog` com uma nova variante de drawer à esquerda (classe `.drawer-left`, espelho da `.drawer-right`). Fica em `position: fixed`, encostado à esquerda, com `height: 100dvh` e `width: min(296px, 100vw - 56px)`. A faixa de 56px de scrim que sobra mostra que dá para tocar fora para fechar. Material opaco `--surface`, borda direita de 1px `--border-strong`, scrim `--scrim`, padding inferior `env(safe-area-inset-bottom)`.
- Cabeçalho com a altura da navbar (56px, 64px a partir de `md`) e a borda inferior `--border`. Nele ficam a marca "Finanças" como texto (o item "Lançamentos" já leva ao mesmo destino), o chip "Demonstração" em `/demo/*` em qualquer largura (abaixo de `sm` ele não aparece na navbar) e o `IconButton` "Fechar menu de navegação" (44x44, ícone x).
- Título acessível: um `h2` visualmente oculto, "Menu de navegação", ligado por `aria-labelledby`.
- Corpo: a mesma `MainNav` do menu lateral, com os mesmos itens, a mesma regra de ativo e os mesmos estados, sobre o fundo opaco.
- Nada além da navegação: o tema, "Entrar" e a conta continuam na navbar.

**Teclado, foco e fechamento**

| Ação | Efeito |
|---|---|
| `Enter` ou `Espaço` no botão de menu | Abre o drawer. O foco vai para o item ativo ou, se não houver, para o primeiro item |
| `Tab` / `Shift+Tab` | Circulam dentro do drawer (foco preso pelo `showModal`, como nos drawers atuais) |
| `Esc` | Fecha e devolve o foco ao botão de menu |
| Clique ou toque no scrim, ou "Fechar menu de navegação" | Fecha e devolve o foco ao botão de menu |
| Ativar um item | Fecha o drawer e navega. O foco volta ao botão de menu, e o anúncio de rota lê o novo título |
| Ativar o item da página atual | Só fecha |
| Mudança de `usePathname` (voltar ou avançar do navegador) | Fecha |
| Viewport passa a >= `xl` com o drawer aberto | Fecha, e o foco vai para o item ativo do menu lateral, que passa a existir (o botão de menu deixa de existir) |

- A página atrás fica inerte e não rola, como no `Drawer` existente.
- Motion: entra deslizando da esquerda (`translateX(-24px)` até 0, em 200ms ease-out), como o `.drawer-right`. Fecha sem animação. Com `prefers-reduced-motion`, não anima.
- Anúncio ao abrir: "Menu de navegação, diálogo. Lançamentos, link, página atual."
- O drawer e o menu da conta nunca ficam abertos juntos. Abrir o drawer fecha o menu da conta (`pointerdown` fora dele), e enquanto o drawer está aberto a navbar fica inerte.

### 17.7 Item ativo

- Regra: um item fica ativo quando `pathname === basePath + href` ou quando `pathname` começa com `basePath + href + "/"`. `basePath` é `''` ou `'/demo'`. Exemplo: `/demo/cards` ativa "Cartões" na demo.
- `/account`, `/account/password`, `/admin/users`, `/login` e o not-found: nenhum item fica ativo.
- O ativo muda quando a rota muda. Ao clicar num item, a tela de destino mostra o `loading.tsx` dela, e o menu marca o destino assim que o `pathname` muda. Não há marcação otimista.
- Visual: 17.5. É o mesmo no menu lateral e no drawer.

### 17.8 Footer (`AppFooter`)

**Conteúdo** (enxuto e sem dados pessoais: nada de nome ou e-mail do usuário, ambiente, URL da API nem dados financeiros):

| Elemento | Texto | Origem |
|---|---|---|
| Nome do app | "Finanças" (Inter 600 14 `--text`) | fixo |
| Ano | "© 2026" | ano corrente em America/Sao_Paulo, calculado no servidor |
| Versão | "Versão 0.1.0" | `version` do `package.json` do web, fixada no build e lida no servidor. Não é segredo e não exige `NEXT_PUBLIC_*` (D11). Sem versão disponível, o trecho é omitido |
| Link | "Ver demonstração", para `/demo/entries` | **só** nas telas protegidas normais (17.4) |

- Sem link na demo: o banner e a navbar já oferecem "Entrar" ou "Ir para meus dados", e um terceiro "Entrar" seria repetição. Sem link no login: o card já tem "Ver demonstração". Sem link no modo restrito: RF42 (PL3).
- Separadores "·" com `aria-hidden="true"`.

**Layout**
- Fica no fim da coluna de conteúdo, depois do `<main>` e fora dele. Tem margem superior de 32px (48px a partir de `md`), borda superior de 1px `--border` e padding vertical de 24px (no mobile, com padding inferior `max(24px, env(safe-area-inset-bottom))`).
- Abaixo de `sm`: duas linhas alinhadas à esquerda, "Finanças · © 2026" e "Versão 0.1.0", e o link, quando houver, numa terceira linha.
- A partir de `sm`: uma linha com as informações à esquerda e o link à direita (`justify-content: space-between`), que quebra com `flex-wrap` se faltar espaço.
- Texto Inter 400 14 `--text-muted`. O link usa `--accent`, sublinhado, `inline-flex` com altura mínima de 44px.

**Material e contraste**
- Sem fundo: é texto simples sobre o gradiente (superfícies 2.7). `--text-muted` e `--accent` sobre as amostras do gradiente entram no `tokens.spec.ts`. Se `--accent` não chegar a 4,5:1 em alguma amostra, o link passa a usar `--text` sublinhado, sem token novo.

**Semântica**
- `<footer>` fora do `<main>`, de `<nav>` e de `<section>`, para ser o landmark *contentinfo*.

**Barra de lote mobile**
- A barra de lote mobile de `/entries` é fixa no pé da tela (z-index 30). Enquanto ela está visível, a coluna reserva embaixo um espaço da altura dela, para o footer não ficar coberto.

### 17.9 Convivência com os outros elementos

- **`DemoBanner`:** primeiro bloco da coluna de conteúdo (a partir de `xl`, à direita do menu lateral). Continua sem sticky, com margem superior de 16px (24px a partir de `md`), como em 2.5.
- **Faixa de abas de `/entries`:** continua sticky em `top: var(--navbar-h)`, com z-index 30, dentro da coluna. Como a navbar tem uma linha só em todos os breakpoints, a faixa gruda logo abaixo dela também em 360px (antes, a linha 2 da navbar rolava embora primeiro). As margens negativas que fazem a faixa sangrar até a borda alcançam a borda da coluna e não entram no menu lateral. A `.page-bg-window` continua alinhada ao gradiente fixo, porque usa `background-attachment: fixed`. Não mudam o `--navbar-h`, o `--tabsbar-h`, o `scroll-padding-top` nem o `IntersectionObserver` da faixa compacta.
- **`thead` sticky:** sem mudança (`top: navbar + abas`, z-index 10).
- **Toast:** sem mudança. No mobile fica abaixo da navbar e da faixa de abas. A partir de `md` fica no canto inferior direito, sobre a coluna de conteúdo.
- **Link "Pular para o conteúdo":** continua o primeiro focável e leva ao `<main id="conteudo">`, pulando a navbar, o menu lateral e o `DemoBanner`. Funciona igual no login e no modo restrito.
- **Ordem de foco a partir de `xl`:** pular → marca → tema → "Entrar" ou avatar → itens do menu lateral → `DemoBanner` → conteúdo → link do footer.
- **Ordem de foco abaixo de `xl`:** pular → botão de menu → marca → tema → "Entrar" ou avatar → `DemoBanner` → conteúdo → link do footer.
- **Menu da conta:** sem mudança (top layer, 2.4).
- **Escala de z-index:** sem número novo. O menu lateral não tem z-index (sticky, sem sobreposição) e o drawer fica na top layer.

| z-index | Elemento |
|---|---|
| 10 | `thead` sticky |
| 20 | Lista do combobox (só dentro de drawer) |
| 30 | Faixa de abas sticky, barra de lote mobile |
| 35 | Grade do `MonthPicker` |
| 40 | Navbar |
| 50 | Toast |
| top layer | `dialog` (drawers, inclusive o de navegação, folha, modal), menu da conta |

### 17.10 Materiais e tokens (nenhum token novo)

| Elemento | Material | Tokens |
|---|---|---|
| Navbar | Vidro de barra | `--bar-bg`, borda inferior `--card-border` (sem mudança) |
| Menu lateral | Vidro de barra (`.glass-bar`) | `--bar-bg`, borda direita `--card-border`; item: `--text-muted`, `--text`, `--accent`, hover `--surface-2`, pressionado `--surface-active`, foco `--focus-ring` |
| Botão de menu | Transparente | ícone `--text`, hover `--surface-2`, pressionado `--surface-active` |
| Drawer de navegação | Opaco (top layer) | `--surface`, `--scrim`, borda `--border-strong`, divisória do cabeçalho `--border` |
| Footer | Sem fundo (texto sobre o gradiente) | `--text`, `--text-muted`, `--accent`, borda superior `--border` |
| Ícones dos itens | - | `currentColor` |

Regras de vidro respeitadas:
- O `backdrop-filter` fica só em superfícies folha: navbar e menu lateral, que não têm popover nem `fixed` dentro.
- Nenhum ancestral delas tem `filter`, `opacity`, `mask`, `clip-path` ou `backdrop-filter`. O container do shell (grid ou flex) não pode receber nenhuma dessas propriedades.
- Não há vidro sobre vidro: o hover dos itens é opaco, e o drawer inteiro é opaco.
- Não há transição de fundo, alfa ou desfoque.
- Nos fallbacks (`@supports not`, `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors`), o menu lateral fica opaco, como a navbar.

### 17.11 Estados

| Região | Carregando | Erro | Vazio |
|---|---|---|---|
| Navbar, menu lateral e footer | Fazem parte do layout e aparecem desde o primeiro quadro, inclusive durante o `loading.tsx` e o `error.tsx` das telas. Não têm skeleton | Se o layout falha (`/auth/me`), vale o fluxo de sessão (8). O `error.tsx` de uma tela mantém navbar, menu e footer, para a pessoa poder ir a outra tela | Não se aplica: os itens são fixos, e um usuário novo vê todos |
| Item ativo durante a navegação | O destino fica ativo quando o `pathname` muda; o carregando é o da tela | - | - |
| Drawer de navegação | Abre na hora, sem dados a carregar | - | - |
| Versão no footer | - | Sem versão no build, o trecho some | - |

### 17.12 Componentes

| Componente | Local sugerido | Tipo | Novo ou alterado | Responsabilidade |
|---|---|---|---|---|
| `AppSidebar` | `components/app-sidebar.tsx` | server (envolve a `MainNav`, que é client) | novo | Menu lateral fixo a partir de `xl` (17.5) |
| `NavDrawer` (inclui o botão de menu) | `components/nav-drawer.tsx` | client | novo | Botão de menu, `dialog` à esquerda, foco, fechamento por navegação e por resize (17.6) |
| `AppFooter` | `components/app-footer.tsx` | server | novo | Nome, ano, versão e link por contexto (17.8) |
| `MainNav` | `components/main-nav.tsx` | client | alterado | Itens com ícone, `basePath`, regra de ativo (17.7), orientação vertical e aviso de navegação para o drawer fechar. Não fica mais na navbar |
| `AppHeader` | `components/app-header.tsx` | server | alterado | Sem `MainNav` e sem linha 2; botão de menu (via `NavDrawer`) abaixo de `xl`; largura total (DL8). O resto como em 10.1 |
| `ModalDialog` | `components/ui/modal-dialog.tsx` | client | alterado | Variante de drawer à esquerda (`.drawer-left`), com o comportamento atual |
| `Icon` | `components/ui/status.tsx` | - | alterado | Ícones novos: lista (Lançamentos), gráfico (Dashboard), cartão (Cartões), etiqueta (Categorias, Feature B), hambúrguer |
| `globals.css` | `web/app/globals.css` | - | alterado | `.drawer-left` e a animação de entrada; grid do shell (menu e coluna). Nenhum token |
| Layouts `(protected)`, `(demo)` e `(auth)` | `web/app/*/layout.tsx` | server | alterado | Compõem navbar, menu lateral (fora do modo restrito e do login), `DemoBanner`, `main` e footer, e passam o contexto (`basePath`, modo, link do footer) |

### 17.13 Fluxos de interação

**Navegar em 360px (toque)**
1. Ana, em `/entries`, toca no botão de menu. O drawer entra pela esquerda com "Lançamentos" ativo e focado.
2. Toca em "Cartões": o drawer fecha, `/cards` carrega com o skeleton dele, e o foco fica no botão de menu.
3. Abre o drawer de novo e toca no scrim: o drawer fecha sem navegar.

**Navegar por teclado em 1280px**
1. `Tab` a partir do topo: "Pular para o conteúdo", marca, tema, avatar e, em seguida, "Lançamentos (página atual)", "Dashboard" e "Cartões" no menu lateral.
2. `Enter` em "Dashboard": navega, e o menu marca "Dashboard" com a barra e o peso 600.

**Drawer por teclado em 1024px**
1. `Tab` até "Abrir menu de navegação" e `Enter`: o drawer abre com o foco no item ativo.
2. `Tab` circula entre os itens e "Fechar menu de navegação". `Esc` fecha, e o foco volta ao botão.

**Redimensionar**
1. Com o drawer aberto em 1200px, a janela passa a 1300px: o drawer fecha, o menu lateral aparece e o foco vai para o item ativo dele.

**Visitante na demo em 360px**
1. Em `/demo/cards`, o botão de menu abre o drawer com o chip "Demonstração" no cabeçalho e os itens apontando para `/demo/*`, com "Cartões" ativo. Não há nenhum item de administração.
2. O footer mostra só nome, ano e versão. Para entrar, a pessoa usa "Entrar" na navbar ou no banner.

**Modo restrito**
1. Carla, com a troca pendente, vê a navbar sem botão de menu, nenhum menu lateral e o footer sem link. A única saída é "Sair" no menu da conta.

### 17.14 Acessibilidade (checklist)

- [ ] Uma única `<nav aria-label="Principal">` na árvore de acessibilidade (no menu lateral ou no drawer). Itens em `<ul>`/`<li>`, com `aria-current="page"` no ativo.
- [ ] Ativo distinguível sem cor: barra de 3px, peso 600 e `aria-current`.
- [ ] Botão de menu: nome "Abrir menu de navegação", `aria-haspopup="dialog"`, `aria-expanded` e `aria-controls`, alvo de 44px.
- [ ] Drawer: `<dialog>` modal com `aria-labelledby` para "Menu de navegação". Foco inicial no item ativo, foco preso, `Esc` e scrim fecham, e o foco volta ao botão de menu (ou ao item ativo do menu lateral depois de um resize para `xl`).
- [ ] Itens com altura mínima de 44px, inclusive com zoom de 200%. Com texto ampliado, o menu lateral rola na vertical e nunca na horizontal.
- [ ] Foco visível e interno nos itens (`outline-offset: -2px`), nos dois temas, sobre a barra e sobre o opaco.
- [ ] Footer como *contentinfo*, link com 44px, separadores `aria-hidden`.
- [ ] "Pular para o conteúdo" pula a navbar, o menu lateral e o `DemoBanner`.
- [ ] Contraste: os itens sobre a barra usam pares já validados (`--text`, `--text-muted`, `--accent` sobre `--bar-bg`) e, no drawer, os pares opacos sobre `--surface` e `--surface-2`. O footer acrescenta ao `tokens.spec.ts` `--text-muted` e `--accent` sobre o gradiente (com a regra de fallback de 17.8).
- [ ] `forced-colors`: a barra do ativo usa `currentColor` ou `Highlight` (não desaparece); as bordas do menu lateral e do drawer se mantêm.
- [ ] axe sem violações em 360px (drawer aberto e fechado) e em 1280px (menu lateral), nos temas claro e escuro, em tela protegida, na demo, no login e no modo restrito.

### 17.15 Pontos para aprovação (layout global)

- **PL1 - Menu lateral fixo só a partir de `xl` (1280px).** Abaixo disso, inclusive em 1024px e em tablets, a navegação fica no drawer aberto pelo botão de menu. *Recomendação: aprovar.* As telas usam breakpoints da viewport, e com o menu fixo a partir de `lg` a coluna de 720px receberia layouts pensados para 960px (DL2). *Alternativa:* menu fixo a partir de `lg`, o que exige revisar as tabelas de lançamentos e usuários e a grade de cartões entre 1024 e 1279px, ou passar essas telas para container queries.
- **PL2 - Menu lateral não recolhível.** *Recomendação: aprovar.* Com 3 ou 4 itens e 240px, o ganho de espaço não compensa o trilho de ícones, os tooltips e a preferência persistida (DL3). *Alternativa:* botão "Recolher menu" que reduz o menu a um trilho de 72px só com ícones e guarda a preferência em cookie, como o tema.
- **PL3 - Conteúdo e alcance do footer.** O footer tem "Finanças · © 2026 · Versão 0.1.0" em todas as telas, inclusive no login e no modo restrito. O link "Ver demonstração" aparece só nas telas protegidas normais. Não há "Entrar" no footer da demo, porque a navbar e o banner já oferecem. *Recomendação: aprovar.* *Alternativa:* footer com "Entrar" na demo para visitante, e sem footer no login e no modo restrito.
