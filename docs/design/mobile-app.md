# Design: App mobile iOS (React Native / Expo)

- Data: 2026-11-02 (rev. 3)
- Branch: `feat/moble`
- Autor: ui-designer
- Status: **DM1-DM10 e DM12-DM16 decididos; DM11 substituída por B6; B2-B8 incorporados (rev. 3).** Pendente só o P-ADR1 (variante da troca de senha pendente), a fechar no ADR 0011.
- Entradas: `docs/specs/mobile-app.md` (RF01-RF25, RNF01-RNF14, CA01-CA33), `docs/adr/0011-app-mobile-ios.md` (§10), `docs/adr/0010-despesas-parceladas.md`, `docs/design/design-system.md` (rev. 7), web existente (`web/lib`, `web/components`, `web/features`, `web/app/(protected)/entries/actions.ts`).
- Escopo: só `mobile/`. Nenhuma mudança visual no web.

Este documento define layout, hierarquia, componentes, estados, fluxos, acessibilidade e o checklist da revisão da App Store. Não contém código. Os textos entre aspas são os textos finais em pt-BR, e os que já existem no web foram copiados de lá.

### Mudanças da rev. 3

| Decisão | O que mudou |
|---|---|
| B6 (substitui DM11) | "Editar" e "Excluir" aparecem para **qualquer usuário** (ADMIN ou USER, inclusive a conta demo), sobre os próprios lançamentos. Removida a condição de papel em princípios, fluxos, telas, componentes, estados, acessibilidade e checklist (1, 5.1, 5.11, 5.15-5.17, 6.4, 6.6, 6.6.3, 7.2, 8.5, 9.1, 12) |
| DM12-DM16 | Aceitos como propostos; marcados como "Decidido" (0.1) |
| B5 | A conta demo entra com o e-mail `demo@showcase.invalid` e a senha "demo". O campo continua sendo de e-mail; removida a nota sobre aceitar "demo" sem "@" (5.2, 6.1, 11, 12). P-ADR4 encerrado |
| B8 | Na conta demo, "Alterar senha" fica **desabilitado** em Ajustes, com a explicação "Indisponível na conta de demonstração" (5.3, 6.10) |
| B7 | Os dados da conta demo são apagados todos os dias às 03:00. Aviso discreto no card de boas-vindas e em Ajustes, só na conta demo (5.11, 6.3.1, 6.10). P-ADR3 encerrado |

### Mudanças da rev. 2

| Decisão | O que mudou |
|---|---|
| DM1-DM10 | Marcados como "Decidido" |
| B2 | Sessão de 24 h sem renovação, igual ao web. Expirou → Entrar com aviso (5.1, 5.8). Removida a tentativa de renovação |
| B3 | Finanças deixa de ser só leitura: pagar despesa (individual e em lote), pagar fatura, editar e excluir despesa, inclusive parcelas (5.12-5.17, 6.4, 6.5, 6.6.3, 8.5) |
| B4 | Removida a tela de troca obrigatória. Novo "Alterar senha" opcional em Ajustes (5.3, 6.2) e estado previsto "Troca de senha pendente" (5.3.1, 6.2.1) |
| B5 | Removido o modo demonstração (rotas `(demo)`, banner, aba "Sobre", botão "Ver demonstração"). A conta demo é um usuário real sem dados. Estados vazios de primeira execução no Dashboard e em Finanças (6.3.1, 6.4.1) |

---

## 0. Decisões de design

### 0.1 Decididas

| # | Tema | Spec | Web hoje | Decisão | Status |
|---|---|---|---|---|---|
| DM1 | Nome do segundo saldo | "Saldo projetado" | "Saldo previsto" (`month-summary.tsx`, gráficos) | **"Saldo previsto"**, igual ao web | Decidido |
| DM2 | Opções de status | "Todas, Pendentes ou Pagas" | "Todos / Pendente / Pago" (`status-filter-field.tsx`) | **"Todos / Pendente / Pago"**, igual ao web | Decidido |
| DM3 | Status padrão em Despesas e Faturas | não define | `PENDING` (ADR 0007) | **Pendente** como padrão, igual ao web. "Todos" fica a um toque | Decidido |
| DM4 | Saldo negativo (CA12) | "-R$ 150,00" ou "R$ -150,00" | `formatBRL` gera "-R$ 150,00" | **"-R$ 150,00"** + indicador "Negativo" com seta para baixo | Decidido |
| DM5 | Confirmação após criar despesa | "Despesa criada." | `feedback.ts` diz se ficou paga, pendente ou em qual fatura | Texto principal da spec ("Despesa criada.") e, no cartão, uma 2a linha do web: "Na fatura de nov/26 do Nubank, vence 20/11/2026." | Decidido |
| DM6 | Fundo e vidro fosco | P06: sem vidro obrigatório | gradiente (rev. 6) + vidro (rev. 7) | **Fundo sólido `--bg` e superfícies opacas** (paleta da rev. 5/6). O único material translúcido é o nativo do iOS (tab bar e barra de navegação) | Decidido |
| DM7 | Fonte | - | Space Grotesk + Inter | **Fonte do sistema (SF Pro)** em todo o app, para Dynamic Type nativo e aparência iOS. Space Grotesk só no logotipo da tela de entrar | Decidido |
| DM8 | Rota do detalhe da fatura | ADR: `app/invoice/[cardId]/[referenceMonth].tsx` (raiz) | - | **Dentro da pilha da aba Finanças** (`app/(tabs)/finances/invoice/...`), para manter a tab bar visível e o "Voltar" nativo (HIG) | Decidido |
| DM9 | Teclado do campo Valor | "teclado numérico com máscara pt-BR" | máscara da direita para a esquerda (`maskMoneyInput`) | **Teclado decimal (`decimal-pad`) com vírgula**, interpretado por `parseMoneyInput`, e formatação com milhar ao sair do campo. É o único modo em que o CA23 ("1234,5" → `"1234.50"`) vale literalmente. Ver 7.4 | Decidido |
| DM10 | Mês do Dashboard x mês de Finanças | não define | páginas separadas | **Independentes**: o Dashboard abre no mês corrente, Finanças no mês inicial (P10). Cada aba guarda o seu | Decidido |
| DM11 | Quem edita e exclui | - | - | **Substituída por B6** (abaixo) | Substituída |
| B6 | Quem edita e exclui | - | Web: editar/excluir só para ADMIN | **Qualquer usuário** (ADMIN ou USER, inclusive a conta demo) edita e exclui os próprios lançamentos. O app não consulta o `role` para mostrar ações. "Pagar", "Editar" e "Excluir" aparecem para todos | Decidido |
| DM12 | O que se edita | - | Só despesas; campos Descrição, Categoria, Data e Valor (`EditExpenseDrawer`). Forma de pagamento e cartão não mudam. Data travada em despesa paga no cartão | **Igual ao web.** Receitas não têm editar, excluir nem pagar (o web e a API não oferecem) | Decidido |
| DM13 | Excluir parcelas: "só esta" ou "todas" | - | Cada parcela é um lançamento independente; não há exclusão em grupo (ADR 0010, itens 1 e 7). O web exclui uma por vez | **Só a parcela escolhida.** Não há escolha "só esta / todas". Se a API ganhar exclusão em grupo, o desenho previsto está em 5.16.1 | Decidido |
| DM14 | Desfazer | - | O web não tem desfazer: exclusão e pagamento só com confirmação. A API não tem "desmarcar pago" | **Excluir:** confirmação + toast "Desfazer" por 5 s (a exclusão só é enviada quando o toast some). **Editar:** toast "Desfazer" por 5 s (envia os valores anteriores). **Pagar:** sem desfazer (a API não permite); por isso a confirmação é obrigatória | Decidido |
| DM15 | Pagar uma despesa | - | Botão "Marcar como pago" visível em cada card pendente (celular) + confirmação | **Círculo de status à esquerda da linha** (como o app Lembretes) + deslizar para a direita + menu de contexto. Sempre com confirmação (DM14) | Decidido |
| DM16 | Pagar em lote | - | Caixas de seleção + barra fixa "Marcar como pago (N)" | **Modo de seleção nativo**: botão "Selecionar" na barra, círculos viram marcas de seleção, barra inferior com total e "Marcar como pago (N)" | Decidido |
| B5 | Login da conta demo | - | - | E-mail `demo@showcase.invalid`, senha "demo". O campo de login continua sendo de e-mail | Decidido |
| B7 | Limpeza da conta demo | - | - | Dados apagados todos os dias às 03:00. Aviso discreto só na conta demo (6.3.1, 6.10) | Decidido |
| B8 | "Alterar senha" na conta demo | - | - | **Desabilitado com explicação** em Ajustes (6.10). Justificativa: a linha desabilitada com motivo mostra ao revisor que a função existe e por que não está disponível, sem parecer que falta algo nem virar botão morto | Decidido |

### 0.2 Pontos que dependem do ADR

| # | Ponto | Estado previsto aqui |
|---|---|---|
| P-ADR1 | Comportamento exato quando a API indica troca obrigatória de senha pendente (`mustChangePassword` ou 403 `PASSWORD_CHANGE_REQUIRED`) | Tela simples "Troca de senha pendente" (6.2.1) com duas variantes; o ADR escolhe uma |
| P-ADR2 | Papel (`role`) da conta demo | **Encerrado por B6**: o papel não muda nada no app (todas as ações aparecem para todos). Recomendação mantida: USER, por ter senha pública |
| P-ADR3 | Limpeza da conta demo | **Encerrado por B7**: limpeza diária às 03:00 |
| P-ADR4 | Login "demo" no campo "E-mail" | **Encerrado por B5**: o login é o e-mail `demo@showcase.invalid` |
| P-ADR5 | Como o app sabe que a conta é a demo (B7, B8) | O design precisa de um sinal booleano (ex.: campo em `me`). Na falta dele, o app compara o e-mail de `me` com `demo@showcase.invalid`. O ADR define a fonte; o design só usa "conta demo: sim/não" |

---

## 1. Princípios

1. **Parece um app iOS, fala como o web.** Navegação, controles e gestos são nativos (barra de navegação com título grande, tab bar, folhas modais, listas agrupadas, interruptores, seletor de data nativo, ações de deslizar, menu de contexto). Textos, rótulos de status, formato de dinheiro e datas, categorias e cores semânticas são os do web.
2. **Toda ação tem um caminho visível e atalhos.** Cada ação sobre um lançamento tem um controle visível (círculo de pagar, toque na linha para editar, botão "Pagar fatura") e atalhos nativos (deslizar, menu de contexto, ações do VoiceOver). Nenhuma ação existe só no gesto. As ações são as mesmas para todo usuário (B6); o que muda é só o tipo e o estado do lançamento (receita, paga, pendente).
3. **Destrutivo pede confirmação; reversível oferece desfazer.** Excluir: folha de ações destrutiva + "Desfazer". Pagar: confirmação (não há desfazer na API). Editar: "Desfazer".
4. **Status e sinal nunca só por cor.** Sempre ícone + texto (Pendente, Pago, Recebida, Positivo, Negativo, Zerado), como os `StatusBadge` e `SignIndicator` do web.
5. **Dinheiro é texto.** Todo valor exibido passa por `formatBRL` (string). As bibliotecas de gráfico recebem números só para geometria, nunca para rótulos (ADR 0011 §10.5). Totais vêm sempre da API (CA17).
6. **Cada bloco falha sozinho.** Carregamento, erro e vazio são por bloco (Dashboard), por aba (Finanças) e por linha (ações).
7. **Pronto para a revisão da Apple.** Sem botões mortos, sem conteúdo provisório, conta demo real que começa vazia e convida a criar o primeiro lançamento, links de privacidade e suporte dentro do app, comportamento correto sem rede.

---

## 2. Fundamentos visuais

### 2.1 Cores (tema claro / escuro)

Tokens do `design-system.md` (rev. 5/6, valores opacos), exportados como um objeto de tema no mobile. Nenhuma cor literal fora do arquivo de tokens do app. Mesmas regras de uso do web (texto só com tokens de texto; `--success`/`--warning`/`--danger` só para preenchimento e borda).

| Papel no app | Token | Claro | Escuro |
|---|---|---|---|
| Fundo das telas | `--bg` | `#ECEEFC` | `#181E2A` |
| Card, linha de lista, folha, grupo de Ajustes | `--surface` | `#FFFFFF` | `#1C2330` |
| Faixa de subtotal, pressionado, skeleton de fundo, linha selecionada | `--surface-2` | `#F4F6F9` | `#252D3C` |
| Campo de texto | `--input-bg` | `#FFFFFF` | `#151B26` |
| Divisória, borda de card | `--border` | `#D9DEE6` | `#2E3747` |
| Borda de controle, borda com "Aumentar contraste", contorno do círculo de pagar | `--border-strong` | `#6F798C` | `#7A8497` |
| Texto principal e valores | `--text` | `#1E293B` | `#E3E7EE` |
| Texto secundário, rótulos | `--text-muted` | `#4B5567` | `#9BA5B7` |
| Desabilitado | `--text-disabled` | `#6F798C` | `#7A8497` |
| Botão primário (fundo / borda / texto) | `--primary-strong` / `--primary-border` / `--on-primary` | `#4F46E5` / `#4F46E5` / `#FFFFFF` | `#4F46E5` / `#818CF8` / `#FFFFFF` |
| Tint do app: links, item ativo da tab bar, botões da barra de navegação, segmento selecionado (texto), ação "Editar" ao deslizar (fundo) | `--accent` | `#0E7490` | `#5CC8DB` |
| Pago, ação "Pagar" ao deslizar (fundo) | `--success-text` (ícone/texto/fundo da ação), `--success` (ponto) | `#047857` | `#34D399` |
| Pendente | `--warning-text`, `--warning` | `#92400E` | `#FBBF24` |
| Erro, Negativo, ação "Excluir" ao deslizar (fundo) | `--danger-text`, `--danger` (borda) | `#B91C1C` | `#F87171` |
| Receita, Recebida | `--income` | `#1D4ED8` | `#60A5FA` |
| Despesa | `--expense` | `#BE123C` | `#FB7185` |
| Gráfico: receitas / pago / pendente | `--chart-income` / `--chart-paid` / `--chart-pending` | `#1D4ED8` / `#059669` / `#B45309` | `#60A5FA` / `#34D399` / `#FBBF24` |
| Rosca: 1a a 5a categoria, "Outras" | `--chart-1..6` | ver design-system | ver design-system |
| Eixo, grade | `--chart-axis`, `--chart-grid` | `#4B5567`, `#D9DEE6` | `#9BA5B7`, `#343E51` |
| Fundo atrás de alertas customizados | `--scrim` | `rgb(15 23 42 / 0.45)` | `rgb(8 11 17 / 0.72)` |

- Ações de deslizar: ícone + texto na cor de contraste do fundo. No claro, texto `#FFFFFF` sobre `--success-text`, `--accent` e `--danger-text`. No escuro, os fundos são claros, então o texto é `--bg` (`#181E2A`). Os 6 pares entram no teste de tokens do mobile (RNF08, mínimo 4,5:1).
- Os pares de contraste opacos já verificados no web (rev. 5/6, `tokens.spec.ts`) valem aqui porque o app usa as mesmas superfícies opacas. O teste de tokens do mobile deve repetir os mesmos pares (RNF08).
- **Aumentar contraste** (Ajustes do iOS): bordas de card passam de `--border` para `--border-strong`.
- **Reduzir transparência**: tab bar e barra de navegação ficam opacas (`--surface`). Com materiais nativos isso é automático.

### 2.2 Tema

