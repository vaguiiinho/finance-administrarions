# Spec de fechamento: Listagem com mês e status padrão

**Impacto em UI: sim, restrito.** Não há telas, fluxos nem textos visíveis novos. O impacto se resume a corrigir o que a apuração comprovar como defeito de UI e a ajustar o nome acessível do botão "Marcar como pago" (B3). O ui-designer só entra se uma correção precisar mudar algo visível ou se o Roteiro C apontar problema na pronúncia do nome.

- Data: 2026-10-31
- Status: **aprovada pelo usuário em 2026-10-31, com as recomendações de B1, B2 e B3.**
- Branch: `feat/listies`, 1 commit (`56e5b6e`) sobre a base `cad1728`
- Spec de origem: `docs/specs/listagem-mes-e-status-padrao.md` (rev. 3). Os RF, RNF e CA citados sem prefixo estão nela. **Nenhum deles muda aqui.**
- Referências: `docs/adr/0007-listagem-mes-e-status-padrao.md`, `docs/design/listagem-mes-e-status-padrao.md` (§10), `docs/runs/listagem-mes-e-status-padrao.md`
- Evidências de hoje (fora do repositório, temporárias):
  - Suíte completa: `/tmp/claude-1000/-home-vagner-workspace-estudo-ia-finance-administrations/1f92478a-4939-402d-94f0-856f31fcbc1c/scratchpad/playwright2.log`
  - Repetição das falhas: `/tmp/claude-1000/-home-vagner-workspace-estudo-ia-finance-administrations/1f92478a-4939-402d-94f0-856f31fcbc1c/scratchpad/playwright3.log`

## 1. Contexto

As 21 tarefas da spec de origem foram entregues e revisadas. O que impede o PR é que **a suíte Playwright de hoje não confirma o estado registrado**.

| Medição | Último registro | Hoje, em `56e5b6e` |
|---|---|---|
| API `npm test` | 915 passando | 915 passando |
| Web vitest | 1754 passando | 1754 passando |
| Web `tsc` | Limpo | Limpo |
| Web eslint e `next build` | eslint limpo no ciclo 3; build só no ciclo 2 | Não repetido isoladamente |
| API `test:int`, `test:e2e`, cobertura, lint, typecheck | 222 e 309 testes, 96,4% de statements (ciclo 1) | Não repetidos |
| Playwright completo | Ciclo 2: 572 testes, 10 falhas | 573 testes, **41 falhas**, 33 min |
| Repetição das 41 falhas | - | 25 passaram, **16 falharam**, 3,5 min |

Comando usado: `npm run test:e2e:local`, com 1 worker. Rodar o Playwright direto falha por biblioteca ausente.

## 2. Linguagem ubíqua (complementar à spec de origem)

| Termo | Definição |
|---|---|
| **Falha conhecida** | Uma das 10 falhas que o registro de execução atribui à base `cad1728`. |
| **Falha reproduzível** | Falha na suíte completa e também na repetição. |
| **Teste instável** | Falhou em uma execução e passou em outra, sem mudança de código. |
| **Regressão** | Falha reproduzível nesta branch que não ocorre na base, ou que ocorre na base por outra causa. |
| **Defeito de produto** | A tela contraria spec, design ou WCAG. Corrige-se a UI. |
| **Defeito de teste** | O teste, o stub ou o ambiente está errado em relação à spec ou ao design. Corrige-se o teste, o stub ou o ambiente. |
| **Base** | Commit `cad1728`, ponto de partida da branch. |

## 3. Gaps encontrados

