# Spec: Fundo em gradiente nos temas claro e escuro

**Impacto em UI: sim.** A feature muda o fundo da página nos dois temas e cria uma página temporária de pré-visualização (`/background-preview`) com sugestões estáticas. O ui-designer participa: define os presets e, depois da escolha do usuário, os valores finais dos tokens.

- Data: 2026-10-26
- Branch: `feat/ui`
- Nota (2026-10-27): a decisão **B1** desta spec (superfícies e navbar sem vidro) foi revogada por `docs/specs/superficies-vidro-fosco.md` e `docs/adr/0004-superficies-vidro-fosco.md`.
- Status: Concluída (presets escolhidos: dark-5 e light-2; pré-visualização removida). Decisão em `docs/adr/0003-fundo-gradiente-temas.md`.
- Escopo: só `[web]`. Sem mudanças em `api/` nem no banco.
- Referências: `docs/design/design-system.md` (rev. 5, paleta suavizada), `docs/adr/0001-lancamentos-financeiros.md` §9.5 (tokens de tema), `web/app/styles/tokens.css`, `web/app/globals.css`, `web/lib/theme/contrast-pairs.ts`, `web/lib/theme/tokens.spec.ts`, `web/test/no-literal-colors.spec.ts`, `web/e2e/dark-theme.pw.ts`.

### Pedido original do usuário

> "melhore a cor de fundo deixe mais colorido com gradiente deixando mais futurista:
> - o tema escuro não precisa ser preto aplique uma mais escura com gradiente.
> - o tema claro não precisa ser o fundo branco use uma cor com tom claro com gradiente.
> se for possível faça uma tela com dados estáticos com sugestões e depois que eu escolher pode ser removido."

---

## 1. Contexto

### 1.1 Estado atual (levantado no código)

- **Tokens de tema.** Ficam em `web/app/styles/tokens.css`, que é o **único arquivo autorizado a ter cores literais** (`test/no-literal-colors.spec.ts` varre `app/` e `components/`). Cada token é declarado uma única vez com `light-dark(claro, escuro)`. O tema efetivo vem de `color-scheme`: o sistema, por padrão, ou `:root[data-theme="light|dark"]`, quando o cookie `theme` está gravado. O cookie é lido no servidor em `app/layout.tsx`.
- **Fundo atual.** `--bg` vale `#EEF1F5` (cinza-azulado) no claro e `#151B26` (azul-ardósia) no escuro, conforme a rev. 5 do design (commit `7959f12`). É uma **cor sólida**, aplicada em `html` e `body` (`globals.css`).
- **Onde `--bg` aparece também como fundo opaco de componentes:**
  - faixa de abas fixa de `/entries` (`entries-tabs-bar.tsx`, classe `bg-bg`, sticky);
  - segunda linha da navbar no mobile (`app-header.tsx`, `bg-bg`);
  - contorno do segmented control e da lista de abas no mobile (`.segmented` e `.tablist` em `globals.css`).
- **Navbar.** Usa `--header-bg` translúcido (alfa 0.95) com `backdrop-blur`. Os testes calculam o contraste da navbar no **pior caso**, compondo sobre `--bg`, `--surface`, `--surface-2` e `--text`.
- **Superfícies.** `--surface` (cards, drawer, modal, tooltip), `--surface-2`, `--surface-active` e `--input-bg` ficam sobre `--bg`, separados por `--border` e `--shadow-card`.
- **Garantias automatizadas de contraste que serão afetadas:**
  - `lib/theme/tokens.spec.ts` fixa o **valor exato** de cada token (`EXPECTED_VALUES`), proíbe tokens extras e tokens com alfa fora de uma lista, só entende declarações `light-dark(cor, cor)` e confere pares obrigatórios com razões mínimas;
  - `lib/theme/contrast-pairs.ts` traz a matriz de produção com 11 pares que usam `--bg` (texto, texto secundário, link, erro, desabilitado, bordas, foco);
  - `e2e/dark-theme.pw.ts` exige luminância < 0.25 no `background-color` do `body` no escuro;
  - `e2e/a11y.pw.ts` audita as telas com axe nos dois temas.

