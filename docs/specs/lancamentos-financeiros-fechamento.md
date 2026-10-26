# Spec de fechamento: Lançamentos financeiros

**Impacto em UI: sim.** Não há telas nem fluxos novos. O impacto se resume a: (a) verificar e revisar os follow-ups de UX ainda não commitados, já previstos no design; (b) corrigir na UI o que a execução dos testes Playwright + axe apontar. O ui-designer só entra se a bloqueante B1 mudar o comportamento atual.

- Data: 2026-10-25
- Branch: `feature/finance`
- Spec de origem: `docs/specs/lancamentos-financeiros.md` (rev. 3). Todos os RF, RNF e CA citados aqui estão nela.
- Referências: `docs/adr/0001-lancamentos-financeiros.md` (§9.5, §11.5, §15), `docs/design/lancamentos-financeiros.md` (§2.2, §12), `docs/runs/lancamentos-financeiros.md` ("Pendências conhecidas", "Estado final dos testes").

## 1. Contexto

A feature foi especificada, implementada e aprovada pelo code-reviewer. Faltam três coisas para dar a entrega como concluída:

1. **Trabalho não commitado e não verificado.** Os follow-ups de UX abaixo estão só no working tree e não passaram nem pelo tester (verificação) nem pelo code-reviewer:
   - eixo Y fixo no gráfico de barras estreito (`monthly-chart.tsx`, `lib/dashboard/chart-data.ts`);
   - destaque de cerca de 2 s da linha ou do card recém-criado (`entry-drawer-context.tsx`, `expenses-list.tsx`, `income-panel.tsx`, `lib/hooks/`);
   - combobox ARIA de categoria com a opção `Usar "<texto>"` (`components/ui/combobox.tsx`);
   - animações dos gráficos condicionadas a `prefers-reduced-motion` e destaque do donut pela legenda (`category-donut.tsx`);
   - e2e novos ou alterados (`theme.pw.ts`, com o CA84 reescrito para clicar no botão de tema; `a11y.pw.ts`; `entries.pw.ts`; `support.ts`).

   Com esse trabalho, o design §12 ficou só com o desvio nº 1. Os demais saíram por terem sido implementados.
2. **Nada do Playwright + axe foi executado** (mais de 63 testes). No WSL faltam `libnss3`, `libnspr4` e `libasound2`, e não há acesso root.
3. **A cobertura de alguns critérios de UI é só indireta, ou nem isso** (ver Gaps).

## 2. Linguagem ubíqua (complementar à spec de origem)

| Termo | Definição |
|---|---|
| **Destaque de recém-criado** | Realce estático (fundo, borda de 2 px e selo "Novo") de cerca de 2 s na linha ou no card do lançamento que acabou de ser criado, sem animação. |
| **Estado verificável** | Combinação de tela, aba, estado (dados, vazio, erro, atualizando, com seleção, aberto, com erro) e tema que a suíte axe precisa auditar (CA82). |
| **Stub da API** | Servidor `web/e2e/stub-api/server.mjs`, que responde no lugar da API real durante os e2e do web. |
| **Cobertura indireta** | O critério é garantido por testes de tokens e pares de contraste (`lib/theme/*.spec.ts`, `test/no-literal-colors.spec.ts`), mas nenhum teste exercita a tela real no navegador. |

## 3. Gaps encontrados

Checagem por amostragem dos RF/CA da rev. 3 contra `api/` e `web/`. Itens conferidos e **atendidos**, sem ação:
- rotas sem estorno (CA28);
- datas da fatura por `MAX` (B9);
- índices T12;
- banners de 404/422 (RF24);
- chip "Fatura nov/26" (RF20);
- atalho de `/cards` para o mês atual filtrado (DR8);
- tabelas alternativas dos gráficos (RNF09);
- tema acompanhando o sistema ao vivo (CA79);
- animações de drawer, skeleton e spinner atrás de `prefers-reduced-motion` (CA87).