- Padrão: segue o sistema (`useColorScheme`), ao vivo.
- Ajustes > Tema: "Sistema", "Claro", "Escuro". A escolha fica em AsyncStorage (dado não sensível) e é aplicada antes da primeira tela (sem piscar). A troca é instantânea, sem transição de cor (igual ao web).
- O `userInterfaceStyle` do app é `automatic`. A tela de abertura (splash) tem versão clara e escura.

### 2.3 Tipografia (Dynamic Type)

Fonte do sistema (SF Pro) com os estilos de texto do iOS, para escalar com Dynamic Type sem trabalho extra (DM7). Valores tabulares (`fontVariant: tabular-nums`) em todo dinheiro e data.

| Estilo | Tamanho base (Large) | Peso | Uso |
|---|---|---|---|
| Large Title | 34 | Bold | Título grande da tela (Dashboard, Finanças, Ajustes) |
| Title 2 | 22 | Bold | Valor principal dos cards de resumo |
| Title 3 | 20 | Semibold | Título de folha, de tela de estado e do card de boas-vindas |
| Headline | 17 | Semibold | Título de card, descrição do lançamento, valor do lançamento |
| Body | 17 | Regular | Texto, campos |
| Subheadline | 15 | Regular | Rótulos secundários, subtotal, status |
| Footnote | 13 | Regular | Ajuda de campo, rodapé de seção, eixo do gráfico, aviso da conta demo |
| Caption 1 | 12 | Medium | Chip "Fatura nov/26" |

- `allowFontScaling` sempre ligado. Não há `maxFontSizeMultiplier`, exceto nos rótulos dentro do desenho do gráfico (eixo e meses, limite 1,3x). Esses valores aparecem sem limite na tabela alternativa e no resumo textual.
- Nenhum texto com altura fixa: alturas mínimas sim, máximas não. Descrições quebram em até 2 linhas na lista e cortam com "…" só depois disso; o texto completo continua no rótulo de acessibilidade.

### 2.4 Espaçamento, forma e ícones

- Grade de 4 pt. Margem lateral 16 pt (20 pt em telas de 428 pt ou mais). Espaço entre cards 12 pt; entre seções 24 pt.
- Raio: 8 (campos e botões), 12 (cards e linhas de lista agrupada), 999 (chips e pontos). Mesmo do web.
- Card: `--surface`, borda 1 pt `--border`, sem sombra no escuro e sombra sutil `--shadow-color` no claro.
- Ícones: SF Symbols, por um componente `Icon` (adaptador; RNF01 pede que nada exclusivo do iOS vaze fora de adaptadores). Mapa com os ícones do web:

| Uso | Web (`status.tsx`) | SF Symbol |
|---|---|---|
| Pago | `check` | `checkmark.circle.fill` |
| Pendente | `clock` | `clock` |
| Círculo de pagar (pendente, tocável) | - | `circle` (contorno `--border-strong`) |
| Recebida | `arrowIn` | `arrow.down.left` |
| Receitas | `arrowIn` | `arrow.down.left.circle` |
| Despesas | `arrowUp` | `arrow.up.right.circle` |
| Positivo / Negativo / Zerado | `arrowUp` / `arrowDown` / `equal` | `arrow.up` / `arrow.down` / `equal` |
| Cartão | `card` | `creditcard` |
| PIX | - | `bolt.horizontal` (ou texto "PIX" sem ícone se a marca exigir) |
| Tabs | `chart` / `list` | `chart.bar.xaxis` (Dashboard), `list.bullet.rectangle` (Finanças), `gearshape` (Ajustes) |
| Novo | - | `plus` |
| Pagar | - | `checkmark.circle` |
| Editar | lápis | `pencil` |
| Excluir | lixeira | `trash` |
| Selecionar (lote) | caixa | `checkmark.circle` (modo de seleção) |
| Alterar senha | - | `key` |
| Boas-vindas (conta vazia) | - | `sparkles` |
| Aviso de limpeza da conta demo | - | `clock.arrow.circlepath` |

### 2.5 Movimento e háptica

- Transições nativas da pilha e das folhas (já respeitam "Reduzir movimento").
- Gráficos animam a entrada em 250 ms ease-out; com "Reduzir movimento", sem animação.
- Linha que sai da lista (paga sob o filtro Pendente, excluída): recolhe em 200 ms; com "Reduzir movimento", some sem animação. Linha restaurada por "Desfazer" volta à mesma posição.
- Skeletons são estáticos (sem brilho deslizante) com "Reduzir movimento"; sem a preferência, pulso de opacidade lento (1,2 s). Opacidade só no skeleton, nunca em texto.
- Háptica (`expo-haptics`): sucesso ao criar, pagar, pagar fatura, editar e alterar a senha; impacto médio ao confirmar excluir; aviso quando a validação barra o envio ou uma ação falha; seleção ao trocar segmento e mês e ao marcar itens no modo de seleção. Ações de deslizar usam a háptica nativa ao cruzar o limite do deslize completo.

---

## 3. Layout por breakpoint

Só iPhone, retrato (P01, RNF01). Os "breakpoints" no app são de **largura** e de **tamanho de texto**.

### 3.1 Largura

| Classe | Larguras (pt) | Aparelhos de referência | Ajustes |
|---|---|---|---|
| Estreita | 375 | iPhone SE (2a/3a), 12/13 mini | Margem 16. Gráfico de evolução mostra 5 meses visíveis e rola. Botões de rodapé lado a lado só se couberem; senão empilham. Barra do modo de seleção: total em cima, botões embaixo |
| Padrão | 390-402 | iPhone 12-17, 16/17 Pro | Margem 16. Gráfico mostra 6 meses visíveis |
| Grande | 428-440 | Plus, Pro Max | Margem 20. Gráfico mostra 7 meses visíveis. Mesmo layout em coluna única |

- Todo layout é coluna única, sem grade de 2 colunas em nenhuma largura.
- iPad: o app não declara suporte a tablet; o iPadOS o roda no modo de compatibilidade de iPhone. Isso precisa funcionar (a Apple testa iPhone apps em iPad, diretriz 2.4.1). Como o modo usa uma janela de iPhone, nenhum layout extra é necessário. Basta incluir esse caso no teste manual. No iPad com cursor, o menu de contexto abre com clique secundário (nativo).
- Paisagem: bloqueada (`orientation: portrait`).

### 3.2 Tamanho de texto (Dynamic Type)

| Faixa | Categorias do iOS | Layout |
|---|---|---|
| Padrão | xSmall a XXL | Pares rótulo/valor lado a lado (rótulo à esquerda, valor à direita) |
| Ampliado | XXXL e AX1-AX5 | Pares rótulo/valor **empilhados** (rótulo em cima, valor embaixo, alinhado à esquerda); linhas de lista em uma coluna; botões ocupam a largura toda; segmentos com rótulo longo viram lista de opções (ver 6.6); ações de deslizar mostram só o ícone (o texto continua no rótulo de acessibilidade e no menu de contexto) |

- A troca usa a escala de fonte do sistema (limite: escala >= 1,35, que é XXXL).
- Meta: sem corte de valor até **AX3**, acima do mínimo exigido (XXL, RNF08). Em AX4/AX5 a tela rola, mas nada fica cortado.
- Tab bar e barra de navegação nativas já mostram o "Visualizador de conteúdo grande" (toque longo) nas categorias de acessibilidade.

### 3.3 Safe areas

- Telas com rolagem usam `contentInsetAdjustmentBehavior="automatic"`: o conteúdo passa por baixo da barra de navegação e da tab bar, e os insets do iPhone (Dynamic Island, notch, indicador de início) são respeitados pelo sistema.
- Telas sem barra nativa (Entrar, Troca de senha pendente, Atualização obrigatória, Erro de abertura) usam `SafeAreaView` nas 4 bordas.
- Toast: acima da tab bar (ou acima da barra do modo de seleção, ou do indicador de início quando não há tab bar), com 8 pt de folga.
- Barra do modo de seleção: substitui a tab bar enquanto o modo está ativo (padrão do iOS em Fotos e Arquivos), com inset inferior do indicador de início.
- Folhas modais: conteúdo com inset inferior; o botão "Salvar" fica na barra de navegação da folha, nunca preso no rodapé atrás do teclado.
- Teclado: formulários rolam o campo com foco para cima do teclado (`KeyboardAwareScrollView` ou `keyboard-controller`), com 16 pt de folga. Rolar a tela fecha o teclado de forma interativa (`keyboardDismissMode="interactive"`).

---

## 4. Navegação (Expo Router)

### 4.1 Árvore de rotas

```
app/
  _layout.tsx                     Stack raiz (sem cabeçalho). Providers, tema, PrivacyOverlay, Toast host
  index.tsx                       Boot: lê credenciais e decide o destino (5.1)
  (auth)/
    _layout.tsx                   Stack sem cabeçalho, gesto de voltar desligado
    login.tsx                     Entrar
  password-required.tsx           Troca de senha pendente (estado previsto, P-ADR1)
  boot-offline.tsx                Erro de conexão na abertura (CA06)
  update-required.tsx             Atualização obrigatória (426)
  (tabs)/
    _layout.tsx                   Tab bar: Dashboard, Finanças, Ajustes
    dashboard/
      _layout.tsx                 Stack (título grande)
      index.tsx
    finances/
      _layout.tsx                 Stack (título grande)
      index.tsx                   Despesas | Receitas | Faturas
      invoice/[cardId]/[referenceMonth].tsx   Detalhe da fatura (push)  [DM8]
    settings/
      _layout.tsx
      index.tsx
      password.tsx                Alterar senha (push)  [B4; inacessível na conta demo, B8]
  new/
    _layout.tsx                   Stack apresentada como folha modal (presentation: "modal")
    expense.tsx                   Nova despesa
    installments.tsx              Nova despesa parcelada
    income.tsx                    Nova receita
    pick-category.tsx             Seleção de categoria (push dentro da folha)
    pick-card.tsx                 Seleção de cartão (push dentro da folha)
  edit/
    _layout.tsx                   Stack apresentada como folha modal
    expense/[id].tsx              Editar despesa (reaproveita o formulário de new/expense)  [B3]
    pick-category.tsx             Mesma tela de new/pick-category
  month-picker.tsx                Folha (presentation: "formSheet", detent médio)
  filters.tsx                     Folha de filtros de Despesas (detents médio e grande)
```

- Não há rotas `(demo)` nem `FinanceReader` de demonstração (B5). A conta demo usa as mesmas rotas e a mesma API de qualquer usuário.
- `edit/expense/[id]` recebe a despesa já carregada na lista (cache do TanStack Query, pela chave da página); não busca por id (a API não tem `GET /api/entries/:id`). Se o item não estiver no cache (ex.: abertura por link no futuro), a folha mostra o erro "Esta despesa não foi encontrada. A lista foi atualizada." e fecha.
- Tab bar: usar as **abas nativas** do Expo Router (UITabBarController) se estiverem estáveis no SDK escolhido. Assim o app ganha o material nativo da versão do iOS, o visualizador de conteúdo grande e a rolagem para o topo ao tocar de novo na aba. Se não estiverem estáveis, usar a tab bar JS com fundo `--surface` opaco e borda superior `--border`.
- Barras de navegação: pilha nativa (`react-native-screens`), com título grande que encolhe ao rolar.

### 4.2 Proteção de rotas (guarda pela máquina de sessão)

O `_layout` raiz observa o estado da máquina de sessão (ADR §10.8) e substitui a pilha (`router.replace`, sem histórico) quando ele muda:

| Estado | Rota permitida | Observação |
|---|---|---|
| `booting` | `index` (splash nativa ainda visível) | |
| `signedOut` | `(auth)/login` | |
| `passwordChangePending` | depende do ADR (P-ADR1): variante A só `password-required`; variante B `password-required` e `(tabs)/settings/password` | Estado previsto. Sem tabs e sem gesto de voltar |
| `signedIn` | `(tabs)/*`, `new/*`, `edit/*`, `month-picker`, `filters` | Na conta demo, `(tabs)/settings/password` não é alcançável (B8) |
| `offline` (só na abertura) | `boot-offline` | |
| `updateRequired` | só `update-required` | |

Ao mudar de estado, folhas modais e alertas abertos são fechados antes do `replace`, o modo de seleção é encerrado e exclusões aguardando o fim do "Desfazer" são descartadas sem envio (8.5).

### 4.3 Botão "Novo" (RF15, RF22)

- Lugar: botão `plus` à direita da barra de navegação de **Dashboard** e **Finanças**, sempre visível (inclusive com o título grande recolhido). É o padrão do iOS para "adicionar" e não disputa espaço com a tab bar nem com o indicador de início. Some enquanto o modo de seleção está ativo.
- Alvo: 44 × 44 pt. Rótulo de acessibilidade: "Novo lançamento". Dica: "Escolha despesa, despesa parcelada ou receita."
- Toque: abre uma **folha de ações** (action sheet nativa) com o título "Novo lançamento" e as opções, nesta ordem:
  1. "Despesa"
  2. "Despesa parcelada"
  3. "Receita"
  4. "Cancelar" (estilo cancelar)
- Cada opção abre a folha modal do formulário (`new/expense`, `new/installments`, `new/income`).
- Os estados vazios oferecem atalhos diretos, sem a folha de ações: "Nova despesa" / "Nova receita" (8.1) e o card de boas-vindas (6.3.1, 6.4.1).

### 4.4 Barra de navegação de Finanças

| Situação | Esquerda | Direita |
|---|---|---|
| Normal, aba Despesas com ao menos 1 pendente na lista | "Selecionar" | `plus` |
| Normal, demais casos | - | `plus` |
| Modo de seleção | "Selecionar todas" / "Desmarcar todas" | "OK" (sai do modo) |

"Selecionar" não aparece para Receitas e Faturas (não há ação em lote nelas no web).

---

## 5. Fluxos de interação

### 5.1 Abertura do app (RF02, CA04-CA06, CA10, 426)

```
abrir app
  └─ splash nativa (logo sobre --bg)
      ├─ 1a execução após instalar → apaga credenciais → Entrar
      ├─ sem credencial → Entrar
      └─ com credencial → GET /api/auth/me (timeout 15 s)
           ├─ 200, mustChangePassword=false → Dashboard (mês corrente SP)
           ├─ 200, mustChangePassword=true  → Troca de senha pendente (6.2.1, P-ADR1)
           ├─ 401 → apaga credencial → Entrar + aviso "Sua sessão expirou. Entre novamente." (B2: sem renovação)
           ├─ 426 → Atualização obrigatória
           └─ rede/timeout → Erro de abertura ("Sem conexão…", "Tentar novamente"), credencial mantida
```

- A splash nativa fica até a decisão. Se `me` passar de 1,5 s, a splash dá lugar a uma tela de boot igual a ela (logo + indicador de atividade + "Carregando…" para VoiceOver), para não parecer travado.
- O Dashboard já começa a buscar resumo, série e categorias em paralelo assim que `me` responde 200 (RNF07: 3 s no p90).
- O `role` devolvido por `me` não muda as ações sobre lançamentos (B6): pagar, editar e excluir aparecem para todos. De `me` o app usa nome, e-mail e o sinal de conta demo (P-ADR5), que controla o aviso de limpeza (B7) e "Alterar senha" desabilitado (B8).

### 5.2 Entrar (RF01)