### 1.2 O que muda

1. O fundo da página deixa de ser uma cor sólida e passa a ser um **gradiente** nos dois temas:
   - **Escuro:** escuro, mas não preto (ex.: azul-marinho, índigo, roxo profundo).
   - **Claro:** tom claro com cor (ex.: lavanda, azul-gelo, menta), não branco.
   - O visual pretendido é "futurista".
2. Antes de aplicar, uma **página temporária** mostra de 4 a 6 sugestões (presets) por tema, com dados estáticos e amostras de cards e texto por cima, para o usuário escolher.
3. Depois da escolha, só o preset escolhido de cada tema vira token. **A página e os presets não escolhidos são removidos.**

---

## 2. Linguagem ubíqua

| Termo | Definição |
|---|---|
| **Fundo da página** | Camada mais ao fundo da aplicação, atrás de navbar, faixas e cards. Hoje é o token `--bg`. |
| **Gradiente de fundo** | Fundo da página formado por duas ou mais cores (paradas) com transição contínua, linear e/ou radial. É estático, salvo decisão em contrário (B5). |
| **Parada (stop)** | Cada cor que compõe o gradiente. Para contraste, **toda parada conta como fundo possível** e vale o pior caso. |
| **Cor base do fundo** | Cor sólida que representa o fundo quando o gradiente não se aplica: faixas opacas, cálculo de contraste "médio", `background-color` lido pelos testes. Precisa estar dentro da faixa de cores do gradiente. |
| **Preset** | Sugestão nomeada de gradiente para um tema, com identificador estável (ex.: `dark-1`, `light-3`), nome descritivo e paradas. Existe só durante a escolha. |
| **Par de presets** | Combinação de um preset claro com um escuro. O usuário pode escolher cada tema separadamente (B3). |
| **Página de pré-visualização** | Rota temporária `/background-preview`, com dados estáticos, que mostra os presets com amostras de UI por cima. É removida depois da escolha. |
| **Amostra de UI** | Conjunto fixo de elementos renderizados sobre cada preset para avaliar contraste e legibilidade: título, texto, texto secundário, link, card (`--surface`) com valor monetário, badge, botão primário, botão secundário, campo, chip e aba ativa/inativa. |
| **Superfície** | Qualquer elemento com fundo `--surface`, `--surface-2`, `--surface-active`, `--input-bg` ou `--tooltip-bg`. Continua opaca, salvo decisão em contrário (B1). |
| **Faixa opaca** | Elemento sticky ou de largura total que hoje usa `--bg` sólido (faixa de abas, segunda linha da navbar no mobile). |
| **Pior caso de contraste** | Menor razão de contraste entre um primeiro plano e todas as paradas do gradiente, incluindo o resultado de composições translúcidas. |

---

## 3. Requisitos funcionais

### Fase A: pré-visualização e escolha

- **RF01** – Criar a rota temporária `/background-preview`, que exibe de 4 a 6 presets para o tema **escuro** e de 4 a 6 para o tema **claro**, todos com dados estáticos e sem chamar a API.
- **RF02** – Cada preset mostra o identificador estável (ex.: `dark-2`), um nome descritivo em pt-BR (ex.: "Índigo profundo") e a lista das suas paradas (cores), para que o usuário cite a escolha sem ambiguidade.
- **RF03** – Sobre cada preset é renderizada a mesma **amostra de UI** (ver Linguagem ubíqua), usando os componentes e classes reais do design system (`.card`, `.btn`, `.btn-primary`, `.chip`, `.field`, `.tab`, `Money`), e não imitações.
- **RF04** – Cada preset escuro é exibido em contexto de tema escuro e cada preset claro em contexto de tema claro, **independentemente do tema ativo** no navegador. Assim, os dois conjuntos podem ser comparados sem alternar o tema.
- **RF05** – Para cada preset, a página mostra o **pior caso de contraste** calculado de `--text`, `--text-muted` e `--accent` contra as paradas do preset, com indicação textual "AA ok" ou "abaixo de AA". Não se usa só a cor para indicar isso.
- **RF06** – Presets que não atingem AA no pior caso **não entram** na lista final apresentada ao usuário. Se um preset só passar com ajuste de outro token (ex.: `--text-muted`), a página indica o ajuste necessário. Ver P5.
- **RF07** – A página **não** aparece na navegação principal (`MainNav`) nem em nenhum outro link da aplicação. O acesso é só pela URL direta.
- **RF08** – A página tem um aviso visível no topo: "Página temporária de escolha do fundo. Será removida após a decisão."
- **RF09** – Tudo o que pertence à pré-visualização (rota, dados dos presets, estilos e testes) fica **isolado** em um único conjunto identificável. A remoção não pode exigir editar componentes de produção, com exceção de uma eventual entrada de exceção removível nos testes de cor literal (ver T1 em Perguntas técnicas).
- **RF10** – A escolha do usuário é comunicada fora da aplicação: ele informa os ids, por exemplo "claro `light-3`, escuro `dark-1`". A página não persiste escolha nenhuma (sem cookie, sem localStorage, sem API). Ver B2.

