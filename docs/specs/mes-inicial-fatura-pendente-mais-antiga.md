# Spec: Mês inicial da fatura pendente mais antiga

- **Impacto em UI: sim** — o mês exibido ao abrir a listagem sem `month` pode ser anterior ao mês atual. Não há novo componente nem mudança visual.
- **Status:** aprovada pelo usuário em 2026-11-01.
- **Escopo:** seleção do mês inicial em `/entries` e `/demo/entries`; não altera o mês informado explicitamente na URL.
- **Referências:** `docs/specs/listagem-mes-e-status-padrao.md` (regra atual e CA14), ADR 0007 e `api/src/modules/finance/domain/initial-month/resolve-initial-month.ts`.

## Regra

Ao abrir a listagem sem `month`, se houver fatura de cartão pendente com mês de referência anterior ao mês atual, selecionar a fatura pendente mais antiga. O mês de referência já persistido na despesa é a fonte de verdade; não recalcular faturas com base no fechamento atual do cartão.

Exemplo: cartão fecha dia 04 e vence dia 11. Uma compra em 20/09/2026 referencia outubro; uma compra em 20/10/2026 referencia novembro. Com ambas pendentes e mês atual novembro, abrir em outubro de 2026.

Para compatibilidade com a regra atual:

- Somente faturas de cartão anteriores ao mês atual passam a ser consideradas.
- PIX pendente em mês anterior continua sem influenciar o mês inicial.
- Se não houver fatura antiga pendente, a regra atual permanece: primeira pendência em ou após o mês atual (incluindo PIX), senão mês seguinte se houver cartão, ou mês atual sem cartão.
- Um `month` válido ou inválido já presente na URL continua impedindo a resolução automática.
- A mudança vale para as rotas protegida e demo. Falhas ao consultar a decisão continuam usando o fallback atual.
- Selecionar um mês anterior não exibe aviso de avanço; o aviso atual continua reservado a avanços para meses futuros.

## Critérios de aceitação

1. Dado o mês atual novembro/2026, cartão com fechamento dia 04 e vencimento dia 11, e compras pendentes em 20/09/2026 e 20/10/2026, ao abrir sem `month`, o mês é outubro/2026 (referência da fatura mais antiga).
2. Se a fatura de outubro for paga ou não houver mais despesas pendentes nela, o exemplo acima abre em novembro/2026.
3. Havendo faturas antigas pendentes em mais de um mês, vence o menor mês de referência; o resultado não depende da ordem de inserção.
4. Uma PIX pendente somente em mês anterior não substitui a regra existente nem passa a ser selecionada como mês inicial.
5. Se não houver fatura antiga pendente, as regras existentes para pendências atuais/futuras (cartão ou PIX), ausência de pendências e existência de cartão permanecem.
6. `/entries` e `/demo/entries` produzem a mesma decisão para os mesmos dados do respectivo usuário/conjunto demo.
7. Uma URL com `month` explícito, válido ou inválido, não é redirecionada pelo cálculo automático.
8. A decisão não altera dados, não recalcula referências antigas e permanece isolada por usuário.
9. Falhas da leitura mantêm o fallback atual para o mês corrente, sem aviso de avanço.

## Fora de escopo

- Alterar filtros de status, cálculo de fatura, cadastro/edição de cartão ou comportamento de mês escolhido explicitamente.
- Exibir aviso para o caso em que a listagem abre em um mês anterior.
