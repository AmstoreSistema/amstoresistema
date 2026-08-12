# Plan: Client Sale Details Modal & PDV Finalization Fix

Implement a detailed view for specific sales when clicking on the transaction history within the client details modal, following the user's uploaded reference (image-52.png). Also, investigate and fix the recurring sale finalization error.

## Proposed Changes

### Database & Schema
- No schema changes. The `sales`, `sale_items`, `sale_payments`, and `sale_installments` tables already contain the necessary data.

### Server Functions
- **`src/lib/sales.functions.ts`**:
    - Add `getSaleDetails` server function to fetch a specific sale's items, payments, and installments.
    - Review `create_complete_sale` RPC calls and ensure all parameters are correctly passed and handled to resolve finalization errors.

### Components
- **`src/components/sales/SaleDetailsModal.tsx`**:
    - Create a new modal that follows image-52.png.
    - Sections: Sale Code & Status, Payment Method, Items List (with unit price and total), Payments Made (with date, method, and account), and Financial Summary (Subtotal, Discount, Total).
    - "Ver Cupom Fiscal" button to trigger the existing `ReceiptModal`.

### Integration
- **`src/components/clients/ClientDetailsModal.tsx`**:
    - Add state to track the selected sale for the detailed view.
    - Make the sales history items clickable to open the `SaleDetailsModal`.

### Bug Fixes
- **PDV Finalization**:
    - Ensure the `create_complete_sale` RPC signature matches exactly between frontend and backend.
    - Add better error handling and logging in the server function.

## Technical Details

### UI Styling (Image-52.png)
- Clean, minimal layout.
- Status badges (e.g., "pago" in green).
- Subtle background for item rows and payment rows.
- Clear summary section at the bottom.