### Fase B: aplicação do preset escolhido

- **RF11** – O fundo da página passa a ser o gradiente do preset escolhido em cada tema, em todas as rotas do shell (`/entries`, `/cards`, `/dashboard`) e também nos estados de carregamento, erro (`error.tsx`) e erro global (`global-error.tsx`).
- **RF12** – O gradiente cobre toda a área visível e acompanha a rolagem sem faixas repetidas, cortes ou "emendas" visíveis em páginas longas. O comportamento exato (fixo na viewport ou rolando junto) é decisão técnica (TQ3).
- **RF13** – A troca de tema (botão sol/lua ou mudança do sistema) troca o gradiente na hora, sem flash do tema anterior no primeiro quadro, mantendo as garantias atuais (CA81, CA84 e CA87 da spec de lançamentos).
- **RF14** – As **faixas opacas** que hoje usam `--bg` sólido (faixa de abas fixa e segunda linha da navbar no mobile) não podem criar contraste visual abrupto com o gradiente. O tratamento visual é definido pelo ui-designer; o mecanismo, pelo architect.
- **RF15** – Superfícies (cards, drawer, modal, tooltip, inputs) continuam **opacas** e com os valores atuais, a menos que o contraste contra o novo fundo exija ajuste ou que B1 seja respondida de outra forma.
- **RF16** – As cores do gradiente final ficam **apenas** em `web/app/styles/tokens.css`, como tokens declarados com `light-dark()` e acompanhados das garantias de contraste existentes. A regra "única fonte de cores literais" (RF27 da spec de lançamentos) continua valendo.
- **RF17** – Depois de aplicar o preset, remover a página `/background-preview`, os dados de todos os presets (inclusive dos escolhidos, que passam a existir só como tokens), seus testes e qualquer exceção criada para ela.
- **RF18** – Atualizar `docs/design/design-system.md` para a rev. 6, com os novos tokens de fundo, a justificativa e as razões de contraste.

---

## 4. Requisitos não funcionais

- **RNF01 – Acessibilidade (WCAG 2.1 AA).**
  - Texto normal ≥ 4,5:1, texto grande ≥ 3:1 e elementos não textuais (bordas de controle, foco, indicadores) ≥ 3:1.
  - Tudo medido **no pior caso**, contra todas as paradas do gradiente e contra as composições translúcidas (navbar com `--header-bg` 0.95, scrim).
  - Os pares que hoje usam `--bg` (11 na matriz de produção) continuam passando.
