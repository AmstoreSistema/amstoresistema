# Plan: Refactor Clientes Page to Card-Based UI with Details Modal

Refactor `src/routes/_authenticated.clients.tsx` from a table-based `CrudPage` to a custom card-based grid layout as requested by the user, including high-fidelity stats cards and a detailed customer profile modal.

## User Requests
- **Client List**: Card-based grid with avatar, name, stats (purchases, cashback), phone, and actions (Details, Edit, Delete).
- **Stats Summary**: High-fidelity cards for Total Clients, PF (Individual), PJ (Legal), and Total Sales.
- **Client Details Modal**: Complete profile view with contact info, financial summary (sales count, total bought, total paid, debt, cashback), and a full transaction history list.
- **Search & Filters**: Search bar and category toggles (All, PF, PJ).

## Proposed Changes

### Database & Schema
- No schema changes required for `clients` table itself.
- Will need to fetch total sales amount and PF/PJ counts for the summary cards.
- Will need a new server function `getClientDetails` to fetch a specific client's transaction/sale history efficiently.

### Components
- Create `src/components/clients/ClientCard.tsx`: Individual client card with the Noir and Gold aesthetic.
- Create `src/components/clients/ClientDetailsModal.tsx`: The full profile modal with transaction history.
- Create `src/components/clients/ClientSummary.tsx`: The top stats cards.

### Routes
- **`src/routes/_authenticated.clients.tsx`**: 
    - Replace `CrudPage` with a custom implementation.
    - Implement search and PF/PJ filtering.
    - Integrate the new components.

## Technical Details

### UI Styling
- Use a white card background with subtle shadows.
- Avatars with primary gradient (`bg-gradient-to-br from-primary to-primary/80`).
- Status badges for sales ("pago", "fiado").
- Grid layout: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`.

### Data Fetching
- Use `useQuery` for client list.
- Calculate summary stats in the component (or via a specific query if database size is large, but for now client-side is fine).
- `getClientDetails` server function will join `sales` and `sale_installments` to show the transaction history correctly.

### Installment Logic
- Ensure "Fiado" status is correctly identified based on the `payment_method` and `sale_installments` status.
