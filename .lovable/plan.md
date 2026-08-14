# Plano de Ajuste de Cashback

Este plano descreve as alterações para mover o botão "Zerar Todos os Cashbacks" para a página de Clientes (Cashback) e corrigir o erro ao executar a função.

## Alterações

### 1. Backend: Corrigir função de reset
- Arquivo: `src/lib/cashback-cleanup.functions.ts`
- Ajustar a lógica de deleção e update para evitar erros de sintaxe ou de permissão.
- Usar filtros mais seguros que funcionem em todos os casos (ex: `gt('created_at', '2000-01-01')` ou similar se o `.neq('id', 'zero-uuid')` falhar).

### 2. Frontend: Mover o botão
- Arquivo: `src/routes/_authenticated.promotions.tsx`
  - Remover o botão "Zerar Todos os Cashbacks" do cabeçalho.
  - Remover a importação e lógica associada.
- Arquivo: `src/routes/_authenticated.clients.tsx`
  - Adicionar o botão "Zerar Todos os Cashbacks" no cabeçalho ao lado de "Novo Cliente".
  - Importar a função `resetAllCashbacks` e implementar o handler com confirmação e toast.

## Detalhes Técnicos
- A falha "Erro ao zerar cashbacks" pode ser devido ao uso de UUIDs inexistentes nos filtros `.neq`. Vamos simplificar para garantir que a deleção ocorra.
- O trigger `tr_sync_cashback_balance` já lida com a sincronização do saldo em `clients` quando `cashback_entries` são deletados, mas o reset explícito em `clients` é uma boa segurança adicional.

## Verificação
- Acessar a página de Clientes.
- Clicar no botão e confirmar.
- Verificar se o toast de sucesso aparece e se os saldos no PDV/Clientes foram para 0.