- **RNF02 – Superfícies legíveis.** Os pares de texto sobre `--surface`, `--surface-2`, `--surface-active`, `--input-bg` e `--tooltip-bg` mantêm as razões mínimas atuais (`tokens.spec.ts`), salvo ajuste aprovado pelo ui-designer e registrado no design.
- **RNF03 – Separação fundo/card.** Cards continuam visualmente separados do fundo (borda `--border` + `--shadow-card`) em todas as regiões do gradiente, inclusive nas regiões cuja luminância fique próxima da de `--surface`.
- **RNF04 – Escuro não é preto.** Nenhuma parada do gradiente escuro é preta pura nem quase preta. Limite proposto: luminância relativa ≥ 0,005, igual à do `--bg` atual. O fundo efetivo continua escuro, abaixo do limite de luminância 0.25 de `dark-theme.pw.ts`.
- **RNF05 – Claro não é branco.** Nenhuma parada do gradiente claro é branca pura (`#FFFFFF`). O fundo precisa ter matiz perceptível e não pode se confundir com `--surface` (branco).
- **RNF06 – Movimento.** O gradiente é estático (B5). Se houver qualquer animação, ela só roda com `prefers-reduced-motion: no-preference` e é desligada durante a troca de tema (`data-theme-switching`).
- **RNF07 – Desempenho.** O fundo não pode degradar a rolagem nem a interação: sem repaints contínuos e sem imagem raster pesada. A pontuação Lighthouse de desempenho das telas principais não deve cair de forma perceptível. Valor de referência na TQ6.
- **RNF08 – Sem cor literal fora de `tokens.css`.** `test/no-literal-colors.spec.ts` continua verde. Exceção apenas na Fase A, conforme TQ1, e removida em RF17.
- **RNF09 – Testes.** Todo código novo tem teste: unitário para dados e cálculo de contraste dos presets, componente para a página de pré-visualização, e2e/axe para a página e para as telas com o fundo final. A suíte de tokens é atualizada para os novos valores, sem afrouxar nenhum mínimo.
- **RNF10 – Remoção limpa.** Depois de RF17, não sobra nenhuma referência a `background-preview` nem aos ids de preset no código, nos testes ou nas configurações. Só o histórico do git e esta spec.
- **RNF11 – Responsividade.** O gradiente funciona do mobile (360 px) ao desktop (≥ 1280 px), sem a área de destaque do gradiente ficar escondida atrás do conteúdo em telas pequenas.

---

## 5. Critérios de aceite

### Fase A: página de pré-visualização

**CA01 – Página lista presets dos dois temas**
- Given o web rodando
- When acesso `/background-preview` diretamente pela URL
- Then vejo uma seção "Tema escuro" com 4 a 6 presets e uma seção "Tema claro" com 4 a 6 presets
- And cada preset mostra id, nome e paradas.

**CA02 – Dados estáticos, sem API**
- Given a API fora do ar (ou o stub desligado)
- When acesso `/background-preview`
- Then a página carrega por completo, sem banner de erro nem requisição à API.

**CA03 – Amostra de UI em cada preset**
- Given a página de pré-visualização aberta
- When observo qualquer preset
- Then vejo sobre ele: título, parágrafo de texto, texto secundário, link, card com valor monetário formatado (ex.: "R$ 1.234,56"), badge, botão primário, botão secundário, campo, chip e aba ativa e inativa, todos com os estilos reais do design system.

**CA04 – Contexto de tema independente do tema ativo**
- Given o tema ativo da aplicação é claro
- When abro `/background-preview`
- Then os presets escuros são renderizados com os tokens do tema escuro (texto claro, cards escuros) e os claros com os tokens do tema claro
- And o mesmo vale com o tema ativo escuro.

**CA05 – Indicador de contraste**
- Given um preset
- When a página é renderizada
- Then aparece o pior caso de contraste de `--text`, `--text-muted` e `--accent` contra as paradas do preset, com o rótulo textual "AA ok" ou "abaixo de AA"
- And todos os presets apresentados como sugestão exibem "AA ok" para os três tokens.

**CA06 – Página não linkada**
- Given qualquer tela da aplicação (`/entries`, `/cards`, `/dashboard`)
- When inspeciono a navegação e os links da página
- Then não existe link para `/background-preview`.

**CA07 – Aviso de temporária**
- Given a página aberta
- Then o aviso "Página temporária de escolha do fundo. Será removida após a decisão." aparece no topo.

**CA08 – Acessibilidade da página**
- Given a página aberta em cada tema
- When rodo a auditoria axe
- Then não há violações de contraste nem de estrutura (títulos, landmarks).

