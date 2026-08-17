# Plano de Correção: Alerta de Débitos e Cálculos de Fiado

O usuário relatou que a mensagem de pendência aparece na finalização da venda (e não na seleção do cliente) e que os cálculos de saldo devedor e cashback liberado no histórico estão incorretos (ex: R$ 100 comprado, R$ 80 pago, mas ainda mostra R$ 100 de dívida em vez de R$ 20).

## 1. Correção do Alerta de Débito no PDV
- Ajustar `src/components/sales/POSModal.tsx` para garantir que `setDebtAlert({ isOpen: false, ... })` seja chamado explicitamente antes de disparar um novo alerta.
- Garantir que a lógica de verificação de débitos ocorra **apenas** quando o cliente é selecionado e não seja re-disparada ou mantida aberta indevidamente durante a finalização.
- Refinar o filtro de `unpaidInstallments` para ser mais robusto contra variações de status.

## 2. Correção de Cálculos Financeiros (Fiado e Saldo)
- Revisar `src/lib/clients.functions.ts` para garantir que o `total_debt` retornado no objeto `stats` considere os pagamentos parciais já realizados nas parcelas.
- Atualizar `src/components/clients/ClientDetailsModal.tsx` para exibir o "Saldo Devedor" real, subtraindo o `total_paid` do `total_bought` para vendas ativas.
- Corrigir a exibição do saldo devedor por venda no histórico para refletir o valor remanescente real (R$ 20 no exemplo do usuário).

## 3. Melhoria na Exibição de Cashback Liberado
- Ajustar o cálculo de "Cashback a ser liberado" no histórico de vendas do cliente para usar o saldo devedor da parcela específica, garantindo que o valor exibido faça sentido com o que falta pagar.

## Detalhes Técnicos
- **Arquivo `src/lib/clients.functions.ts`**: Alterar a query e o cálculo de `total_debt` para subtrair `paid_amount` de cada parcela.
- **Arquivo `src/components/sales/POSModal.tsx`**: Adicionar um `setDebtAlert` com `isOpen: false` no início da função de limpeza e garantir que o efeito de verificação de débitos não cause loops ou re-exibições.
- **Arquivo `src/components/clients/ClientDetailsModal.tsx`**: Ajustar os badges e os cards de estatísticas para usar a lógica de saldo remanescente real.
