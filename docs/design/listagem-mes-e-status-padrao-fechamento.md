# Design (adendo): Fechamento da listagem com mês e status padrão

- Data: 2026-10-31
- Branch: `feat/listies`
- Autor: ui-designer
- Status: **Aprovado pelo usuário em 2026-10-31, com B3.**
- Adenda a: `docs/design/listagem-mes-e-status-padrao.md` (Aprovado), que continua valendo integralmente.
- Entradas: `docs/specs/listagem-mes-e-status-padrao-fechamento.md` (B3, CAF07), `docs/adr/0008-listagem-mes-e-status-padrao-fechamento.md` (V7, V8, seção 9), `web/features/entries/_components/expenses-list.tsx`.

**Sem tela nova e sem mudança visível.** Layout, hierarquia, componentes, estados de carregamento, erro e vazio e fluxos seguem o design aprovado. Nenhum token novo.

**Limite de verificação.** Conferido por leitura do código, sem executar nada. O efeito sobre o cálculo do nome (1.3) precisa ser confirmado no primeiro teste.

---

## 1. Decisão B3: nome acessível dos botões de pagamento

### 1.1 Regra

O nome acessível é **o texto visível naquela largura + ": " + a descrição da despesa**. O texto visível vem primeiro e por inteiro, como pede a WCAG 2.5.3. A descrição continua identificando a despesa. A regra vale para as linhas 289 e 345, e só para despesas pendentes fora da demo, onde o botão existe.

### 1.2 Texto e nome por largura

Exemplo com a despesa "Internet".

| Largura | Faixa | Onde está o botão | Texto visível (sem mudança) | Nome acessível |
|---|---|---|---|---|
| **360 px** | < `md` (até 767) | Card, linha 345 | Marcar como pago | **Marcar como pago: Internet** |
| **768 px** | `md` a < `lg` (768 a 1023) | Tabela, linha 289 | Pagar | **Pagar: Internet** |
| **1280 px** | >= `lg` (1024 em diante) | Tabela, linha 289 | Marcar como pago | **Marcar como pago: Internet** |

Os limites são os padrões do Tailwind, pois `globals.css` não redefine breakpoints. Testar também as bordas 767/768 e 1023/1024 é recomendado.

Tabela e cards coexistem no DOM, mas a versão oculta fica em `display: none` e não entra na árvore de acessibilidade. Em cada largura, portanto, cada despesa tem um único botão exposto.

| Fica fora do nome da despesa | Motivo |
|---|---|
| Valor, data e cartão | Já estão na linha ou no card. O checkbox da mesma linha já os anuncia |

| Não muda | Valor atual |
|---|---|
| Aparência do botão: texto, tamanho, variante, alvo de 44 px | Como hoje |
| Título do diálogo individual | Marcar "Internet" como pago? |
| Botão de confirmação do diálogo | Marcar como pago, ou Pagando… durante o envio |
| Foco e toast depois de pagar | Design aprovado, 6.2 |
| Botão de lote | Marcar como pago, ou Marcar como pago (N) |

**Forma de obter o nome: composição por conteúdo (ADR, seção 9).** O `aria-label` atual sai, e a descrição entra como texto `sr-only`. Um `aria-label` único, como o sugerido na spec, não serve: "Marcar como pago: Internet" não contém "Pagar", e a faixa de 768 px continuaria em violação. O `sr-only` tem posição absoluta, fica fora do fluxo do `.btn` e não aciona o `gap` de 8 px, então a aparência não deve mudar. A comparação visual em 1.5 confirma isso.

### 1.3 Espaço antes dos dois-pontos: achado que afeta os testes

A string acima é o contrato de conteúdo, mas **um locator com a string literal pode falhar**. O ADR não trata este ponto.

- `.btn` é `inline-flex`, e `sr-only` usa posição absoluta. Nos dois casos, o `display` calculado do `span` deixa de ser `inline`.
- O cálculo de nome do Playwright acrescenta espaços em volta de elementos com `display` diferente de `inline` (lido em `playwright-core`). O resultado esperado é **"Marcar como pago : Internet"**.
- Navegadores podem fazer o mesmo. Não verifiquei no Chromium, nem com leitor de tela.

**Decisão:** esse espaço é efeito do cálculo do nome, não muda o que a pessoa ouve de forma relevante e é aceito. É a **única** variação tolerada. Os testes ancoram o nome inteiro nas duas pontas e aceitam espaço apenas em volta dos dois-pontos. Substring e nome sem a descrição não valem.

Se o Roteiro C mostrar que o leitor de tela pronuncia algo estranho nesse ponto, o assunto volta ao ui-designer.

### 1.4 Colisão com o botão de lote (ADR V8)

Hoje "Marcar Internet como pago" não contém "Marcar como pago". O novo nome contém. Como `getByRole` com `name` em string casa por substring, os locators do lote passam a casar também com os botões de linha.

