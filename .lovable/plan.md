# Plano de Implementação: Baixa de Materiais e Cortes na Produção e Venda

Este plano descreve as alterações necessárias para garantir que a finalização de uma produção ou venda dê baixa corretamente nos estoques de materiais, variações e cortes, além de integrar as transações financeiras.

## Alterações de Banco de Dados (Supabase)

1.  **Novas Tabelas e Colunas:**
    *   `production_order_items`: Para registrar quais materiais/cortes foram usados em uma ordem específica (instante da produção).
    *   `transactions`: Já existe, mas garantir colunas para `sale_id`, `production_id`, `type` (entrada/saída).

## Implementação da Lógica de Produção (`src/routes/_authenticated.production.tsx`)

Ao clicar em "Concluir Produção":
1.  **Recuperar a Composição do Produto:** Buscar todos os itens da tabela `product_materials` para o `product_id` da ordem.
2.  **Calcular Necessidade Total:** Multiplicar a quantidade da composição pela quantidade produzida (`order.quantity`).
3.  **Processar Baixas:**
    *   **Materiais Simples:** Subtrair `quantity * order.quantity` do `current_stock` em `materials`.
    *   **Variações:** Subtrair do `current_stock` em `material_variations`.
    *   **Cortes:** Se a linha da composição especifica um `material_cut_id`, alterar o status do corte para 'usado' (ou 'consumido').
4.  **Entrada de Estoque do Produto:** Incrementar o `current_stock` do produto final na tabela `products`.
5.  **Log de Auditoria:** Registrar a baixa e a entrada de estoque.

## Implementação da Lógica de Vendas (`src/routes/_authenticated.sales.tsx`)

Ao finalizar uma venda no PDV:
1.  **Baixa de Estoque de Produtos:** Subtrair a quantidade vendida do `current_stock` em `products`.
2.  **Lógica de Fiado:** Se a venda for marcada como fiado (`is_debt`):
    *   Criar um registro na tabela `credit` (ou `fiados`) associado ao cliente.
    *   Registrar uma transação do tipo 'saída_pendente' ou similar.
3.  **Transações Financeiras:** Criar um registro em `transactions` com o valor da venda, tipo 'receita'.

## Detalhes Técnicos

*   Uso de `supabase.rpc` ou transações manuais via `Promise.all` no frontend (idealmente encapsulado em uma função de servidor para atomicidade).
*   Validação de estoque insuficiente antes de iniciar/concluir a produção.
*   Atualização de status de cortes de 'reservado' para 'usado'.

## Próximos Passos

1.  Criar a migração para as tabelas de transações e ajustes de esquema.
2.  Refatorar a função `updateStatus` em `production.tsx` para incluir a lógica de baixa.
3.  Implementar o modal de Nova Venda (PDV) com a lógica de baixa e fiado em `sales.tsx`.
