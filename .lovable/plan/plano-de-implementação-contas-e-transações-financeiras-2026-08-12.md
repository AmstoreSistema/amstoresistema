# Plano de Implementação: Contas e Transações Financeiras

Este plano detalha a implementação do Módulo Financeiro completo, incluindo a gestão de Contas Financeiras e o livro-razão de Transações, conforme a documentação técnica fornecida.

## 1. Banco de Dados e Lógica de Saldo
*   [x] Criação da tabela `financial_accounts` para armazenar caixas, bancos e carteiras.
*   [x] Adição de campos de auditoria e vínculos em `transactions` (account_id, status, due_date).
*   [x] Implementação de Trigger `handle_transaction_balance` para atualização atômica de saldo em tempo real.
*   [x] Implementação de RPC `transfer_between_accounts` para movimentações seguras entre contas.

## 2. Interface de Contas Financeiras (`/accounts`)
*   [ ] Desenvolvimento da página de gestão de contas.
*   [ ] Modais de:
    *   Nova Conta (nome, tipo, saldo inicial, cor, dados bancários).
    *   Edição de Conta (desativação, alteração de dados).
    *   Transferência entre Contas (origem, destino, valor).
*   [ ] Visualização de saldo em tempo real e KPIs financeiros por conta.

## 3. Livro-razão de Transações (`/transactions`)
*   [ ] Refatoração da página de transações para suportar:
    *   Lançamentos manuais de Receitas e Despesas vinculados a contas.
    *   Vínculos automáticos com Vendas e Compras de Materiais.
    *   Filtros por conta, categoria, fornecedor e data.
    *   Status de pagamento (pendente, pago, cancelado) com impacto automático no saldo.

## 4. Integração do Fluxo Financeiro
*   [ ] Atualização do fluxo de Vendas (POS) para selecionar a conta de destino do pagamento.
*   [ ] Atualização do fluxo de Compras de Materiais para selecionar a conta de origem do débito.
*   [ ] Lógica de estorno e cancelamento em cascata (cancelar venda -> estornar saldo da conta vinculada).

## Detalhes Técnicos
*   Utilização de Supabase RLS para proteção de dados financeiros.
*   Funções `SECURITY DEFINER` com `search_path` definido para segurança.
*   Atualização de saldo via `$inc` (operador atômico do Postgres via Trigger) para evitar condições de corrida.
