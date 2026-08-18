# Plano de Implementação - Bônus Cashback em Tempo Real e Liberação Proporcional

Melhorar a experiência do PDV exibindo o bônus de cashback em tempo real e garantir que a liberação para o saldo do cliente ocorra proporcionalmente aos pagamentos.

## Alterações de Interface (UI)

- **PDV (Nova Venda):**
  - O campo "Bônus Cashback" será atualizado instantaneamente conforme produtos são adicionados, removidos ou têm seus descontos alterados.
  - O cálculo levará em conta a categoria de cada produto e o percentual configurado em "Cashback por Categoria".

## Alterações de Lógica (Frontend)

- **POSModal.tsx:**
  - Ajustar o `useEffect` que calcula o `estimatedCashback` para garantir que ele reflita os valores líquidos de cada item (preço * quantidade - desconto do item).
  - Remover qualquer lógica de arredondamento agressiva no frontend para manter consistência com o banco de dados.

## Alterações de Lógica (Backend/Banco de Dados)

- **Lógica de Gravação (create_complete_sale):**
  - Garantir que o valor total de cashback calculado (`cashback_earned`) seja gravado na tabela `sales` no momento da criação, independentemente de ser venda à vista ou fiado.
  - O gatilho `tr_release_cashback_on_payment` já existente cuidará da liberação proporcional automática sempre que uma transação do tipo 'income' (receita) for vinculada à venda.

## Verificação Técnica (Internal)

- Validar que o gatilho `tr_release_cashback_on_payment` está ativo na tabela `transactions`.
- Confirmar que a função `release_proportional_cashback` calcula corretamente a proporção `(pagamento / total_venda) * cashback_total`.
- Verificar se a sincronização do saldo (`sync_client_cashback_balance`) é disparada após a inserção na `cashback_entries`.
