# Design: Fim da demonstração pública, login com dica da conta demo e textos da redefinição diária

- Data: 2026-11-14
- Branch: `review/demo`
- Autor: ui-designer
- Status: **Aprovado** (2026-11-14). Implementado em `review/demo`; PA1, PA2 e PA5 adotados (rótulo condicional, dica abaixo do botão, "horário de Brasília") e PA3 e PA4 mantidos como propostos (sem botão "Preencher"; aviso no Dashboard do app inalterado).
- Entradas: `docs/specs/remover-demo-publica-login.md` (rev. 2: RF02, RF03, RF06-RF11, RNF07, RNF08, CA06-CA16, B1-B5, P01-P09), `docs/adr/0013-remocao-demo-publica-login-rotina-conta-demo.md` (§9, §10), `docs/design/autenticacao-autorizacao.md` (§2.6, §3, §8, §17.8), `docs/design/design-system.md` (rev. 7), `docs/design/superficies-vidro-fosco.md` (§2.3, §4), `docs/design/fundo-gradiente-temas.md`.
- Escopo: `web/` (tela `/login`, remoção das telas `/demo/*` e dos elementos do modo demo, texto de `/privacy`) e `mobile/` (só o texto `DEMO_CLEANUP_TEXT`). Nenhum token novo. Nenhuma tela nova.

---

## 0. Decisões de design

| Id | Decisão | Motivo |
|---|---|---|
| DR1 | O primeiro campo do login vira `type="text"`, `autoComplete="username"`, `autoCapitalize="none"`, `spellCheck={false}`, sem `inputMode`. O `name` continua `email`. | O campo passa a aceitar `demo`, que não é e-mail (B1). `username` é o valor que gerenciadores de senha esperam para "identificador de login", seja e-mail ou não. O `name` não muda porque é o contrato da Server Action e da API (ADR 0013 §6.2). |
| DR2 | **O rótulo do campo depende da dica:** com `DEMO_ACCOUNT_HINT` ligada, "E-mail ou usuário"; desligada, "E-mail". A mensagem de obrigatório acompanha: "Informe o e-mail ou usuário." / "Informe o e-mail.". | O único "usuário" que existe é o alias `demo`, e quem precisa saber disso é quem leu a dica. Sem a dica, "ou usuário" faria uma pessoa com conta real procurar um nome de usuário que ela não tem. O CA10 já prevê "E-mail (ou o rótulo de B1)". A fonte de verdade é a mesma da dica (`isDemoHintEnabled()`), então os dois nunca divergem. |
| DR3 | Sem placeholder no campo (nos dois casos). | Os formulários de autenticação não usam placeholder (o design de autenticação §3.3 não define nenhum): o rótulo fica sempre visível. Um placeholder como "demo" exporia a credencial mesmo com a dica desligada (contra B4), e um exemplo de e-mail pareceria campo preenchido. |
| DR4 | A dica fica **dentro do card, logo abaixo do botão "Entrar"** e antes do rodapé do card, no contexto opaco do formulário. | Pessoas com conta real chegam ao botão sem passar pela dica (ela não compete com campos nem banners). Quem chega para testar encontra a dica no mesmo bloco visual do formulário, antes do texto de orientação. Na ordem do DOM fica depois do formulário, como exigem RF10 e o ADR §9.3. |
| DR5 | A dica é uma **nota neutra**, não um alerta: fundo `--card-bg-2` (no contexto opaco vale `--surface-2`), borda 1px `--border`, raio 8px, sem borda lateral colorida. | Os banners do formulário (`InlineAlert`) usam borda lateral de 3px em cor de tom. Se a dica usasse o mesmo visual, ela competiria com o banner de erro ou de sessão expirada que pode aparecer ao mesmo tempo (RF10). Uma superfície levemente diferente do card já basta para agrupar a informação. |
| DR6 | A credencial (`demo`) aparece em peso 600 e fonte monoespaçada, num chip com borda 1px `--border-strong`. | RNF07: o destaque não pode depender só de cor. Peso, família e contorno distinguem o valor a ser digitado do texto ao redor. |
| DR7 | **Sem botão "Preencher"** nesta entrega. | A spec deixa fora de escopo qualquer atalho que preencha ou envie a credencial (RF10, §6). A credencial tem 4 letras, então digitar custa pouco. Fica como evolução possível (seção 13, PA3), já com o comportamento definido para o caso de ser aprovada. |
| DR8 | Sai o link "Ver demonstração", e o rodapé do card fica só com "Não tem acesso ou esqueceu a senha? Fale com um administrador.". | RF03, RF09, P09. |
| DR9 | O app mobile não ganha a dica nem muda o rótulo do login. | P07 e §6 da spec: a credencial vai nas notas de revisão da App Store. O alias funciona no app publicado sem mudança (ADR §10). Mudar o rótulo para "E-mail ou usuário" sem a dica que o explica teria o mesmo problema do DR2. |
| DR10 | Os textos sobre a conta demo (dica, `/privacy`, `DEMO_CLEANUP_TEXT`) usam "redefinida todos os dias às 03:00 (horário de Brasília)". | Os textos ficam iguais em todos os pontos. Hoje `/privacy` diz "horário de São Paulo" e o app diz "horário de Brasília"; padroniza-se o segundo, que é o nome que o público reconhece (o fuso é o mesmo, America/Sao_Paulo). "Apagados" deixa de ser exato com o dataset de exemplo (B2): os dados voltam ao estado de exemplo em vez de sumir. |

