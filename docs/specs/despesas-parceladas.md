# Spec: despesas parceladas

**Impacto em UI: sim** — novo botão e drawer "Nova despesa parcelada" no cabeçalho de Lançamentos.

## Contexto e decisões

Adicionar várias despesas mensais a partir de uma única compra, mantendo cada parcela como lançamento independente. O formulário atual de lançamento permanece inalterado.

- O campo Valor representa o **total da compra**. Esse total é dividido por igual entre 2 a 36 parcelas, com precisão de centavos. Centavos que não se dividem igualmente são distribuídos, um por vez, nas parcelas iniciais; a soma sempre corresponde exatamente ao total (R$ 350,00 em 6x: R$ 58,34 nas duas primeiras e R$ 58,33 nas quatro seguintes).
- A data informada é a data da primeira parcela. As demais usam o mesmo dia civil nos meses seguintes; se o mês não tiver esse dia, usa-se o último dia daquele mês, sem deslocar o dia-âncora dos meses posteriores.
- Permite PIX ou Cartão. Todas as parcelas são criadas como `PENDING`, inclusive em PIX; o objetivo é registrar obrigações mensais, que poderão ser pagas individualmente ou em lote pelas ações existentes. Em Cartão, todas usam o cartão selecionado, com fatura calculada individualmente para cada data.
- Apenas despesas podem ser criadas por esse fluxo. A receita continua usando o formulário atual.
- A criação dos N lançamentos é atômica: qualquer falha deixa todos sem persistir. Cada parcela tem ID próprio, status próprio e pode ser editada, paga ou excluída pelas regras existentes.
- A operação usa o dono autenticado e não recebe owner em seu corpo.

## Critérios de aceitação

1. A tela protegida mostra uma ação separada "Nova despesa parcelada"; o fluxo não acrescenta campos ao formulário "Novo lançamento".
2. O drawer coleta descrição, categoria, data inicial, valor total, quantidade de parcelas e forma de pagamento; Cartão exige cartão. Receitas não aparecem como opção.
3. O resumo prévio informa quantidade e valor de cada parcela, inclusive diferenças de centavos.
4. Ao salvar 6 parcelas, a API retorna seis lançamentos ordenados por data, cada um com valor, data, status e fatura individuais.
5. Valor total dividido sempre preserva exatamente os centavos e cada parcela tem valor positivo.
6. Dia civil da data inicial é mantido quando possível; datas inexistentes no mês de destino são limitadas ao último dia do mês.
7. Uma despesa parcelada de cartão produz uma data de compra e uma fatura correspondente para cada mês.
8. Toda criação da série é transacional e os eventos só são publicados depois do commit.
9. A validação rejeita campos desconhecidos, valor inválido, quantidade fora de 2..36, série abaixo de um centavo por parcela, data fora da faixa suportada ou cartão inexistente.
10. A série é criada somente para o dono autenticado; cartão de outro dono não é aceito.
11. A interface indica sucesso com a quantidade de parcelas criadas e revalida lista, faturas, resumo e dashboard. Erros preservam os campos e não apresentam falso sucesso.
12. Em modo demo/readonly, a ação e o drawer de escrita não são renderizados.

## Contrato proposto

`POST /api/entries/installments` — body estrito:

```json
{
  "description": "Notebook",
  "category": "Eletrônicos",
  "date": "2026-11-01",
  "amount": "350.00",
  "installments": 6,
  "paymentMethod": "CARD",
  "cardId": "0192f3a4-0000-7000-8000-000000000001"
}
```

Resposta `201 { items: EntryDto[] }`, ordenada por data. Erros seguem o contrato `{ code, message, details }`; validação: `400`; cartão inexistente/de outro dono: `404 CARD_NOT_FOUND`; nenhuma parcela é persistida em caso de erro.

## Tarefas

### [api] [db]

- Criar value object/serviço de domínio puro para plano mensal e distribuição exata de centavos.
- Implementar use case e endpoint estrito, com seleção do cartão por owner e persistência de toda a série em uma transação.
- Emitir eventos de criação individuais somente após o commit; DTO de resposta contém cada parcela.
- Cobrir datas de fim de mês/ano bissexto, arredondamento, limites e falha atômica.

### [web]

- Adicionar botão separado no cabeçalho e drawer próprio; não alterar o drawer existente.
- Buscar/reutilizar cartões e categorias já disponíveis no host de formulários.
- Mostrar prévia das parcelas, manter status pendente e tratar erros/sessão.
- Revalidar telas após criação; cobrir desktop/mobile e modo readonly.