| # | Gap | Afeta |
|---|---|---|
| G1 | 6 falhas reproduzíveis estão fora das 10 conhecidas (ver 3.1). Não se sabe se são regressões. | Conclusão da branch |
| G2 | 25 testes instáveis, 14 deles da própria feature (ver 3.2). | Confiança nos CA da spec de origem |
| G3 | A suíte levou 33 min, e não se sabe por quê. O registro não tem duração anterior para comparar. | Reprodutibilidade |
| G4 | O registro diz "4" falhas de `auth-a11y` sem nomeá-las, e hoje 5 se reproduzem. | Lista das falhas conhecidas |
| G5 | `test:int`, `test:e2e`, cobertura, lint, typecheck e build da API, e lint, cobertura e build do web, não rodaram sobre o commit. | RNF07, gates do projeto |
| G6 | Falta a conferência com leitor de tela que o design §10.3 exige. | RF05, RF21, RF24, RNF06 |
| G7 | Os itens 🔵 da revisão do ciclo 1 não estão em lugar nenhum do repositório. A única menção é a linha de "Pendências" do registro. | Rastreabilidade |
| G8 | A "tarefa própria" das 10 falhas conhecidas não existe em nenhum lugar. | Rastreabilidade |
| G9 | Registro desatualizado: o cabeçalho diz "sem commit" e os resultados param no ciclo 3. | Documentação |
| G10 | Violação WCAG 2.5.3 no botão "Marcar como pago" (ver 3.3). | Acessibilidade de `/entries` |

### 3.1 Falhas reproduzíveis

A contagem fecha com o registro: 16 reproduzíveis = 10 conhecidas + 6 novas. As 6 novas passaram no ciclo 2, segundo o registro. Depois dele, o registro cita mudanças só em `globals.css`, `expenses-list.tsx`, `expenses-list.spec.tsx` e `status-filter.pw.ts`.

As colunas "Fato" vêm do log. As colunas "Hipótese" **não estão confirmadas** e servem só como ponto de partida.

**Fora das 10 conhecidas (classificar antes de tudo)**

| Teste | Fato | Hipótese |
|---|---|---|
| `admin-users:265` | Depois do alerta de sessão expirada, a página navega para `/entries` e segue o avanço de mês, em vez de ir para `/login?...reason=expired`. | Se confirmado na tela, contraria o RNF02 ("sessão expirada continua levando ao login"). **Tratar como o caso mais grave até prova em contrário.** |
| `auth-a11y` CA46 dark mobile, "login carregando" | O axe auditou a lista de `/entries`, não o login. Na suíte completa, "Entrando…" nem foi encontrado. | Corrida no teste: o estado "carregando" termina antes da auditoria. A violação encontrada é real (ver 3.3). Provavelmente é a 5ª de `auth-a11y`, a confirmar (G4). |
| `buttons:128` light | Estoura os 30 s na etapa de "Pagar fatura" (linha 161). | O teste acumula várias etapas e estoura o tempo, ou o diálogo fecha antes da leitura. |
| `buttons:128` dark | Estoura os 30 s na etapa de salvar lançamento (linha 136). | Parar em outra etapa sugere tempo ou estado do stub, não um defeito único de UI. `buttons.pw.ts` foi alterado na branch. |
| `dark-theme:45` lançamentos | "Atualizando…" aparece e some antes do fim da auditoria (linha 67). | O estado segurado por `holdQueries` termina antes da hora. |
| `dark-theme:45` dashboard | Igual ao anterior. | O dashboard não faz parte da feature, e `dark-theme.pw.ts` não foi alterado. Causa comum possível fora das telas alteradas. |

**Falhas conhecidas (confirmar que a causa é a mesma da base)**

| Teste | Fato | Hipótese |
|---|---|---|
| `auth-a11y` CA46 mobile, diálogos de inativar e de redefinir senha, light e dark (4) | `getByRole('row')` não encontra "Ana Souza" em 360 px. | Em mobile a lista pode não usar linhas de tabela. Provável defeito de teste. |
| `auth-account` CA09 e CA10, `auth-login` CA04 | `getByRole('alert')` resolve 2 elementos, por causa do `__next-route-announcer__`. | Defeito de teste. |
| `auth-login` CA42, `demo-shell` CA38 | `getByText('Cartão Demo')` resolve 2 elementos (h2 e `sr-only`). | Defeito de teste. |
| `auth-login` CA05 | A URL aceita `/login` ou `/demo/entries`, mas o heading "Lançamentos" deve ter contagem 0. | O teste pode ser contraditório: conferir contra o CA05 de origem. |

### 3.2 Testes instáveis (25)

Falharam em `playwright2.log` e passaram em `playwright3.log`.