1. Usuário digita e-mail (tecla "Seguinte" leva à senha) e senha (tecla "Entrar" envia).
2. Toque em "Entrar": validação local **só de campo vazio** (o formato do e-mail fica a cargo da API). Se falhar, erro no campo, foco nele e háptica de aviso.
3. Envio: botão vira "Entrando…" com indicador, campos ficam somente leitura, segundo toque ignorado.
4. Resultado:
   - sucesso: grava credenciais no Keychain e segue 5.1 (Dashboard ou Troca de senha pendente);
   - `INVALID_CREDENTIALS`: banner "E-mail ou senha inválidos.", senha apagada, foco na senha (CA02);
   - 400: erro no campo correspondente;
   - 429: banner "Muitas tentativas. Tente novamente em N min." (N = `ceil(retryAfterSeconds / 60)`, mínimo 1) (CA03);
   - 426: Atualização obrigatória;
   - rede: banner "Sem conexão. Verifique sua internet.".
5. O gerenciador de senhas do iOS (Senhas/iCloud Keychain) pode preencher e oferecer salvar (`textContentType` corretos). Isso não é o armazenamento do token.
6. A conta demo (e-mail `demo@showcase.invalid`, senha "demo") entra por aqui, como qualquer conta (B5). Não há botão nem atalho para ela na tela; as credenciais vão nas notas para o revisor da App Store.

### 5.3 Alterar senha (Ajustes, opcional) (B4)

1. Ajustes > "Alterar senha" empilha a tela 6.2 (título "Alterar senha", "Voltar" nativo). Na conta demo a linha fica desabilitada e não empilha nada (B8, 6.10).
2. Campos: Senha atual, Nova senha, Confirmar nova senha.
3. Validação local antes de chamar a API (regras e textos do `change-password-form.tsx` do web): vazio, tamanho (8-72) e "As senhas não conferem." (sem chamada, CA07).
4. "Salvar" (na barra, à direita; VoiceOver "Salvar nova senha") → indicador "Salvando". Campos somente leitura, "Voltar" desligado durante o envio.
5. Sucesso: volta para Ajustes + toast "Senha alterada." + háptica de sucesso. A sessão continua (a API mantém o token atual; se o ADR definir o contrário, o app vai para Entrar com o aviso de sessão).
6. Erros: campo (ex.: senha atual incorreta, vindo do 400 da API), 429 (banner "Muitas tentativas. Tente novamente em N min."), rede ("Não foi possível salvar agora. Verifique sua conexão e tente novamente.", texto do web), 401 (5.8). Se a API recusar a troca para a conta demo (caso o sinal do app falhe), banner com a `message` da API, campos mantidos.
7. Sair da tela com campos preenchidos ("Voltar" ou gesto de borda): folha de ações "Descartar alterações" (destrutivo) / "Continuar editando".

#### 5.3.1 Troca de senha pendente (estado previsto, P-ADR1)

Quando `me` devolve `mustChangePassword = true`, ou qualquer chamada devolve 403 `PASSWORD_CHANGE_REQUIRED`, o app fecha folhas e alertas e mostra a tela 6.2.1. O comportamento final é do ADR; o design deixa duas variantes prontas:

- **Variante A (só aviso):** a tela explica que a senha precisa ser trocada no site. Ações: "Sair". Nada mais do app fica acessível.
- **Variante B (troca no app):** a mesma tela tem o botão primário "Alterar senha", que empilha a tela 6.2 em modo pendente (sem "Voltar"; ao concluir, vai ao Dashboard com o toast "Senha alterada."). Ações: "Alterar senha" e "Sair".

Nas duas, "Sair" confirma por folha de ações ("Sair" destrutivo / "Cancelar") e segue 5.10.

### 5.4 Dashboard (RF07, RF08)

1. Abre no mês corrente (SP). O seletor de mês troca o mês; os três blocos recarregam de forma independente (dados em cache aparecem na hora e revalidam).
2. Puxar para atualizar recarrega os três blocos. O indicador nativo some quando os três terminam (com sucesso ou erro).
3. Tocar numa barra do gráfico mostra o balão do mês (ver 6.3). Tocar em "Tabela" troca o gráfico pela tabela.
4. Ao voltar ao app (foreground) ou à aba, dados com mais de 30 s revalidam (ADR §10.8).
5. Conta sem dados: em vez dos três blocos, o card de boas-vindas (6.3.1). Criar o primeiro lançamento invalida o cache e o Dashboard volta ao layout normal.

### 5.5 Finanças (RF09-RF14)

1. Primeira abertura na sessão: chama `initial-month` com limite de 1,5 s. Enquanto isso, mostra o skeleton da aba (sem mês no seletor ainda, só o skeleton do rótulo).
   - `NEXT_PENDING`/`NO_PENDING_AHEAD`: abre no mês devolvido e mostra o aviso de avanço (6.9), **exceto na conta sem dados** (6.4.1), em que o aviso não aparece (não há pendências a explicar).
   - falha ou demora: mês corrente, sem aviso (CA16).
2. Aba padrão: Despesas, status Pendente (DM3). A aba, o mês e os filtros ficam guardados enquanto o app estiver aberto (P10).
3. Trocar de aba (segmentos Despesas | Receitas | Faturas) preserva o mês. Trocar de mês preserva a aba e os filtros e fecha o aviso de avanço (igual ao web, CA25 do ADR 0007).
4. Rolagem infinita: ao chegar a ~2 telas do fim, busca a próxima página (pageSize 20). O rodapé mostra o carregamento ou o erro da página.
5. Faturas: tocar numa fatura empilha o detalhe (5.6).
6. Puxar para atualizar recarrega a aba ativa e o subtotal (e o resumo do mês, se visível). Desligado durante o modo de seleção.
7. Ações sobre lançamentos: 5.12 a 5.17.

### 5.6 Detalhe da fatura (RF13, CA19)

1. Push na pilha de Finanças. Título: nome do cartão; subtítulo (prompt) "Fatura de novembro de 2026".
2. Cabeçalho com Fecha / Vence / Total / Pago / Pendente (dados já carregados na lista, aparecem na hora) e o botão "Pagar fatura" (5.14).
3. Lista de despesas carregada por `GET /api/cards/:cardId/invoices/:referenceMonth/entries`, com skeleton, erro ("Não foi possível carregar as despesas desta fatura." + "Tentar novamente") e vazio.
4. As linhas têm as mesmas ações das linhas de Despesas (pagar, editar, excluir), exceto o modo de seleção. Depois de qualquer ação, a lista e o cabeçalho da fatura recarregam.
5. "Voltar" nativo e gesto de borda. Puxar para atualizar recarrega a lista e o cabeçalho.

### 5.7 Criar despesa, despesa parcelada e receita (RF15-RF21)

```
+ (Dashboard/Finanças) ou atalho do estado vazio → [Despesa | Despesa parcelada | Receita]
  └─ folha modal com o formulário (Cancelar | título | Salvar)
       ├─ Categoria → push "Categoria" (busca + sugestões + "Usar “texto”") → volta preenchida
       ├─ Cartão → push "Cartão" (lista) → volta preenchido
       ├─ Salvar
       │    ├─ validação local falha → erros nos campos, foco no 1o, háptica de aviso, sem chamada
       │    ├─ enviando → "Salvar" vira indicador, campos somente leitura, gesto de fechar desligado
       │    ├─ 201 → fecha a folha → toast + háptica de sucesso → invalida o cache (RF20)
       │    ├─ 400 → erros por campo; não mapeados no resumo do topo
       │    ├─ 404 CARD_NOT_FOUND → erro no Cartão, seleção limpa, lista recarregada
       │    ├─ 401 → folha fecha, Entrar com "Sua sessão expirou. Entre novamente." (dados descartados, P09)
       │    ├─ 403 PASSWORD_CHANGE_REQUIRED → folha fecha, Troca de senha pendente (5.3.1)
       │    ├─ 426 → Atualização obrigatória
       │    └─ rede/5xx → banner no topo, campos mantidos, nada anunciado como criado
       └─ Cancelar / deslizar para baixo
            ├─ sem alterações → fecha
            └─ com alterações → folha de ações "Descartar alterações" (destrutivo) / "Continuar editando"
```

- A folha usa `presentation: "modal"` (página com cabeçalho próprio), não meia altura: os formulários são longos e precisam de espaço com teclado e Dynamic Type.
- Depois de criar, a tela de origem continua no mesmo mês. Se o lançamento caiu em outro mês, o toast ganha a linha "Em dezembro de 2026." (para a pessoa não achar que sumiu).

### 5.8 Sessão expirada (RF04, CA05, CA08) (B2)

A sessão do app tem o mesmo prazo do web: **24 h a partir do login, sem renovação**. O app não sabe de antemão quando expira; descobre pelo primeiro 401.

1. Qualquer 401 numa chamada protegida (inclusive `me` na abertura ou na volta ao primeiro plano): apaga credenciais, limpa o cache, fecha folhas e alertas, encerra o modo de seleção, descarta exclusões aguardando "Desfazer" (não são enviadas) e faz `replace` para Entrar.
2. A tela de Entrar mostra no topo um aviso informativo (não de erro): "Sua sessão expirou. Entre novamente." (texto do web, `SESSION_EXPIRED_TEXT`). O VoiceOver anuncia o texto ao abrir a tela. O e-mail fica preenchido com o último usado (guardado em memória durante a execução do app, não em disco).
3. Sem alerta bloqueante: a pessoa já está onde precisa estar para resolver.
4. Formulário aberto (criar, editar, alterar senha) quando o 401 chega: os dados digitados são descartados (P09). Ação em andamento (pagar, pagar fatura, excluir): nada foi alterado, e o app não reenvia depois do login.
5. Depois de entrar de novo, o app vai para o Dashboard no mês corrente (não restaura a tela anterior).

### 5.9 Atualização obrigatória (426)

1. Em qualquer chamada (inclusive `login` e `me`), 426 `APP_UPDATE_REQUIRED` leva a esta tela, que substitui tudo (sem tabs e sem voltar).
2. Credenciais mantidas, cache limpo (ADR §10.7).
3. "Atualizar" abre `details.storeUrl` (App Store). Se `storeUrl` vier nulo, o botão "Atualizar" não aparece e o texto orienta a procurar o app na App Store.
4. "Tentar novamente" chama `me` de novo (útil se a versão mínima for revertida). Ao voltar para o app depois de atualizar, o app reabre do zero.

### 5.10 Sair (RF05, CA09)

1. Ajustes > "Sair" → folha de ações: título "Sair da conta?", mensagem "Você precisará entrar de novo neste iPhone.", botões "Sair" (destrutivo) e "Cancelar".
2. Confirmação: envia antes as exclusões aguardando "Desfazer" (a pessoa já viu "Despesa excluída."), chama logout (sem bloquear a interface além de 1 s), apaga credenciais, limpa o cache, Entrar. Sem rede, sai localmente do mesmo jeito, sem mensagem de erro.

### 5.11 Conta demo (B5, B6, B7, B8)

- É um usuário real (e-mail `demo@showcase.invalid`, senha "demo"), sem dados. Usa o app exatamente como qualquer conta: mesmas telas, mesma API, "+" disponível, e pagar, editar e excluir disponíveis sobre os próprios lançamentos (B6).
- Não há banner, aba "Sobre", rotas próprias nem textos de "dados de exemplo".
- O primeiro contato (e o do revisor da Apple) é a conta vazia: Dashboard com o card de boas-vindas (6.3.1) e Finanças com os estados vazios de primeira execução (6.4.1), ambos com chamada para criar a primeira despesa ou receita.
- **Limpeza diária (B7):** os dados da conta demo são apagados todos os dias às 03:00. O app mostra um aviso discreto só nessa conta: rodapé do card de boas-vindas (6.3.1) e rodapé da seção Conta em Ajustes (6.10), com o texto "Os dados desta conta de demonstração são apagados todos os dias.". Sem banner nem alerta. Se a limpeza acontecer com o app aberto, a próxima revalidação (volta ao primeiro plano, puxar para atualizar) mostra a conta vazia de novo; uma ação sobre um lançamento apagado cai no 404 já tratado (5.12, 5.15, 5.16).
- **Alterar senha (B8):** desabilitado em Ajustes, com "Indisponível na conta de demonstração" (6.10). A senha é pública e precisa continuar "demo" para o próximo revisor.
- A conta demo não tem cartões; por isso o segmento "Cartão" aparece desabilitado com "Cadastre um cartão no site para usar esta opção." (RF21). Isso é esperado e não é um botão morto.

### 5.12 Pagar uma despesa (B3)

Pontos de entrada (só em despesas com status Pendente; receitas nunca):

| Entrada | Onde |
|---|---|
| Círculo de status à esquerda da linha (DM15) | Despesas, Detalhe da fatura |
| Deslizar a linha para a direita: ação "Pagar" (deslize completo dispara) | idem |
| Menu de contexto (toque longo): "Marcar como pago" | idem |
| Ação do VoiceOver: "Marcar como pago" | idem |

```
entrada → alerta de confirmação
  título: Marcar "Aluguel" como pago?
  mensagem: Total: R$ 1.500,00
  botões: Cancelar | Marcar como pago (preferido)
  ├─ Cancelar → nada muda; foco volta à linha
  └─ Marcar como pago → POST /api/entries/:id/pay
       ├─ enviando → círculo vira indicador de atividade; status "Pagando…"; linha não aceita outras ações
       ├─ 200 → toast "\"Aluguel\" marcado como pago." + háptica de sucesso
       │        sob o filtro Pendente: a linha recolhe; sob Todos/Pago: vira Pago com "Pago em 02/11/2026"
       │        invalida subtotal, resumo do mês, série, categorias, faturas (RF20)
       ├─ 404 → toast de erro "Esta despesa não foi encontrada. A lista foi atualizada." + recarrega a lista
       ├─ 401 → 5.8;  403 PASSWORD_CHANGE_REQUIRED → 5.3.1;  426 → 5.9
       └─ rede/5xx → linha volta ao estado anterior; alerta "Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente." com "Tentar novamente" / "OK"
```

- Sem desfazer (DM14): a API não desmarca pagamento. A confirmação deixa isso claro pelo próprio verbo; não há texto extra.
- O alerta nativo não mostra estado de envio, por isso o carregamento fica na linha, depois que o alerta fecha.

### 5.13 Pagar em lote (B3, DM16)

1. Aba Despesas com pendentes na lista: "Selecionar" (à esquerda da barra) ativa o modo de seleção.
2. No modo: o título vira "N selecionadas" ("Selecionar itens" com zero); os círculos das pendentes viram marcas de seleção; despesas pagas ficam com o check não interativo e esmaecido só no ícone (o texto continua `--text`), lidas como "Aluguel, já pago, não selecionável". Tocar na linha marca/desmarca. Deslizar e menu de contexto ficam desligados.
3. A tab bar dá lugar à barra do modo de seleção:

```
┌───────────────────────────────┐
│ 3 selecionados · R$ 750,00    │  Subheadline; anunciado ao mudar
│ [Limpar]  [Marcar como pago (3)] │  primário à direita; desabilitado com 0
└───────────────────────────────┘
```

   O total é a soma das linhas selecionadas (a mesma `sumDecimals` do web, em string decimal; é a única soma feita no app, porque é a soma da seleção, não um subtotal do mês).
4. "Selecionar todas" seleciona as pendentes **carregadas** (texto do VoiceOver: "Selecionar todas as despesas pendentes desta página", do web).
5. "Marcar como pago (3)" → alerta: título "Marcar 3 despesas como pagas?", mensagem com "Total: R$ 750,00" e até 5 itens ("Aluguel R$ 500,00", …, "e mais 2"). Botões "Cancelar" / "Marcar como pago".
6. Envio (`POST /api/entries/pay`): a barra mostra "Pagando…" com indicador; seleção travada.
7. Resultado:
   - 200 → sai do modo de seleção; toast `paidFeedback` do web ("3 despesas marcadas como pagas." ou "2 despesas marcadas como pagas. 1 já estava paga.");
   - 404 com `missingIds` → continua no modo, remove da seleção os itens não encontrados e mostra `InlineAlert` acima da lista: "Nenhuma despesa foi alterada. 2 despesas selecionadas não foram encontradas:" + lista, com "Fechar";
   - rede/5xx → alerta "Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente.";
   - 401 / 403 / 426 → 5.8 / 5.3.1 / 5.9.
