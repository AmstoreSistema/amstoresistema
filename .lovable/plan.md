# Plan for Improving External Backup Restoration

I will improve the "RESTAURAR BACKUP BASE44" functionality by creating an explicit mapping dictionary and ensuring all relevant keys within the `dados` object are correctly mapped to our Supabase tables.

## User Review Required

> [!IMPORTANT]
> This update assumes that the external backup file structure encapsulates data inside a `dados` key, as specified in your request. I will ensure that even empty collections are processed and that all recognized keys are mapped correctly.

## Proposed Changes

### Logic Improvements
- **Explicit Mapping Dictionary**: Update the mapping logic in `src/lib/backup-mapping.ts` to include an explicit "de-para" (from-to) dictionary for all common keys found in external backups (Base44).
- **Flexible Data Extraction**: Refine `extractAllCollections` to ensure it looks for the `dados` key and maps its children even if they are empty arrays, preventing the "Coleções não reconhecidas" block.
- **Table Alias Expansion**: Add more explicit aliases for `materiais`, `produtos`, `composicoes`, `ordens`, `estoque`, `clientes`, `vendas`, `fornecedores`, etc.
- **Empty Array Handling**: Modify the import logic to allow processing of tables even if the array is empty (`Array(0)`).

### Files to be Modified
- `src/lib/backup-mapping.ts`: Update `TABLE_ALIASES` and `extractAllCollections` logic.
- `src/lib/backup.functions.ts`: Ensure `importSystemData` handles empty collections without failing prematurely.

## Technical Details
- **Fuzzy/Explicit Mapping**: Expand the `TABLE_ALIASES` constant to cover all requested keys.
- **Key Normalization**: Ensure slugging and normalization of keys work for all variations (e.g., `composicoes` vs `composicao`).
- **Supabase Table Mapping**:
  - `materiais` -> `materials`
  - `produtos` -> `products`
  - `composicoes` -> `product_materials`
  - `ordens` -> `production_orders`
  - `estoque` -> `stock_products`
  - `clientes` -> `clients`
  - `vendas` -> `sales` / `transactions`
  - `fornecedores` -> `suppliers`