---

## 1. Fundamentos usados (sem token novo)

| Elemento | Material | Tokens |
|---|---|---|
| Card de login (`AuthCard`) | Vidro (`.card`) | `--card-bg`, `--card-border`, `--card-shadow` (sem mudança) |
| Formulário e dica | Contexto opaco (`data-surface="opaque"`, já existente no `AuthCard`) | `--card-bg-2` = `--surface-2` |
| Nota da dica | Opaca | fundo `--card-bg-2`, borda 1px `--border`, texto `--text` e `--text-muted`, ícone `--text-muted` |
| Chip da credencial | Opaco | fundo `--surface`, borda 1px `--border-strong`, texto `--text`, raio 4px |
| Banners | `InlineAlert` (sem mudança) | ver design de autenticação §3.5 |

Contraste (opaco, pares calculados sobre os valores do design system, WCAG 2.1):

| Frente / fundo | Claro | Escuro | Mínimo |
|---|---|---|---|
| `--text` sobre `--surface-2` | 13,4 | 11,1 | 4,5 |
| `--text-muted` sobre `--surface-2` | 6,9 | 5,6 | 4,5 |
| `--text` sobre `--surface` (chip) | 14,6 | 12,6 | 4,5 |
| `--border-strong` sobre `--surface-2` (contorno do chip) | 4,0 | 3,7 | 3 |
| `--border` (borda da nota) | decorativa | decorativa | (não exigido) |

A borda da nota é decorativa: o agrupamento também aparece pela diferença de fundo e pelo ícone, então ela não precisa chegar a 3:1. Com `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` ou sem `backdrop-filter`, o card já cai em `--surface` (glass.css §1-§2) e a nota continua em `--surface-2`: a diferença entre os dois existe nos dois temas. Em `forced-colors`, a nota e o chip ficam com a borda do sistema (`CanvasText`), e o destaque da credencial continua pelo peso e pela fonte.

Tipografia: corpo Inter 14 (linha 1 em 400 `--text`, linha 2 em 400 `--text-muted`); credencial em `ui-monospace` 14, peso 600.

---

## 2. Tela `/login`

### 2.1 Hierarquia de informação

1. Título (h1) "Entrar".
2. Contexto: subtítulo ou "Entre para continuar em <tela>." (sem mudança).
3. Banner do formulário (credenciais, 429, rede, sessão expirada), só quando houver.
4. Campos: "E-mail ou usuário" (ou "E-mail", DR2) e "Senha".
5. Ação primária "Entrar".
6. **Dica da conta demo** (só com `DEMO_ACCOUNT_HINT=on`).
7. Orientação no rodapé do card: "Não tem acesso ou esqueceu a senha? Fale com um administrador.".

Sai o antigo item 6, "caminho alternativo: Ver demonstração".

### 2.2 Layout por breakpoint

Container, card e espaçamentos são os do design de autenticação §3.2, sem mudança: abaixo de `sm`, largura total, padding 20px e margem superior 24px; a partir de `sm`, `max-width: 420px`, padding 32px e margem superior 64px; a partir de `lg`, centralizado verticalmente. O fundo é o gradiente do tema (`fundo-gradiente-temas.md`), e o card é de vidro fosco.