8. "OK" sai do modo sem pagar. Trocar de mês, aba ou filtro também sai do modo e limpa a seleção.

### 5.14 Pagar fatura (B3)

Entradas: botão "Pagar fatura" no cabeçalho do Detalhe da fatura (6.5); deslizar o card da fatura para a direita (ação "Pagar"); menu de contexto do card ("Pagar fatura"); ação do VoiceOver. Fatura sem pendências (`pendingCount = 0`): o botão fica desabilitado com a nota "Fatura paga" ao lado e o deslizar e o menu não oferecem a ação.

```
alerta
  título: Pagar a fatura Nubank de novembro de 2026?
  mensagem: Vence em 20/11/2026
            3 lançamentos pendentes
            Total: R$ 500,00
            Serão pagas as despesas pendentes desta fatura no momento da confirmação.
  botões: Cancelar | Pagar fatura (preferido)
  └─ Pagar fatura → POST /api/cards/:cardId/invoices/:referenceMonth/pay
       ├─ enviando → botão "Pagar fatura" vira "Pagando…" com indicador (no card: indicador no lugar do chevron)
       ├─ 200 → toast `invoicePaidFeedback` do web, ex.: "Fatura Nubank de nov/26 paga: 3 despesas, R$ 500,00."
       │        (com paidCount 0: toast informativo "Nenhuma despesa pendente nesta fatura. Nada foi alterado.")
       │        (valor diferente do exibido: + "O valor difere do exibido porque a fatura mudou.")
       │        recarrega faturas, despesas, resumo, série, categorias; sob o filtro Pendente o card sai da lista
       ├─ 404 → toast de erro "Este cartão não foi encontrado. Nada foi alterado."
       ├─ 401 / 403 / 426 → 5.8 / 5.3.1 / 5.9
       └─ rede/5xx → alerta "Não foi possível pagar a fatura. Nenhuma despesa foi alterada. Tente novamente." ("Tentar novamente" / "OK")
```

Sem desfazer (DM14).

### 5.15 Editar despesa (B3, B6, DM12)

Disponível para qualquer usuário, sobre as próprias despesas (B6). Entradas: tocar na linha da despesa; deslizar para a esquerda → "Editar"; menu de contexto → "Editar"; ação do VoiceOver.

```
entrada → folha modal "Editar despesa" (6.6.3), campos preenchidos
  ├─ Salvar → validação local (mesmas regras de criar)
  │    ├─ falha → erros nos campos, foco no 1o, háptica de aviso
  │    ├─ enviando → indicador no lugar de "Salvar", campos somente leitura, gesto de fechar desligado
  │    ├─ 200 → fecha → toast "Despesa atualizada." com "Desfazer" (5 s) → invalida cache (RF20)
  │    │        se a data mudou o mês/fatura: + "Em dezembro de 2026." e a linha sai do mês atual
  │    ├─ 400 → erros por campo; não mapeados no resumo do topo
  │    ├─ 404 → fecha; toast de erro "Esta despesa não foi encontrada. A lista foi atualizada." + recarrega
  │    ├─ 403 (sem código de troca de senha) → fecha; toast de erro "Você não tem permissão para alterar esta despesa." + recarrega a lista
  │    ├─ 401 / 403 PASSWORD_CHANGE_REQUIRED / 426 → 5.8 / 5.3.1 / 5.9
  │    └─ rede/5xx → banner "Não foi possível atualizar a despesa. Tente novamente.", campos mantidos
  └─ Cancelar / deslizar para baixo → igual a 5.7 (descartar alterações)
```

**Desfazer edição:** toque em "Desfazer" no toast envia `PUT /api/entries/:id` com os valores anteriores (descrição, categoria, data, valor). Durante o envio, o toast mostra "Desfazendo…". Sucesso: toast "Alteração desfeita.". Falha: toast de erro "Não foi possível desfazer. A despesa ficou com os dados novos." (e a pessoa pode editar de novo). Se a despesa foi paga, excluída ou editada de novo antes do toque, o "Desfazer" some (só vale para a última edição e enquanto nada mais mudou nela).

Parcela: a edição vale só para a parcela aberta (ADR 0010, item 7). A folha mostra o rodapé "Só esta parcela será alterada." quando a despesa veio de um parcelamento; como o `EntryDto` não identifica parcelas, esse rodapé só aparece se a API passar a informar (fica fora da v1 se não houver o campo).

### 5.16 Excluir despesa (B3, B6, DM13, DM14)

Disponível para qualquer usuário, sobre as próprias despesas (B6). Entradas: deslizar para a esquerda → "Excluir" (vermelho, último à direita; deslize completo **não** dispara direto, abre a confirmação); menu de contexto → "Excluir" (destrutivo, último item, separado); ação do VoiceOver; botão "Excluir despesa" no fim da folha de edição (6.6.3).

```
entrada → folha de ações (destrutiva, ancorada na linha)
  título: Excluir "Aluguel"?
  mensagem: O lançamento será removido permanentemente dos resumos e das faturas.
  botões: Excluir despesa (destrutivo) | Cancelar
  └─ Excluir despesa
       → a linha recolhe na hora (exclusão pendente) → háptica de impacto
       → toast "Despesa excluída." com "Desfazer" (5 s; 10 s com VoiceOver ativo)
          ├─ Desfazer → a linha volta à mesma posição; nada é enviado; toast "Exclusão desfeita."
          └─ o toast some → DELETE /api/entries/:id
               ├─ 204 → invalida subtotal, resumo, série, categorias, faturas (RF20)
               ├─ 404 → recarrega a lista (já não existia); sem mensagem extra
               ├─ 403 (sem código de troca de senha) → a linha volta; toast de erro "Você não tem permissão para excluir esta despesa."
               ├─ 401 / 403 PASSWORD_CHANGE_REQUIRED / 426 → 5.8 / 5.3.1 / 5.9 (a despesa não foi excluída)
               └─ rede/5xx → a linha volta; toast de erro "Não foi possível excluir a despesa. Tente novamente."
```

Regras da exclusão pendente:
- O envio também acontece antes do fim do toast quando: o app vai para o segundo plano; outra exclusão começa (a anterior é enviada); a pessoa sai da conta (5.10).
- Não acontece (é descartada) quando chega um 401, 403 de troca de senha ou 426 antes do envio.
- Enquanto pendente, a linha fica oculta mesmo após puxar para atualizar ou trocar de mês e voltar. O subtotal mostra os valores anteriores com o rótulo "Atualizando…" (Footnote, `--text-muted`) até a lista recarregar após o envio; o app não recalcula o subtotal (CA17).
- Excluir pela folha de edição: a folha fecha antes de a linha recolher.

#### 5.16.1 Parcelas: "só esta parcela" ou "todas"

Na v1 só existe "Excluir despesa", que exclui **apenas a parcela escolhida** (DM13). As demais parcelas continuam nos outros meses.

Desenho previsto se a API ganhar exclusão em grupo (não implementar agora): a folha de ações mostra "Excluir só esta parcela" (destrutivo), "Excluir todas as 10 parcelas" (destrutivo), "Cancelar"; mensagem "Notebook, parcela 2 de 10. Parcelas já pagas também serão excluídas." O toast seria "10 parcelas excluídas." com o mesmo "Desfazer".

### 5.17 Menu de contexto e deslizar (resumo por tipo de lançamento)

Igual para todos os usuários (B6).

| Elemento | Deslizar para a direita | Deslizar para a esquerda | Menu de contexto (toque longo) | Toque |
|---|---|---|---|---|
| Despesa pendente | "Pagar" | "Excluir", "Editar" | "Marcar como pago", "Editar", — , "Excluir" | Editar |
| Despesa paga | - | "Excluir", "Editar" | "Editar", — , "Excluir" | Editar |
| Receita | - | - | sem menu | nada |
| Fatura com pendências | "Pagar" | - | "Pagar fatura", "Ver despesas" | Detalhe |
| Fatura paga | - | - | "Ver despesas" | Detalhe |

- O menu de contexto mostra uma prévia da linha (a própria linha ampliada). Itens com ícone SF (2.4).
- Deslizar só funciona fora do modo de seleção e quando não há ação em andamento na linha.
- Linhas com ação em andamento (pagando, excluindo) ignoram toques, deslizes e menu.

---

## 6. Telas: hierarquia e layout

Os esquemas usam a largura padrão (390 pt) e o tema claro. `[ ]` = controle, `( )` = segmento, `>` = navegação.

### 6.1 Entrar

```
┌───────────────────────────────┐
│ (safe area)                   │
│        [logo]                 │
│     Finanças Pessoais*        │  Title 3 (Space Grotesk só aqui)
│                               │
│ ┌ aviso (sessão expirou) ───┐ │  só quando vier de 5.8
│ └───────────────────────────┘ │
│ ┌ banner de erro ───────────┐ │  credenciais / 429 / rede
│ └───────────────────────────┘ │
│ E-mail                        │
│ [ana@exemplo.com          ]   │
│ Senha                         │
│ [••••••••            ( 👁 ) ] │  botão Mostrar senha 44pt
│                               │
│ [        Entrar         ]     │  primário, largura total
│                               │
│ Não tem acesso ou esqueceu a  │  Footnote, --text-muted
│ senha? Fale com um            │
│ administrador.                │
│                               │
│ Política de privacidade · Suporte │  links (Footnote, --accent)
└───────────────────────────────┘
```
`*` nome do app definido no ADR.

Hierarquia: 1) identidade; 2) avisos; 3) campos; 4) "Entrar"; 5) ajuda; 6) links legais.

Detalhes:
- E-mail: `keyboardType="email-address"`, `textContentType="username"`, `autoComplete="email"`, sem autocorreção e sem maiúscula automática, tecla de retorno "Seguinte".
- Senha: `secureTextEntry`, `textContentType="password"`, tecla "Entrar" (`returnKeyType="go"`) envia. O botão do olho tem rótulo fixo "Mostrar senha" e estado selecionado (padrão do web: nome fixo, estado em `selected`).
- Não existe "Criar conta", "Esqueci a senha" (P02) nem "Ver demonstração" (B5).
- Toda a tela rola (Dynamic Type grande + teclado).

### 6.2 Alterar senha (Ajustes) (B4)

```
┌───────────────────────────────┐
│ ‹ Ajustes                Salvar │  Salvar em negrito (--accent)
│ Alterar senha                 │  título (pequeno, padrão de tela empilhada de Ajustes)
│ ┌ banner (rede / 429) ──────┐ │
│ SENHA ATUAL                   │
│ [••••••••            ( 👁 ) ] │
│ NOVA SENHA                    │
│ [••••••••            ( 👁 ) ] │
│ De 8 a 72 caracteres.         │  rodapé da seção (texto do web)
│ CONFIRMAR NOVA SENHA          │
│ [••••••••            ( 👁 ) ] │
└───────────────────────────────┘
```
- Lista agrupada, igual aos formulários (6.6). Foco inicial em Senha atual; "Seguinte" passa ao próximo campo; "Concluído" no último envia.
- Senha atual: `textContentType="password"`. Nova senha e confirmação: `textContentType="newPassword"` e regras de senha (`passwordRules`: mínimo 8, máximo 72) para o iOS sugerir uma senha forte.
- "Salvar" desabilitado só durante o envio (não por campos vazios: a validação explica o que falta, como no web).
- Hierarquia: 1) título; 2) avisos; 3) campos na ordem do preenchimento.
- Não abre na conta demo (B8, 6.10).

#### 6.2.1 Troca de senha pendente (estado previsto, P-ADR1)

```
┌───────────────────────────────┐
│ (safe area)                   │
│           [ícone]             │  key, 56 pt, --accent
│   Troca de senha pendente     │  Title 2
│ Sua senha precisa ser trocada │  Body
│ antes de continuar.           │
│ Acesse o site para definir    │  Body; só na variante A
│ uma nova senha e depois entre │
│ novamente.                    │
│ [      Alterar senha      ]   │  primário; só na variante B
│ [          Sair           ]   │  secundário (variante A: é o único botão)
└───────────────────────────────┘
```
- Composição de `ScreenState` (igual a 6.11 e 6.12). Sem tabs, sem gesto de voltar.
- Variante B: "Alterar senha" empilha 6.2 sem "Voltar" e com o título "Nova senha"; o texto do rodapé fica igual. Sucesso → Dashboard + toast "Senha alterada.".
- O VoiceOver lê o título e o texto ao abrir.

### 6.3 Dashboard

```
┌───────────────────────────────┐
│ Dashboard                 [+] │  título grande + Novo
│ [‹]   novembro de 2026   [›]  │  MonthSwitcher
│                               │
│ Resumo de novembro de 2026    │  Subheadline, --text-muted, cabeçalho
│ ┌───────────────────────────┐ │
│ │ ↙ Receitas    R$ 5.000,00 │ │  card 1
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ ↗ Despesas      R$ 600,00 │ │  card 2
│ │ ● Pago          R$ 100,00 │ │
│ │ ● Pendente      R$ 500,00 │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Saldo realizado           │ │  card 3
│ │      R$ 4.900,00 ↑Positivo│ │
│ │ receitas − despesas pagas │ │  Footnote
│ │ Saldo previsto            │ │
│ │      R$ 4.400,00 ↑Positivo│ │
│ │ receitas − todas as despesas│
│ └───────────────────────────┘ │
│                               │
│ ┌ Evolução mensal ──────────┐ │
│ │ dez/25 – nov/26           │ │  subtítulo
│ │ (Gráfico)(Tabela)         │ │  segmentos
│ │ ■ Receitas ■ Pago ▨ Pendente│  legenda com texto
│ │ ▐▌ ▐▌ ▐▌ ▐▌ ▐▌ [▐▌]  →     │  barras, rola na horizontal
│ │ jul ago set out nov       │ │
│ │ Deslize para ver os 12 meses│
│ └───────────────────────────┘ │
│                               │
│ ┌ Despesas por categoria ───┐ │
│ │ novembro de 2026          │ │
│ │        ( rosca )          │ │  centro: total R$ 600,00
│ │ ● Moradia  R$ 300,00  50% │ │  legenda = tabela
│ │ ● Mercado  R$ 200,00  33% │ │
│ │ ● Outras   R$ 100,00  17% │ │
│ └───────────────────────────┘ │
├───────────────────────────────┤
│ [Dashboard] [Finanças] [Ajustes] │ tab bar
└───────────────────────────────┘
```

Hierarquia: 1) mês; 2) resumo (o que a pessoa vem ver); 3) evolução; 4) categorias.

**Resumo (bloco 1)** - mesmos 3 cards e textos do `MonthSummary` do web:
- Receitas (`--income`, ícone), Despesas (`--expense`, ícone) com Pago/Pendente (ponto + texto), Saldo realizado e Saldo previsto (DM1), cada saldo com `SignIndicator` (seta + "Positivo"/"Negativo"/"Zerado").
- Dicas "receitas − despesas pagas" e "receitas − todas as despesas" visíveis (Footnote), como no web a partir de `md` (no celular há espaço vertical; ajudam a entender a diferença).
- Mês sem lançamentos (numa conta que tem dados em outros meses): abaixo dos cards, "Sem lançamentos neste mês" (texto do web).
- Dynamic Type ampliado: rótulo em cima, valor embaixo; o indicador de sinal vai para a linha do valor e quebra se precisar.

