# ADR 0009 — Mês inicial pela fatura de cartão pendente mais antiga

- **Status:** Aceito (2026-11-01; aprovado pelo usuário).
- **Contexto:** ADR 0007 e a especificação de listagem ignoram pendências anteriores ao mês atual. Por isso, ao abrir a listagem em novembro, uma fatura pendente de outubro não é selecionada.
- **Decisão:** a leitura usada pelo endpoint de mês inicial deve também obter o menor mês de referência de despesas de cartão PENDENTES, sem limite inferior. Se esse mês for anterior ao mês atual, ele prevalece sobre a decisão existente. Caso contrário, mantém-se integralmente a regra atual baseada na primeira pendência a partir do mês atual e na existência de cartão.
- **PIX:** pendências antigas de PIX não entram na nova busca histórica. PIX no mês atual ou futuro continua compondo a decisão existente.
- **Referência histórica:** usar `reference_month` persistido, não recalcular a fatura com a configuração atual do cartão.
- **Borda da API:** manter o contrato público existente e indicar ausência de avanço futuro para um mês histórico; o web não deve montar o aviso `adv` nesse caso.
- **Impacto:** alterar a porta/read model e o domínio/caso de uso na API, testes unitários/de integração/e2e e fixture compartilhada pelo stub do web. O fluxo de redirecionamento do web deve ser testado para garantir que mês histórico não produza aviso de avanço. As rotas protegida e demo precisam permanecer consistentes.

## Consequências

- Usuários com faturas antigas ainda pendentes passam a vê-las primeiro ao entrar sem mês explícito.
- A busca histórica deve restringir-se a despesas de cartão pendentes; uma busca histórica de qualquer despesa mudaria a regra vigente de PIX.
- Mês explícito, fallback de falha, mês de referência persistido e isolamento por usuário permanecem inalterados.
