# Design: despesas parceladas

**Spec:** `docs/specs/despesas-parceladas.md`  
**Impacto em UI:** sim

## Ação no cabeçalho

- Acrescentar ação secundária "Nova despesa parcelada" ao lado do botão existente "+ Novo lançamento".
- Em telas estreitas, ações ficam empilhadas e ocupam a largura disponível; não substituir nem misturar a ação existente.
- A ação fica dentro do mesmo limite `WriteOnly`, portanto não aparece na demo.

## Drawer independente

Título "Nova despesa parcelada". Campos:

1. Descrição.
2. Categoria (mesmas opções e combobox).
3. Data da primeira parcela.
4. Valor total da compra, em BRL.
5. Quantidade de parcelas, inteiro entre 2 e 36.
6. Forma de pagamento PIX/Cartão; Cartão mostra o seletor de cartão e torna-o obrigatório.

Receita e estado "Ainda não paguei" não fazem parte deste fluxo. O formulário explica que todas as parcelas começam pendentes. Não alterar nem reaproveitar estado de formulário do drawer existente.

## Prévia e confirmação

Após valor, quantidade e data válidos, mostrar uma lista compacta e acessível com `1ª parcela — R$ x,xx — dd/MM/yyyy`, até 6 linhas e texto "e mais N parcelas"; incluir total e número de parcelas. A prévia apresenta as diferenças de centavos reais calculadas pela mesma regra da API.

Botão final "Criar parcelas (N)". Sucesso fecha, atualiza as leituras e mostra toast "N parcelas criadas."; não marcar todas como "recentes" na lista.

## Erros e acessibilidade

- Drawer responsivo existente: folha de tela cheia em viewport estreita e painel lateral em viewport larga.
- Reusar primitivos de `Drawer`, `TextField`, `CategoryCombobox`, `SelectField`, `SegmentedControl`, `InlineAlert` e alertas de sessão.
- Erros de validação são associados aos campos; erro geral fica focável. Erro de cartão removido orienta a atualizar a lista sem apagar os outros dados.
- Enquanto envia, campos/botões ficam indisponíveis; falha não fecha nem limpa o formulário.
- Se não houver cartões, oferecer atalho para a tela de cartões; se houver erro ao carregá-los, permitir tentar novamente sem perder os dados.
