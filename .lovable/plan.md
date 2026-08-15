# Plan - Modernize Transaction Details to Match Reference

The user wants the transaction details modal to perfectly match the provided reference image (Image 97). This includes a specific layout for sale details, product lists, totals, and transaction metadata.

## User Review Required

> [!IMPORTANT]
> The current modal is already functional but follows a slightly different visual structure. I will refactor it to use the card-based layout seen in the image, ensuring all fields (Client, Sale Code, Date, Payment Method, Account, Category) are in their exact positions.

## Proposed Changes

### Financial Logic
- No changes needed to the backend logic; all required data is already fetched.

### UI Enhancements
- **Refactor `src/components/finance/TransactionDetailsModal.tsx`**:
    - Add the "V[Code]" header style.
    - Implement the "Pago" and "Receita" badges at the top left.
    - Create the large value card with the green/red highlight.
    - Implement the "Detalhes da Venda" card with:
        - Two-column grid for Client and Sale Code.
        - Two-column grid for Sale Date and Payment Method.
        - Product list table with specific headers and row styling.
        - Large "Total da Venda" footer.
    - Add the bottom summary grid:
        - Client (with icon).
        - Category (with icon).
        - Account (with icon).
        - Transaction Date (with icon).
    - Match the "Fechar" button style (full width, black).

## Technical Details

### Components
- `TransactionDetailsModal.tsx`: Main target for refactoring. I will use Tailwind classes to match the light blue/gray background containers and the specific typography shown in the image.

### Data Mapping
- The `transaction` object will map to the "Transação" section.
- The `sale` and `items` objects (fetched via `getSaleDetails`) will populate the "Detalhes da Venda" section.
