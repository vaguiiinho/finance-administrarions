# ADR 0008 - Fechamento da listagem com mês e status padrão: comparação com a base, apuração da instabilidade e critérios de estabilidade

- **Status:** Aceito em 2026-10-31. O usuário aprovou as recomendações de B1, B2 e B3 (seção 9).
- **Data:** 2026-10-31
- **Spec:** `docs/specs/listagem-mes-e-status-padrao-fechamento.md`
- **Base:** ADR 0007 (feature de origem), ADR 0002 (precedente de fechamento, T1 do Playwright sem root e T5 do stub)
- **Autor:** architect

**Limite de verificação.** Este ADR foi produzido por leitura de código, dos logs e de `web/test-results`, sem executar nada e sem acesso a `git`. **O conteúdo de `cad1728` não foi lido:** o que se diz sobre a base vem do registro de execução e do ADR 0007 e está marcado como "a confirmar". As causas descritas continuam hipóteses até a apuração da seção 5.

---

## 1. Escopo e decisão central

Este ADR decide **método**, não feature: como comparar, como apurar e como julgar. Não muda aggregate, schema nem contrato (RNFF03, P06, P07).

Decisões:

| # | Decisão | Seção |
|---|---|---|
| D1 | Os números 16 e 25 são **entrada** da apuração, não resultado: foram medidos em ambiente que há indícios de ter sido contaminado. A classificação vale só sobre execuções controladas. | 3, 5 |
| D2 | Base e branch rodam em **dois worktrees** próprios, em sequência, nunca ao mesmo tempo, com `CI=1 npm run test:e2e:local -- --retries=0`. | 4 |
| D3 | Uma causa só é aceita com prova **de necessidade e de suficiência**: some na execução limpa e volta quando é provocada. | 5 |
| D4 | Toda comparação exige o mesmo mês civil em São Paulo **e** em UTC. Execução que atravessa a virada é descartada. | 6 |
| D5 | Classificação em dois eixos, origem e natureza, comparando a assinatura da falha, não só o título do teste. | 7 |
| D6 | Suíte estável: duas execuções completas controladas, seguidas, com o mesmo conjunto e as mesmas assinaturas de falha. | 8 |

---

## 2. Bounded context, linguagem ubíqua e modelo

**Bounded context:** Finanças pessoais, como no ADR 0007 seção 2. Linguagem: a da spec, seção 2, mais os termos abaixo.

| Termo | Definição |
|---|---|
| **Execução controlada** | Suíte rodada conforme a seção 4, com as checagens de ambiente registradas antes, durante e depois. |
| **Escritor externo** | Qualquer cliente de `/__scenario` ou `/__release` que não seja o teste em execução. |
| **Assinatura da falha** | Tipo do erro, locator, valor esperado e recebido, linha de chamada no teste e URL final, com portas e hashes normalizados. |
| **Mês de execução** | Par (`M_SP`, `M_UTC`) lido no início e no fim da execução. |

| Item | Mudança |
|---|---|
| Aggregates, entities, value objects, invariantes | Nenhuma. Invariantes do ADR 0007 seção 3 mantidas |
| Domain events | Nenhum |
| Interfaces de repositório (domain) | Nenhuma |
| Ports e use cases (application) | Nenhum. Tarefas [api] são só verificação (P07) |
| Endpoints HTTP e DTOs | Nenhum |
| `schema.prisma`, migration | Nenhuma. Sem estratégia de migração a definir |

Se uma correção exigir mudar qualquer linha desta tabela, a tarefa para e volta ao architect.

---

## 3. Conferência da spec contra o código e os logs

### 3.1 Confirmado

- `playwright.config.ts`: portas por `PW_WEB_PORT` e `PW_STUB_PORT`, 1 worker, `reuseExistingServer: !process.env.CI`, `retries: process.env.CI ? 1 : 0`, `next build && next start`, sem `outputDir` próprio (usa `test-results`).
- `expenses-list.tsx` linhas 289 e 345: `aria-label="Marcar ${description} como pago"`, com o texto visível descrito.
- `support.ts` roda só `color-contrast`.
- `CONTROL` em `server.mjs`: `/__scenario` e `/__release` chamam o mesmo `openGate`. `stubNow` usa a data real sem `now`.
- Contagens de `playwright2.log` e `playwright3.log`: 41 falhas, 16 reproduzíveis (10 + 6) e 25 instáveis, com 14 da feature. O log confirma 5 falhas de `auth-a11y`.
- `web/e2e/stub-api/auth.spec.ts` usa porta aleatória (4300-4799), então o vitest não colide com o stub do Playwright.

### 3.2 Divergências e achados que a spec não traz