| Arquivo | Testes |
|---|---|
| `status-filter.pw.ts` (**feature**) | :61 CA33, :103 CA36, :114 e :127 CA37, :141 CA38, :391 CA51, :413 CA53, :445 CA55, :458 CA56, :487 CA58 |
| `initial-month.pw.ts` (**feature**) | :102 CA11, :249 CA26, :277 CA28, :344 ciclo de vida do aviso |
| `buttons.pw.ts` (alterado na branch) | :87 Despesas paginadas, light |
| `entries.pw.ts` (alterado na branch) | :117 RF24, :200 CA77 |
| `demo-shell.pw.ts` (alterado na branch) | :175 CA45 |
| `a11y.pw.ts` (alterado na branch) | :312 dark, G3 toast com ação |
| `auth-a11y.pw.ts` | :65 light mobile "trocar senha obrigatória", light desktop "trocar senha com erro", dark desktop "tela protegida com menu lateral" |
| `auth-account.pw.ts` | :33 CA08 |
| `dark-theme.pw.ts` | :148 superfícies |
| `month-summary.pw.ts` | :205 CA20 CLS |

Padrões do log que orientam a investigação, **sem causa confirmada**:

- `a11y:312` falhou com `ENOENT` em `test-results/.playwright-artifacts-0`: algo removeu o diretório durante a execução.
- Vários testes não encontram os dados do seu próprio cenário (`Paga A`, `Roxo paga`, `Cadastrar cartão`), e outros estouram 15 s em `waitForURL`.
- Hipótese inicial: outro processo em paralelo, ou servidor reaproveitado por `reuseExistingServer`. O cenário do stub é estado global, então isso explicaria o `ENOENT`, os dados errados e a lentidão.
- Hipóteses alternativas: estado que vaza de um teste para o seguinte, ou lentidão acumulada na suíte longa.
- A repetição passou em outra ordem e com poucos testes. **Isso não prova que os 25 estejam saudáveis na suíte completa.**

### 3.3 Violação de acessibilidade

O axe apontou `label-content-name-mismatch` (WCAG 2.5.3) em `expenses-list.tsx:345`. O texto visível é "Marcar como pago" e o nome acessível é "Marcar Internet como pago", que não contém o texto visível de forma contígua. A linha 289 usa o mesmo padrão e, em telas `lg`, também mostra esse texto. A regra só apareceu por acaso, porque a auditoria caiu em `/entries`: `support.ts` roda só `color-contrast`, e `auth-a11y.pw.ts` audita as telas de autenticação. Não se sabe ainda se isso já ocorre na base.

## 4. Requisitos de fechamento

### Bloqueiam a conclusão da branch

- **RFF01 - Classificação.** Cada uma das 16 falhas reproduzíveis e dos 25 testes instáveis recebe uma classificação (regressão, falha conhecida, defeito de produto, defeito de teste ou ambiente), com evidência da comparação com a base.
- **RFF02 - Regressões corrigidas.** Nenhuma regressão permanece. Em especial, sessão expirada leva ao login (RNF02).
- **RFF03 - Testes da feature estáveis.** `status-filter.pw.ts` e `initial-month.pw.ts` passam em todas as execuções completas.
- **RFF04 - Instabilidade explicada.** A causa da instabilidade e dos 33 min fica identificada e registrada, e é corrigida se estiver no repositório ou no modo de execução. Se a causa for externa, o modo correto de execução fica documentado.
- **RFF05 - Falhas restantes nomeadas.** Toda falha que continuar na suíte estará na lista nominal aprovada em B1, com a causa.
- **RFF06 - Pendências rastreáveis.** As falhas conhecidas e os itens 🔵 ficam registrados conforme B1 e B2.

### Não funcionais

- **RNFF01 - Gates sobre o commit final.**
  - API: unit, cobertura, `test:int`, `test:e2e`, lint, typecheck, build.
  - Web: unit, cobertura, lint, `tsc`, build, Playwright.
  - Cobertura de domain/application >= 80% (`CLAUDE.md`).
- **RNFF02 - Nenhuma perda de rigor.** Não vale `skip`, apagar teste, enfraquecer asserção, ligar `retries` no local ou aumentar timeout sem causa demonstrada.
- **RNFF03 - Sem mudança de contrato.** Sem mudança de contrato HTTP, de schema ou de regra de negócio.

