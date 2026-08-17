# Plan: Fix Client Total Spent Display

The user reported a bug where the "Total Comprado" (Total Bought) field in the client cards is appearing as "R$ 0,00" even when the client has sales associated with them. Investigation confirms that the `sales` table contains the correct data, but the `clients` table does not have a native field for this total, and the current frontend code is looking for `client.total_spent` which is undefined.

## User Review Required

> [!NOTE]
> I will be calculating the total spent for each client by fetching the sum of their sales directly. This ensures the data is always accurate even if sales are added or deleted.

## Technical Details

### 1. Fetch Sales Totals per Client
Modify the `ClientsPage` in `src/routes/_authenticated.clients.tsx` to fetch the total amount spent for each client using a Supabase query that aggregates the `total_amount` from the `sales` table, grouped by `client_id`.

### 2. Map Data to Client Objects
Update the `useMemo` block in the `ClientsPage` to merge these calculated totals into the client objects. This will populate the `total_spent` property that the `ClientCard` component expects.

### 3. Update Component Mapping
Ensure the `ClientCard` in `src/components/clients/ClientCard.tsx` uses the correctly mapped property. (It already uses `client.total_spent`, but it will now receive a real value).

## Steps

1.  **Read** current implementation in `src/routes/_authenticated.clients.tsx`.
2.  **Add** a new `useQuery` to fetch sales totals per client.
3.  **Update** the `useMemo` that processes clients to include `total_spent`.
4.  **Verify** the changes in the preview.
