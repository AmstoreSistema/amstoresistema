# Plan: Modernize Fiados (Credit) Module

Modernize the credit management interface to follow a noir/gold card-based design with advanced filtering and a dedicated "Secretário" payment modal.

## 1. Credit Page Refactor (`src/routes/_authenticated.credit.tsx`)
- Implement filter state: `status` ('all', 'overdue', 'ontime') and `term`.
- Calculate overdue status by checking if any installment of a sale is past its `due_date`.
- Group sales by client to display unique client cards.
- **Client Card Content**:
  - Client Name.
  - Count of pending sales.
  - Highlighted "Total Devido" (Total - Paid).
  - "Ver detalhes" link (opens `ClientDetailsModal`).

## 2. Installment List & Status
- Enhance the sale installment display in `SaleInstallmentsModal` and `SaleDetailsModal`.
- Add a "Pendente" (Yellow) status badge for unpaid installments.
- Ensure payment history is visible below the installments list.

## 3. "Secretário" Payment Modal (`src/components/sales/PaymentSecretaryModal.tsx`)
Create a new specialized component to handle credit payments:
- **Header**: Venda ID, Client, and Financial summary.
- **Installment Selector**: List of pending installments with checkboxes.
- **Payment Fields**:
  - `amount_to_pay` (auto-calculated from selected installments).
  - `payment_method` (Dinheiro, Pix, Card).
  - `payment_date`.
  - `financial_account_id`.
  - `notes`.
- **Dynamic Summary**: "Valor a pagar agora" vs "Restante".
- **Action**: Call `registerSalePayment` server function and invalidate relevant queries.

## Technical Details
- Use `sale_installments` table data to determine "Vencido" (Overdue) status.
- Ensure the "Ver detalhes" link correctly triggers the existing `ClientDetailsModal`.
- Maintain Noir and Gold aesthetics throughout the new UI.