| # | Gap | Critérios afetados |
|---|---|---|
| G1 | Os follow-ups de UX listados na seção 1 não estão commitados e não passaram por tester nem code-reviewer. Não se sabe se `npm test`, a cobertura, o lint, o tsc e o build do web continuam verdes com eles. | RNF08, RNF09, CA87, CA74 (feedback após criar), RF23 (autocomplete) |
| G2 | A suíte Playwright + axe nunca foi executada. Todos os CA que dependem dela estão sem evidência. | CA44, CA47, CA53, CA66, CA68-CA82, CA84, CA87, RNF11 |
| G3 | `a11y.pw.ts` não audita vários estados que o CA82 exige: "atualizando"; banners de 404/422; drawer com o painel "+ Novo cartão" aberto; drawer de cartão (criar e editar, com erro); modal de confirmação (lote e "Pagar fatura"); folha de filtros mobile; toasts; dashboard com tooltip aberto e com a tabela alternativa visível. | CA82, RNF11 |
| G4 | O CA83 (botões em todos os estados × 2 temas) só tem cobertura indireta. Nenhum teste no navegador força hover, foco, pressionado, carregando e desabilitado. | CA83 |
| G5 | O CA85 só tem cobertura indireta. Nenhum teste no tema escuro confere a ausência de transparência que derrube o contraste, nem o estado "atualizando" acima de AA. | CA85 |
| G6 | O CA86 está parcial. Nenhum e2e alterna o tema com o dashboard e o formulário abertos e confere eixos, grade, legenda, tooltip, cursor e séries, nem o `color-scheme` efetivo dos controles nativos (data, mês, select, scrollbar). | CA86 |
| G7 | Divergência entre spec e design. RF27 e CA84 pedem alternar o tema "com drawer, atalho de novo cartão ou modal aberto". O design §2.2, que está implementado e testado em `theme.pw.ts`, deixa o botão inerte sob o scrim; nesse estado, o tema só muda por mudança do sistema. Com uma preferência salva, não há como trocar o tema com um diálogo aberto. O desvio não está registrado em nenhuma seção de desvios aceitos. | RF27, CA84 |
| G8 | O RNF06 (p95 < 300 ms com 100 mil lançamentos e 20 cartões) nunca foi medido. Não há seed de volume nem medição em nenhuma suíte. | RNF06 |
| G9 | Nenhum teste integra web e API real. Os e2e do web rodam contra o stub, e o stub não implementa `PUT /api/cards/:id`, de modo que a edição de cartão (RF25) não tem e2e. O stub também calcula o mês de referência de forma fixa (`"2026-12"`), não pela regra real. | RF03, RF25, CA05 (ponta a ponta), CA77 |
| G10 | Documentação desatualizada: (a) o cabeçalho da spec rev. 3 diz que ADR e design refletem a rev. 2; (b) B8 e B9 continuam em "Perguntas em aberto" embora aprovadas; (c) "Pendências conhecidas" do registro de execução descrevem o CA84 como "emula a mídia", o que deixou de valer; (d) o `CHANGELOG.md` `[Unreleased]` não cita os follow-ups de UX; (e) o README do web não explica como rodar o Playwright sem root. | — |
| G11 | Não existe pipeline de CI. A verificação automatizada de contraste (RNF11, T16 da spec de origem) não roda em lugar nenhum de forma recorrente. | RNF11 |

## 4. Requisitos de fechamento

### Funcionais

- **RFF01 - Follow-ups de UX verificados.** Os follow-ups da seção 1 seguem o design e não quebram os CA já atendidos. O destaque de recém-criado é estático, tem cerca de 2 s e não depende de cor como único sinal (RNF09). O combobox segue ARIA 1.2 e mantém o B1 (case-insensitive, grafia existente). Com `reduce`, os gráficos não animam (CA87).
- **RFF02 - Suíte Playwright + axe executada** nos temas claro e escuro, sem falhas e sem violações (CA82, RNF11). Se aparecerem falhas, a UI é corrigida, não o teste (salvo teste comprovadamente errado em relação à spec ou ao design).
- **RFF03 - Cobertura direta de CA82, CA83, CA85 e CA86** no navegador real, nos estados listados em G3 a G6.
- **RFF04 - CA84 coerente com a decisão B1** (ver seção 7), com o desvio registrado se for o caso.
- **RFF05 - Edição de cartão coberta de ponta a ponta** no web (RF25), com o aviso de não retroatividade.

### Não funcionais

- **RNFF01 - RNF06 medido.** p95 dos endpoints de listagem paginada, subtotais, resumo, faturas do mês, pagar fatura e dashboard, com 100 mil lançamentos e 20 cartões, em ambiente local. O resultado fica registrado.
- **RNFF02 - Reprodutibilidade.** Rodar o Playwright no WSL sem root fica documentado e repetível.
- **RNFF03 - Gates.** As suítes do estado final (api: unit, cobertura, int, e2e, lint, typecheck, build; web: unit, cobertura, lint, tsc, build e agora Playwright) ficam verdes com o trabalho commitado. A cobertura continua >= 80% em domain/application e o web não cai abaixo dos números do registro de execução.