## 5. Critérios de aceite

**CAF01 - Execução limpa (RFF04)**
- Given nenhum outro processo Playwright, `next` ou stub ativo, e as portas 3100 e 4010 livres
- When o tester roda a suíte completa com `npm run test:e2e:local`
- Then a duração total e a duração por arquivo ficam registradas, assim como a presença ou não de `ENOENT` em `test-results`.

**CAF02 - Comparação com a base (RFF01)**
- Given a base `cad1728` e a branch, no mesmo dia e no mesmo modo de execução
- When a suíte completa é executada nas duas (ADR 0008, D2), cada uma com a versão do teste do seu próprio commit (o teste que não existir na base fica marcado como "só na branch")
- Then o registro de execução tem uma tabela por teste com o resultado em cada commit, a mensagem de erro e a classificação, e nomeia os 4 casos de `auth-a11y` da lista conhecida.

**CAF03 - Sessão expirada (RFF02, RNF02)**
- Given um usuário autenticado com o diálogo de inativar aberto em `/admin/users`
- When a sessão expira e ele confirma a ação
- Then aparece "Sua sessão expirou. Entre novamente." e ele vai para `/login` com `reason=expired`, sem abrir `/entries`; `admin-users:265` passa sem mudar a expectativa, salvo prova de que o teste contraria a spec de autenticação.

**CAF04 - Demais novas falhas (RFF02)**
- Given `buttons:128` (light e dark), `dark-theme:45` (lançamentos e dashboard) e `auth-a11y` "login carregando"
- When rodam na suíte completa
- Then passam, e cada teste audita de fato o estado do seu nome: botão em "carregando", tela em "Atualizando…" até o fim da auditoria, e "Entrando…" visível na auditoria do login.

**CAF05 - Estabilidade (RFF03, RNFF02)**
- Given as correções aplicadas, com o commit final
- When a suíte Playwright completa roda **duas vezes seguidas**
- Then os dois resultados são idênticos, sem falhas em `status-filter.pw.ts` e `initial-month.pw.ts`, e o conjunto de falhas é exatamente o aprovado em B1.

**CAF06 - Duração explicada (RFF04)**
- Given as medições do CAF01 e do CAF05
- When o tester compara os tempos
- Then o registro explica a duração, por exemplo os arquivos mais lentos e o tempo gasto em timeouts. Não há limite numérico: o critério é ter a explicação, e nenhum teste passar perto do timeout de 30 s por causa de estado errado do stub.

**CAF07 - Nome acessível (G10, B3)**
- Given a aba Despesas com despesa pendente, nas larguras de 360, 768 e 1280 px
- When o axe roda com a regra `label-content-name-mismatch` em `/entries`
- Then não há violação, o nome de cada botão continua identificando a despesa, e essa auditoria fica coberta por teste, sem depender de corrida. Os nomes aprovados são:
  - 360 px, no card: "Marcar como pago: `<descrição>`"
  - 768 px, na tabela: "Pagar: `<descrição>`"
  - 1280 px, na tabela: "Marcar como pago: `<descrição>`"
- Nos testes, a única variação aceita é espaço em volta dos dois-pontos. Referências: `docs/design/listagem-mes-e-status-padrao-fechamento.md` §1 e ADR 0008 (V7, seção 9).

**CAF08 - Gates (RNFF01)**
- Given o commit final
- When as suítes do RNFF01 rodam
- Then todas passam, sem queda em relação ao registro: API unit >= 915, `test:int` >= 222, `test:e2e` >= 309, web unit >= 1754. Os números finais ficam registrados.

**CAF09 - Rigor preservado (RNFF02)**
- Given o diff do fechamento
- When o code-reviewer revisa
- Then não há item 🔴, os 🟡 estão corrigidos, e toda alteração de asserção, timeout ou seletor traz a justificativa. Cada defeito de teste aponta o trecho da spec ou do design que o comprova.

**CAF10 - Pendências registradas (RFF05, RFF06)**
- Given as respostas de B1 e B2
- When o doc-writer atualiza o registro de execução
- Then as falhas que ficam estão listadas por nome, com a causa, e os itens 🔵 da nova revisão estão listados um a um, cada um com a decisão tomada. Nenhum item é inventado para representar a lista antiga.