```
< sm (360px), com dica                 >= sm (até 1280+), com dica
+----------------------------------+  +------------------------------------------------+
| Finanças                   [sol] |  | Finanças                                 [sol] |
+----------------------------------+  +------------------------------------------------+
|  +----------------------------+  |  |         +--------------------------+           |
|  | Entrar                     |  |  |         | Entrar                   |           |
|  | Acesse seus lançamentos,   |  |  |         | Acesse seus lançamentos, |           |
|  | cartões e faturas.         |  |  |         | cartões e faturas.       |           |
|  | [banner, se houver]        |  |  |         | [banner, se houver]      |           |
|  | E-mail ou usuário          |  |  |         | E-mail ou usuário        |           |
|  | [______________________]   |  |  |         | [______________________] |           |
|  | Senha                      |  |  |         | Senha                    |           |
|  | [__________________][olho] |  |  |         | [________________][olho] |           |
|  | [         Entrar        ]  |  |  |         | [        Entrar        ] |           |
|  | +------------------------+ |  |  |         | +----------------------+ |           |
|  | |(i) Para testar, use o  | |  |  |         | |(i) Para testar, use  | |           |
|  | |    usuário [demo] e a  | |  |  |         | |    o usuário [demo] e| |           |
|  | |    senha [demo].       | |  |  |         | |    a senha [demo].   | |           |
|  | |    Conta compartilhada:| |  |  |         | |    Conta             | |           |
|  | |    não registre dados  | |  |  |         | |    compartilhada: não| |           |
|  | |    pessoais. Ela é     | |  |  |         | |    registre dados    | |           |
|  | |    redefinida todos os | |  |  |         | |    pessoais. Ela é   | |           |
|  | |    dias às 03:00       | |  |  |         | |    redefinida todos  | |           |
|  | |    (horário de         | |  |  |         | |    os dias às 03:00  | |           |
|  | |    Brasília).          | |  |  |         | |    (horário de       | |           |
|  | |                        | |  |  |         | |    Brasília).        | |           |
|  | +------------------------+ |  |  |         | +----------------------+ |           |
|  | ------------------------   |  |  |         | ------------------------ |           |
|  | Não tem acesso ou esqueceu |  |  |         | Não tem acesso ou        |           |
|  | a senha? Fale com um       |  |  |         | esqueceu a senha? Fale   |           |
|  | administrador.             |  |  |         | com um administrador.    |           |
|  +----------------------------+  |  |         +--------------------------+           |
|  ------------------------------  |  | ---------------------------------------------- |
|  Finanças · © 2026               |  | Finanças · © 2026 · Versão 0.1.0               |
+----------------------------------+  +------------------------------------------------+
(as quebras de linha do esboço são ilustrativas; o texto reflui pela largura real)

Sem dica (DEMO_ACCOUNT_HINT desligada), qualquer breakpoint
|  | E-mail                     |  |   rótulo "E-mail" (DR2)
|  | [______________________]   |  |
|  | Senha ...                  |  |
|  | [         Entrar        ]  |  |
|  | ------------------------   |  |   a nota não existe no DOM; nenhum espaço reservado
|  | Não tem acesso ou esqueceu |  |
```

| Breakpoint | Nota da dica |
|---|---|
| < `sm` | largura total do conteúdo do card (288px em 360px de viewport), padding 12px, ícone 20px à esquerda com gap 12px. O texto ocupa cerca de 244px e quebra em várias linhas, sem truncar. |
| >= `sm` | largura total do conteúdo do card (356px), mesmo padding e mesma estrutura. |
| Zoom 200% / 320 CSS px | o card ocupa a largura e o texto reflui. O chip `demo` tem `white-space: nowrap` (a palavra não quebra), e a frase quebra entre palavras, sem hifenização e sem rolagem horizontal (WCAG 1.4.10). |

- Espaço entre o botão "Entrar" e a nota: 16px (o `gap-4` que o bloco opaco do `AuthCard` já tem). Entre a nota e a divisória do rodapé: os 24px do `gap-6` do card.
- Estrutura interna da nota: `flex items-start gap-3`; ícone (círculo com "i", 20px, `aria-hidden`); coluna de texto `flex-col gap-1`, com dois parágrafos.
- No teclado virtual do mobile, a nota rola junto com o card, como o resto. Nada fica fixo.

### 2.3 Primeiro campo

| Propriedade | Com dica | Sem dica |
|---|---|---|
| Rótulo | "E-mail ou usuário" | "E-mail" |
| `type` | `text` | `text` |
| `name` | `email` | `email` |
| `autoComplete` | `username` | `username` |
| `autoCapitalize` / `spellCheck` | `none` / `false` | `none` / `false` |
| `inputMode` | (não definido: teclado de texto) | (não definido) |
| Placeholder | nenhum (DR3) | nenhum |
| Obrigatório | `aria-required="true"` (sem mudança) | idem |
| Mensagem `REQUIRED` | "Informe o e-mail ou usuário." | "Informe o e-mail." |
| Validação no cliente | só presença (D13, sem mudança). Formato nunca é validado no login | idem |
| Erro de credencial | banner "E-mail ou senha inválidos." (exato, CA14) | idem |