## 5. Critérios de aceite

**CAF01 - Follow-ups verificados (RFF01)**
- Given o working tree com os follow-ups da seção 1
- When o tester roda `npm test`, cobertura, lint, tsc e build do web, e o code-reviewer revisa os arquivos
- Then tudo passa, o reviewer não aponta item 🔴 e os 🟡 são corrigidos antes do commit.

**CAF02 - Destaque de recém-criado (RFF01, CA74)**
- Given o drawer "Novo lançamento" com dados válidos de um lançamento do mês selecionado
- When o usuário salva
- Then a linha (desktop) ou o card (mobile) do lançamento aparece com fundo, borda e selo "Novo" por cerca de 2 s, sem animação, inclusive com `prefers-reduced-motion: reduce`, e o selo é anunciado como "lançamento recém-criado". Um lançamento de outro mês não gera destaque.

**CAF03 - Combobox de categoria (RFF01, RF23, B1)**
- Given as categorias "Alimentação" e "Moradia" e o campo Categoria focado
- When o usuário digita "alim", depois "Lazer" e navega com setas, Enter e Esc
- Then "alim" sugere "Alimentação"; "Lazer" oferece `Usar "Lazer"`; o primeiro Esc fecha só a lista e o segundo fecha o drawer; a criação com "  alimentação " grava "Alimentação" (CA20).

**CAF04 - Gráficos com movimento reduzido e eixo fixo (RFF01, CA87, DR3)**
- Given o dashboard com dados e viewport de 360 px
- When `prefers-reduced-motion: reduce` está ativo e o usuário rola o gráfico de barras e passa pela legenda do donut
- Then barras, linhas e donut não animam, o eixo Y continua visível durante a rolagem horizontal com os 12 meses disponíveis, e o destaque de categoria pela legenda funciona por teclado e ponteiro sem depender só de cor.

**CAF05 - Playwright executado (RFF02, CA82, RNF11)**
- Given o ambiente com as bibliotecas do Chromium disponíveis (com ou sem root)
- When o tester roda `npx playwright test` no `web/`
- Then todos os testes passam, o número de testes executados é registrado no registro de execução, e não há violação axe em nenhum tema.

**CAF06 - Estados que faltavam no axe (RFF03, CA82)**
- Given cada estado listado em G3
- When auditado com axe nos temas claro e escuro
- Then não há violação de contraste nem `incomplete` de color-contrast fora da allowlist já existente.

**CAF07 - Botões em todos os estados (RFF03, CA83)**
- Given botões primário, secundário, terciário, ícone (inclusive o alternador), abas e paginação presentes nas telas reais
- When exibidos em padrão, hover, foco, pressionado, carregando e desabilitado, nos dois temas
- Then texto >= 4,5:1 e ícone, borda e estado desabilitado >= 3:1 contra o fundo do botão e o fundo ao redor, verificados no navegador.

**CAF08 - Tema escuro sem tons lavados (RFF03, CA85)**
- Given o tema escuro e o estado "atualizando" (transição de mês ou de filtro) na tela de lançamentos e no dashboard
- When auditado
- Then nenhum texto fica abaixo de AA por opacidade ou scrim, e superfícies, inputs, tooltips, toasts, menus, skeletons, abas e blocos de fatura usam tokens do tema escuro.

**CAF09 - Gráficos e controles nativos após alternar (RFF03, CA86)**
- Given o dashboard aberto e, em outra verificação, o formulário de lançamento aberto
- When o tema é alternado (pelo botão, no dashboard; pelo meio definido em B1, com o formulário aberto)
- Then eixos, grade, legenda, tooltip, cursor e séries passam às cores do novo tema com AA, e `color-scheme` efetivo de inputs de data e mês, selects e scrollbar acompanha o tema ativo.

**CAF10 - CA84 conforme B1 (RFF04)**
- Given a resposta de B1
- When a suíte `theme.pw.ts` roda
- Then o CA84 é verificado do jeito decidido, e, se prevalecer o comportamento atual, o desvio fica registrado no design §12 e numa linha do histórico da spec de origem.