**CAF11 - Verificação manual (G6)**
- Given os roteiros da seção 7
- When o usuário os executa
- Then o resultado de cada passo, o leitor de tela e o navegador ficam no registro de execução. Divergência em relação ao design §10.2 vira tarefa [web] antes da conclusão; pronúncia estranha do nome do botão volta ao ui-designer (Roteiro C).

## 6. Escopo

| Bloqueia a branch | Fica fora |
|---|---|
| Classificar as 16 + 25 (CAF01, CAF02) | Funcionalidade, regra ou texto novo da feature. Os itens da seção 7 da spec de origem seguem fora |
| Corrigir regressões e as 6 novas falhas (CAF03, CAF04) | As 10 falhas conhecidas, quando a causa for a mesma da base (B1) |
| Estabilizar os testes da feature e explicar a duração (CAF05, CAF06) | Corrigir itens 🔵 (B2) |
| Nome acessível do botão (B3, CAF07) | Instabilidade fora da feature com a mesma causa na base e sem relação com a branch: fica registrada por nome (P03) |
| Gates sobre o commit final (CAF08) | Reduzir o tempo da suíte, além do que a causa encontrada exigir |
| Revisão e documentação (CAF09, CAF10) | Criar pipeline de CI |
| Verificação manual do usuário (CAF11) | Medir de novo o desempenho (RNF01): a API de produção não mudou e o resultado está registrado |
| | Medir o carregamento com a API real (o registro só tem medição contra o stub) |
| | **Abrir o PR: é ação do usuário ou do coordenador, não de subagente** |

## 7. Verificação manual do usuário

Só uma pessoa pode fazer. Nenhum subagente pode executar nem dar como feita. Fazer depois da tarefa 14, para o resultado valer sobre o commit final, e antes de abrir o PR.

Use um leitor de tela real (por exemplo, NVDA no Windows ou VoiceOver no macOS) com a aplicação em execução. O resultado esperado vem do design §10.2, e o nome do botão no Roteiro C vem do adendo §1.2.

**Roteiro A - Aviso de avanço na carga (RF05, RNF06)**
1. Use uma conta com cartão e sem pendência no mês atual.
2. Abra `/entries` sem `month`.
3. Confirme que o texto do aviso é lido **uma vez**, com o mês de destino, sem mover o foco para ele.
4. Espere mais de 10 s e navegue pela página em modo de leitura. Confirme que o texto do aviso não é lido em duplicidade.

**Roteiro B - Pagar fatura sob "Pendente" (RF21, CA55, CA28)**
1. Na aba Faturas, sob "Pendente", pague uma fatura.
2. Confirme que são lidos o toast e o `h2` do painel, com o foco nesse `h2`.
3. Confirme que depois é lida a nova contagem do painel.
4. Repita com a última fatura da lista, que leva ao vazio com filtros.

**Roteiro C - Pagamento individual sob "Pendente" (RF24, CA61)**
1. Na aba Despesas, sob "Pendente", leve o leitor de tela até o botão de pagamento de uma despesa, sem ativá-lo. Confirme que ele é lido como "Marcar como pago: `<descrição>`" ou "Pagar: `<descrição>`", conforme a largura da tela (`docs/design/listagem-mes-e-status-padrao-fechamento.md` §1.2).
2. Se o leitor de tela pronunciar algo estranho na altura dos dois-pontos, registre o que ouviu: o assunto volta ao ui-designer (mesmo adendo, §1.3).
3. Ative o botão e marque a despesa como paga.
4. Confirme que o toast é lido e que o foco vai para o `h2` do painel.
5. Confirme que nenhum dos anúncios é cortado pelo outro.

## 8. Perguntas em aberto

### Bloqueantes (decisões do usuário)

