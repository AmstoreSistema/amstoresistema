# Plano de Implementação: Fluxo Completo de Vendas

Este plano detalha a implementação do módulo de Vendas (PDV) com integração total ao estoque, financeiro, clientes e cashback, conforme a documentação técnica fornecida.

## 1. Banco de Dados (Supabase)

O esquema básico já existe, mas precisa de tabelas e campos adicionais para suportar o fluxo completo.

- **Tabelas Novas:**
  - `sale_payments`: Registro de pagamentos parciais vinculados a uma venda.
  - `cashback_history`: Registro detalhado de ganho e uso de cashback.
  - `promotional_qr`: Registro de cupons QR gerados em vendas.

- **Ajustes nas Tabelas Existentes:**
  - `sales`: Adicionar `discount`, `paid_amount`, `status` (pendente, parcial, pago, cancelado), `payment_method`, `is_historical`, `cashback_used`, `cashback_earned`, `vendedor`.
  - `sale_items`: Adicionar `numeracao` (para calçados), `discount` (por item), `stock_snapshot` (JSON com dados do produto no momento da venda).
  - `clients`: Garantir campos `cashback_balance`, `total_purchases`, `last_purchase_at`, `used_sizes`.
  - `stock_products`: Campo `numeracoes` (JSON) para controle por tamanho.

## 2. Lógica de Servidor (TanStack Start)

Criação de `src/lib/sales.functions.ts` com funções robustas:
- `createSale`: Executa a cascata atômica (Venda -> Itens -> Estoque -> Financeiro -> Cashback).
- `registerSalePayment`: Registra pagamentos adicionais em vendas "parciais".
- `cancelSale`: Reverte integralmente o estoque e o financeiro.

## 3. Interface do Usuário (Frontend)

- **PDV (Novo Produto):**
  - Modal lateral de alta fidelidade para seleção de cliente, produtos e forma de pagamento.
  - Busca inteligente de produtos (nome/SKU/barras).
  - Seleção de numeração dinâmica baseada no estoque disponível.
  - Resumo financeiro em tempo real (subtotal, descontos, cashback).
  
- **Listagem e Histórico:**
  - Visualização de vendas por data.
  - Status coloridos (Pago, Parcial, Pendente, Cancelado).
  - Ações rápidas: Impressão de Cupom, DANFE, Estorno.

- **Componentes:**
  - `SaleModal`: O coração do PDV.
  - `SaleReceipt`: Visualização/Impressão do cupom de venda.
  - `PaymentModal`: Para baixas parciais.

## Detalhes Técnicos

- **Cálculo de Cashback:** Baseado na categoria do produto.
- **Atomicidade:** Uso de transações Supabase ou lógica de compensação no servidor.
- **Controle de Estoque:** Decremento preciso no objeto JSON de numerações para calçados.
- **Integração Financeira:** Geração automática de registros na tabela `transactions`.