| # | Spec | Encontrado | Efeito |
|---|---|---|---|
| **V1** | §3.2: hipótese de "servidor reaproveitado por `reuseExistingServer`". | Os dois logs trazem `[WebServer]` antes dos testes (`playwright2.log:5`, `playwright3.log:8`). A saída de erro do web só aparece com esse prefixo se a própria execução subiu o processo. Logo, **nessas duas execuções o web não foi reaproveitado ao iniciar**. O stub não dá como saber: ele escreve em stdout, que o Playwright não mostra por padrão. | Hipótese reformulada: H1, seção 5. Quem pode ter reaproveitado é **outra** execução, iniciada depois, conectando-se aos servidores desta. |
| **V2** | §3.2: causa de ambiente sem evidência direta. | `web/test-results` tem resultado de dois testes **que não foram da execução de `playwright3.log`**: `status-filter.pw.ts:180` (CA41), com `net::ERR_CONNECTION_REFUSED at http://localhost:3100/login`, e `status-filter.pw.ts:191` (CA42), com subtotal "0 despesas". Nenhum dos dois está nas 41 selecionadas, e o `:191` não falhou em `playwright2.log`. `.last-run.json` lista as 16 de `playwright3.log`. | Indício forte de **outra execução escrevendo no mesmo diretório**. Conexão recusada sugere que o servidor em uso por ela caiu. |
| **V3** | §3.1: `dark-theme:45` sem menção a erro de API. | `playwright3.log:535-563`: três `ApiError: INTERNAL_ERROR`, com `details: null` e os mesmos digests das telas `error500` de `playwright2.log`, durante `dark-theme:45`. `failMode: "all"` só existe no cenário `error500`, usado só em `a11y.pw.ts:227,305`, `theme.pw.ts:146` e `page-background.pw.ts:201`. **Nenhuma dessas telas estava entre as 41.** | Indício forte de escritor externo. Mas `dark-theme:45` também falhou sem esses erros (dashboard em `playwright3.log`, e os dois em `playwright2.log`), então isso sozinho não o explica. |
| **V4** | §3.1: `admin-users:265` tratado como provável violação do RNF02. | A navegação observada exige `GET /api/auth/me` = 200 (`proxy.ts` e `decideRoute`: só `valid` manda de `/login` para `/entries`) e `initial-month` = 200, com os dados do cenário `default`. Sob `expired-session`, o stub responde 401 nas duas. Ou o estado do stub mudou depois do alerta, ou a tela de fato errou. Os testes de sessão expirada de `auth-login.pw.ts:146-170` não estão entre as 41. | **Continua o caso mais grave até prova em contrário (P02)**, mas a pergunta muda: o que `/auth/me` respondeu naquele instante? Seção 5.3. |
| **V5** | RF2: "a partir de 01/11". | O ADR 0007 seção 10 registra que o stub da base calculava o mês da demo em **UTC**. Se confirmado, a base muda às **21:00 de 31/10 em São Paulo**. Em `web/`, o mês vem de `currentYearMonthSP`. | Prazo real é anterior ao que a spec indica. Seção 6. |
| **V6** | T1: usar `PW_WEB_PORT` e `PW_STUB_PORT` nos dois commits. | O registro lista `playwright.config.ts`, `support.ts` e `auth-login.pw.ts` como alterados na branch, e o ADR 0007 V3 os aponta como novidade. **Provavelmente a base ignora as variáveis.** Nesse caso, ela usaria 3100 e 4010 sem avisar e, fora de CI, se conectaria a qualquer servidor nessas portas. | Tratado na seção 4.3. A confirmar na base. |
| **V7** | §3.3 e B3: "Marcar como pago: Internet" resolve; CAF07 cobre "mobile e `lg`". | Na linha 289, entre `md` e `lg`, o texto visível é **"Pagar"** (linha 291). Nem o nome atual nem o sugerido o contêm. A tabela existe a partir de `md`, então essa faixa fica sem correção e sem teste. | Afeta a proposta de B3 e o CAF07. Seção 9. |
| **V8** | B3: "testes que localizam o botão pelo nome atual precisam acompanhar". | O impacto é maior. `getByRole` com `name` em string casa **por substring**. Hoje, "Marcar Internet como pago" não contém "Marcar como pago"; qualquer nome conforme conterá. Os locators do botão **de lote** passam a casar também com os botões de linha: `buttons:108,148`, `theme:300`, `a11y:40`, `dark-theme:154`, `glass:226,447`, `entries:73,89,121,134`. `entries:89` usa `toHaveCount(0)` e muda de sentido. | Custo real de B3. Seção 9. |
| **V9** | RFF01: classificação em lista única. | "Regressão" e "falha conhecida" dizem a origem. "Defeito de produto", "de teste" e "ambiente" dizem a natureza. Uma regressão pode ser defeito de teste. | Dois eixos. Seção 7. |
| **V10** | §3.2: a repetição passou "em outra ordem". | A ordem relativa é a mesma, por arquivo. O que muda é o conjunto e, portanto, o teste anterior a cada um. | A repetição não testa ordem, só vizinhança. H3, seção 5. |
| **V11** | §3.1: `dark-theme.pw.ts` não foi alterado, logo causa "fora das telas alteradas". | Vale para o arquivo, mas `server.mjs` e `support.ts`, que ele usa, foram alterados na branch. | Não exclui a branch como origem. |
| **V12** | §3.3: `auth-a11y.pw.ts` audita "as telas de autenticação". | Também audita `/cards`, `/admin/users` e demo, com todas as regras exceto contraste. Nenhuma mostra Despesas com botões de pagamento, pois a demo é só leitura. | Por isso a regra só apareceu por acaso. Reforça T4. |
| **V13** | RFF05: lista "aprovada em B1", antes da classificação. | B1 aprova a política. Os nomes só existem depois da tarefa 3. | O usuário confirma a lista nominal após a tarefa 3. |

**Evidência frágil.** `web/test-results` e os logs são temporários, e a próxima execução do Playwright naquele diretório apaga os resultados. **O primeiro passo do tester é preservá-los e registrar as datas dos arquivos, antes de qualquer execução.** As datas dizem se CA41 e CA42 foram escritos durante `playwright3.log`, o que não pude verificar.

---

## 4. T1 e T2: comparação base e branch

### 4.1 Worktrees

Dois worktrees destacados, **fora do diretório principal**, inclusive para a branch:

```bash
git worktree add --detach "$WT/base" cad1728
git worktree add --detach "$WT/branch" 56e5b6e
# em cada um, dentro de web/:
npm ci && npm run pw:deps
```

