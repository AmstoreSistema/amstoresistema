# Plan - Separation of Product and Material Categories

This plan corrects the category filtering logic across different modules to ensure that **Materials** only show material-specific categories (raw materials) and **Products** only show product-specific categories (finished goods).

## Proposed Changes

### Database & Backend
- No schema changes required as both use existing tables (`material_categories` and `products` table).
- We will ensure that the UI logic correctly distinguishes between them.

### Frontend Components

#### 1. Material Management (`src/routes/_authenticated.materials.tsx`)
- Hardcode or filter the categories list to only include: **Armarinho, Cola, Couro, Embalagens, Estrutura, Ferragem, Forro, Linha, Outro, Papelaria, Tecido**.
- Update both the filter bar and the "New/Edit Material" modal.

#### 2. Product Management (`src/routes/_authenticated.products.tsx`)
- Define a strict list for product categories: **Bolsa, Carteira, Perfume, Sandália**.
- Update the filter bar and the "New/Edit Product" modal.

#### 3. Stock Direct Add (`src/components/stock/AddProductDirectModal.tsx`)
- Synchronize the `CATEGORIES` constant with the product-specific list defined above.

#### 4. Supplier Management (`src/components/suppliers/SupplierFormModal.tsx`)
- Ensure the "Category" field uses the material-specific categories (as suppliers provide raw materials).

## Technical Details
- In `materials.tsx`, I will replace the dynamic fetch from `material_categories` with a static array if it contains mixed values, or add a column to `material_categories` to distinguish types if the user prefers (but the request implies a fixed set for now).
- I will strictly separate the `CATEGORIES` constants in `products.tsx` and `AddProductDirectModal.tsx`.

## Verification Plan
- Open **Materials** page: Check that only raw material categories appear in filters and creation modal.
- Open **Products** page: Check that only finished good categories (Bolsa, Sandália, etc.) appear.
- Open **Stock** (Add Direct): Check categories list.
- Open **Suppliers**: Check that categories align with Materials.
