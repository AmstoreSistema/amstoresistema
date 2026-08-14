# Plano: Detalhamento do Histórico de Pagamentos na Venda

O objetivo é atualizar o modal de detalhes da venda para que o histórico de pagamentos exiba informações completas: valor recebido, conta financeira de destino e data de recebimento, conforme solicitado pelo usuário e demonstrado na imagem de referência.

## Alterações

### Backend (Server Functions)

- **src/lib/sales.functions.ts**:
    - Atualizar a função `getSaleDetails` para que a consulta na tabela `sale_payments` inclua a relação com as contas financeiras (`financial_accounts`).
    - *Nota*: Como a tabela `sale_payments` no banco de dados não possui a coluna `account_id` (visto no schema), mas os pagamentos de vendas geram registros na tabela `transactions` que possuem `account_id`, ajustaremos a lógica para buscar os detalhes da conta a partir das transações vinculadas à venda quando necessário, ou garantiremos que o retorno do Supabase traga o nome da conta se a relação existir.

### Frontend (Componentes)

- **src/components/sales/SaleDetailsModal.tsx**:
    - Refatorar a seção "Histórico de Pagamentos".
    - Exibir o valor em destaque (cor verde).
    - Exibir o método de pagamento e a data formatada.
    - Exibir a conta financeira (ex: "Conta: Caixa Principal").
    - Ajustar o layout para alinhar com a imagem `user-uploads://image-85.png`.

## Detalhes Técnicos

- Utilizar `brl()` para formatação de moeda.
- Utilizar `dateTimeBR()` para formatação de data/hora.
- Verificar se a relação `financial_accounts` está disponível via PostgREST no Supabase para a tabela `sale_payments`. Caso contrário, buscaremos via `transactions`.

## Verificação

- Abrir o detalhe de uma venda no sistema.
- Validar se o histórico de pagamentos mostra todos os campos solicitados.
- Comparar visualmente com a imagem de referência fornecida pelo usuário.