Motivo: portas separadas **não isolam** `test-results` nem `.next`, que dependem do diretório. Só o worktree isola, e o worktree da branch garante que o código testado é o do commit. A lista de `$WT`, o `node -v`, a versão do Playwright e do Chromium e o hash do `package-lock.json` entram no registro. Versões diferentes entre os commits são anotadas, pois podem explicar diferença de comportamento.

**`.env`.** `web/.env` existe no diretório principal e não é versionado, então nenhum worktree o terá. Isso vale igual para os dois lados. Se a suíte exigir alguma variável, o mesmo arquivo é copiado para ambos, e só os nomes das variáveis são registrados. Os worktrees são removidos ao fim, depois de salvas as evidências.

### 4.2 Comando

```bash
CI=1 PW_WEB_PORT=<web> PW_STUB_PORT=<stub> \
PLAYWRIGHT_JSON_OUTPUT_NAME="$EVID/<rotulo>.json" \
npm run test:e2e:local -- --retries=0 --reporter=list,json 2>&1 | tee "$EVID/<rotulo>.log"
```

| Parte | Motivo |
|---|---|
| `npm run test:e2e:local` | Traz as bibliotecas de `pw:deps`. Nunca `npx playwright test` direto |
| `CI=1` | **Desliga `reuseExistingServer`**: com a porta ocupada, a execução falha em vez de se conectar em silêncio. Não exige mudar código |
| `--retries=0` | `CI=1` liga `retries: 1`, que esconderia instabilidade (RNFF02) |
| `--reporter=list,json` | `--reporter=line`, usado hoje, não dá duração por teste. O JSON é a fonte do CAF01, do CAF02 e do CAF06 |

Sem `--workers`, pois a configuração já fixa 1. Sem `--last-failed`, pois depende de `.last-run.json` de cada diretório. Sem seleção por `arquivo:linha`, pois as linhas diferem entre commits.

`process.env.CI` só é lido em `playwright.config.ts`, conferido no `web/` atual. Na base, a mesma leitura consta do ADR 0002 T3; a confirmar. `next build` pode reagir por conta própria a `CI`, e como o modo é o mesmo nos dois lados, isso não distorce a comparação.

### 4.3 Portas

Antes de tudo, confirmar na base: `grep -n "PW_WEB_PORT\|PW_STUB_PORT" playwright.config.ts e2e/support.ts e2e/auth-login.pw.ts`.

| Situação na base | Base | Branch |
|---|---|---|
| Lê as variáveis nos 3 arquivos | 3300 / 4030 | 3200 / 4020 |
| Não lê em algum deles (provável) | 3100 / 4010, **sem definir as variáveis** | 3200 / 4020 |

Não se altera a base para aceitar portas, pois ela deixaria de ser a base.

Portas diferentes são uma segunda barreira, não licença para paralelismo. **As execuções são sempre em sequência:** o paralelo disputaria CPU e invalidaria o tempo e os testes sensíveis a tempo.

### 4.4 Seleção

**Decisão: suíte completa nos dois commits**, não só as 41. A spec lembra que a repetição com poucos testes não prova a saúde na suíte completa, e o mesmo vale para a base. Além disso, a duração da base é a única referência para o G3. As 41 são extraídas do JSON pela chave `arquivo + describe + título`.

Ordem: branch, base. Se uma falha aparecer só em um dos lados, repete-se **a suíte completa** desse lado uma vez, para separar instabilidade de diferença real.

**Se o tempo não couber:** o limite da seção 6 tem prioridade. Rodam-se os arquivos completos que contêm as 41, em ambos os lados, e o registro declara a redução. Nunca um lado completo e o outro reduzido.

Teste sem título equivalente na base fica como "só na branch". Teste com mesmo título e corpo alterado é anotado como "alterado" (RF5), e a diferença do corpo é considerada na classificação.

### 4.5 Checagens de ambiente

Fazem parte da evidência de cada execução. Faltando uma, a execução não é controlada.

| Momento | O que registrar | Exigência |
|---|---|---|
| Antes | `ps` de `playwright`, `next`, `stub-api/server.mjs`; `ss -ltnp` das portas 3100, 4010 e as da execução; `M_SP` e `M_UTC` | Nenhum processo; portas livres (CAF01) |
| Durante | Os mesmos `ps` e `ss`, a cada 30 s, em arquivo | Só os processos desta execução. Registrar, além do comando, o `lstart` e o diretório |
| Depois | `ps` e `ss`; `M_SP` e `M_UTC`; `grep ENOENT`; total e por arquivo | Nenhum processo órfão; mesmo mês |

Processo órfão de execução abortada é o caminho concreto pelo qual uma rodada se conectaria a um stub antigo, então a limpeza é verificada, não presumida.

**Só o tester roda Playwright durante a apuração.** O coordenador garante que nenhum outro subagente use o Playwright, `next build` ou `npm test` do web ao mesmo tempo.

### 4.6 T2: reuso de servidor

**Decisão:** `playwright.config.ts` **não muda agora**. `CI=1` já dá a proteção durante a apuração. Se H1 for provada, a causa está "no modo de execução" (RFF04), e aí:

- trocar o padrão por opção explícita, `reuseExistingServer: process.env.PW_REUSE === "1"`. O README do web documenta `PW_REUSE=1` para iterar com `next dev`;
- registrar no README que só pode haver uma execução por vez e que outro diretório ou outras portas não tornam seguro compartilhar o stub.

A mudança é de teste, sem efeito em produção e sem afetar RNFF03. Descartadas: trava em arquivo e verificação em `globalSetup`, pois exigem mais código e o Playwright já recusa porta ocupada quando o reuso está desligado.

Se H1 não for provada, o reuso permanece como está.

---

## 5. Apuração da instabilidade e dos 33 minutos

### 5.1 O que conta como evidência