**CA09 – Isolamento**
- Given o código da Fase A
- When listo os arquivos criados ou alterados por ela
- Then estão todos sob um único diretório de rota e um único módulo de dados (mais a eventual exceção de teste documentada na TQ1)
- And nenhum componente de produção importa nada desse conjunto.

### Fase B: fundo aplicado

**CA10 – Gradiente no tema escuro**
- Given o tema escuro ativo (por preferência salva ou pelo sistema)
- When abro `/entries`, `/cards` ou `/dashboard`
- Then o fundo da página é o gradiente do preset escuro escolhido
- And nenhuma parada é preta pura.

**CA11 – Gradiente no tema claro**
- Given o tema claro ativo
- When abro `/entries`, `/cards` ou `/dashboard`
- Then o fundo da página é o gradiente do preset claro escolhido
- And nenhuma parada é branca pura
- And os cards brancos continuam distinguíveis do fundo.

**CA12 – Troca de tema**
- Given uma tela aberta no tema claro
- When clico no botão de tema
- Then o fundo passa para o gradiente escuro no mesmo quadro, sem transição nem flash do gradiente anterior
- And recarregar a página mantém o gradiente do tema salvo desde o primeiro quadro.

**CA13 – Tema do sistema**
- Given nenhuma preferência salva e o sistema em modo escuro
- When o sistema muda para o modo claro com a página aberta
- Then o gradiente muda ao vivo para o do tema claro.

**CA14 – Contraste no pior caso (tokens)**
- Given os novos tokens de fundo
- When a suíte `lib/theme/tokens.spec.ts` roda
- Then cada par que hoje usa `--bg` passa contra **todas** as paradas do gradiente, nos dois temas, com os mínimos da categoria (4,5 / 3)
- And a navbar (`--header-bg` 0.95) passa no pior caso composto sobre todas as paradas.

**CA15 – Contraste no navegador**
- Given cada tela principal, em cada tema, nos estados já auditados (dados, vazio, erro, atualizando, drawer aberto)
- When rodo `a11y.pw.ts` e `dark-theme.pw.ts`
- Then não há violação de contraste
- And o `body` no escuro continua com luminância de fundo < 0.25.

**CA16 – Faixas opacas**
- Given `/entries` rolada para baixo, com a faixa de abas grudada abaixo da navbar
- When observo a faixa e a segunda linha da navbar no mobile
- Then não aparece uma barra de cor sólida destoante do gradiente, conforme o tratamento definido no design rev. 6
- And o texto e as abas da faixa mantêm AA.

**CA17 – Páginas longas e rolagem**
- Given uma lista longa em `/entries` (ex.: 50 itens)
- When rolo até o fim
- Then o fundo não mostra faixas repetidas, cortes, nem área sem gradiente.

**CA18 – Estados de carregamento e erro**
- Given uma rota em carregamento (`loading.tsx`) ou em erro (`error.tsx` / `global-error.tsx`)
- When ela é exibida
- Then o fundo é o mesmo gradiente do tema efetivo.

**CA19 – Movimento reduzido**
- Given `prefers-reduced-motion: reduce`
- When qualquer tela é exibida
- Then o fundo não tem animação. Se B5 for "estático", também não há animação com `no-preference`.

**CA20 – Sem cor literal**
- Given o código final
- When `test/no-literal-colors.spec.ts` roda
- Then passa sem nenhuma exceção ligada a esta feature.

### Remoção

**CA21 – Página removida**
- Given o preset aplicado e aprovado pelo usuário
- When acesso `/background-preview`
- Then recebo a página 404 padrão do Next.

**CA22 – Nenhum resíduo**
- Given o repositório depois da remoção
- When procuro por `background-preview` e pelos ids de preset (`dark-1`…`dark-6`, `light-1`…`light-6`) em `web/`
- Then não há ocorrências em código, testes ou configuração.

---

## 6. Fora de escopo