**Evolução mensal (bloco 2)** - `react-native-gifted-charts`, gráfico de barras:
- 12 meses (de `GET /api/dashboard/monthly-series`), um grupo por mês: barra de **Receitas** (`--chart-income`) e barra de **Despesas** empilhada **Pago** (`--chart-paid`, base) + **Pendente** (`--chart-pending`, topo, com hachura se a lib permitir padrão de preenchimento; se não, a ordem fixa e a legenda com texto bastam, e a tabela é a alternativa).
- Separador de 1 pt entre segmentos empilhados na cor do card (`--surface`), como o `--chart-sep` do web.
- Rola na horizontal; abre com o mês selecionado visível à direita e destacado (faixa `--chart-cursor` atrás do grupo e rótulo do mês em negrito). Meses visíveis por largura: 5 / 6 / 7 (3.1).
- Eixo Y fixo à esquerda com `formatAxisTick` ("R$ 1,5 mil"); grade `--chart-grid`; linha do zero.
- Tocar num grupo: balão (`--surface`, borda `--border-strong`) com "novembro de 2026", Receitas, Despesas (Pago, Pendente), Saldo realizado, Saldo previsto, todos em `formatBRL`. Tocar fora fecha.
- "Deslize para ver os 12 meses" (texto do web) abaixo do gráfico, com setas ‹ › de 44 pt ("Meses anteriores" / "Meses recentes") que rolam 3 meses.
- As linhas de saldo do web ficam fora do gráfico no celular (ficariam ilegíveis em 5-7 meses visíveis). Os saldos aparecem no balão e na tabela.
- **Tabela** (segmento "Tabela"): linhas por mês (mais recente primeiro), colunas Mês, Receitas, Despesas, Saldo previsto. Em Dynamic Type ampliado, cada mês vira um card com pares rótulo/valor.
- Série vazia (12 meses zerados, numa conta com dados mais antigos): o gráfico mostra a grade e a pílula "Sem lançamentos de dez/25 – nov/26" (texto do web).

**Despesas por categoria (bloco 3)** - rosca do gifted-charts:
- Até 5 categorias + "Outras" (`groupCategories` do web), cores `--chart-1..6` na ordem decrescente de valor, separador entre fatias.
- Centro: total do mês e "Total".
- Legenda abaixo (é a tabela): ponto colorido, categoria, valor e percentual (`formatPercent`). "Outras" tem uma 2a linha com os nomes agrupados (Footnote, até 2 linhas).
- Tocar numa fatia ou linha da legenda destaca as duas (sem balão, a legenda já mostra tudo).
- Sem segmentos Gráfico/Tabela neste bloco: a legenda já é a forma tabular.
- Vazio: "R$ 0,00" grande + "Nenhuma despesa em novembro de 2026" + botão "Ir para Finanças" (troca para a aba Finanças no mesmo mês).

#### 6.3.1 Conta sem dados (primeira execução, conta demo) (B5, B7)

É a primeira tela que o revisor da Apple vê. Precisa parecer intencional, explicar o app e levar à primeira ação.

**Quando aparece:** a lista de categorias (`GET /api/categories`) está vazia **e** a série de 12 meses está zerada (`isSeriesEmpty`). Categorias vazias indicam que a conta nunca registrou lançamento; a série confirma. Enquanto as duas respostas não chegam, mostra os skeletons normais (sem piscar o card de boas-vindas). Se qualquer uma falhar, usa o layout normal com o erro do bloco. (Sinal a validar pelo architect: se as categorias puderem existir sem lançamentos, trocar por um indicador da API.)

