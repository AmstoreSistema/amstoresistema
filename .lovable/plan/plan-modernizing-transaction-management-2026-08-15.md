# Plan - Modernizing Transaction Management

Update the transactions interface to match the reference images (Noir & Gold aesthetic) and enhance functionality with detailed views, editing, and unified logic.

## UI Updates
- **Transactions Page (`src/routes/_authenticated.transactions.tsx`):**
    - Redesign header and stat cards to follow the "Noir & Gold" reference.
    - Implement a grouped list by date with blue headers showing daily summary (Revenue, Expense, Daily Balance) as seen in image 92.
    - Transaction items: include icons for type (Up/Down), status badges, description, client/category info, and action buttons (eye, pencil, trash).
    - Add multi-filter bar (Date range, Search, Status filter chips).
- **Transaction Details Modal:**
    - Create a detailed view (Image 93) showing transaction value prominently at the top.
    - Include sub-sections: "Detalhes da Venda" (if linked), "Produtos Vendidos" list, "Conta", "Categoria", and "Data".
- **Upsert Transaction Modal (Image 94/95):**
    - Create a unified modal for creating and editing transactions.
    - Fields: Type (Receita/Despesa), Category (with add button), Description, Value, Account, Transaction Date, Due Date, Status (Pago/Pendente), Payment Protection (Forma de Proteção), and Observations.
    - Show dynamic "Impacto na conta" indicator.

## Technical Details
- **Data Fetching:**
    - Use `useRows` from `src/lib/data.ts` for listing transactions.
    - Join `financial_accounts` to show account names.
    - Handle linking to sales for detailed "Receita" information.
- **Server Functions (`src/lib/finance.functions.ts`):**
    - Add/update `updateTransaction` to allow editing existing records.
    - Ensure atomic updates to status and values.
- **State Management:**
    - Use URL-synced state for filters where applicable.
    - Manage modal state for Detail, Edit, and New transaction views.
