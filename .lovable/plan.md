# Plano de Ação - Correção e Melhoria do Fluxo de Vendas (Numeração)

O objetivo é corrigir o erro `column "numeracao" does not exist` ao finalizar vendas e garantir que a numeração dos calçados seja registrada corretamente em todas as tabelas e fluxos.

## Alterações no Banco de Dados (Supabase)

- Adicionar a coluna `numeracao` (TEXT) na tabela `sale_items` (se ainda não existir).
- Atualizar a função RPC `create_complete_sale` para tratar corretamente o campo `numeracao` vindo do JSON de itens, garantindo que ele seja persistido na tabela `sale_items`.
- Garantir que a baixa de estoque na função `create_complete_sale` considere a numeração quando disponível.

## Alterações no Backend (TanStack Start Functions)

- Validar no `src/lib/sales.functions.ts` que o campo `numeracao` está sendo passado corretamente no validador Zod e repassado para o RPC do banco de dados.

## Alterações no Frontend (Componentes)

- Verificar no `src/components/sales/POSModal.tsx` se o objeto de itens enviado para o servidor contém a propriedade `numeracao`.
- Garantir consistência visual e funcional no `ProductSearch.tsx` para que a seleção de tamanho seja obrigatória ou sugerida para produtos que possuem grade.

## Verificação Técnica

- Realizar um teste de venda com um produto com numeração e verificar:
  1. Se a venda é concluída sem erro de banco de dados.
  2. Se a numeração aparece no registro da venda e itens de venda.
  3. Se a baixa de estoque ocorreu na numeração específica dentro da coluna JSONB `numeracoes` da tabela `stock_products`.