| Conta | Não conta |
|---|---|
| Execução controlada com falha e sua assinatura | Passar em `--last-failed` ou em subconjunto, sozinho |
| Trace ou `error-context.md` mostrando o estado no instante da falha | Coincidência de nomes ou de mensagens |
| Contagem de chamadas de controle no stub em teste isolado | Resultados de `playwright2.log` e `playwright3.log` como prova final (são só indícios) |
| Reprodução provocada da mesma assinatura | "Passou em outra máquina" ou "no ciclo 2", sem as condições registradas |
| Leitura do código que explica o mecanismo, **com** uma das anteriores | Leitura de código sozinha, inclusive a deste ADR |

**Regra (D3): causa aceita = necessidade + suficiência.** Necessidade: a falha some quando a condição é retirada. Suficiência: a mesma assinatura volta quando a condição é provocada, sem mudar o código. Para causa de produto ou de teste, a correção faz o papel da retirada, e um teste que falhava antes dela prova o efeito.

### 5.2 Hipóteses

Nenhuma é aceita de antemão. Todas são avaliadas sobre a execução controlada da tarefa 1.

| # | Hipótese | Previsão | Como refutar |
|---|---|---|---|
| **H1** | **Escritor externo:** outra execução usa o mesmo stub ou o mesmo diretório. Mecanismo possível: `POST /__scenario` recarrega o estado e abre o gate; `holdMutations` também prende o `POST` de login. Explicaria dados errados, `Atualizando…` que some, diálogos que fecham e `waitForURL` de 15 s. `playwright test` limpa `test-results` ao iniciar, o que explicaria o `ENOENT`. | Na execução controlada, somem o `ENOENT` e as assinaturas de estado errado. | As mesmas assinaturas aparecem sem nenhum outro processo. |
| **H2** | **Servidor antigo reaproveitado:** stub ou web de execução anterior. V1 afasta o web nos logs de hoje; o stub segue em aberto. | A execução comum falha com `CI=1` por porta ocupada; ou o `ps` mostra processo anterior. | Portas livres no início, em cada execução. |
| **H3** | **Vazamento entre testes:** estado global do stub, cenário ou gate deixados pelo anterior. | A falha depende do antecessor e persiste na execução controlada. | Passa e falha igual com e sem o antecessor, por `--repeat-each` no arquivo e `-g` isolado. |
| **H4** | **Lentidão acumulada:** memória ou conexões em suíte longa. | Duração do mesmo tipo de teste cresce com a posição; a falha ocorre tarde e passa isolada. | Sem tendência no JSON. |
| **H5** | **Relógio real.** Seção 6. | Muda com o mês de execução, no mesmo commit. | Mesmo resultado em meses diferentes. |
| **H6** | **Corrida real do teste ou da tela.** Por exemplo, `Atualizando…` termina porque a resposta com `loading.tsx` encerra a transição, mesmo com os dados presos. | Persiste na execução controlada, com o gate fechado, de forma repetível. | Instrumentação mostra o gate aberto no instante da falha. |
| **H7** | **Custo do redirecionamento da feature:** `signIn` sem `next` abre `/entries`, e o ADR 0007 7.2 prevê `meta refresh` de 1 s em carga completa. Explicaria tempo, não falha, e deve pesar pouco na base. | Base significativamente mais rápida, com diferença concentrada nos testes com login em `/entries`. | Mesma duração por teste na base. |

**Sobre os 33 min.** Limpar o ambiente pode não resolver a duração. No pior caso, as 41 falhas custaram 41 x 30 s = 20,5 min, sobrando ao menos 12,7 min para 532 testes. Esse é só um limite, pois a maioria falha antes de 30 s. A resposta sai do JSON (seção 5.4).

### 5.3 Experimentos

**E1. Execução controlada da branch (tarefa 1).** Se o conjunto das 41 mudar, a tabela da tarefa 3 usa o novo resultado e registra o antigo.

**E2. Instrumentação temporária.** Só em cópia de diagnóstico no worktree, **nunca em commit**, e fora das execuções comparativas. Uma linha no stub escreve em **stderr** cada chamada de controle, com horário e parâmetros, além das respostas de `/api/auth/me`. A saída aparece no log com o prefixo `[WebServer]`. Verifica-se a contagem esperada em teste isolado:

| Teste | `/__scenario` esperados | `/__release` esperados |
|---|---|---|
| `admin-users:265` | 2 (`beforeEach`, `expired-session`) | 0 |
| `dark-theme:45` | 3 (`signInAsAna`, `beforeEach`, `holdQueries`) | 1, no `finally` |

Qualquer chamada a mais, ou fora do lugar, é escritor externo ou vazamento.

**E3. Prova de suficiência de H1.** Só se as assinaturas sumirem em E1. Com o teste segurando o estado, um script envia `POST /__scenario {"name":"default"}` ao stub:

| Teste | Assinatura que deve voltar |
|---|---|
| `dark-theme:45` | "o estado atualizando deve durar até o fim do audit" |
| `buttons:128` | Timeout em `snapshotOf`, com o diálogo já fechado |
| `auth-a11y` "login carregando" | Axe auditando `/entries` |
| `admin-users:265` | `navigated to /entries`, com `reason=expired` ausente |

Depois, uma segunda execução de `playwright test` no mesmo diretório, iniciada durante a primeira, deve reproduzir o `ENOENT`. Isso ocorre só no worktree e tem o resultado descartado. Se E1 limpa e E3 reproduz, H1 está provada.

**E4. Sessão expirada (`admin-users:265`).** Com a instrumentação, registrar a resposta de `/api/auth/me` no momento da navegação:

| Observado | Conclusão |
|---|---|
| 401, e mesmo assim vai a `/entries` | **Defeito de produto, RNF02.** Corrige o frontend-dev |
| 200, com chamada de cenário externa | Ambiente (H1) |
| 200, sem chamada externa | Estado do stub ou do teste. Investigar antes de classificar |
| Passa em execução controlada, repetidamente | Não é regressão. E3 confirma a causa |

Até um desses resultados, a tarefa 4 não é dada como concluída.

**E5. Base.** Rodar `admin-users:265`, `buttons:128`, `dark-theme:45` e "login carregando" na suíte completa da base. `label-content-name-mismatch`: localizar o `aria-label` na base com `git show cad1728:web/features/entries/_components/expenses-list.tsx`, se o arquivo existir, e registrar a origem da violação.

### 5.4 Medição de tempo (CAF01, CAF06)

Do JSON, por execução: total; por arquivo; soma por status; soma do tempo dos testes que falharam; 20 testes mais lentos; testes passando com mais de 80% do limite de 30 s; duração por posição (H4). O tempo do `next build` fica fora, com medida própria.

O registro deve responder: quanto é custo estrutural, quanto é timeout, e a diferença em relação à base, nos mesmos termos. Reduzir tempo só entra se a causa exigir (spec, seção 6).

### 5.5 T3: estados segurados no stub

**Decisão: não mudar o gate antes de E1 a E4.** Se H1 for provada e os testes passarem em ambiente limpo, o stub fica como está. O compartilhamento do gate só é defeito se houver uma falha que dependa dele em execução controlada.

Se H6 for confirmada em `dark-theme:45`, a correção deve manter o que o teste promete, por ordem de preferência: (1) fazer o teste auditar o estado realmente exposto ao usuário durante a espera, se o design o confirmar; (2) ajustar o momento de segurar. Trocar a asserção da linha 67 sem base no design viola RNFF02.

Em `auth-a11y`, a checagem de `holds` está na linha 93, depois das auditorias. Um estado perdido aparece como violação de outra tela, como aconteceu. **Pedido do CAF04:** repetir a checagem logo antes de cada auditoria desses casos, sem remover a final. Isso reforça o teste e não exige mudar o timeout.

---

## 6. Relógio real

### 6.1 Fatos

Os dados do cenário `default` são fixos (out. e nov. de 2026) e `MONTH = "2026-11"`. O resultado depende do relógio em:

| Onde | Efeito |
|---|---|
| `GET .../entries/initial-month` (stub, sem `now`) | Hoje, M = out., e `/entries` vai a nov. com aviso. De 01/11, M = nov. e não há aviso. De 01/12, sem pendência a partir de M e com cartão, vai a jan./2027 com `NO_PENDING_AHEAD` |
| `buildDemo` | Meses da demo ao redor do mês atual, em cache até o próximo cenário |
| Servidor web: `currentYearMonthSP`, `todaySP`, `redirect-to-initial-month` | Mês em caso de falha, "Mês atual" e data padrão. **`page.clock` e o `now` do stub não alcançam esse processo** (ADR 0007 seção 10) |
| `demo-shell.pw.ts:266`, `entries-data.ts:76` | O teste lê o ano e o mês reais |

`seedData` com `now` fixo já isola parte de `initial-month.pw.ts`, mas não os testes com `setScenario("default")` nem o login em `/entries`.

**Sem fonte de prova:** o registro do ciclo 2 foi feito em 30/10 e a suíte de hoje em 31/10. Não encontrei lógica de dia 31 que explique diferença, mas não é prova de ausência.

### 6.2 Regras

1. **Não congelar o relógio na comparação.** A base não tem `now` por cenário (T5 do ADR 0007), e o web usa o relógio do sistema. Descartado `libfaketime`: afeta todos os processos, incluindo timers do Node e do Chromium, e introduz uma variável maior que a que resolve.
2. **Validade:** todas as execuções de uma comparação têm o mesmo (`M_SP`, `M_UTC`), lido no início e no fim. Quem atravessa é descartado.
3. **Janela de hoje:**

| Virada | Horário em São Paulo |
|---|---|
| `M_UTC` passa a nov. | 31/10, 21:00 |
| `M_SP` passa a nov. | 01/11, 00:00 |

Só é válida a comparação terminada antes das 21:00 de hoje, ou iniciada depois das 00:00 de 01/11. **Entre 21:00 e 00:00 os dois meses diferem,** e esse período fica reservado à eventual medição de sensibilidade (6.3), não à comparação. Se as duas suítes não couberem antes das 21:00, é melhor esperar a virada e rodar as duas do que fazer uma em cada lado. Refazer tudo em novembro continua sendo comparação válida; o que muda é o registro do mês.

### 6.3 Sensibilidade à data e o CAF05

As verificações finais provavelmente rodam em novembro, e a apuração, em outubro. Portanto:

- Se a apuração for em outubro, **a branch roda de novo em novembro**, antes de qualquer correção ou com a correção anotada. Falha que só muda com o mês, no mesmo commit, é **defeito de teste por relógio** (H5).
- A correção é passar `now` fixo no cenário do teste, recurso já existente. Se muitos testes com `default` forem afetados, é aceitável uma variável só de stub (`STUB_NOW`) como padrão de `stubNow`. O que depender do relógio do web não é coberto por ela, e o teste precisa ler o mês real, como `currentMonthSP`.
- Sem teste que dependa da data, o trabalho termina aí. Não se reescrevem dados fixos de forma preventiva.
- **Risco remanescente:** nem a suíte verde em novembro garante dezembro, pois o `default` passa a não ter pendência a partir de M. Se a verificação de sensibilidade não cobrir isso, o caso entra no registro como pendência.

---

## 7. Critério de classificação (RFF01, CAF02)

Cada um dos 41 testes recebe dois campos, além de resultado por commit, mensagem e evidência.