**B1 - As 10 falhas anteriores à feature entram neste fechamento? Decidida em 2026-10-31: não entram.**
Pelo registro, elas ocorrem na base com a mesma causa e não têm relação com a feature. Pelo log, a maioria parece ser defeito de teste de custo baixo, mas isso não foi confirmado.
*Decisão, conforme a recomendação: não entram.* Ficam listadas por nome e causa no registro, numa seção que passa a ser a "tarefa própria", para uma branch logo depois desta. O PR declara as falhas que permanecem. Assim o diff continua sendo da feature e a decisão já registrada é mantida. O custo é abrir o PR com a suíte não totalmente verde. Sem CI, nada impede o merge, então a lista nominal é a única proteção. **Exceção:** a falha cuja causa na branch for diferente da causa na base passa a ser regressão e entra. A lista nominal é confirmada pelo usuário após a tarefa 3 (ADR 0008, V13).
*Alternativa não adotada:* incluí-las em uma tarefa [web] à parte, se a suíte verde for condição para o merge.

**B2 - O que fazer com os itens 🔵 não registrados? Decidida em 2026-10-31: só registrar, sem reconstruir a lista original.**
A lista original não está no repositório. Reconstruí-la de memória seria inventar conteúdo.
*Decisão, conforme a recomendação:* não tentar reconstruir. A revisão final (tarefa 13) cobre o diff inteiro da branch e registra os 🔵 um a um no registro de execução. A linha antiga de "Pendências" é substituída por essa lista, com uma nota de que a original se perdeu. Os itens **ficam registrados, sem correção neste fechamento**, salvo os que o usuário escolher. Se o coordenador ainda tiver o relatório do ciclo 1 na sessão, ele o entrega ao doc-writer para complementar a lista.

**B3 - O nome acessível de "Marcar como pago" entra neste fechamento? Decidida em 2026-10-31: entra.**
A violação de 3.3 é real e está numa tela da feature, mas pode já existir na base.
*Decisão, conforme a recomendação: entra, qualquer que seja a origem.* A mudança é pequena, não altera nada visível e torna o CA46 confiável. Nomes aprovados por largura, que começam com o texto visível e mantêm a descrição:
- 360 px, no card: "Marcar como pago: `<descrição>`"
- 768 px, na tabela: "Pagar: `<descrição>`"
- 1280 px, na tabela: "Marcar como pago: `<descrição>`"

Um nome único não atende, porque não conteria o texto "Pagar" visível em 768 px. Referências: `docs/design/listagem-mes-e-status-padrao-fechamento.md` §1 e ADR 0008 (V7, seção 9). Testes que localizam o botão pelo nome atual precisam acompanhar a mudança.

### Técnicas (decisão do architect)

Nenhuma exige ADR novo. Se a resposta mudar contrato ou regra, volta para o architect.

- **T1 - Como rodar a base sem conflito.** `.next` é compartilhado e `reuseExistingServer` está ativo fora de CI. *Sugestão:* worktree separado, com dependências próprias e sem nada mais rodando, usando `PW_WEB_PORT` e `PW_STUB_PORT` distintos se for preciso, sempre com `npm run test:e2e:local`.
- **T2 - Reuso de servidor.** *Sugestão:* manter o `reuseExistingServer`, se a causa for outra. Se for ele, fazer a execução local falhar ou avisar ao encontrar um servidor já ativo.
- **T3 - Estados segurados no stub.** `dark-theme:45` e `buttons:128` dependem de `holdQueries` e `holdMutations`. *Sugestão:* investigar antes de mudar. Hoje `setScenario` e `/__release` compartilham o mesmo gate, o que é um bom ponto de partida.
- **T4 - Cobertura de `label-content-name-mismatch`.** *Sugestão:* uma verificação direcionada em `/entries`, em vez de ampliar de uma vez o axe de todas as telas. Ampliar pode revelar mais violações e aumentar o escopo.

## 9. Premissas adotadas

- **P01** A feature está funcionalmente entregue. Só se reabre um CA se uma falha comprovar defeito.
- **P02** Falha é tratada como defeito de produto até haver evidência de defeito de teste. Quem corrige teste é o tester, e quem corrige UI é o frontend-dev.
- **P03** Teste instável fora da feature entra só se a causa estiver nesta branch ou for comum à suíte. Do contrário, fica registrado com o mesmo tratamento de B1.
- **P04** O commit final pode ter mais commits sobre `56e5b6e`. Quem decide fazer os commits e como é o coordenador, junto com o usuário.
- **P05** A suíte continua contra o stub, como define `playwright.config.ts`.
- **P06** Não há tarefa [db]: nenhuma migração, schema ou dado muda. Se isso mudar, o assunto volta ao planner.
- **P07** A API de produção não mudou desde o ciclo 1, conforme o registro. Por isso as tarefas [api] são só de verificação, a menos que `test:int` ou `test:e2e` falhem.

