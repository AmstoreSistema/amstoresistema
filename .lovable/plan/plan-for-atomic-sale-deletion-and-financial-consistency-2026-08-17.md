# Plan for Atomic Sale Deletion and Financial Consistency

The current `cancel_complete_sale` SQL function performs most of the required actions but needs refinement to handle cashback reversals (storno) correctly when a sale is deleted. The trigger `release_proportional_cashback` correctly adds cashback on payment, but we need to ensure that deleting the sale also reverses these additions.

## User Review Required

> [!IMPORTANT]
> This will involve a database migration. Deleting a sale will now also:
> 1.  Delete all linked transactions and payments.
> 2.  Reverse account balances affected by those transactions.
> 3.  **Automatically deduct** any proportional cashback that was already released for this sale from the customer's balance.

## Technical Details

### Backend (SQL Migration)
1.  Update `cancel_complete_sale` to explicitly handle cashback reversals:
    -   Sum all released cashback for the sale from `cashback_entries`.
    -   Subtract this total from the client's `cashback_balance`.
    -   Ensure all related records (`transactions`, `sale_payments`, `sale_installments`, `cashback_entries`) are deleted (relying on CASCADE where possible, or explicit deletion).
2.  Update `release_proportional_cashback` trigger logic to be aware of deletions if necessary, though `cancel_complete_sale` will handle the reversal.

### Logic Improvements in `sales.functions.ts`
-   The existing `cancelSale` function already calls the SQL RPC. I will verify if any additional client-side cleanup is needed (like invalidating queries).

### Verification Plan
-   [ ] Create a sale with multiple installments.
-   [ ] Pay some installments and verify account balance and cashback release.
-   [ ] Cancel (delete) the sale.
-   [ ] Verify account balances are reverted.
-   [ ] Verify customer's cashback balance is reverted.
-   [ ] Verify all linked records are gone.