**Origem**, decidida nesta ordem sobre execuções controladas:

| Resultado | Origem |
|---|---|
| Passa em todas as execuções da branch, sem correção | **Causa de ambiente** se ligada a H1 ou H2; do contrário, instável, com causa a explicar |
| Falha na branch; **não existe** na base | **Só na branch:** não pode ser "anterior". É tratada como regressão até provar que o teste contraria a spec |
| Falha na branch; passa na base | **Regressão** |
| Falha nos dois lados, com assinatura **diferente** | **Regressão** (causa diferente da base) |
| Falha nos dois lados, com a mesma assinatura | **Anterior à branch.** Se for uma das 10, é "falha conhecida". Se não, é anterior não registrada e vai ao usuário |
| Alterna nos dois lados, sem padrão | **Instável na base.** Fora da feature: P03. Na feature não pode ocorrer, pois os arquivos não existem na base |
| Alterna só na branch | **Regressão de estabilidade** |

Mesma assinatura exige igualdade dos campos da seção 2, depois de normalizar portas, hashes e o mês quando for ele o único elemento variável. Em caso de dúvida, a origem é regressão: o erro de chamar regressão de "instabilidade" é o risco RF1.

Teste com corpo alterado, em caso de mesma assinatura, exige justificativa de que a alteração não mudou o que se testa.

**Natureza:** `produto`, `teste`, `stub` ou `ambiente`. Vale P02: é produto até haver evidência em contrário, e defeito de teste cita o trecho da spec ou do design (CAF09).

**Efeito:**

| Origem | Efeito |
|---|---|
| Regressão, de qualquer natureza | Bloqueia. Corrigir (RFF02) |
| Só na branch | Bloqueia, salvo prova de que o teste contraria a spec, e aí se corrige o teste |
| Teste de `status-filter` ou `initial-month` instável | Bloqueia (RFF03) |
| Anterior, das 10 | Conforme B1 |
| Anterior não registrada, ou instável fora da feature com a mesma causa na base | Registro nominal (P03) e aviso ao coordenador |
| Ambiente | Corrige-se o modo de execução e documenta-se (RFF04) |

A tabela também nomeia as 4 de `auth-a11y` da lista conhecida (G4). Pela spec, seriam os diálogos de inativar e de redefinir senha em mobile, nos dois temas, e o log é compatível com isso. Só a base confirma.

**Regressão fora do previsto em 3.1:** avisar o coordenador antes de seguir (tarefa 3).

---

## 8. O que conta como suíte estável (RFF03, CAF05)

A suíte é estável quando, sobre o **commit final**:

1. Há **duas execuções completas controladas**, seguidas, com o comando da seção 4.2, sem correção entre elas.
2. Os conjuntos de falhas são idênticos e as assinaturas, iguais.
3. Esse conjunto é exatamente o aprovado em B1, com zero falhas em `status-filter.pw.ts` e `initial-month.pw.ts`.
4. Não há `ENOENT`, processo externo, processo órfão nem reaproveitamento.
5. As duas têm o mesmo mês de execução.
6. Nenhum teste passa com mais de 80% do limite de 30 s por estado errado do stub (CAF06). Lentidão legítima é explicada no registro.
7. `--retries=0`, sem `skip`, sem aumento de timeout sem causa (RNFF02).

**Limite do critério.** Duas execuções não provam ausência de instabilidade: um teste com 5% de falha passa nas duas em cerca de 90% das vezes. Para reduzir isso sem criar rodadas completas extras, cada teste dos 25 corrigido ou explicado passa por `--repeat-each=5`, em execução controlada do seu arquivo, na tarefa 9. Isso **complementa** o CAF05, sem substituí-lo.

Se um teste alternar entre as duas execuções, o CAF05 falhou: volta-se a classificá-lo. Não vale uma terceira execução para "desempatar".

---

## 9. Decisões do usuário

**Decididas em 2026-10-31: valem as recomendações abaixo.** B1: as 10 falhas anteriores ficam fora, salvo causa diferente da base. B2: a lista perdida não é reconstruída; a revisão final registra os novos itens 🔵 sem corrigi-los. B3: o nome acessível entra, conforme o adendo de design.

**Dado novo para H1:** o usuário confirmou ter rodado o Playwright em outro terminal por volta das 12:26, o que explica as pastas de V2. Não se sabe se houve sobreposição com a suíte completa de 11:52 a 12:25; por isso, H1 não está provada para os 25 instáveis e os números 16 e 25 seguem como entrada.

### B1 - As 10 falhas anteriores entram neste fechamento?

**Proposta:** não entram, conforme a spec, com a exceção de que falha com causa diferente da base vira regressão (seção 7). A lista nominal é confirmada pelo usuário após a tarefa 3 (V13).

| Resposta | O que muda |
|---|---|
| **Não entram** | Tarefa 10 não roda. O CAF05 aceita as falhas da lista. O registro vira a "tarefa própria" e o PR declara a lista. Sem CI, nada mais impede o merge |
| **Entram** | Tarefa 10 roda antes das verificações. O CAF05 exige suíte sem falhas. Cada correção cita a spec (CAF09). Sem mudança de contrato. Custo: diff maior, fora da feature, e mais uma rodada se surgir algo |
| **Sem resposta** | Tarefa 3 pode rodar, mas a conclusão não, pois RFF05 e CAF05 dependem da lista |

### B2 - Itens azuis (🔵) não registrados

**Proposta:** não reconstruir. A revisão final do diff inteiro registra os itens um a um, com a nota de que a lista original se perdeu. Ficam sem correção, salvo os que o usuário escolher. Se o relatório do ciclo 1 ainda existir na sessão, o coordenador o entrega ao doc-writer.