- Qualquer mudança em `api/`, no Prisma ou no banco.
- Seletor de fundo para o usuário final em produção (escolha de tema/preset persistida por usuário). A escolha é única, feita agora pelo dono do produto.
- Novos temas além de claro e escuro (ex.: "alto contraste", "tema automático por horário").
- Redesenho de componentes (cards, botões, navbar, gráficos) além do estritamente necessário para manter contraste e coesão com o novo fundo.
- Mudança nas cores semânticas (receita, despesa, status) e nas séries dos gráficos, salvo se algum par deixar de atingir AA por causa do fundo.
- Imagens, ilustrações, texturas raster ou vídeos de fundo.
- Efeitos de vidro (glassmorphism) nos cards, a menos que B1 seja respondida de outra forma.

---

## 7. Riscos

| # | Risco | Mitigação sugerida |
|---|---|---|
| R1 | **Contraste no pior caso.** Gradientes mais coloridos aumentam a faixa de luminância do fundo. Uma parada mais clara no escuro, ou mais saturada no claro, pode derrubar `--text-muted`, `--accent`, `--text-disabled` e `--border-strong` abaixo de AA. | Pior caso calculado por parada (RF05, CA14); ajustar paradas antes de mexer em tokens de texto. |
| R2 | **Gradiente não cabe em `light-dark()`.** `light-dark()` só aceita cores, e o parser de `tokens.spec.ts` só reconhece `light-dark(cor, cor)`. Um token "gradiente" não seria validado pela suíte atual. | Decisão técnica TQ2, com cores das paradas como tokens validáveis. |
| R3 | **Suíte de tokens rígida.** `tokens.spec.ts` fixa valores exatos, proíbe tokens extras e limita os tokens com alfa a uma lista. Qualquer novo token quebra a suíte. | O tester atualiza a suíte antes (fase red), sem afrouxar os mínimos de contraste. |
| R4 | **Faixas opacas.** A faixa de abas sticky, a segunda linha da navbar no mobile, `.segmented` e `.tablist` usam `--bg` sólido. Sobre um gradiente, viram barras de cor chapada. | Tratamento no design rev. 6 (RF14, CA16). |
| R5 | **Página de pré-visualização viola a regra de cor literal.** Os presets precisam de cores literais fora de `tokens.css`, o que quebra `no-literal-colors.spec.ts`. | Exceção isolada e removível (TQ1). |
| R6 | **Resíduo após a escolha.** A página temporária pode ficar esquecida no código ou ir para produção. | Isolamento (RF09, CA09), tarefa explícita de remoção (T11) e CA21/CA22. |
| R7 | **Banding e desempenho.** Gradientes grandes podem mostrar "degraus" de cor em telas de 8 bits. `background-attachment: fixed` ou camadas com blur podem custar repaint no mobile. | RNF07; validação em mobile real ou emulado. |
| R8 | **Testes visuais leem `background-color`.** `dark-theme.pw.ts` lê a cor computada do `body`. Com gradiente em `background-image`, o teste continua medindo só a cor base e pode passar sem refletir o que o usuário vê. | Garantir que a cor base esteja dentro da faixa do gradiente (TQ5). |
| R9 | **Subjetividade de "futurista".** O usuário pode não gostar de nenhum preset e pedir uma nova rodada. | A página aceita uma segunda rodada de presets sem mudar a estrutura (premissa PA5). |

---

## 8. Perguntas em aberto

### Bloqueantes (mudam a regra de negócio ou o resultado visível)

| # | Pergunta | Resposta padrão sugerida |
|---|---|---|
| **B1** | O gradiente vale **só para o fundo da página** ou também para superfícies (cards translúcidos/vidro, navbar com mais transparência, faixa de abas)? | Só o fundo da página. Cards, drawer, modal, tooltip e inputs continuam opacos, com os valores atuais. A navbar mantém o alfa 0.95 atual. Faixas opacas recebem um tratamento coerente (RF14), sem vidro. |
| **B2** | Como o usuário registra a escolha? Só informando os ids (ex.: "light-3 + dark-1") ou com um botão na própria página que aplique o preset na aplicação inteira para testar nas telas reais? | Informar os ids na conversa. A página não persiste nada e não altera as telas reais (RF10). Para testar nas telas reais, o próximo passo seria uma rodada extra de ajuste depois de aplicado. |
| **B3** | O usuário escolhe os temas **de forma independente** (qualquer claro com qualquer escuro) ou entre **pares prontos** (claro e escuro com a mesma família de cor)? | Independente. A página agrupa os presets por família de cor (ex.: "índigo", "ciano", "violeta") para facilitar escolher um par coerente, mas qualquer combinação é aceita. |
| **B4** | A página de pré-visualização pode ficar acessível em **produção** (por URL direta) até ser removida, ou só em ambiente de desenvolvimento? | Só em desenvolvimento: fora de dev, retorna 404. A página nunca chega a `main`, porque é removida na mesma branch antes do merge. |
| **B5** | "Futurista" inclui **movimento** (gradiente animado, brilho pulsante) ou só cores e formas (linear + brilhos radiais estáticos)? | Estático. Gradientes lineares e/ou radiais com "brilhos" suaves, sem animação. Nenhum preset animado. |

