# Design — Mês inicial pela fatura pendente mais antiga

- **Impacto em UI:** sim, apenas no comportamento do mês inicial. Não há novos componentes, controles ou estilos.
- **Status:** aprovado pelo usuário em 2026-11-01.

## Comportamento

- A entrada sem `month` continua redirecionando para uma URL com mês explícito, preservando os demais parâmetros.
- Se a API encontrar fatura de cartão pendente em mês anterior, a URL recebe esse mês e a tela mostra normalmente as despesas/faturas daquele mês.
- Não exibir o aviso de avanço (`adv`) ao voltar para uma fatura histórica. O aviso atual continua para mudanças automáticas para meses futuros.
- Mês explicitamente presente na URL e filtros/abas existentes permanecem preservados.
- Em falha na consulta, manter o fallback atual para o mês corrente.

## Critério visual

Nenhuma mudança de layout é esperada. Validar o mês do cabeçalho, o seletor e os dados da listagem para a referência histórica, sem aviso de avanço indevido.