| Resposta | O que muda |
|---|---|
| **Só registrar** | Tarefa 13 lista e tarefa 16 documenta. Nenhum código a mais |
| **Registrar e corrigir alguns** | Os escolhidos entram entre as tarefas 13 e 14, e a tarefa 12 é repetida |
| **Corrigir todos** | Mesmo fluxo, com escopo maior. Mudança de contrato ou de regra continua fora (RNFF03) |

### B3 - Nome acessível de "Marcar como pago"

**Proposta:** entra, com ajustes em relação à sugestão da spec, por V7 e V8. Em vez de `aria-label`, compor o nome a partir do conteúdo, nas linhas 289 e 345, deixando o texto visível exatamente como é hoje:

```tsx
// linha 289: o nome acompanha o que estiver visível
<span className="hidden lg:inline">Marcar como pago</span>
<span className="lg:hidden">Pagar</span>
<span className="sr-only">: {entry.description}</span>

// linha 345
Marcar como pago<span className="sr-only">: {entry.description}</span>
```

Resultado: "Marcar como pago: Internet" em `lg` e no mobile; "Pagar: Internet" entre `md` e `lg`. Resolve as três faixas e reaproveita o padrão `sr-only` de `InvoiceChip`. Trecho apenas ilustrativo; quem implementa é o frontend-dev. Com um `aria-label` fixo, a faixa `md` continuaria violando a regra.

**Custos:**

- **Locators do lote (V8):** precisam de `exact: true` ou de regex ancorada. Quando há seleção, o rótulo vira "Marcar como pago (N)", então `buttons:148`, `a11y:40` e semelhantes precisam de algo como `/^Marcar como pago( \(\d+\))?$/`.
- **Locators de linha:** `a11y:161`, `initial-month:218`, `status-filter:194,204,211,231,241,252,257`, e os specs unitários que usem o nome.
- **`status-filter:221`** e **`entries:242`** usam regex que passa a casar com mais botões; revisar a intenção de cada um.
- **jsdom não aplica CSS:** as duas `span` da linha 289 entram no nome calculado nos unitários. A verificação da faixa fica no Playwright.
- Toda troca de seletor é justificada pela mudança de nome (CAF09), sem enfraquecer a asserção.

**Cobertura (T4):** teste direcionado com `new AxeBuilder({ page }).withRules(["label-content-name-mismatch"])` em `/entries?month=<mês>`, em **360, 768 e 1280 px**, com cenário que tenha despesa pendente. 768 é acréscimo ao CAF07, pela V7. Não se amplia o axe das demais telas, para não aumentar o escopo. Abre diretamente com `month`, sem depender de corrida.

| Resposta | O que muda |
|---|---|
| **Entra, composição por conteúdo** (proposta) | Tarefa 8 como acima. CAF07 com as três larguras |
| **Entra, `aria-label` "Marcar como pago: X"** (sugestão da spec) | Menos mudança na marcação, mesmos custos de locators. **A faixa `md` continua em violação**: o CAF07 só passa sem o teste em 768, e a pendência fica registrada |
| **Não entra** | Tarefa 8 não roda. A violação vira pendência nominal no registro e no PR. Sem efeito sobre `auth-a11y` "login carregando": a correção daquele teste o devolve à tela de login, e a violação deixa de ser exercitada. **O problema continua existindo sem teste que o acuse** |

A proposta é a mesma qualquer que seja a origem, mas E5 registra se a violação já existia na base.

**Nada aqui precisa do ui-designer:** nenhuma das opções muda o que é visível. Mudam só os anúncios do leitor de tela, e os roteiros da seção 7 da spec conferem isso.

---

## 10. Impacto no Next.js e em arquivos

| Área | Mudança | Condição |
|---|---|---|
| Páginas, Server Actions, rotas | Nenhuma prevista | Só o que a apuração comprovar (P01). `admin-users:265`, se E4 der defeito |
| `expenses-list.tsx` | Nome acessível | B3 |
| `web/e2e/*.pw.ts` | Correções por tarefa, teste direcionado | Classificação; B3 |
| `web/e2e/stub-api/server.mjs` | Nenhuma prevista. `STUB_NOW` só se 6.3 exigir | Prova |
| `web/playwright.config.ts` | `PW_REUSE` (seção 4.6) | H1 ou H2 provadas |
| `web/README.md` | Modo de execução | RFF04 |
| `docs/runs/listagem-mes-e-status-padrao.md` | Tabela, tempos, pendências | Tarefa 16 |
| `api/` | Nenhuma | Só verificação (P07) |

---

## 11. Violações de SOLID que afetam o fechamento

| # | Onde | Violação | Efeito | Tratamento |
|---|---|---|---|---|
| S1 | `server.mjs`: `state` e `releaseGate` globais | SRP: um único estado mutável por processo atende todos os clientes, sem isolamento | Qualquer cliente pode invalidar o teste em andamento. Causa provável de H1 | Não refatorar agora. Isolamento por sessão é maior que o fechamento. Mitiga-se com execução exclusiva (4.5, 4.6) |
| S2 | `POST /__scenario` também abre o gate | CQS e SRP: definir cenário libera requisições | Efeito colateral difícil de ver (T3) | Registrar. Só mudar se uma falha controlada depender disso |
| S3 | `releaseMutations` em `support.ts` | Nome preso a mutações, mas libera também consultas | Confunde quem lê `dark-theme:69` | Registrar, sem renomear neste fechamento |
| S4 | `expenses-list.tsx`: linhas 289 e 345, rótulo duplicado em tabela e cards | DRY/OCP: mudar o nome exige dois pontos | B3 pode divergir | Se B3 entrar, avaliar um componente pequeno `PayEntryButton`. Não ampliar a extração além disso |
| S5 | `auth-a11y.pw.ts`: `row()` usa `getByRole("row")` em mobile; `admin-users.pw.ts:14` já avisa que é só para desktop | LSP informal: o helper não vale em todos os viewports | Provável causa das 4 falhas conhecidas (a confirmar) | Conforme B1 |
| S6 | `playwright.config.ts`: `CI` controla reuso e retries juntos | SRP: não se liga um sem o outro | Obriga a `--retries=0` em 4.2 | Separa-se se 4.6 for aplicada |