Sobre o banner de credencial: ele continua "E-mail ou senha inválidos." mesmo com o rótulo "E-mail ou usuário". O CA14 exige o texto exato, e a mensagem genérica é a mesma para todos os casos (RNF05). Quem usa o alias leu a dica e entende que "demo" ocupa o lugar do e-mail.

Trade-off aceito: sem `inputMode="email"`, o teclado do celular deixa de mostrar o `@` na primeira camada. É o preço de aceitar `demo`, e o `type="text"` vale nos dois casos para que o comportamento do campo não mude com uma variável de ambiente (só o rótulo muda).

### 2.4 Dica da conta demo (`DemoAccountHint`)

**Textos (exatos):**

- Linha 1 (`--text`): "Para testar, use o usuário **demo** e a senha **demo**."
- Linha 2 (`--text-muted`): "Conta compartilhada: não registre dados pessoais. Ela é redefinida todos os dias às 03:00 (horário de Brasília)."

A credencial é constante de código (P03, ADR §9.3), nunca vem de env.

**Quando aparece:** só com `DEMO_ACCOUNT_HINT=on` (B4, CA10, CA11). Aparece junto com qualquer banner (sessão expirada, credencial inválida, 429, rede) e em qualquer contexto de `next`. Desligada, não é renderizada nem deixa espaço vazio.

**Acessibilidade:**

| Aspecto | Especificação |
|---|---|
| Elemento | `<div role="note" aria-label="Conta de demonstração">` com dois `<p>`. Não é landmark nem região viva (`aria-live`): o conteúdo é estático. |
| Ordem | No DOM, depois do `<form>` e antes do `<footer>` do card. Leitores de tela a encontram na leitura linear, depois do botão "Entrar" (CA16). |
| Foco | Nenhum elemento focável dentro dela (sem `tabIndex`, sem link, sem botão). Não recebe foco programático e não altera o foco inicial nem o foco após erro. |
| Credencial | `<strong><code translate="no">demo</code></strong>`. O leitor lê "use o usuário demo e a senha demo" sem anunciar formatação extra. `translate="no"` impede que um tradutor automático troque "demo" por outra palavra. O texto é selecionável e copiável. |
| Ícone | `aria-hidden="true"`. A informação está toda no texto. |
| Cor | Pares da seção 1 acima de 4,5:1 nos dois temas. O destaque da credencial vem de peso, fonte e contorno (DR6). |
| Zoom / reflow | Seção 2.2. |
| `forced-colors` | Seção 1. |

**Estilo do chip:** `padding: 0 4px`, raio 4px, `font-family: ui-monospace, SFMono-Regular, Menlo, monospace`, 14px, peso 600, fundo `--surface`, borda 1px `--border-strong`, `white-space: nowrap`. A altura não muda a da linha (`line-height` herdada).

### 2.5 Estados da tela

A página continua estática, sem `loading.tsx` (design de autenticação §9). A dica é server component e não reage ao envio.

| Estado | Banner (topo do formulário) | Campos e botão | Dica |
|---|---|---|---|
| Inicial | nenhum | rótulo conforme DR2; sem foco automático | visível (se ligada) |
| Validação de presença (cliente) | nenhum | erro no campo vazio ("Informe o e-mail ou usuário." / "Informe a senha."), foco no primeiro inválido | visível |
| Carregando (envio) | o atual permanece até a resposta | botão com spinner e "Entrando…", `aria-busy`; campos `readOnly`; novos envios ignorados | visível, inalterada (não fica esmaecida nem some) |
| Erro de credenciais (401) | `InlineAlert` `danger`: "E-mail ou senha inválidos.", `role="alert"` | identificador mantido, senha limpa, foco em Senha (DA9) | visível. É justamente quando ajuda a conferir o que foi digitado |
| Rate limit (429) | `InlineAlert` `warning`: "Muitas tentativas. Tente novamente em N minutos, às HH:MM." e, no fim do prazo, "Você já pode tentar novamente." (`role="status"`) | botão com `aria-disabled` e `aria-describedby` para o banner até o prazo; senha não é limpa | visível. A conta demo é isenta do limite por identificador, mas o limite por IP vale (RF11). O texto é o mesmo de qualquer 429 |
| Rede ou 5xx | `InlineAlert` `danger`: "Não foi possível entrar agora. Verifique sua conexão e tente novamente." | valores mantidos | visível |
| Sessão expirada (`reason=expired`) | `InlineAlert` `info`: "Sua sessão expirou. Entre novamente.", `role="status"` | normal | visível (RF10) |
| Sem dica (`DEMO_ACCOUNT_HINT` desligada) | o do momento | rótulo "E-mail", mensagem "Informe o e-mail." | não renderizada; o card termina no botão e no rodapé |
| Sucesso | nenhum | "Entrando…" até a navegação terminar | permanece até a troca de página |

