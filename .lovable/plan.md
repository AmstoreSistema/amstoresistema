# Plan: Integrate Material Purchases with Inventory and Finance

Updating the "Registrar Compra" modal to use registered suppliers, automatically update material stocks, and generate financial transactions.

## User Review Required

> [!IMPORTANT]
> - Ensure the `financial_accounts` table has at least one account marked as `active` for automatic expense launching.
> - The purchase items will be logged in the audit trail since there is no `purchase_items` table in the current schema.

## Proposed Changes

### Database & Backend
- No schema changes required as the existing `materials`, `purchases`, `suppliers`, and `transactions` tables are sufficient.
- The logic will be implemented primarily in the frontend component `PurchasesPage` to handle the atomic updates (insert purchase, update material stocks, create transaction).

### Components & UI
#### `src/routes/_authenticated.purchases.tsx`
- **Supplier Selection**: Replace the text input for "Fornecedor" with a `Select` component populated from the `suppliers` table.
- **Stock Integration**: In the `finalize` function, iterate through purchased items and increment the `current_stock` in the `materials` table.
- **Financial Integration**: In the `finalize` function, create a new record in the `transactions` table with:
    - `type`: "saida"
    - `amount`: Negative total value
    - `status`: "pago"
    - `category`: "Compra de Materiais"
    - `account_id`: The ID of the currently active financial account.
    - `description`: Detailed string including the supplier name and purchased items summary.
- **Visual Polish**: Ensure the transaction description follows the "Noir and Gold" styling (negative values in red).

## Technical Details
- Use `useRows("suppliers")` to fetch the list of suppliers.
- Use `useRows("financial_accounts")` to identify the active account for the transaction.
- Wrap the purchase finalization in a single try/catch block with descriptive error handling.
- Use `supabase.from("transactions").insert(...)` to launch the expense.

## Verification Plan
1. **Manual Test**: Register a new purchase in the UI.
2. **Check Materials**: Verify that the `current_stock` of the selected materials increased by the purchased amount.
3. **Check Transactions**: Verify a new transaction appears with a negative value, red text (if "saida"), and the correct description.
4. **Check Suppliers**: Ensure the supplier dropdown correctly displays all registered suppliers.