```
┌───────────────────────────────┐
│ Dashboard                 [+] │
│ [‹]   novembro de 2026   [›]  │
│                               │
│ ┌───────────────────────────┐ │  card de boas-vindas (--surface, borda --accent)
│ │        [sparkles]         │ │  40 pt, --accent
│ │  Comece pelo primeiro     │ │  Title 3, centralizado
│ │  lançamento               │ │
│ │ Registre uma despesa ou   │ │  Body, --text-muted
│ │ receita para ver o resumo │ │
│ │ do mês, a evolução e os   │ │
│ │ gastos por categoria.     │ │
│ │ [    Nova despesa     ]   │ │  primário, largura total
│ │ [    Nova receita     ]   │ │  secundário, largura total
│ │ ───────────────────────── │ │  divisória --border (só na conta demo)
│ │ ⟲ Os dados desta conta de │ │  Footnote, --text-muted, ícone clock.arrow.circlepath
│ │ demonstração são apagados │ │  só na conta demo (B7)
│ │ todos os dias.            │ │
│ └───────────────────────────┘ │
│                               │
│ Resumo de novembro de 2026    │
│ ┌───────────────────────────┐ │  um card compacto com os 4 pares zerados
│ │ Receitas          R$ 0,00 │ │
│ │ Despesas          R$ 0,00 │ │
│ │ Saldo realizado   R$ 0,00 = Zerado │
│ │ Saldo previsto    R$ 0,00 = Zerado │
│ └───────────────────────────┘ │
│                               │
│ ┌ O que aparece aqui ───────┐ │  card informativo, Subheadline
│ │ ▐▌ Evolução mensal        │ │  ícone chart.bar.xaxis, --text-muted
│ │   Receitas e despesas dos │ │  Footnote
│ │   últimos 12 meses.       │ │
│ │ ◔ Despesas por categoria  │ │  ícone chart.pie
│ │   Onde o dinheiro foi no  │ │
│ │   mês.                    │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

- Hierarquia: 1) chamada para a primeira ação; 2) resumo zerado (mostra que o app funciona e o que vai medir); 3) prévia do que os gráficos mostrarão. Os gráficos vazios não aparecem (uma grade vazia e uma rosca cinza parecem quebrados para quem nunca viu o app).
- "Nova despesa" abre `new/expense`; "Nova receita" abre `new/income` (sem a folha de ações). O "+" da barra continua disponível.
- **Aviso da conta demo (B7):** rodapé do card, abaixo dos botões, separado por divisória, em Footnote `--text-muted`, com o ícone `clock.arrow.circlepath` (decorativo, oculto ao VoiceOver). Aparece só quando a conta é a demo (P-ADR5). Fica no card porque é a primeira coisa que o revisor lê e explica, antes de ele criar algo, por que a conta pode estar vazia num outro dia. Não usa cor de alerta: é informação, não erro.
- Depois do primeiro lançamento criado (qualquer mês), o cache é invalidado e o Dashboard volta ao layout normal; o toast de criação continua igual (8.4). A partir daí o aviso da conta demo fica só em Ajustes (6.10).
- Trocar de mês mantém o card de boas-vindas (a conta continua sem dados).
- VoiceOver: o card de boas-vindas é lido primeiro ("Comece pelo primeiro lançamento. Registre uma despesa ou receita…"), seguido dos dois botões e, na conta demo, do aviso. O foco inicial da tela continua no título "Dashboard".
- Fora da conta demo, nenhum texto fala em "demonstração" ou "exemplo": o mesmo estado vale para qualquer conta nova. O aviso de limpeza é a única exceção, e só na conta demo.

### 6.4 Finanças

```
┌───────────────────────────────┐
│ Selecionar   Finanças     [+] │  título grande; "Selecionar" só em Despesas com pendentes
│ [‹]   novembro de 2026   [›]  │  MonthSwitcher (compartilhado entre as 3 abas)
│ ┌ aviso de avanço ─────── ✕ ┐ │  6.9
│ (Despesas)(Receitas)(Faturas) │  segmentos
├─ conteúdo da aba ─────────────┤
│ Despesas:                     │
│ (Todos)(Pendente)(Pago) [Filtros 2] │  status inline + botão de filtros com contagem
│ Forma: Nubank · Categoria: Moradia  [Limpar] │ chips dos filtros ativos
│ ┌ Subtotal · com os filtros aplicados ┐ │
│ │ 3 despesas                │ │
│ │ Total R$ 600,00           │ │
│ │ ● Pago R$ 0,00 ● Pendente R$ 600,00 │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ ○ Aluguel      R$ 1.500,00│ │  círculo de pagar (44 pt) + Headline / valor Headline
│ │   Moradia · 05/11/2026    │ │  Subheadline muted
│ │   PIX          ⏱ Pendente │ │  forma + status (ícone + texto)
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ ✓ Notebook 2/10  R$ 350,00│ │  check (não tocável) em paga
│ │   Eletrônicos · 28/10/2026│ │
│ │   Nubank [Fatura nov/26] ✓ Pago │  chip quando a fatura ≠ mês da data
│ │   Pago em 24/10/2026      │ │
│ └───────────────────────────┘ │
│ … (rolagem infinita)          │
│ ◌ Carregando mais…            │  rodapé
├───────────────────────────────┤
│ tab bar                       │
└───────────────────────────────┘
```

Deslizar uma linha de despesa para a esquerda (qualquer usuário, B6):

```
│ ┌──────────────────┬──────┬───────┐ │
│ │ Aluguel  R$ 1.500│Editar│Excluir│ │  --accent | --danger-text; ícone + texto
│ └──────────────────┴──────┴───────┘ │
```

Hierarquia: 1) mês; 2) aba; 3) filtros; 4) subtotal (o número que responde "quanto"); 5) itens; 6) ações de cada item.

**Cabeçalho fixo vs. rolagem.** O seletor de mês, o aviso e os segmentos das abas rolam junto com o conteúdo, como cabeçalho da lista. Os segmentos das abas ficam **grudados** abaixo da barra de navegação ao rolar (sticky header da lista), para trocar de aba sem voltar ao topo. Tocar de novo na aba Finanças da tab bar rola ao topo.

**Despesas (RF11)**
- Status: segmentos inline "Todos | Pendente | Pago" (DM2, DM3), mudança imediata.
- "Filtros" (botão com rótulo e contagem: "Filtros, 2 ativos" no VoiceOver) abre a folha 6.7 com Forma e Categoria.
- Chips dos filtros ativos abaixo, cada um com "✕" (44 pt de alvo; rótulo "Remover filtro Forma: Nubank") e "Limpar" quando houver mais de um.
- Subtotal (`ExpensesSubtotal` do web): "Subtotal · todas as despesas do mês" ou "Subtotal · com os filtros aplicados"; contagem; Total; Pago; Pendente. Fundo `--surface-2`. Valores da API, nunca somados no app (CA17). Com exclusão pendente ou ação recém-concluída, mostra "Atualizando…" até recarregar.
- Item (`ExpenseRow`):
  - Coluna de status à esquerda (44 × 44 pt): pendente = círculo vazio tocável (`circle`, contorno `--border-strong`; rótulo "Marcar como pago: Aluguel"); paga = `checkmark.circle.fill` em `--success-text`, não tocável; pagando = indicador de atividade; modo de seleção = marca de seleção.
  - Linha 1: descrição (Headline, até 2 linhas) à esquerda; valor (Headline, tabular) à direita, sem quebra.
  - Linha 2: categoria · data (`dd/mm/aaaa`, `formatCivilDate`).
  - Linha 3: forma ("PIX" ou nome do cartão) + chip "Fatura nov/26" quando `referenceMonth` ≠ mês da data (regra `showInvoiceChip` do web) à esquerda; `StatusBadge` à direita ("Pagando…" durante o envio).
  - Despesa paga: 4a linha "Pago em 24/10/2026" (`formatInstantDate`, SP), como no web.
  - Toque na linha: abre "Editar despesa" para qualquer usuário (B6) (destaque `--surface-2` ao pressionar, sem chevron; o padrão é o do app Lembretes, em que o toque edita).
  - Deslizar, menu de contexto e ações do VoiceOver conforme 5.17.
- Ordem: a da API.
- Modo de seleção (5.13): linha selecionada com fundo `--surface-2` e borda `--accent`.

**Receitas (RF12)**
- Sem status (sempre Recebida). Botão "Filtros" só com Categoria (ou chip de categoria direto).
- Subtotal: "Subtotal · todas as receitas do mês" / "com o filtro aplicado"; contagem; Total.
- Item: descrição + valor (`--text`); categoria · data; `StatusBadge` "Recebida" (`--income`). Sem coluna de status à esquerda (alinha o texto à margem), sem toque, sem deslizar, sem menu (DM12).

**Faturas (RF13)**
- Status: segmentos "Todos | Pendente | Pago" (padrão Pendente; "Todos" = sem parâmetro).
- Linha do contexto (texto do web): "Mostrando 2 faturas de novembro de 2026" + qualificador do status.
- Card de fatura (`InvoiceRow`), tocável, com chevron:
  - Linha 1: nome do cartão (Headline) + "Fatura paga" (✓, `--success-text`) quando `pendingCount = 0`.
  - Linha 2: "Fecha 10/11/2026 · Vence 20/11/2026".
  - Pares: Total; ● Pago; ● Pendente.
  - Rodapé: "3 despesas" + chevron (indicador de atividade no lugar do chevron enquanto paga).
  - "Pagar fatura" pelo deslizar, pelo menu de contexto e no detalhe (5.14). O card não tem botão próprio, para manter um único alvo de toque (o card inteiro abre o detalhe) e não repetir o botão do detalhe.

#### 6.4.1 Conta sem dados (Finanças) (B5)

Mesmo sinal de 6.3.1 (categorias vazias). Substitui o vazio comum das três abas; o aviso de avanço de mês não aparece; "Selecionar", "Filtros" e o subtotal não aparecem (não há o que filtrar ou somar). Os segmentos de status ficam visíveis (mostram que haverá filtro), mas o vazio não depende deles.

```
Despesas                               Receitas                              Faturas
┌───────────────────────────┐          ┌───────────────────────────┐         ┌───────────────────────────┐
│      [arrow.up.right.circle]│        │     [arrow.down.left.circle]│       │        [creditcard]        │
│ Nenhuma despesa ainda     │          │ Nenhuma receita ainda     │         │ Nenhuma fatura ainda      │
│ Registre sua primeira     │          │ Registre sua primeira     │         │ As faturas aparecem quando│
│ despesa para acompanhar o │          │ receita para ver quanto   │         │ você registra uma despesa │
│ que já pagou e o que falta│          │ entrou no mês.            │         │ no cartão. Os cartões são │
│ pagar.                    │          │                           │         │ cadastrados no site.      │
│ [   Nova despesa   ]      │          │ [   Nova receita   ]      │         │ [   Nova despesa   ]      │
│ [Nova despesa parcelada]  │          │                           │         │                           │
└───────────────────────────┘          └───────────────────────────┘         └───────────────────────────┘
```
- Ícone 40 pt `--accent`, título Title 3, texto Body `--text-muted`, botão primário em largura total; "Nova despesa parcelada" como botão terciário (texto `--accent`).
- Em Faturas, "Nova despesa" abre o formulário com a forma "Cartão" já escolhida só se houver cartões; sem cartões (conta demo), abre com PIX e o segmento "Cartão" desabilitado com a explicação do RF21. Isso é coerente com o texto da tela, que diz que cartões são cadastrados no site.
- O aviso de limpeza da conta demo não se repete aqui (fica no Dashboard e em Ajustes), para não carregar as três abas com o mesmo texto.
- Depois do primeiro lançamento, todas as abas voltam aos estados normais.

### 6.5 Detalhe da fatura

```
┌───────────────────────────────┐
│ ‹ Finanças                    │
│ Nubank                        │  título grande
│ Fatura de novembro de 2026    │  Subheadline muted
│ ┌───────────────────────────┐ │
│ │ Fecha 10/11/2026          │ │
│ │ Vence 20/11/2026          │ │
│ │ Total          R$ 600,00  │ │
│ │ ● Pago         R$ 100,00  │ │
│ │ ● Pendente     R$ 500,00  │ │
│ │ [      Pagar fatura     ] │ │  primário, largura total; "Pagando…" no envio
│ └───────────────────────────┘ │  fatura paga: botão desabilitado + "✓ Fatura paga" acima dele
│ 3 despesas                    │  cabeçalho de seção
│ [ExpenseRow sem a linha da forma, com as ações de 5.17] … │
└───────────────────────────────┘
```
- Botão desabilitado: `--text-disabled`, sem opacidade; VoiceOver "Pagar fatura, indisponível, fatura paga".
- Rótulo de acessibilidade do botão: "Pagar fatura Nubank de novembro de 2026" (texto do web).

### 6.6 Formulários (folha modal)

Estrutura comum (lista agrupada, estilo Ajustes do iOS):

```
┌───────────────────────────────┐
│ Cancelar   Nova despesa  Salvar │  barra da folha; Salvar em negrito (--accent)
│ ┌ resumo de erros ──────────┐ │  só com 400 não mapeado / rede
│ DESCRIÇÃO                     │
│ [Aluguel                  ]   │
│ CATEGORIA                     │
│ [Moradia                 >]   │  linha que empilha a seleção
│ DATA                          │
│ [Data            05/11/2026]  │  seletor nativo compacto
│ VALOR                         │
│ [R$            1.500,00   ]   │  decimal-pad
│ FORMA DE PAGAMENTO            │
│ (   PIX   )(  Cartão  )       │
│ [Ainda não paguei      (○ )]  │  interruptor, só em PIX
│ Status inicial: paga.         │  rodapé da seção (texto do web)
└───────────────────────────────┘
```

Campos e regras por formulário (validação e payload = `web/lib/entries/form.ts`, parcelas = `web/lib/entries/installments.ts`):

| Campo | Despesa | Parcelada | Receita | Editar despesa | Controle | Teclado / entrada |
|---|---|---|---|---|---|---|
| Descrição | sim | sim | sim | sim | campo de texto, 1-120, contador "87/120" a partir de 100 | padrão, capitalização de frase, "Seguinte" |
| Categoria | sim | sim | sim | sim | linha → tela "Categoria" (6.6.1) | - |
| Data | "Data" | "Data da primeira parcela" + ajuda "As próximas parcelas usam o mesmo dia nos meses seguintes." | "Data" | "Data" (6.6.3) | seletor nativo compacto (`dd/mm/aaaa`, locale pt-BR, fuso America/Sao_Paulo), padrão hoje em SP | - |
| Valor | "Valor" | "Valor total da compra" | "Valor" | "Valor" | campo com prefixo "R$" | `decimal-pad` (7.4) |
| Parcelas | - | "Quantidade de parcelas", 2-36, padrão 2 | - | - | `Stepper` (− campo +), botões de 44 pt | `number-pad` no campo central |
| Forma de pagamento | PIX / Cartão | PIX / Cartão | - | somente leitura | segmentos (editar: linha de valor, 6.6.3) | - |
| Cartão | se Cartão | se Cartão | - | somente leitura | linha → tela "Cartão" (lista com marca de seleção) | - |
| Ainda não paguei | só PIX | - | - | - | interruptor | - |
| Linha de status | `initialStatusText` | "Todas as parcelas serão criadas como pendentes." | "Status inicial: recebida." | status atual (`StatusBadge`) | rodapé de seção | - |
| Prévia | - | sim (6.6.2) | - | - | seção somente leitura | - |
| Excluir despesa | - | - | - | sim (qualquer usuário, B6) | botão destrutivo no fim (6.6.3) | - |

Textos de status inicial (iguais ao web, sem adaptação, porque o app agora paga lançamentos): "Status inicial: paga.", "Status inicial: pendente. Você poderá marcá-la como paga depois." e "Status inicial: pendente, na fatura do cartão.".

Dica de data futura em PIX pago (texto do web): "Data futura: ela será registrada como paga hoje. Marque "Ainda não paguei" se o PIX ainda não saiu."

Forma "Cartão" sem cartões (RF21, CA28): segmento "Cartão" desabilitado (`--text-disabled`, `disabled` no VoiceOver) e, abaixo, "Cadastre um cartão no site para usar esta opção.". Falha ao carregar cartões: segmento habilitado; ao escolher, a linha do cartão mostra "Não foi possível carregar os cartões." + "Tentar novamente".

Ordem do foco/teclado: Descrição → (Categoria abre tela) → Valor; "Concluído" na barra acima do teclado fecha o teclado.

Título da folha e botão: "Nova despesa" / "Nova despesa parcelada" / "Nova receita" / "Editar despesa". Botão "Salvar" (na parcelada, VoiceOver: "Salvar 6 parcelas"; na edição, "Salvar alterações", texto do web). Durante o envio, "Salvar" vira indicador de atividade com rótulo "Salvando".

#### 6.6.1 Tela "Categoria"

- Push dentro da folha. Campo de busca no topo (já com foco), com o texto atual.
- Lista das categorias de `GET /api/categories` filtradas pela busca (sem diferenciar acento e caixa); a atual com marca de seleção.
- Se o texto não bate exatamente com nenhuma: primeira linha "Usar “Mercado”" (cria nova; a grafia final é a canônica da API, P05).
- Tocar numa linha volta ao formulário preenchido.
- Erro ao carregar: aviso "Não foi possível carregar as sugestões." e a linha "Usar “…”" continua funcionando.
- Vazio (sem categorias ainda, caso da conta nova): "Digite o nome da categoria." + sugestões fixas de partida como linhas comuns ("Moradia", "Mercado", "Transporte", "Saúde", "Lazer" para despesa; "Salário", "Freelance" para receita), para o primeiro lançamento não começar de uma tela vazia. São só atalhos de texto; a API cria a categoria ao salvar.

#### 6.6.2 Prévia das parcelas (RF17, CA24)

```
PRÉVIA
6 parcelas · total R$ 350,00
2 × R$ 58,34 e 4 × R$ 58,33
1ª parcela · 31/01/2027        R$ 58,34
2ª parcela · 28/02/2027        R$ 58,34
3ª parcela · 31/03/2027        R$ 58,33
…
e mais 3 parcelas              (toque para ver todas)
Todas as parcelas serão criadas como pendentes.
```
- Aparece quando total, quantidade e data são válidos; senão, "Preencha o valor total, as parcelas e a data para ver a prévia."
- A linha de resumo ("2 × R$ 58,34 e 4 × R$ 58,33"; com parcelas iguais, "6 × R$ 50,00") vem da mesma divisão em centavos do servidor.
- Mostra as 6 primeiras e "e mais N parcelas" (texto do web), que expande a lista.
- VoiceOver lê a seção como um grupo: "Prévia: 6 parcelas, total R$ 350,00, 2 de R$ 58,34 e 4 de R$ 58,33."

#### 6.6.3 Editar despesa (B3, B6)

Reaproveita o `EntryForm` (mesmos campos, validação, erros e teclado do "Nova despesa"), em modo edição:

```
┌───────────────────────────────┐
│ Cancelar  Editar despesa  Salvar │
│ ┌ resumo de erros ──────────┐ │
│ DESCRIÇÃO                     │
│ [Aluguel                  ]   │
│ CATEGORIA                     │
│ [Moradia                 >]   │
│ DATA                          │
│ [Data            05/11/2026]  │
│ A data de compra pode alterar │  rodapé (texto do web)
│ a fatura do cartão.           │
│ VALOR                         │
│ [R$            1.500,00   ]   │
│ PAGAMENTO                     │
│ Forma               Nubank    │  linha de valor, somente leitura
│ Status            ⏱ Pendente  │
│ A forma de pagamento não pode │  rodapé
│ ser alterada.                 │
│                               │
│ [      Excluir despesa      ] │  texto --danger-text, centralizado (qualquer usuário)
└───────────────────────────────┘
```
- Campos preenchidos com a despesa. O valor entra formatado ("1.500,00").
- Despesa paga no cartão: Data desabilitada com o rodapé "A data de uma despesa paga no cartão não pode ser alterada." (texto do web).
- "Salvar" só envia o que o web envia (descrição, categoria, data, valor).
- "Excluir despesa" segue 5.16 (folha de ações ancorada no botão).
- Sem alterações, "Salvar" fecha a folha sem chamada.

### 6.7 Folha de filtros (Despesas)

- `formSheet` com detents médio e grande. Barra: "Limpar" (esquerda), "Filtros", "Aplicar" (direita).
- Seção "Forma": lista de opção única com marca: "Todas", "PIX", cada cartão.
- Seção "Categoria": "Todas" + categorias (com busca se houver mais de 8).
- Erro ao carregar cartões/categorias: texto do web ("Não foi possível carregar os cartões." / "…as categorias.") + "Tentar novamente" na seção.
- Os filtros só valem ao tocar em "Aplicar" (a lista não pisca a cada toque). Fechar arrastando descarta.

### 6.8 Seletor de mês (`MonthSwitcher` + folha)

- Linha: botão ‹ (44 pt, "Mês anterior"), rótulo do mês (botão, "novembro de 2026", dica "Toque para escolher outro mês"), botão › (44 pt, "Próximo mês").
- Tocar no rótulo abre a folha (detent médio): ano com ‹ › e grade de 12 meses (3 × 4, "jan" a "dez", alvos ≥ 44 pt), mês selecionado preenchido com `--primary-strong`, mês corrente com borda `--accent`; botão "Mês atual" na barra.
- Com Dynamic Type ampliado, a grade vira 2 colunas.
- Ao trocar de mês, o VoiceOver anuncia "novembro de 2026".
- Desabilitado durante o modo de seleção (trocar de mês encerraria a seleção sem aviso).

### 6.9 Aviso de avanço de mês (Finanças, RF09)

- Textos do web: "Sem pendências em outubro de 2026. Mostrando novembro de 2026, o próximo mês com pendências." e "Sem pendências de outubro de 2026 em diante. Mostrando novembro de 2026."
- Faixa informativa (`InlineAlert` tom info: `--surface`, borda `--accent`, ícone `info.circle`), com "✕" de 44 pt ("Fechar aviso de mês").
- Some ao trocar de mês ou ao fechar; só aparece na primeira abertura da sessão. VoiceOver anuncia depois de 0,5 s.
- Não aparece na conta sem dados (6.4.1).

### 6.10 Ajustes

Lista agrupada (inset grouped):

| Seção | Linhas |
|---|---|
| (sem título) | Avatar com a inicial (círculo `--primary-strong`, letra `--on-primary`), nome (Headline), e-mail (Subheadline). Não tocável |
| Conta | "Alterar senha" (ícone `key`, chevron) → 6.2. **Conta demo (B8):** linha desabilitada (texto e ícone `--text-disabled`, sem chevron, sem destaque ao toque) com o subtítulo "Indisponível na conta de demonstração" (Footnote, `--text-muted`) |
| Rodapé da seção Conta | **Só na conta demo (B7):** "Os dados desta conta de demonstração são apagados todos os dias." |
| Aparência | "Tema" → opções em linha com marca: "Sistema", "Claro", "Escuro" |
| Sobre | "Política de privacidade" (abre navegador interno, `SFSafariViewController`), "Suporte" (idem), "Versão" com valor "1.0.0 (42)" à direita |
| Rodapé da seção Sobre | "Perfil e cartões são gerenciados no site." |
| (sem título) | "Sair" (texto `--danger-text`, centralizado) |

- **B8, desabilitado e não oculto:** a linha desabilitada com motivo mostra ao revisor que a função existe e por que não está disponível, sem parecer que falta algo nem virar botão morto.
- VoiceOver da linha na conta demo: "Alterar senha, indisponível. Indisponível na conta de demonstração." (`accessibilityState: disabled`; o motivo faz parte do rótulo, não depende de dica).
- O aviso de limpeza fica no rodapé da seção Conta, junto da linha desabilitada, porque as duas coisas se explicam juntas (conta compartilhada e temporária). Footnote `--text-muted`, sem ícone, padrão de rodapé de seção do iOS.

### 6.11 Atualização obrigatória

```
┌───────────────────────────────┐
│           [ícone]             │  arrow.down.app, 56pt, --accent
│   Atualização necessária      │  Title 2
│ Atualize o aplicativo para    │  Body (message da API)
│ continuar.                    │
│ Esta versão (1.0.3) não é mais│  Footnote muted
│ suportada. Instale a 1.2.0 ou │
│ mais recente.                 │
│ [        Atualizar        ]   │  primário → storeUrl
│ [     Tentar novamente    ]   │  secundário
└───────────────────────────────┘
```
Sem `storeUrl`: em vez de "Atualizar", "Procure por <nome do app> na App Store para atualizar.".

### 6.12 Erro de conexão na abertura

Mesma composição de 6.11: ícone `wifi.slash`, título "Sem conexão", texto "Sem conexão. Verifique sua internet.", botão primário "Tentar novamente" (mostra "Tentando…" enquanto chama `me`). Sem botão de sair (o token é preservado, CA06). Quando a rede volta (NetInfo), tenta sozinho uma vez.

### 6.13 Cobertura de privacidade (P11)

Quando o app fica inativo ou vai para o fundo, uma camada cobre a tela: `--bg` + logo central. Nenhum dado, nenhum desfoque do conteúdo (o desfoque ainda deixa ler valores grandes). Some ao voltar. Alertas e folhas de ações abertos ficam por baixo da camada e continuam abertos ao voltar.

---

## 7. Componentes

"Existente" = reaproveitado sem mudança (componente nativo do iOS/Expo ou regra pura do web sincronizada, ADR §10.3). "Novo" = componente de UI criado em `mobile/src/ui` ou `mobile/src/features`. Todo componente visual do app é novo, já que nenhum componente React do web roda em React Native; a coluna "Equivale no web" mostra de onde vêm o comportamento e os textos.

### 7.1 Base (`src/ui`)

| Componente | Tipo | Equivale no web | Notas |
|---|---|---|---|
| `ThemeProvider` + tokens | Novo | `tokens.css`, `lib/theme` | claro/escuro/sistema, alto contraste |
| `Text` (variantes do 2.3) | Novo | - | Dynamic Type, `tabular-nums` opcional |
| `Icon` | Novo (adaptador de SF Symbols) | `Icon` de `status.tsx` | |
| `Button` (primário, secundário, terciário, destrutivo) | Novo | `components/ui/button.tsx` | min 44 pt, estado carregando com rótulo ("Entrando…", "Pagando…"), desabilitado sem opacidade |
| `IconButton` | Novo | `IconButton` | 44 × 44 pt, rótulo obrigatório |
| `TextField` | Novo | `fields.tsx` | rótulo visível, ajuda, erro, contador, somente leitura |
| `PasswordField` | Novo | `password-field.tsx` | botão "Mostrar senha" |
| `MoneyField` | Novo | máscara de `decimal.ts` | 7.4 |
| `DateField` | Novo sobre existente (`@react-native-community/datetimepicker`) | campo `type=date` | compacto, pt-BR, SP, desabilitado com motivo |
| `Stepper` | Novo | campo numérico de parcelas | − / campo / +, 2-36 |
| `SegmentedControl` | Novo | `segmented-control.tsx` | segmento desabilitado com motivo; vira lista em Dynamic Type ampliado |
| `SwitchRow` | Novo sobre `Switch` nativo | `checkbox.tsx` ("Ainda não paguei") | |
| `GroupedList`, `ListRow`, `SelectRow`, `ValueRow` | Novo | - | estilo Ajustes, alvos de 44 pt; `ValueRow` = rótulo + valor somente leitura; `ListRow` aceita estado desabilitado com subtítulo de motivo (B8) |
| `Card` | Novo | `.card` / `.glass` | opaco (DM6) |
| `Money` | Novo | `ui/money.tsx` | sempre `formatBRL` |
| `StatusBadge`, `SignIndicator`, `StatusDot` | Novo | `ui/status.tsx` | ícone + texto; estado "Pagando…" |
| `Chip` | Novo | `.chip` | "Fatura nov/26" |
| `InlineAlert` (info, erro) | Novo | `ui/states.tsx` | com ação opcional ("Fechar") |
| `EmptyState` | Novo | `EmptyState` | ícone, título, descrição, até 2 ações (primária e terciária) |
| `WelcomeCard` | Novo | - | 6.3.1; variante de `EmptyState` com borda `--accent` e rodapé opcional (aviso da conta demo, B7) |
| `ErrorState` / `BlockError` | Novo | `BlockErrorBoundary` | mensagem + "Tentar novamente" |
| `Skeleton` | Novo | `Skeleton` | estático com "Reduzir movimento" |
| `Toast` + host | Novo | `ui/toast.tsx` | 4 s; com ação ("Desfazer") 5 s, 10 s com VoiceOver; tipos sucesso, info, erro; anunciado ao VoiceOver, não rouba o foco; uma ação por toast |
| `ActionSheet` | Existente (`ActionSheetIOS`/`@expo/react-native-action-sheet`) | `AlertDialog` | confirmações destrutivas (excluir, sair, descartar), ancoradas na origem |
| `ConfirmAlert` | Existente (`Alert.alert` nativo) | `AlertDialog`, `PayConfirmDialog` | confirmações não destrutivas (pagar, pagar fatura) e erros de ação com "Tentar novamente" |
| `SwipeableRow` | Novo sobre existente (`react-native-gesture-handler` `ReanimatedSwipeable`) | - | ações à direita e à esquerda, ícone + texto, deslize completo configurável (liga em "Pagar", desliga em "Excluir"), fecha ao rolar a lista |
| `ContextMenu` | Novo (adaptador sobre menu nativo, ex.: `zeego` ou `react-native-ios-context-menu`) | - | prévia da linha, itens com ícone, destrutivo separado; RNF01: só via adaptador |
| `SelectionToolbar` | Novo | barra fixa de seleção do `expenses-list.tsx` | substitui a tab bar; total, "Limpar", ação primária |
| `ScreenState` (tela cheia: ícone, título, texto, ações) | Novo | `error.tsx` das rotas | 6.2.1, 6.11, 6.12 |
| `PrivacyOverlay` | Novo | - | 6.13 |
| `OfflineBanner` | Novo | - | 8.3 |
| `UserAvatar` | Novo | `user-avatar.tsx` | inicial por `core/initial.ts` |

Removidos na rev. 2: `DemoBanner` (B5).

### 7.2 De feature (`src/features`)

| Componente | Feature | Equivale no web |
|---|---|---|
| `LoginForm` | auth | `login-form.tsx` |
| `ChangePasswordForm` (modo opcional; modo pendente só na variante B de P-ADR1) | account | `change-password-form.tsx` (`mode="optional"`) |
| `PasswordPendingScreen` | sessão | - (6.2.1) |
| `useIsDemoAccount` (sinal de conta demo, P-ADR5) | sessão | - (5.11, 6.3.1, 6.10) |
| `DemoResetNotice` (texto do aviso de limpeza, usado no card de boas-vindas e no rodapé de Ajustes) | sessão | - (B7) |
| `MonthSwitcher`, `MonthPickerSheet` | compartilhado | `month-picker.tsx` |
| `MonthSummary` (+ skeleton, + variante compacta zerada) | dashboard | `month-summary.tsx` |
| `MonthlyChartCard` (gráfico, tabela, balão, resumo acessível) | dashboard | `monthly-chart.tsx`, `monthly-chart-a11y` |
| `CategoryDonutCard` | dashboard | `category-donut.tsx` |
| `ChartCard` (título, subtítulo, Gráfico/Tabela, descrição acessível) | dashboard | `chart-card.tsx` |
| `DashboardWelcome` (card + resumo zerado + prévia dos gráficos) | dashboard | - (6.3.1) |
| `chart-adapters` (dados → gifted-charts) | dashboard | `lib/dashboard/chart-data.ts` (existente, sincronizado) |
| `useAccountIsEmpty` (sinal de conta sem dados) | compartilhado | - (6.3.1) |
| `FinancesTabs` | finances | `entries-tabs-bar.tsx` |
| `MonthAdvanceNotice` | finances | `month-advance-notice.tsx` |
| `ExpenseFiltersBar`, `FiltersSheet` | finances | `expense-filters.tsx`, `status-filter-field.tsx` |
| `ExpensesSubtotal`, `IncomeSubtotal` | finances | `tab-subtotal.tsx` |
| `ExpenseRow` (círculo de pagar, deslizar, menu, seleção) | finances | itens de `expenses-list.tsx` |
| `IncomeRow` | finances | `income-panel.tsx` |
| `ExpenseActions` (orquestra pagar, editar, excluir e desfazer; mesmas ações para todo usuário, B6) | finances | `expenses-list.tsx` (handlers) |
| `PendingDeletes` (fila de exclusões aguardando "Desfazer") | finances | - (5.16) |
| `BatchPayController` + `SelectionToolbar` | finances | seleção de `expenses-list.tsx`, `pay-confirm-dialog.tsx` |
| `InvoiceRow`, `InvoiceHeader` (com "Pagar fatura") | finances | `invoice-block.tsx` |
| `FinancesFirstRun` (vazios de 6.4.1) | finances | - |
| `NewEntryButton` + folha de ações | entries | "+ Novo lançamento" |
| `EntryForm` (despesa, receita e **edição de despesa**) | entries | `new-entry-drawer.tsx`, `edit-expense-drawer.tsx` |
| `InstallmentForm`, `InstallmentPreview` | entries | `installment-expense-drawer.tsx` |
| `CategoryPicker`, `CardPicker` | entries | `combobox.tsx`, select de cartão |
| `SettingsScreen` (com "Alterar senha" desabilitado e aviso na conta demo) | settings | `account-menu.tsx` (parte) |
| `UpdateRequiredScreen`, `BootOfflineScreen` | sessão | - |

### 7.3 Regras puras reaproveitadas (existentes, sincronizadas do web)

`money/decimal.ts` (`formatBRL`, `parseMoneyInput`, `toCents`, `signOf`, `sumDecimals`), `dates/format.ts` (`formatCivilDate`, `formatInstantDate`, `monthLongPtBR`, `monthLabelPtBR`, `shiftMonth`, `currentYearMonthSP`, `todaySP`), `entries/form.ts` (validação, `initialStatusText`, `buildCreateEntryPayload`, `mapApiFieldIssues`), `entries/installments.ts` (prévia), `dashboard/chart-data.ts` (`toChartPoints`, `groupCategories`, `formatPercent`, `formatAxisTick`, `isSeriesEmpty`). Textos de UI que estão em arquivos não sincronizados (ex.: `entries/feedback.ts`: `paidFeedback`, `invoicePaidFeedback`, `countLabel`) são copiados neste documento e testados no mobile.

### 7.4 `MoneyField` (teclado numérico de valores)

- Teclado `decimal-pad` (dígitos + separador decimal; no iPhone em pt-BR o separador é a vírgula). Sem tecla de retorno, por isso a barra acima do teclado tem "Concluído".
- Prefixo fixo "R$" dentro do campo (não editável; o VoiceOver lê o campo como "Valor, R$ 1.500,00").
- Entrada aceita: dígitos e **uma** vírgula, até 2 casas decimais. Um "." digitado (teclado com região diferente) vira ",". Caracteres fora disso são ignorados.
- Colar: o texto colado passa por `parseMoneyInput` (aceita "1.234,56", "R$ 10,5", "10"). Se for válido, entra formatado; se não, não muda o campo.
- Ao sair do campo: formata com milhar e 2 casas ("1234,5" → "1.234,50"). Ao entrar de novo, mantém o texto formatado (os pontos são aceitos por `parseMoneyInput`).
- Na edição, o valor da API ("1500.00") entra formatado ("1.500,00").
- Validação (no envio e ao sair do campo, se já tiver sido tocado): "Informe um valor maior que zero." / "O valor máximo é R$ 9.999.999.999,99." (textos do web; parcelada: "Informe um total maior que zero."). Envio: `parseMoneyInput` → string decimal (CA23).
- Alternativa descartada: máscara da direita para a esquerda (`maskMoneyInput`). Digitar "1234,5" daria "123,45", o que contraria o CA23 (DM9, decidido).

---

## 8. Estados

### 8.1 Matriz por tela e bloco

| Tela / bloco | Carregando | Vazio | Erro | Sem rede |
|---|---|---|---|---|
| Abertura | splash; após 1,5 s, boot com indicador | - | 401 → Entrar com aviso; 426 → 6.11 | 6.12 |
| Entrar | botão "Entrando…" | - | banner (credenciais, 429, rede); erro de campo | banner "Sem conexão. Verifique sua internet." |
| Alterar senha | indicador "Salvando" no lugar de "Salvar" | - | banner/campo | banner de rede (texto do web) |
| Ajustes, conta demo | - | - | - | "Alterar senha" desabilitado com motivo e aviso de limpeza aparecem com ou sem rede (dependem só de `me` já carregado) |
| Troca de senha pendente | - | - | - | tela é local; "Sair" funciona sem rede |
| Dashboard, conta sem dados | skeletons normais até categorias e série responderem | card de boas-vindas (6.3.1), com o aviso de limpeza na conta demo | se o sinal falhar, layout normal com erros por bloco | idem |
| Resumo (Dashboard) | skeleton com o mesmo layout dos 3 cards | "Sem lançamentos neste mês" abaixo dos cards zerados | "Não foi possível carregar o resumo." + "Tentar novamente" | dados em cache + `OfflineBanner`; sem cache: erro com texto de rede |
| Evolução mensal | skeleton (card com barras cinza) | grade + "Sem lançamentos de dez/25 – nov/26" | "Não foi possível carregar a evolução mensal." + "Tentar novamente" (CA14) | idem |
| Categorias | skeleton (círculo + 3 linhas) | "R$ 0,00" + "Nenhuma despesa em novembro de 2026" + "Ir para Finanças" | "Não foi possível carregar as despesas por categoria." | idem |
| Finanças, conta sem dados | skeleton da aba | 6.4.1 (por aba, com chamada para criar) | layout normal com o erro da aba | idem |
| Despesas | skeleton do subtotal + 5 linhas | sem filtro: "Nenhuma despesa em novembro de 2026" + "Registre uma despesa ou escolha outro mês." + "Nova despesa"; com filtro: "Nenhuma despesa para os filtros selecionados em novembro de 2026" + "Limpar filtros" | "Não foi possível carregar as despesas." + "Tentar novamente" | idem |
| Receitas | idem | "Nenhuma receita em novembro de 2026" + "Nova receita"; com filtro: "Nenhuma receita na categoria Trabalho em novembro de 2026" + "Limpar filtro" | "Não foi possível carregar as receitas." | idem |
| Faturas | skeleton de 2 cards | "Nenhuma fatura neste mês" + "Compras no cartão aparecem na fatura do mês em que vencem."; com filtro: "Nenhuma fatura para os filtros selecionados em novembro de 2026" + "Ver todas" | "Não foi possível carregar as faturas." | idem |
| Próxima página | rodapé "Carregando mais…" | rodapé "Fim da lista" (só se houver mais de 1 página) | rodapé "Não foi possível carregar mais itens." + "Tentar novamente" (itens já carregados ficam) | idem |
| Detalhe da fatura | skeleton de 3 linhas, rótulo "Carregando despesas…" | "Nenhuma despesa nesta fatura." | "Não foi possível carregar as despesas desta fatura." | idem |
| Formulários (criar e editar) | categorias/cartões: linha com indicador | sem cartões: 6.6 (RF21); sem categorias: 6.6.1 | 8.2 | `OfflineBanner` no topo da folha; "Salvar" continua ativo (o NetInfo pode errar) e, se falhar, banner de rede |
| Mês inicial | skeleton da aba | - | silencioso → mês corrente | silencioso → mês corrente |
| Ações sobre lançamentos | 8.5 | - | 8.5 | 8.5 |

Nota sobre o texto vazio da spec (RF14): "Nenhuma despesa em novembro de 2026." Mantenho o texto do web, sem ponto final no título (é título de estado vazio). Os testes devem usar o texto deste documento.

### 8.2 Validação e erros de formulário

- Validação local só no "Salvar" e, depois do primeiro envio, a cada edição do campo com erro (o erro some quando a pessoa corrige; igual ao `updateField` do web). Não há erro enquanto a pessoa digita pela primeira vez.
- Erro de campo: borda `--danger` 2 pt, ícone `exclamationmark.circle` e texto `--danger-text` (Footnote) abaixo do campo. O rótulo de acessibilidade do campo inclui o erro ("Descrição, Informe a descrição.").
- Ao barrar o envio: rola até o primeiro campo com erro, move o foco do VoiceOver para ele e toca a háptica de aviso. Se houver mais de um erro, o VoiceOver anuncia antes "2 campos precisam de correção."
- Resumo no topo (`InlineAlert` erro): mensagens do 400 que não mapeiam para campos, erro de rede ("Sem conexão. Verifique sua internet."), 5xx ("Não foi possível salvar agora. Seus dados foram mantidos. Tente novamente."; na edição, "Não foi possível atualizar a despesa. Tente novamente.", texto do web). Recebe o foco do VoiceOver.
- `CARD_NOT_FOUND`: "O cartão escolhido não existe mais." no campo Cartão; a lista é recarregada e a seleção é limpa.
- Parcelas: "Informe entre 2 e 36 parcelas." e "O total deve permitir ao menos R$ 0,01 por parcela." (textos do web). O `Stepper` não passa de 2 a 36, mas o campo digitado pode, por isso a validação.
- Data inválida na parcelada: "Informe uma data válida entre 1900 e 9998." (texto do web).
- Alterar senha: textos de `fieldMessage("password", …)` do web e "As senhas não conferem.".

### 8.3 Sem rede durante o uso

- `OfflineBanner` fino abaixo da barra de navegação: ícone `wifi.slash` + "Sem conexão. Mostrando os últimos dados carregados." (`--surface-2`, texto `--text`). Some sozinho quando a rede volta, e os blocos com erro recarregam.
- Puxar para atualizar sem rede: o indicador termina e um toast diz "Sem conexão. Verifique sua internet.".
- Ações (pagar, pagar fatura, editar, excluir) sem rede: as entradas continuam disponíveis (o NetInfo pode errar); a falha segue 8.5. Exclusão pendente sem rede: ao fim do "Desfazer", a chamada falha, a linha volta e o toast de erro aparece.
- Não há fila offline de criação nem de ações (fora de escopo).

### 8.4 Confirmações (toast)

| Ação | Texto | Ação no toast |
|---|---|---|
| Despesa PIX paga ou pendente | "Despesa criada." | - |
| Despesa no cartão | "Despesa criada." + "Na fatura de nov/26 do Nubank, vence 20/11/2026." (DM5) | - |
| Parcelada | "6 parcelas criadas." | - |
| Receita | "Receita criada." | - |
| Lançamento em outro mês | + "Em dezembro de 2026." | - |
| Pagar uma despesa | "\"Aluguel\" marcado como pago." | - |
| Pagar em lote | "3 despesas marcadas como pagas." / "2 despesas marcadas como pagas. 1 já estava paga." | - |
| Pagar fatura | "Fatura Nubank de nov/26 paga: 3 despesas, R$ 500,00." (+ "O valor difere do exibido porque a fatura mudou.") | - |
| Fatura sem pendências | "Nenhuma despesa pendente nesta fatura. Nada foi alterado." (info) | - |
| Editar | "Despesa atualizada." | "Desfazer" |
| Desfazer edição | "Alteração desfeita." | - |
| Excluir | "Despesa excluída." | "Desfazer" |
| Desfazer exclusão | "Exclusão desfeita." | - |
| Alterar senha | "Senha alterada." | - |

### 8.5 Estados das ações sobre lançamentos (B3, B6)

| Ação | Carregando | Sucesso | Erro | Desfazer |
|---|---|---|---|---|
| Pagar uma | círculo vira indicador; status "Pagando…"; linha bloqueada | toast; linha recolhe (filtro Pendente) ou vira Paga | 404: toast + recarrega; rede/5xx: alerta com "Tentar novamente"; linha volta | não há (DM14) |
| Pagar em lote | `SelectionToolbar` com "Pagando…"; seleção travada | sai do modo; toast | 404: `InlineAlert` com os itens; rede/5xx: alerta; seleção mantida | não há |
| Pagar fatura | botão "Pagando…" (detalhe) ou indicador no lugar do chevron (card) | toast; recarrega fatura e despesas | 404: toast "Este cartão não foi encontrado. Nada foi alterado."; rede/5xx: alerta | não há |
| Editar | indicador no lugar de "Salvar"; campos somente leitura | fecha; toast com "Desfazer" | campo / banner na folha; 404 e 403 fecham com toast | `PUT` com os valores anteriores; "Desfazendo…"; falha: toast de erro |
| Excluir | linha recolhe na hora (pendente) | após o toast: envio silencioso | linha volta + toast de erro | não envia; linha volta |

Regras comuns:
- Uma ação por linha de cada vez. Outras linhas continuam livres.
- As entradas das ações são as mesmas para todo usuário (B6). Nenhum estado depende do `role`.
- Toda ação concluída invalida as chaves afetadas (ADR §10.8): lista da aba, subtotal, faturas, despesas da fatura, resumo, série e categorias do mês do lançamento.
- 401, 403 `PASSWORD_CHANGE_REQUIRED` e 426 seguem 5.8, 5.3.1 e 5.9, e nunca mostram o erro genérico da ação.
- 403 sem código de troca de senha (caso defensivo: a API recusar a ação, ex.: lançamento que não é da pessoa): toast "Você não tem permissão para alterar esta despesa." / "…excluir esta despesa." e recarga da lista. As ações continuam visíveis nas demais linhas.

---

## 9. Acessibilidade

### 9.1 VoiceOver

- Todo controle tem rótulo, papel e estado (`accessibilityRole`, `accessibilityState: selected/disabled/busy/expanded`). Botões só com ícone têm rótulo obrigatório ("Novo lançamento", "Mês anterior", "Mostrar senha", "Fechar aviso de mês", "Marcar como pago: Aluguel").
- Títulos de seção e de card com `accessibilityRole="header"` (navegação pelo rotor "Títulos").
- Itens de lista são **um elemento** cada, lido nesta ordem: "Aluguel, R$ 1.500,00, Pendente, Moradia, 05/11/2026, PIX". Com chip: "…, Nubank, fatura de novembro de 2026". Fatura: "Nubank, vence 20/11/2026, total R$ 600,00, pago R$ 100,00, pendente R$ 500,00, 3 despesas", papel botão, dica "Mostra as despesas da fatura".
- **Ações personalizadas** (`accessibilityActions`, rotor "Ações") espelham o deslizar e o menu de contexto, na ordem de 5.17: "Marcar como pago", "Editar", "Excluir" (despesa); "Pagar fatura" (fatura). O círculo de pagar continua como elemento próprio para quem navega por toque. Dica da linha de despesa (qualquer usuário): "Toque duas vezes para editar. Mais ações no rotor."
- Linha em andamento: `busy`, lida como "Aluguel, pagando".
- Modo de seleção: cada linha pendente é uma caixa de seleção ("Selecionar Aluguel, R$ 1.500,00, 05/11/2026", texto do web); mudança do total anunciada ("3 selecionados, R$ 750,00").
- Toast com "Desfazer": anunciado com a ação ("Despesa excluída. Ação disponível: Desfazer"); o toast fica 10 s com VoiceOver ativo e o "Desfazer" é alcançável pelo rotor e por "esfregar com dois dedos" (escape) **não** o fecha.
- Cards do resumo: um elemento por par ("Receitas, R$ 5.000,00"; "Saldo previsto, menos R$ 150,00, negativo"). O sinal é lido como "menos" (rótulo próprio, não o caractere "-").
- Gráficos: o desenho fica oculto para o VoiceOver. O card do gráfico é um elemento com o resumo textual do web: "Evolução mensal de dez/25 – nov/26. Em novembro de 2026: receitas R$ 5.000,00, despesas R$ 600,00, saldo realizado R$ 4.900,00, saldo previsto R$ 4.400,00." e a ação personalizada "Ver tabela" (ou o segmento Tabela). A rosca: "Despesas por categoria em novembro de 2026, total R$ 600,00. Moradia R$ 300,00, 50%; …". A legenda e a tabela são navegáveis linha a linha.
- Segmentos: cada um é botão com estado "selecionado" e posição ("1 de 3"). Segmento desabilitado lê o motivo como dica ("Cadastre um cartão no site para usar esta opção.").
- Conta demo: "Alterar senha" lido como "Alterar senha, indisponível. Indisponível na conta de demonstração."; o aviso de limpeza é texto estático, lido na ordem normal (sem anúncio automático).
- Anúncios (`announceForAccessibility`): troca de mês, toast, aviso de avanço (0,5 s depois), "Carregando mais…", fim de carregamento de página ("20 despesas carregadas"), erro de envio, linha removida ("Aluguel removida da lista").
- Foco: ao abrir uma tela, o foco vai para o título (padrão nativo). Ao fechar a folha do formulário com sucesso, o foco volta ao botão "+" (criar) ou à linha editada (editar). Após pagar sob o filtro Pendente ou excluir, o foco vai para a linha seguinte (ou para o título da aba, se não houver). Após cancelar uma confirmação, o foco volta ao controle que a abriu. Ao abrir Entrar com aviso de sessão, o foco vai para o aviso.
- Rótulos de dinheiro e datas lidos por extenso pelo VoiceOver em pt-BR (formato "R$ 1.500,00" e "05/11/2026" já é lido corretamente; não usar abreviações como "nov/26" no rótulo de acessibilidade: usar "novembro de 2026").

### 9.2 Dynamic Type

Ver 2.3 e 3.2. Checklist por tela em XXL, AX1 e AX3: nenhum valor cortado; pares empilhados a partir de XXXL; botões em largura total; segmentos de 3 opções com rótulo maior que a largura viram lista de seleção; gráfico mantém a altura e a tabela/legenda escalam; ações de deslizar só com ícone a partir de XXXL; `SelectionToolbar` empilha total e botões; aviso de limpeza e motivo de "Alterar senha" quebram em várias linhas sem corte.

### 9.3 Alvos de toque

Mínimo 44 × 44 pt em tudo que é tocável: botões de ícone, círculo de pagar, chevrons do mês, "✕" dos chips e do aviso, setas do gráfico, segmentos (altura 44 pt mesmo que o desenho seja de 32 pt, com `hitSlop`), linhas de lista (altura mínima 44 pt; itens de lançamento ≥ 72 pt), ações de deslizar (largura mínima 74 pt cada), "Desfazer" no toast. Espaço mínimo de 8 pt entre alvos vizinhos. O círculo de pagar e o corpo da linha (editar) são alvos separados, sem sobreposição.

### 9.4 Contraste, cor e movimento

- WCAG 2.1 AA nos dois temas (pares do design-system, opacos, e os pares das ações de deslizar em 2.1).
- Nunca só cor: status, sinal do saldo, séries do gráfico (legenda com texto, hachura no pendente se possível, tabela), filtro ativo (chip com texto), campo com erro (ícone + texto), ações de deslizar (ícone + texto; só ícone em texto ampliado, com rótulo de acessibilidade), linha desabilitada (motivo em texto, não só cor esmaecida).
- "Reduzir movimento": sem animação de gráfico, skeleton estático e linhas somem sem recolher. "Aumentar contraste": bordas fortes. "Reduzir transparência": barras opacas. "Texto em negrito": automático com a fonte do sistema.

---

## 10. Modo escuro

- Todas as telas, gráficos, splash, overlay de privacidade, ações de deslizar e ícone de abertura têm variante escura com os tokens do 2.1.
- Gráficos recebem as cores do tema ativo (gifted-charts recebe as cores como props; o componente lê do tema, sem cor literal).
- O ícone do app tem variantes clara, escura e tingida (iOS 18+), opcional para a v1, recomendado para a ficha da loja.
- Capturas para a App Store nos dois temas (ao menos o Dashboard com dados e o Dashboard de boas-vindas).

---

## 11. Revisão da App Store (HIG e diretrizes)

| Diretriz / tema | Como o design atende |
|---|---|
| 2.1 Completude / acesso do revisor | Conta demo real (e-mail `demo@showcase.invalid`, senha "demo") nas notas de revisão; ela começa vazia (limpeza diária às 03:00, B7) e o app guia a primeira ação (6.3.1, 6.4.1); pagar, editar e excluir disponíveis para ela (B6); nenhum botão sem função ("Alterar senha" desabilitado com motivo, B8); estados vazios com orientação |
| 2.4.1 iPhone app em iPad | Layout em coluna única, funciona no modo de compatibilidade (3.1) |
| 4.0 Design / 4.2 Funcionalidade mínima | Controles e navegação nativos (deslizar, menu de contexto, modo de seleção, folhas), gráficos interativos, criar, pagar, editar e excluir lançamentos; não é um "site embrulhado" |
| 5.1.1 Privacidade | Links de Política de privacidade e Suporte dentro do app (Entrar e Ajustes) e na ficha; sem rastreamento; cobertura no alternador de apps |
| 5.1.1(v) Exclusão de conta | O app não cria contas; o rodapé de Ajustes e a página de Suporte orientam a pedir ao administrador (R11) |
| 3.1 Pagamentos | Sem compras; "Pagar" e "Pagar fatura" só registram status de um lançamento, sem transação financeira. O texto "gerenciados no site" não menciona preço nem link de compra |
| Senhas | `textContentType` corretos (preenchimento automático e senha forte do iOS, inclusive em "Alterar senha") |
| Sem rede | Telas e mensagens próprias, sem tela branca (6.12, 8.3) |
| Atualização forçada | Tela clara com caminho para a App Store (6.11) |
| Acessibilidade | VoiceOver (com ações personalizadas para tudo que é gesto), Dynamic Type, contraste, alvos (9); preencher os "Accessibility Nutrition Labels" da ficha, se disponíveis |
| Inicialização | Splash nativa estática, sem propaganda, sem tela de carregamento artificial |

---

## 12. Checklist para o tester e o frontend-dev

- [ ] Todos os textos deste documento usados literalmente (DM1-DM10, DM12-DM16 e B5-B8 decididos).
- [ ] Abas Dashboard, Finanças, Ajustes; "+" só em Dashboard e Finanças; nenhuma rota, banner ou botão de "demonstração".
- [ ] Conta demo entra pelo formulário normal com `demo@showcase.invalid` / "demo"; o campo de login é de e-mail.
- [ ] Conta sem dados: Dashboard com card de boas-vindas, resumo zerado e prévia dos gráficos; Finanças com os vazios de 6.4.1 nas três abas; sem aviso de avanço de mês; "Nova despesa"/"Nova receita" abrem os formulários direto.
- [ ] Conta demo: aviso "Os dados desta conta de demonstração são apagados todos os dias." no rodapé do card de boas-vindas e no rodapé da seção Conta em Ajustes; ausente em qualquer outra conta.
- [ ] Conta demo: "Alterar senha" desabilitado com "Indisponível na conta de demonstração", sem navegação; VoiceOver lê "indisponível" e o motivo.
- [ ] Ajustes > "Alterar senha" (demais contas): validação local, sucesso com toast "Senha alterada.", erros de campo, 429 e rede.
- [ ] `mustChangePassword` ou 403 `PASSWORD_CHANGE_REQUIRED` → tela "Troca de senha pendente" (variante definida no ADR), sem tabs e sem gesto de voltar.
- [ ] 401 em qualquer chamada → Entrar com "Sua sessão expirou. Entre novamente."; sem tentativa de renovação; folhas fechadas; formulário descartado; exclusões pendentes não enviadas.
- [ ] 426 → tela de atualização, de qualquer chamada, inclusive login.
- [ ] Pagar: círculo, deslizar para a direita, menu de contexto e ação do VoiceOver; sempre com confirmação; "Pagando…" na linha; toasts do web; sem "Desfazer".
- [ ] Pagar em lote: "Selecionar", `SelectionToolbar` com total, confirmação com até 5 itens + "e mais N", tratamento de `missingIds`.
- [ ] Pagar fatura: botão no detalhe, deslizar e menu no card; desabilitado com "Fatura paga"; textos de `invoicePaidFeedback`.
- [ ] Editar e Excluir aparecem para qualquer usuário (ADMIN, USER e conta demo); nenhuma tela ou estado consulta o `role`. Receitas sem nenhuma ação.
- [ ] Editar: mesma folha do criar, campos preenchidos, data travada em despesa paga no cartão, forma somente leitura, "Desfazer" envia os valores anteriores.
- [ ] Excluir: folha de ações destrutiva com o texto do web; deslize completo não exclui direto; linha some na hora; "Desfazer" por 5 s (10 s com VoiceOver) sem chamada; envio ao fim do toast, ao ir para o fundo, ao iniciar outra exclusão e ao sair da conta; falha restaura a linha.
- [ ] Parcela: excluir e editar afetam só a parcela escolhida; nenhuma opção "todas as parcelas".
- [ ] Erro isolado por bloco no Dashboard (CA14); puxar para atualizar recarrega os três.
- [ ] Status e saldo sempre com ícone + texto; "-R$ 150,00" + "Negativo".
- [ ] `MoneyField`: "1234,5" → `"1234.50"`; "0,00" e "10.000.000.000,00" barrados sem chamada (CA23).
- [ ] Prévia de parcelas "2 × R$ 58,34 e 4 × R$ 58,33" (CA24).
- [ ] Cartão desabilitado sem cartões, com o texto do RF21.
- [ ] VoiceOver: rótulos, resumo dos gráficos, itens como um elemento, ações personalizadas, anúncios, foco após pagar/excluir.
- [ ] Dynamic Type XXL, AX1, AX3 sem corte; alvos ≥ 44 pt; ações de deslizar legíveis.
- [ ] Claro e escuro (inclusive cores das ações de deslizar); "Reduzir movimento", "Aumentar contraste" e "Reduzir transparência".
- [ ] Safe areas em iPhone SE (sem Dynamic Island) e Pro Max (com); teclado não cobre campo nem "Salvar"; `SelectionToolbar` acima do indicador de início.
- [ ] Overlay de privacidade no alternador de apps.
- [ ] Modo de compatibilidade no iPad (menu de contexto com clique secundário).