Os banners continuam limitados a um por vez, no topo do formulário. A dica não é banner e não entra nessa regra.

### 2.6 Fluxo de interação

**Visitante que quer testar (dica ligada):**
1. Abre `/` sem sessão e é redirecionado para `/login` (RF06, CA06). O mesmo acontece ao clicar na marca do shell de autenticação, que aponta para `/`.
2. Lê o card e encontra a dica abaixo do botão.
3. Digita `demo` em "E-mail ou usuário" (maiúsculas e espaços nas pontas são aceitos, CA12) e `demo` em "Senha".
4. Ativa "Entrar" com clique ou `Enter`. O botão mostra "Entrando…".
5. Chega a `/entries` (ou ao `next`) como "Conta de demonstração", com os dados de exemplo (B2, P02).
6. Se errar, aparece o banner "E-mail ou senha inválidos.", a senha é limpa, o foco vai para Senha e a dica continua visível para conferência.

**Pessoa com conta real:** a ordem de tabulação é a de hoje (campo, senha, olho, "Entrar"). A dica não tem elementos focáveis e não entra na tabulação. Mesmo destino de antes (`next` ou `/entries`; troca obrigatória leva a `/account/password`).

**Rota protegida sem sessão:** `/dashboard?month=2026-11` leva a `/login?next=...` com "Entre para continuar em Dashboard." e, se ligada, a dica (CA08).

**Sair:** o item "Sair" do menu da conta leva a `/login` (antes `/demo/entries`, ADR §9.2). Não há toast, e a dica aparece se estiver ligada.

**Favoritos antigos:** `/demo/entries`, `/demo/dashboard`, `/demo/cards` e qualquer `/demo/*` mostram a página de não encontrado global, no shell de autenticação (P04, CA09), sem redirecionar.

---

## 3. Remoção das telas `/demo/*` e do modo demo

Não há mudança visual nas telas protegidas. No modo protegido, `WriteOnly` já renderizava os filhos, `basePath` era `""` e o cabeçalho já mostrava o avatar. O que some existia só em `/demo/*`.

| Some | Onde aparecia | Design de origem |
|---|---|---|
| Telas `/demo/entries`, `/demo/dashboard`, `/demo/cards` | rotas públicas | autenticação §7 |
| `DemoBanner` ("Você está vendo dados de exemplo." com "Entrar" ou "Ir para meus dados") | topo da coluna de conteúdo em `/demo/*` | autenticação §2.5 |
| Chip "Demonstração" (`DemoChip`) | navbar, a partir de `sm`, e cabeçalho do drawer de navegação abaixo de `sm` | autenticação §2.1, §17.6 |
| Botão "Entrar" da navbar (`SignInButton`) | navbar do visitante na demo | autenticação §2.2 |
| Estado somente leitura (`WriteOnly`: sem "Novo lançamento", "Pagar", "Pagar fatura", seleção em lote, "+ Novo cartão", "Editar"; vazios sem CTA) | telas em `/demo/*` | autenticação §7.2, DA7 |
| Itens do menu lateral e do drawer apontando para `/demo/*`; marca apontando para `/demo/entries` | navegação na demo | autenticação §2.1, §17.4 |
| Títulos "Lançamentos (demonstração) · Finanças", "Dashboard (demonstração) · Finanças", "Cartões (demonstração) · Finanças" | `document.title` | autenticação §3.7 |
| Link "Ver demonstração" | rodapé do card de login | autenticação §3.2, §3.6 ("continua ativo durante o envio" deixa de se aplicar) |

Confirmações para a regressão (R9):

- Navbar das telas protegidas: `[botão de menu] Finanças ... [tema] (avatar)`, igual a hoje. O avatar nunca é substituído por "Entrar".
- Menu lateral, drawer, item ativo e footer: iguais. Os links já eram `/entries`, `/dashboard` e `/cards`.
- Todos os controles de escrita continuam visíveis para quem tem permissão. A conta demo vê os mesmos controles de hoje, porque tem escrita (B3). O que ela não pode fazer (trocar senha, editar perfil, gerenciar usuários) segue controlado por `me.capabilities`, sem mudança.
- Skeletons, `error.tsx` e vazios das telas protegidas: sem mudança.

Notas de atualização para o doc-writer em `docs/design/autenticacao-autorizacao.md`: §2.1 (chip e variante "visitante"), §2.2, §2.5, §3.1 (item 6), §3.2 (rodapé), §3.6 (último item), §3.7 (títulos da demo), §7, §8 (linhas "Sair" e "/"), §9 (linha `/demo/*`), §11.1 e §11.10 passam a remeter a este documento.

---