| Largura | Botão de lote exposto | Botões de linha | Colide? |
|---|---|---|---|
| 360 px | Só com seleção, na barra fixa: Marcar como pago (N) | Marcar como pago: X | **Sim, com seleção.** Sem seleção o locator do lote passa a achar só as linhas |
| 768 px | Na barra de ferramentas: Marcar como pago ou Marcar como pago (N) | Pagar: X | **Não** |
| 1280 px | Na barra de ferramentas: Marcar como pago ou Marcar como pago (N) | Marcar como pago: X | **Sim, sempre que houver despesa pendente** |

**Locators listados no ADR (V8):** `buttons:108,148`, `theme:300`, `a11y:40`, `dark-theme:154`, `glass:226,447`, `entries:73,89,121,134`.

**Conferência contra o código:**

- Todas as linhas listadas existem e usam a string "Marcar como pago" sem escopo. Na largura desktop, a maioria passa a falhar por casar com vários elementos, o que torna o problema visível.
- `entries:89` é o caso silencioso. Ele exige contagem 0 na aba Receitas e continua passando, mas agora cobre lote e linhas. É preciso decidir de forma explícita o que ele afirma.
- `status-filter:221` e `entries:242` usam regex sem âncora. Em `status-filter:221`, o `.first()` só continua pegando o lote porque a barra vem antes na ordem do DOM, o que é frágil.
- **Não colidem:** os locators com escopo em `alertdialog`, pois o nome do botão de confirmação não muda. Os unitários com `getByRole` e string em `expenses-list.spec.tsx` casam o nome inteiro por padrão, salvo as ocorrências que usam o nome antigo, que precisam acompanhar a mudança.

**Tratamento:** a colisão se resolve **nos testes, sem alterar nome ou texto do lote**. O locator do lote passa a casar o nome inteiro, e o de linha, o nome com a descrição (ADR, seção 9; CAF09). Locators de linha com o nome antigo também mudam: `a11y:161`, `initial-month:218`, `status-filter:194,204,211,231,241,252,257`.

**Efeito para quem usa o produto.** Em 1280 px, um comando de voz como "clicar em Marcar como pago" passa a corresponder ao lote e às linhas, e o software de voz pede para escolher. Isso é aceito: é o comportamento que a WCAG 2.5.3 busca, e hoje esse comando não alcança as linhas. Para leitor de tela, os nomes continuam distintos, pois só os de linha têm a descrição.

### 1.5 Verificação (CAF07 com a ampliação do ADR)

Quem faz: tester e frontend-dev, depois da aprovação de B3.

- Axe com `label-content-name-mismatch` em **360, 768 e 1280 px**, com despesa pendente, abrindo `/entries` com `month`. Sem violação.
- Em cada largura, o nome de cada botão confere com 1.2, observada a tolerância de 1.3.
- Comparação visual do botão, antes e depois, nas três larguras, sem diferença de texto, tamanho ou posição.
- `jsdom` não aplica CSS, então os unitários não conferem a faixa. A conferência por largura fica no Playwright.
- **Manual, só o usuário:** nos Roteiros A a C da spec, nenhum passo manda ouvir o nome do botão. Sugiro acrescentar ao Roteiro C: "antes de ativar, confirme que o botão é lido como 'Marcar como pago: `<descrição>`' ou 'Pagar: `<descrição>`'".

**Divergência com a spec, que este adendo não altera:** o CAF07 cita só "mobile e `lg`" e B3 sugere um único nome. A faixa de 768 px exige o acréscimo do ADR (V7), que o responsável pela spec precisa registrar.

### 1.6 Efeito de cada resposta do usuário

| Resposta a B3 | Efeito neste adendo |
|---|---|
| **Entra, composição por conteúdo** (recomendada) | Seção 1 vale como está |
| **Entra, `aria-label` único** | 360 e 1280 px como em 1.2. **768 px continua violando a WCAG 2.5.3**, com pendência registrada, e esta opção não atende à exigência de valer nas três larguras |
| **Não entra** | Seção 1 não se aplica. Os nomes atuais ficam, e a violação vira pendência nominal no registro e no PR |

---

## 2. Regra geral: correções não alteram o design aprovado

Vale para todas as tarefas do fechamento, sem depender de B3.

1. **Correções de teste ou de regressão não alteram o design aprovado.** O design é a referência: quando um teste diverge dele, muda o teste; quando a tela diverge, ela volta ao que foi aprovado.
2. **Se uma correção precisar alterar algo visível, ela para e volta ao ui-designer**, por meio do coordenador, antes de ser aplicada. A alteração só segue com o design revisado e aprovado pelo usuário.
3. **Conta como alteração visível:** texto, layout, ordem, cor, tamanho, presença de um elemento, estados de carregamento, erro e vazio, e o momento em que eles aparecem ou somem.
4. **O que o design aprovado define também não muda por correção**, mesmo sem efeito visual: destino do foco e anúncios (seção 10). Se a correção precisar mudá-los, segue o mesmo caminho do item 2.
5. **A exceção é só a seção 1 deste adendo**, depois de B3 aprovada e nos limites dela: muda o nome acessível, nada visível.
6. **Em caso de dúvida, trate como alteração visível.**
