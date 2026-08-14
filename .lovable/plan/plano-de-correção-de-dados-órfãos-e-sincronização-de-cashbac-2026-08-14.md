# Plano de Correção de Dados Órfãos e Sincronização de Cashback

O sistema apresenta inconsistências no saldo de cashback exibido no PDV devido a exclusões diretas de vendas e falta de sincronização entre o saldo armazenado na tabela `clients` e as transações reais de cashback.

## Mudanças Técnicas

### 1. Banco de Dados (Supabase)

- **Correção da Função `get_client_cashback_by_category`**: Atualmente, esta função calcula o ganho baseado nos itens de venda, mas não desconta o cashback utilizado nem considera entradas manuais ou bônus de QR Code. Vou simplificá-la para refletir o saldo real por categoria se possível, ou garantir que ela ignore vendas deletadas (o que o PostgreSQL já faz se as vendas forem removidas via `DELETE`).
- **Trigger de Auditoria de Saldo**: Criar um trigger na tabela `cashback_entries` (ou `transactions` se o cashback for tratado lá) para recalcular e atualizar o `cashback_balance` do cliente sempre que houver uma alteração, garantindo que o saldo em `clients` nunca fique "órfão".
- **Cascata de Exclusão**: Garantir que a remoção física de uma venda dispare a limpeza de registros relacionados em `cashback_entries` e `qr_promo_history`.

### 2. Backend (TanStack Start)

- **Sincronização no PDV**: Ajustar a busca de dados do cliente para sempre priorizar o cálculo dinâmico do saldo disponível a partir do extrato de transações, em vez de confiar apenas no campo estático `cashback_balance`.

### 3. Frontend

- **Validação no PDV**: No componente `POSModal`, adicionar uma verificação de segurança que invalida o cashback caso a venda original seja inexistente.

## Detalhes de Implementação

- Criar migração para adicionar `ON DELETE CASCADE` em chaves estrangeiras cruciais se faltarem.
- Implementar trigger para manter `clients.cashback_balance` sincronizado com `cashback_entries`.
- Ajustar `getClientDetails` para retornar o saldo calculado dinamicamente.