## 4. Textos pendentes do ADR

### 4.1 `/privacy`

A página não menciona a demonstração pública (o link para `/demo/*` e o visitante sem login não aparecem nela). Ela fala da **conta de demonstração** compartilhada, que continua. Só o último parágrafo muda, para refletir B2 e B5. O restante da página e o layout ficam como estão.

| | Texto |
|---|---|
| Título da seção (sem mudança) | "Conta de demonstração" |
| Atual | "Existe uma conta de demonstração compartilhada, usada para apresentar o aplicativo. Qualquer pessoa pode entrar nela, por isso não registre dados pessoais ali. Os lançamentos e cartões dessa conta são apagados todos os dias às 03:00 (horário de São Paulo)." |
| **Novo** | "Existe uma conta de demonstração compartilhada, com dados fictícios de exemplo, usada para apresentar o aplicativo. Qualquer pessoa pode entrar nela, por isso não registre dados pessoais ali. Essa conta é redefinida todos os dias às 03:00 (horário de Brasília): os lançamentos e cartões criados ou alterados são descartados e os dados de exemplo voltam ao estado original." |

- A credencial não aparece em `/privacy`, que é uma página institucional. Ela existe só na tela de login e nas notas de revisão.
- O teste atual (`/demonstra[çc][ãa]o/i` e `/03:00/`) continua válido.

### 4.2 `DEMO_CLEANUP_TEXT` (mobile, `mobile/src/core/messages.ts`)

| | Texto |
|---|---|
| Atual | "Os dados desta conta de demonstração são apagados todos os dias às 03:00 (horário de Brasília)." |
| **Novo** | "Esta conta de demonstração é compartilhada e redefinida todos os dias às 03:00 (horário de Brasília): o que for criado ou alterado é descartado e os dados de exemplo voltam." |

- Apresentação sem mudança: `Text variant="footnote" tone="muted"`, nos dois lugares em que já aparece. Em Ajustes fica abaixo do card "Conta", sempre visível para a conta demo. No Dashboard fica no card de boas-vindas, que só aparece com a conta vazia.
- Consequência de B2: a conta demo passa a ter dados de exemplo, então o card de boas-vindas do Dashboard (e o texto dentro dele) só aparece se um visitante apagar tudo. Na prática, o aviso fica visível em Ajustes. Proponho manter assim nesta entrega e deixo como PA4 a opção de mostrar o aviso também no Dashboard com dados.
- O teste atual (`toContain('03:00')`) continua válido. Entra na próxima versão do app (ADR §10). Até lá, o texto antigo continua verdadeiro para o que o visitante cria.
- Notas de revisão da App Store e `mobile/README.md` (fora do app, texto de referência para o doc-writer): "Conta de demonstração: usuário `demo` (ou `demo@showcase.invalid`) e senha `demo`. A conta já vem com dados de exemplo e é redefinida todos os dias às 03:00 (horário de Brasília)."

### 4.3 Consistência dos textos sobre a redefinição

| Onde | Forma |
|---|---|
| Dica do login (web) | "Ela é redefinida todos os dias às 03:00 (horário de Brasília)." |
| `/privacy` (web) | "Essa conta é redefinida todos os dias às 03:00 (horário de Brasília): ..." |
| `DEMO_CLEANUP_TEXT` (mobile) | "... redefinida todos os dias às 03:00 (horário de Brasília): ..." |

Os três textos usam o verbo "redefinir", horário em 24 h e "horário de Brasília". Nenhum promete que nada se perde no meio do dia: a execução manual (RF17) pode acontecer a qualquer hora e não é anunciada ao usuário.

---

## 5. Mobile: tela de login

Existe tela de login (`mobile/app/(auth)/login.tsx`), mas a spec não prevê dica nem rótulo novo no app (P07, §6: "Dica da conta demo no app mobile" está fora de escopo). Por isso:

- O rótulo continua "E-mail", e a mensagem continua "Informe o e-mail.", com `keyboardType="email-address"` e `textContentType="username"` (já presente).
- Sem dica. O revisor recebe a credencial nas notas de revisão (4.2).
- `demo`/`demo` funciona digitado nesse campo, porque o app só valida presença e quem resolve o alias é a API (ADR §10, CA30). O teclado de e-mail permite digitar `demo` normalmente.
- Se a dica entrar no app no futuro, valem os mesmos textos da seção 2.4 e a regra do DR2 (rótulo condicional), com a flag vindo da configuração do app. Isso exige uma decisão de negócio nova.

---

## 6. Componentes

### 6.1 Novos

