# ADR 0010 - Despesas parceladas

- **Status:** Aceito para implementação
- **Spec:** `docs/specs/despesas-parceladas.md`
- **Impacto em UI:** sim

## Decisões

1. Cada parcela é um `Entry` independente. Não será introduzido aggregate persistido de parcelamento nem coluna de grupo nesta entrega: os lançamentos mantêm compatibilidade com listagens, filtros, faturas, pagamento, edição e exclusão existentes.
2. `POST /api/entries/installments` é uma operação dedicada. O corpo recebe valor total, quantidade, primeira data, forma de pagamento e, para cartão, `cardId`; a API gera parcelas e IDs.
3. Quantidade entre 2 e 36. O valor total é moeda decimal positiva, limitado ao teto atual por lançamento. Repartição usa centavos inteiros e aloca o resto às primeiras parcelas, garantindo soma exata.
4. As datas mensais preservam o dia inicial sempre que possível; no mês curto a data é o último dia do mês, sem propagação do truncamento ao mês seguinte.
5. Todas as parcelas nascem `PENDING`, inclusive PIX. A compra parcelada cria compromissos futuros; cada um segue o pagamento normal do sistema depois de registrado.
6. A API calcula faturas de cartão por lançamento e persiste toda a série no mesmo Unit of Work/transação. Os eventos `EntryCreated` são publicados após o commit.
7. Não há edição/exclusão em grupo nem cancelamento em cascata. Depois da criação, cada parcela é um lançamento independente, coerente com as operações existentes.

## Consequências

- Não há migração de schema.
- O limite de 36 restringe o volume de uma requisição e mantém datas dentro de uma série previsível.
- Em arredondamentos inexatos, parcelas iniciais podem diferir em um centavo.
- Operações posteriores sobre uma parcela não alteram as demais.