---

## 12. Alternativas descartadas

| # | Alternativa | Motivo |
|---|---|---|
| A1 | Rodar a base com `git stash` ou `checkout` no diretório principal | Compartilha `.next`, `test-results` e `node_modules`; perde o estado de quem usa o diretório |
| A2 | Rodar a base em paralelo, só com portas diferentes | Compete por CPU e invalida tempo. Portas não isolam o diretório |
| A3 | Rodar só as 41 nos dois lados, como primeira escolha | Perde o contexto da suíte, que é justamente o que está em dúvida, e a referência de duração. Fica como plano reduzido (4.4) |
| A4 | Portar na base o suporte a `PW_*` | A base deixaria de ser a base |
| A5 | Rodar os testes da branch contra o código da base | Falsearia a comparação, pois testes e stub mudaram (RF5). O CAF02 usa cada um no seu commit |
| A6 | Congelar o relógio com `libfaketime` | Seção 6.2 |
| A7 | `retries` local para aceitar instabilidade | Proibido por RNFF02 |
| A8 | Ampliar o axe a todas as telas (T4) | Aumenta o escopo. Fica como sugestão para outra branch |
| A9 | Refatorar o stub para isolar estado por sessão | Grande para um fechamento. Só com falha comprovada e sem outra saída |
| A10 | Aceitar a causa ambiental com base nos indícios desta conferência | Sem E1 e E3, repetiria o erro de chamar regressão de instabilidade (RF1) |

**Trade-offs aceitos:** as suítes completas custam tempo, com risco de ultrapassar o limite de hoje (seção 6.2); `CI=1` faz o modo da apuração diferir do uso comum, o que é intencional; dois worktrees exigem `npm ci` e build próprios; manter o stub global continua a exigir disciplina de uma execução por vez.

---

## 13. Plano de testes por camada

| Camada | O que roda | Comando | Critério |
|---|---|---|---|
| Domain, application (api) | Sem código novo. Verificação | `npm run test:cov` | >= 915 testes; >= 80% |
| Infra (api) | Verificação | `npm run test:int` | >= 222 |
| Presentation (api) | Verificação | `npm run test:e2e` | >= 309 |
| Qualidade (api) | Verificação | `npm run lint`, `npm run typecheck`, `npm run build` | Sem erros |
| Web, unitário | >= 1754. Se B3 entrar: `expenses-list.spec.tsx` com nome contendo a descrição, ajustado ao jsdom | `npm run test:cov` | Sem queda |
| Web, qualidade | | `npm run lint`, `npx tsc --noEmit`, `npm run build` | Sem erros |
| Web, Playwright | Seção 8 | Seção 4.2 | Seção 8 |
| Regressão de correção | Cada correção de produto tem teste que falha antes (`admin-users:265`, se for o caso) | Red antes do fix | CAF03, CAF04 |
| A11y direcionada | Seção 9, se B3 entrar | Playwright | CAF07 |
| Manual | Roteiros A, B e C da spec. **Só o usuário** | - | CAF11 |

Os testes de instrumentação de 5.3 não são versionados nem contam para a suíte.

Sequência: tarefas 11 e 12 sobre o commit final, sem nada em paralelo. Os gates de API usam testcontainers e também pesam em CPU, por isso rodam antes ou depois do Playwright, nunca junto.

---

## 14. Ordem da apuração (tarefas 1 a 3)

1. **Preservar** logs e `web/test-results`; registrar as datas dos arquivos (3.2).
2. Confirmar ambiente e horário: decidir pela janela (6.2).
3. Criar worktrees; verificar `PW_*` e o cálculo do mês da demo na base (V5, V6).
4. E1: suíte controlada da branch (CAF01).
5. Suíte controlada da base (CAF02).
6. E2, E3 e E4, conforme o que restar; E5 junto com a base.
7. Entregar a tabela da seção 7 e o relatório de tempo.
8. Parar se surgir regressão fora da seção 3.1 da spec.
9. Se a apuração for em outubro, repetir a branch em novembro (6.3).

**Saídas que encerram a apuração:** todos os 41 classificados nos dois eixos; causa da instabilidade e dos 33 min aceita pela regra D3, ou declarada não identificada, com o que foi refutado. "Não identificada" não atende ao RFF04: volta ao coordenador, em vez de ser dada como concluída.

---

## 15. Riscos residuais

| Risco | Mitigação |
|---|---|
| Indícios da seção 3.2 levarem a aceitar H1 sem prova | D3, A10 |
| Evidência apagada na próxima execução | Passo 1 da seção 14 |
| Base não sobe (dependências ou `.env`) | Registrar. Usar o mesmo `.env` nos dois lados. Se a base continuar sem subir, o coordenador decide, pois sem ela o CAF02 não se cumpre |
| Janela de hoje insuficiente | Seção 6.2: esperar, sem misturar meses |
| `CI=1` afetar o `next build` | Mesmo modo nos dois lados; anotar diferenças no log de build |
| Suíte frágil em dezembro | Seção 6.3 |
| Nome acessível novo afetar a leitura | Roteiro C e demais roteiros da spec |
| Outro processo iniciado durante a verificação final | Coordenador garante exclusividade; o `ps` periódico o detecta |