| Componente | Arquivo sugerido | Tipo | Responsabilidade |
|---|---|---|---|
| `DemoAccountHint` | `web/app/(auth)/login/demo-account-hint.tsx` | Server component, sem props (ou `hint: DemoHint`) | Renderiza a nota da seção 2.4 a partir da constante da credencial. Quem decide se aparece é o `page.tsx`, com `isDemoHintEnabled()` (ADR §9.3). Sem estado e sem JS no cliente. |

### 6.2 Existentes alterados

| Componente | Arquivo | Mudança |
|---|---|---|
| `LoginPage` | `web/app/(auth)/login/page.tsx` | Lê `isDemoHintEnabled()` por requisição. Passa `demoHint: boolean` ao `LoginForm` e renderiza `<DemoAccountHint />` depois dele, dentro do `AuthCard` (bloco opaco). Remove o `<Link>` "Ver demonstração" (e o import de `Link`). O rodapé fica com um parágrafo. |
| `LoginForm` | `web/app/(auth)/login/login-form.tsx` | Prop `demoHint`. Primeiro campo conforme 2.3 (rótulo e mensagem condicionais, `type="text"`, `autoComplete="username"`, sem `inputMode`). Nada muda nos banners, no foco, no 429 nem no envio. |
| `fieldMessage` | `web/lib/auth/field-messages.ts` | Nova entrada para o campo com alias (ex.: `login.identifier.REQUIRED` = "Informe o e-mail ou usuário."). "Informe o e-mail." continua para o caso sem dica. |
| `PrivacyPage` | `web/app/(public)/privacy/page.tsx` | Parágrafo da seção "Conta de demonstração" (4.1). |
| `DEMO_CLEANUP_TEXT` | `mobile/src/core/messages.ts` | Texto (4.2). |
| `logoutAction` | `web/app/(auth)/actions.ts` | Destino `/login` (efeito visível: depois de sair, a pessoa vê o login). |

### 6.3 Existentes sem mudança

`AuthCard`, `TextField`/`FieldShell`, `PasswordField`, `Button`, `InlineAlert`, `AppShell` (shell `auth`), `ThemeToggle`, `AppHeader` (fora a remoção dos ramos de demo), `AppSidebar`, `NavDrawer`, `MainNav`, `AppFooter`, o `not-found` global e as telas protegidas.

### 6.4 Removidos

`DemoBanner`, `DemoBannerAction`, `DemoChip`, `SignInButton` (com `signInHref`), `WriteOnly` (os filhos passam a renderizar direto), `AppModeProvider`/`useAppMode`, layout e páginas de `web/app/(public)/demo/*`.

---

## 7. Microcopy

| Chave | Texto |
|---|---|
| Rótulo do identificador (dica ligada) | "E-mail ou usuário" |
| Rótulo do identificador (dica desligada) | "E-mail" |
| Obrigatório (dica ligada) | "Informe o e-mail ou usuário." |
| Obrigatório (dica desligada) | "Informe o e-mail." |
| Obrigatório (senha) | "Informe a senha." (sem mudança) |
| Credencial inválida | "E-mail ou senha inválidos." (sem mudança, CA14) |
| Dica, linha 1 | "Para testar, use o usuário **demo** e a senha **demo**." |
| Dica, linha 2 | "Conta compartilhada: não registre dados pessoais. Ela é redefinida todos os dias às 03:00 (horário de Brasília)." |
| Nome acessível da dica | "Conta de demonstração" |
| Rodapé do card | "Não tem acesso ou esqueceu a senha? Fale com um administrador." (sem mudança) |
| `/privacy`, conta de demonstração | seção 4.1 |
| `DEMO_CLEANUP_TEXT` | seção 4.2 |

Tudo em pt-BR, sem emojis (RNF08).

---

## 8. Acessibilidade (checklist)

- [ ] A dica é texto real, em `role="note"`, depois do formulário no DOM, sem `tabIndex` e sem foco programático (CA16).
- [ ] A dica não é região viva e não é anunciada ao carregar. Ela é lida na ordem natural.
- [ ] Contraste AA nos dois temas (seção 1). Verificado com axe no Playwright (ADR §11.5).
- [ ] A credencial se destaca por peso, fonte e contorno, não só por cor (RNF07).
- [ ] Reflow a 320 CSS px e zoom de 200% sem rolagem horizontal.
- [ ] O rótulo visível e o nome acessível do campo são iguais ("E-mail ou usuário" ou "E-mail"), conforme WCAG 2.5.3.
- [ ] `autoComplete="username"` no identificador e `current-password` na senha, para gerenciadores de senha (WCAG 1.3.5).
- [ ] Ordem de foco do formulário inalterada; o foco após erro segue DA9.
- [ ] Nenhum link para `/demo` na página (CA10).

---

## 9. Responsividade (resumo)

