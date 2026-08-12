# Plano de Implementação: Módulo de Vendas (PDV)

Implementação do fluxo completo de vendas, desde a seleção de produtos até o fechamento financeiro e controle de estoque/cashback.

## Mudanças

### Banco de Dados (Já implementado via RPCs)
- RPC `create_complete_sale`: Cria venda, itens, transações, decrementa estoque (incluindo numerações) e atualiza cashback.
- RPC `cancel_complete_sale`: Estorna venda, itens, restaura estoque e estorna cashback.
- Tabelas envolvidas: `sales`, `sale_items`, `sale_payments`, `stock_products`, `cashback_entries`, `transactions`.

### Frontend
- **Componentes do PDV**:
  - `POSModal.tsx`: Modal principal com interface dividida entre seleção de itens e fechamento.
  - `ClientSearch.tsx`: Busca e seleção de clientes com exibição de saldo de cashback.
  - `ProductSearch.tsx`: Busca de produtos no estoque com seleção de numeração/tamanho.
  - `ReceiptModal.tsx`: Modal para visualização e impressão do comprovante de venda.
- **Integração na Página de Vendas**:
  - Atualização de `src/routes/_authenticated.sales.tsx` para gerenciar o estado do PDV e listar vendas recentes.
  - Implementação do botão "Estornar Venda" que invoca o `cancelSale` do servidor.

## Detalhes Técnicos
- Utilização de `createServerFn` para invocar os RPCs do backend.
- Gestão de estado local para o "Carrinho de Vendas" antes da persistência.
- Lógica de cálculo de totais, descontos e cashback em tempo real no frontend.
- Tratamento de vendas a prazo (fiado) com registro nas transações financeiras.

## Próximos Passos
1. Finalizar `ProductSearch.tsx` com suporte a numerações.
2. Finalizar `ClientSearch.tsx` com exibição de cashback.
3. Integrar fechamento financeiro no `POSModal.tsx`.
4. Implementar visualização de recibo.