### Técnicas (decisão do architect)

| # | Pergunta | Resposta padrão sugerida |
|---|---|---|
| **TQ1** | Onde ficam as cores literais dos presets durante a Fase A, já que `no-literal-colors.spec.ts` só permite `tokens.css`? | Um único módulo de dados da pré-visualização dentro da rota temporária, adicionado a uma lista de exceções explícita no teste com o comentário "remover junto com /background-preview". O próprio teste falha se a exceção apontar para um arquivo inexistente, o que força a limpeza. |
| **TQ2** | Como representar o gradiente final nos tokens, se `light-dark()` não aceita gradientes? | Cada parada vira um token de cor `light-dark(claro, escuro)` (ex.: `--bg-stop-1..n`), validável pela suíte. O gradiente é composto em CSS a partir desses tokens. `--bg` continua existindo como cor base. |
| **TQ3** | O gradiente fica fixo na viewport ou rola com o conteúdo? Em que elemento é aplicado (`html`, `body`, pseudo-elemento)? | Fixo na viewport (sem emendas em páginas longas), aplicado de forma que não gere repaint contínuo no mobile. A técnica fica a critério do architect. |
| **TQ4** | Onde fica a rota temporária: dentro do grupo `(app)` (com navbar real) ou fora dele (sem shell)? | Dentro de `(app)`, para avaliar o fundo com a navbar real, mas sem link no `MainNav`. |
| **TQ5** | Como as suítes de contraste (`tokens.spec.ts`, `contrast-pairs.ts`, `e2e/contrast.ts`) passam a tratar o fundo? | Todo par cujo `bg` é `--bg` passa a ser verificado contra cada parada (pior caso). `HEADER_UNDER` inclui as paradas. A cor base fica dentro da faixa de luminância das paradas. |
| **TQ6** | Qual referência de desempenho adotar para RNF07? | Lighthouse mobile de `/entries` antes e depois, com queda de no máximo 5 pontos e sem aumento de CLS. |
| **TQ7** | Como renderizar presets em contexto de tema forçado (RF04) sem mexer no `data-theme` da raiz? | Contêiner com `color-scheme` próprio por seção (claro/escuro), aproveitando que os tokens usam `light-dark()`. |

### Premissas adotadas

- **PA1** – Os valores atuais de `--surface`, `--surface-2`, `--surface-active`, `--input-bg`, `--tooltip-bg`, `--text`, `--text-muted` e das cores semânticas só mudam se algum par falhar contra o novo fundo. Qualquer ajuste é registrado no design rev. 6.
- **PA2** – Cada preset tem de 2 a 4 paradas e pode combinar um gradiente linear com até dois brilhos radiais suaves. Não há imagem nem textura.
- **PA3** – O ui-designer propõe as famílias de cor dos presets. Direções iniciais, não vinculantes:
  - escuro: "índigo profundo", "azul-marinho → roxo", "petróleo/ciano noturno", "violeta → magenta escuro", "grafite azulado com brilho ciano";
  - claro: "lavanda → azul-gelo", "menta → céu", "pêssego → lilás claro", "azul-névoa", "aurora suave (ciano/rosa/lilás claros)".