**CAF11 - Edição de cartão de ponta a ponta (RFF05, RF25, CA05)**
- Given o cartão "Nubank" (fecha 25, vence 5) em `/cards`
- When o usuário edita para fecha 20 e vence 28 e salva
- Then a lista mostra "Fecha dia 20 · Vence dia 28", o drawer exibia o aviso de que a mudança só vale para novos lançamentos, e um nome duplicado mostra o 409 inline.

**CAF12 - Desempenho medido (RNFF01, RNF06)**
- Given um banco local com 100 mil lançamentos distribuídos em pelo menos 12 meses e 20 cartões
- When cada endpoint do RNF06 é chamado repetidamente
- Then o p95 de cada um é registrado e fica < 300 ms; o que passar do limite vira gap explícito (ver B2).

**CAF13 - Documentação coerente (G10)**
- Given o fechamento concluído
- When o doc-writer atualiza os documentos
- Then o registro de execução tem um novo "Estado final dos testes" com o Playwright, as pendências resolvidas ficam marcadas como resolvidas, o CHANGELOG cita os follow-ups, e o README do web explica como rodar o Playwright sem root.

## 6. Fora de escopo

- Qualquer regra de negócio nova ou alterada (pagamentos, mês de referência, faturas, totais). Todas as decisões B1-B14 e DR1-DR8 da spec de origem ficam como estão.
- Itens da seção 7 da spec de origem (edição e exclusão de lançamentos, estorno, recorrência, parcelamento, "a receber" etc.).
- Telas ou componentes novos além do que está no design.
- Criar pipeline de CI (G11). Fica registrado como pendência e recomendação, salvo decisão contrária em T3.
- Otimizar desempenho além do RNF06. Se a medição passar do limite, a otimização vira uma tarefa nova, decidida em B2.
- Teste de carga concorrente ou de longa duração.

## 7. Perguntas em aberto

### Bloqueantes (mudam regra de negócio)

**B1 - Trocar o tema com drawer ou modal aberto (G7)**
RF27 e CA84 pedem alternar o tema com drawer, atalho de novo cartão ou modal aberto. O comportamento aprovado no design §2.2, e já implementado, deixa o botão inerte sob o scrim. Com uma preferência salva, o usuário não consegue trocar o tema com um diálogo aberto.
*Resposta padrão sugerida:* manter o design §2.2 (fundo inerte é o comportamento correto de diálogo modal, D7). O CA84 passa a ser lido como "a troca de tema, quando ocorre com um diálogo aberto (mudança do sistema sem preferência salva), preserva estado e cores", e isso fica registrado como desvio aceito no design §12 e no histórico da spec de origem.

**B2 - O RNF06 bloqueia o fechamento?**
Se algum endpoint passar de 300 ms (p95) na medição, a feature fica aberta até otimizar, ou fecha com o gap registrado?
*Resposta padrão sugerida:* bloqueia só se algum endpoint passar de 300 ms. Nesse caso, a otimização entra neste fechamento como tarefa [db]/[api] adicional. Se todos passarem, só se registra o resultado.

### Técnicas (decisão do architect)

- **T1 - Chromium sem root no WSL.** *Sugestão:* `apt-get download libnss3 libnspr4 libasound2` (e dependências que faltarem), `dpkg -x` num diretório local fora do repositório e `LD_LIBRARY_PATH` só para o processo do Playwright, com um script documentado. A alternativa é a imagem Docker oficial do Playwright, se o Docker estiver disponível.
- **T2 - Como forçar estados de botão no CA83.** *Sugestão:* CDP `CSS.forcePseudoState` (hover, focus-visible, active) em telas reais, mais cenários do stub que mantêm ações em "carregando" e desabilitado, com axe e cálculo de contraste do fundo efetivo.
- **T3 - CI.** *Sugestão:* fora deste fechamento (ver Fora de escopo). Registrar os comandos e a recomendação no README.
- **T4 - Seed e medição do RNF06.** *Sugestão:* script de seed em `api/` (fora de `src/`) com `generate_series` e medição com autocannon ou um script com `performance.now()` contra a API local. Os resultados ficam no registro de execução, não como teste automatizado recorrente.
- **T5 - Stub x API real (G9).** *Sugestão:* completar o stub com `PUT /api/cards/:id` e com a regra real do mês de referência, ou importar a regra do domínio. Somar um smoke manual documentado (API real + web) cobrindo criar despesa no cartão, pagar fatura e conferir o dashboard.

## 8. Premissas adotadas