| Largura | Comportamento |
|---|---|
| 320-359 | Card com largura total e padding 20px. A nota fica com cerca de 10-11 linhas, e o chip não se divide. |
| 360-639 | Card com largura total (seção 2.2). A nota fica com cerca de 9 linhas, e o card rola com a página. |
| 640-1023 | Card de 420px centralizado, margem superior de 64px. A nota fica com cerca de 6 linhas. |
| >= 1024 (`lg`) | Card centralizado verticalmente entre a navbar e o footer. Com a dica, o card fica cerca de 140px mais alto. Se a altura da viewport não comportar, vale a margem mínima de 64px e a página rola. |

---

## 10. Rastreabilidade

| CA | Seção |
|---|---|
| CA06, CA07, CA08 | 2.6 |
| CA09 | 2.6 (favoritos), 3 |
| CA10 | 2.1, 2.2, 2.4, 0 (DR8) |
| CA11 | 2.4 (quando aparece), 2.5 (sem dica), DR2 |
| CA12, CA13 | 2.3, 2.6 |
| CA14 | 2.3 (banner inalterado) |
| CA16 | 2.4 (acessibilidade), 8 |
| RF03 | 3 |
| P07 | 5 |
| P08 | 4 |

---

## 11. Entregas para o frontend

1. `page.tsx`: `isDemoHintEnabled()`, `demoHint` para o formulário, `<DemoAccountHint />` depois do `LoginForm`, sem "Ver demonstração".
2. `login-form.tsx`: campo da seção 2.3.
3. `field-messages.ts`: mensagem do identificador.
4. `demo-account-hint.tsx`: seção 2.4 (estrutura, classes por token, `role="note"`, chip).
5. Testes de componente: com a dica, o rótulo "E-mail ou usuário" e a nota depois do `<form>` no DOM, sem `tabIndex`; sem a dica, o rótulo "E-mail" e nenhuma nota; nota presente com banner de sessão expirada e com banner de credencial inválida; nenhum `href` para `/demo`; `autoComplete="username"` e `type="text"`.
6. `/privacy` e `DEMO_CLEANUP_TEXT` (4.1, 4.2).

---

## 12. Riscos visuais

| # | Risco | Mitigação |
|---|---|---|
| RV1 | Rótulo e dica dependem da mesma variável: se o frontend ler a flag em dois lugares diferentes, um pode mostrar "E-mail ou usuário" sem a dica. | Uma leitura só no `page.tsx`, que repassa o valor ao formulário e decide a nota. Teste de componente cobre os dois estados. |
| RV2 | Card mais alto em telas baixas (notebook de 768px de altura) pode deixar o rodapé abaixo da dobra. | Aceitável: o rodapé é texto secundário e a página rola. A dica está acima dele. |
| RV3 | Visitantes podem confundir a nota com um aviso de erro. | Visual neutro (DR5), sem cor de tom e com ícone de informação. Banners de erro ficam no topo, com outro material. |
| RV4 | `DEMO_ACCOUNT_HINT=on` com senha diferente de `demo` na API (R4). | Fora do design: checklist de deploy (ADR §9.3). A interface não tem como detectar. |

---

## 13. Pontos para aprovação

| Id | Ponto | Proposta |
|---|---|---|
| PA1 | Rótulo condicional (DR2): "E-mail ou usuário" com dica, "E-mail" sem dica. | Aprovar. Alternativa: rótulo fixo "E-mail ou usuário" em qualquer caso (mais simples, mas confunde quem tem conta real quando a dica está desligada). |
| PA2 | Posição da dica abaixo do botão "Entrar", em nota neutra (DR4, DR5). | Aprovar. Alternativa: acima dos campos. Ficaria mais visível para visitantes, mas competiria com os banners e empurraria o formulário para baixo em 360px. |
| PA3 | Botão "Preencher" (DR7). | **Não incluir** nesta entrega (fora de escopo na spec, §6). Se for aprovado depois, a especificação seria: botão terciário "Usar conta demo" dentro da nota, alvo de 44px; preenche os dois campos com `demo`, limpa erros de campo, move o foco para "Entrar" e anuncia "Campos preenchidos com a conta de demonstração." num `role="status"`; nunca envia sozinho. Isso exige revisão da spec (RF10) e um client component para a nota. |
| PA4 | Aviso da redefinição no Dashboard do app quando a conta demo tem dados (4.2). | Manter como está (Ajustes sempre; Dashboard só com a conta vazia). Reavaliar se o revisor da Apple ou os visitantes não perceberem a redefinição. |
| PA5 | Padronizar "horário de Brasília" em `/privacy` (hoje "horário de São Paulo") (DR10). | Aprovar. |