- **PA4** – A cor primária (`--primary*`) e o accent (`--accent`) são as âncoras de matiz do visual "futurista" (índigo e ciano). Os presets harmonizam com elas.
- **PA5** – Se o usuário rejeitar todos os presets, nova rodada de 4 a 6 presets na mesma página, sem mudar a estrutura (até 2 rodadas antes de reavaliar o pedido).
- **PA6** – A remoção da página acontece na mesma branch, antes do merge em `main`.
- **PA7** – Datas e valores na amostra seguem as decisões do projeto: valores em `Money` com string decimal, exibição pt-BR e America/Sao_Paulo.
- **PA8** – Os estados de carregamento e erro usam o mesmo fundo do tema (CA18), sem fundo especial.

---

## 9. Tarefas (ordenadas)

Todas `[web]`. Nenhuma tarefa `[api]` ou `[db]`.

### Fase A: pré-visualização (antes da escolha)

1. **[web] T1 – Design dos presets.** O ui-designer define de 4 a 6 presets por tema, com id, nome, família de cor e paradas, e calcula o pior caso de `--text`, `--text-muted`, `--accent`, `--border-strong` e `--focus-color` contra cada parada, descartando os que não passam AA. Também define a composição da amostra de UI. Registra em um rascunho da rev. 6 de `docs/design/design-system.md`.
2. **[web] T2 – Testes (red) da pré-visualização.**
   - Unitário: dados dos presets (contagem 4–6 por tema, ids únicos e estáveis, nenhuma parada preta ou branca pura, pior caso ≥ AA para os tokens de texto).
   - Componente: renderiza as duas seções, amostra completa, indicador "AA ok", aviso de temporária.
   - Teste garantindo que nenhum arquivo de produção importa o módulo da pré-visualização.
   - CA01–CA07 e CA09.
3. **[web] T3 – Módulo de dados estáticos dos presets**, isolado, com a exceção de cor literal conforme TQ1.
4. **[web] T4 – Rota `/background-preview`.** Seções por tema com contexto de tema forçado (TQ7), amostra de UI com componentes reais, indicador de contraste e aviso. Restrição de ambiente conforme B4. Sem link na navegação.
5. **[web] T5 – e2e/axe da pré-visualização** nos dois temas (CA08), mais a verificação de ausência de link (CA06).
6. **[web] T6 – Verificação e entrega para escolha.** Tester e code-reviewer rodam sobre a Fase A. O usuário acessa a página e informa os ids escolhidos. **Gate: aprovação do usuário.**

### Fase B: aplicação (depois da escolha)

7. **[web] T7 – Design final.** O ui-designer converte os presets escolhidos em tokens (paradas + cor base), define o tratamento das faixas opacas (RF14) e registra as razões de contraste finais na rev. 6 do design.
8. **[web] T8 – Testes (red) do fundo final.**
   - Atualizar `lib/theme/tokens.spec.ts`: novos `EXPECTED_VALUES`, pares com `--bg` verificados contra cada parada, `HEADER_UNDER` com as paradas, regra "escuro não preto, claro não branco".
   - Ajustar `e2e/dark-theme.pw.ts`, `e2e/contrast.ts` e `a11y.pw.ts` para o novo fundo.
   - Escrever o e2e de rolagem longa (CA17) e de loading/erro (CA18).
9. **[web] T9 – Tokens do fundo** em `web/app/styles/tokens.css` e matriz `lib/theme/contrast-pairs.ts` atualizada (CA14).
10. **[web] T10 – Aplicação do gradiente** no fundo da página e tratamento das faixas opacas, do `.segmented` e do `.tablist` (CA10–CA13, CA16, CA17, CA19).
11. **[web] T11 – Remoção da pré-visualização.** Apagar a rota, o módulo de dados, os testes da Fase A e a exceção em `no-literal-colors.spec.ts`. Conferir CA20–CA22.
12. **[web] T12 – Verificação final.** `npm test`, cobertura, lint, tsc, build e Playwright + axe nos dois temas. Comparação de desempenho (TQ6).
13. **[web] T13 – Documentação.** `docs/design/design-system.md` rev. 6 (fundo em gradiente, tokens novos, razões de contraste), entrada no `CHANGELOG.md` e registro em `docs/runs/`.