- **PF01** Os follow-ups de UX não commitados fazem parte desta feature e serão commitados na própria `feature/finance`, depois da verificação e da revisão.
- **PF02** As dependências de sistema baixadas para o Chromium não são versionadas no repositório.
- **PF03** Falha em e2e ou axe é tratada como defeito da UI, a menos que o teste contradiga a spec ou o design. Nesse caso, quem corrige o teste é o tester, não o frontend-dev.
- **PF04** A allowlist atual de `incomplete` do axe (navbar com `--header-bg`) continua válida e não pode crescer sem justificativa registrada.
- **PF05** O destaque de recém-criado não se aplica a pagamentos (só à criação).
- **PF06** A medição do RNF06 usa o mesmo hardware local e o Postgres 17 do `docker-compose.yml`.
- **PF07** Nenhuma mudança de contrato HTTP é esperada. Se a otimização do B2 exigir alguma, ela volta ao architect.

## 9. Riscos

- **RF1** Rodar o Playwright pela primeira vez pode revelar muitas falhas acumuladas (seletores, timing, contraste real diferente dos pares calculados), aumentando o esforço do fechamento.
- **RF2** Bibliotecas extraídas com `dpkg -x` podem exigir dependências transitivas adicionais ou divergir das versões do sistema.
- **RF3** O stub pode mascarar divergências de contrato com a API real (G9).
- **RF4** O RNF06 pode falhar no filtro por categoria: o índice de categoria é `(category_key, created_at, id)`, não `(category_key, reference_month)` como sugeria a T12. É hipótese, a confirmar na medição.
- **RF5** Forçar pseudo-estados via CDP depende do Chromium e não cobre outros navegadores.

## 10. Tarefas (ordenadas)

### Verificação do trabalho pendente
1. [test] Rodar no working tree atual `npm test`, cobertura, lint, tsc e build do web, e as suítes da api (unit, int, e2e). Corrigir testes que divirjam do design (CAF01).
2. [web] Corrigir o que a tarefa 1 apontar nos follow-ups (destaque, combobox, gráficos, reduced-motion) (CAF02-CAF04).
3. [test] Conferir se os specs novos (`combobox.spec.tsx`, `recent-highlight.spec.tsx`, `charts-motion.spec.tsx`, `reduced-motion.spec.tsx`, `chart-data.spec.ts`) cobrem CAF02-CAF04 e completar se faltar.

### Playwright
4. [test] Viabilizar o Chromium sem root conforme T1, com script e passo a passo (RNFF02).
5. [test] Executar a suíte Playwright + axe completa e registrar o resultado (CAF05).
6. [web] Corrigir na UI as falhas da tarefa 5 (RFF02).

### Cobertura que faltava
7. [test] Completar o stub da API: `PUT /api/cards/:id`, cenários de "atualizando" (resposta lenta), ação em "carregando" e regra real do mês de referência (T5).
8. [test] Ampliar `a11y.pw.ts` com os estados de G3 nos dois temas (CAF06).
9. [test] e2e de botões em todos os estados × 2 temas (CAF07, T2).
10. [test] e2e do tema escuro sem tons lavados, incluindo o estado "atualizando" (CAF08).
11. [test] e2e de gráficos e controles nativos após alternar o tema (CAF09).
12. [test] Ajustar o CA84 em `theme.pw.ts` conforme a resposta de B1 (CAF10).
13. [test] e2e de edição de cartão em `/cards` (CAF11).
14. [web] Corrigir na UI o que as tarefas 8-13 apontarem.

### Desempenho
15. [db] Seed de volume (100 mil lançamentos, 20 cartões, pelo menos 12 meses) para ambiente local (T4).
16. [test] Medir o p95 dos endpoints do RNF06 e registrar (CAF12).
17. [db] Só se a tarefa 16 passar do limite e B2 confirmar: ajustar índices ou queries agregadas.
18. [api] Só se a tarefa 17 exigir: ajustar os read models correspondentes, sem mudar o contrato (PF07).

### Fechamento
19. [test] Rodada final de todas as suítes (api e web, inclusive Playwright) com o trabalho commitado (RNFF03).
20. Code-reviewer: revisar os follow-ups de UX, as correções e os testes novos.
21. Doc-writer (CAF13, G10): atualizar o registro de execução (novo estado final, pendências resolvidas, CA84), o CHANGELOG `[Unreleased]`, o README do web (Playwright sem root), o design §12 (desvio de B1, se for o caso) e uma linha no histórico da spec de origem marcando B8 e B9 como aprovadas e apontando para este arquivo.
