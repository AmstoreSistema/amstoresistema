# Plano: Correção de Inconsistências no Detalhe do Cliente (Status da Venda e Saldo de Cashback)

O objetivo é corrigir dois problemas relatados no detalhe do cliente:
1.  **Status "Parcial" em Vendas Pagas**: Vendas pagas integralmente estão aparecendo como "Parcial" no histórico de vendas do cliente.
2.  **Divergência de Cashback**: O valor de cashback gerado na venda não condiz com o valor exibido no "Detalhamento de Cashback por Categoria".

## Alterações

### 1. Correção do Status da Venda no Histórico
- **src/components/clients/ClientDetailsModal.tsx**:
    - Ajustar a lógica de exibição do status. Atualmente, ele compara `sale.status === 'paid'`, mas no banco de dados o valor padrão é `'completed'`. 
    - Vou padronizar para considerar `paid`, `completed` ou `finalizado` como status de venda concluída, ou simplesmente confiar na comparação entre `paid_amount` e `total_amount`.

### 2. Sincronização e Precisão do Cashback
- **src/lib/sales.functions.ts**:
    - Garantir que ao criar uma venda (`create_complete_sale`), a entrada em `cashback_entries` reflita exatamente o que foi calculado e exibido no PDV.
    - O cálculo de cashback por categoria na função `createSale` será revisado para garantir consistência com a exibição do frontend.
- **Banco de Dados (Trigger)**:
    - O trigger `tr_sync_cashback_balance` e a função `sync_client_cashback_balance` parecem estar corretos ao somar as entradas, mas a função `get_client_cashback_by_category` (RPC) usa um cálculo em tempo real baseado nos itens da venda que pode divergir se a configuração de cashback mudar após a venda.
    - **Ajuste na RPC `get_client_cashback_by_category`**: Vou modificar a lógica para que ela utilize os valores *snapshot* ou registros históricos reais se possível, ou pelo menos garanta que o arredondamento (`Math.floor` vs `numeric`) seja idêntico ao do PDV.

## Detalhes Técnicos

- **Status**: Alterar `sale.status === 'paid'` para `(sale.status === 'paid' || sale.status === 'completed' || sale.status === 'finalizado' || Number(sale.paid_amount) >= Number(sale.total_amount))`.
- **Cashback**: Investigar por que `2.00` gerou `2.54`. Provavelmente a RPC está recalculando com porcentagens atuais sobre o total bruto, enquanto a venda salvou um valor fixo. Vou sugerir (ou implementar via código) que o detalhamento por categoria seja mais fiel ao que foi registrado no momento da transação.

## Verificação

- Realizar uma venda teste e verificar o status no perfil do cliente.
- Validar se o cashback acumulado por categoria bate com o total gerado na venda.
