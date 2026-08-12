---
title: Fix AddProductDirectModal Image Upload and Stock Display
description: Implement image upload support in the "Adicionar Produto Direto" modal and fix the stock quantity display/saving issue to match the reference system.
---

## Technical Details

### 1. Database Updates
- Ensure `products` and `stock_products` tables are correctly synchronized.
- Verify `stock_products.numeracoes` JSON field storage and retrieval.

### 2. Frontend Components
- **`src/components/stock/AddProductDirectModal.tsx`**:
    - Add `image_url` to `formData`.
    - Implement an image upload field using a standard pattern (e.g., similar to `Materials` page).
    - Fix the `handleSave` logic to ensure the `products.current_stock` is updated along with `stock_products.quantidade_disponivel`.
    - Ensure the size grid (33-40) correctly maps to the `numeracoes` JSON field.
- **`src/routes/_authenticated.stock.tsx`**:
    - Update the product card to display detailed information as seen in the reference image:
        - Entry date, Batch (Lote), Category, Color.
        - Grid of available sizes (numerations).
        - Detailed unit prices (Cost, Retail, Wholesale).
        - "Available for sale" status badge.

### 3. Business Logic
- The "Sandália" category requires a size grid where quantities are entered per size.
- The total quantity must be calculated and saved to both `products.current_stock` (for the overall product list) and `stock_products.quantidade_disponivel` (for inventory records).
- Image upload should handle standard formats and store URLs in the `image_url` column of the `products` table.

## User Review Required

> [!IMPORTANT]
> The reference image shows specific fields like "Localização: Loja". I will ensure these are present in both the modal and the card display.

- **Image Upload**: Does the user prefer a specific cloud storage bucket, or should I use the default public bucket for product images? (Defaulting to `product-images` if available, or standard `materials` pattern).
- **Size Grid**: The reference shows specific sizes (36, 37, 38, 39). The current implementation has 33-40. I will keep 33-40 but only show sizes that have stock > 0 on the card.
