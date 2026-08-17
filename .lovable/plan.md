---
name: Suppliers Page Implementation
description: Implementation of the Suppliers module with CRUD, statistics, and UI matching the reference.
type: feature
---

# Suppliers Feature

Implement the complete "Suppliers" module, including database schema updates, UI components, and the main page.

## 1. Database Schema

Execute a migration to enhance the `suppliers` table with required fields:

```sql
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('Pessoa Jurídica', 'Pessoa Física')),
ADD COLUMN IF NOT EXISTS document TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS phone_secondary TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS delivery_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Ensure RLS and Grants
GRANT ALL ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
```

## 2. Components to Create

- `src/components/suppliers/SupplierCard.tsx`: Display supplier details and action buttons.
- `src/components/suppliers/SupplierFormModal.tsx`: Unified modal for Create/Edit.
- `src/components/suppliers/SupplierPurchasesModal.tsx`: Visual history of purchases for a specific supplier.

## 3. Main Page

- `src/routes/_authenticated.purchase-board.tsx`: The main page for "Fornecedores" (mapped to the sidebar URL).
  - Stats Cards: Total, Active, Total Purchases (sum from `purchases` table).
  - Filters: Search input, Category pills, Status toggle.
  - Responsive Grid of `SupplierCard`.

## 4. Sidebar Update

Ensure the sidebar link for "Fornecedores" points to the correct route.