## 10. Riscos

- **RF1 - Classificação errada.** Chamar regressão de "instabilidade" levaria um defeito ao PR. `admin-users:265` é o caso mais sensível. CAF02 e CAF03 mitigam.
- **RF2 - Relógio real.** `stubNow` usa a data real quando o cenário não fixa outra, e hoje é o último dia de outubro. Base e branch precisam ser comparadas no mesmo dia. Uma execução a partir de 01/11 muda o mês atual e pode mudar resultados.
- **RF3 - Causa de ambiente não confirmada.** Mesmo em execução limpa, a instabilidade pode persistir e exigir mais trabalho em testes e no stub.
- **RF4 - Tempo de execução.** Cada rodada completa levou 33 min. O CAF05 pede duas, além da comparação com a base.
- **RF5 - Base diferente do que se espera.** Testes e stub mudaram na branch, então um mesmo teste pode não ser comparável entre os commits. O CAF02 usa a versão de cada commit e explicita esses casos.
- **RF6 - PR com falhas.** Com a decisão B1, as 10 falhas podem acabar esquecidas de novo. CAF10 e a declaração no PR mitigam.

## 11. Tarefas (ordenadas)

Não há tarefas [db] (P06).

### Apuração
1. [web] Tester: garantir ambiente limpo, rodar a suíte completa e registrar duração por arquivo e sinais de `ENOENT` (CAF01, T2).
2. [web] Tester: rodar a suíte completa na base `cad1728` e na branch, no mesmo dia, incluindo as 41 falhas de hoje (CAF02, T1; ADR 0008, D2).
3. [web] Tester: entregar a tabela de classificação, com os 4 casos nomeados de `auth-a11y` (RFF01, G4). **Se surgir regressão fora do que a seção 3.1 prevê, o coordenador é avisado antes de seguir.**

### Correção
4. [web] Sessão expirada: corrigir o que a tarefa 3 apontar em `admin-users:265` (CAF03).
5. [web] `buttons:128` (light e dark): corrigir conforme a classificação (CAF04).
6. [web] `dark-theme:45` (lançamentos e dashboard): corrigir conforme a classificação (CAF04, T3).
7. [web] `auth-a11y` "login carregando": fazer a auditoria cobrir de fato o estado "carregando" (CAF04).
8. [web] Ajustar o nome acessível dos botões de linha e de card de `expenses-list.tsx` (linhas 289 e 345 em `56e5b6e`), com testes (B3, CAF07, T4).
9. [web] Corrigir a causa da instabilidade e estabilizar `status-filter.pw.ts` e `initial-month.pw.ts` (CAF05, RFF04).
10. [web] Não executada (B1): as 10 falhas conhecidas têm a mesma causa na base. Só entraria falha com causa diferente da base.

### Verificação
11. [api] Tester: rodar cobertura, `test:int`, `test:e2e`, lint, typecheck e build sobre o commit final, além de `npm test` (CAF08).
12. [web] Tester: rodar unit, cobertura, lint, `tsc` e build, e depois o Playwright completo duas vezes seguidas (CAF05, CAF06, CAF08).
13. Code-reviewer: revisar o diff do fechamento quanto ao rigor (CAF09) e o diff inteiro da branch para listar os itens 🔵 (B2).
14. Tratar os 🟡 e 🔴 da revisão e repetir a tarefa 12, se houver mudança.

### Fechamento
15. **Usuário:** executar os roteiros da seção 7 e informar o resultado (CAF11).
16. Doc-writer: atualizar `docs/runs/listagem-mes-e-status-padrao.md` com o novo estado final, a classificação, as falhas restantes por nome, os itens 🔵, o resultado informado pelo usuário e a correção do cabeçalho, além do `CHANGELOG.md` se houver mudança perceptível (CAF10, CAF11, G8, G9).
