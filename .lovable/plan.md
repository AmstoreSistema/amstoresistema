# Plano de Melhoria do Módulo de Vendas (PDV)

Conforme solicitado e com base nas imagens de referência, implementaremos melhorias no PDV para torná-lo fiel ao sistema original, corrigindo a exibição de produtos e adicionando campos essenciais no modal de nova venda.

## Mudanças Propostas

### 1. Correção de Estoque no PDV
- **Componente:** `src/components/sales/ProductSearch.tsx`
- **Ação:** Remover o filtro restritivo que impedia a exibição de produtos (o filtro estava buscando `quantidade_disponivel = 0` em vez de maior que zero).
- **Resultado:** Os produtos disponíveis em estoque voltarão a aparecer na busca do PDV.

### 2. Expansão do Modal "Nova Venda" (High-Fidelity)
- **Componente:** `src/components/sales/POSModal.tsx`
- **Novos Campos:**
    - **Código da Venda:** Exibição do código gerado automaticamente (ex: V120826103411).
    - **Tipo de Venda:** Seleção entre "Varejo" e "Atacado" (ou outras categorias do sistema).
    - **Vendedor:** Identificação automática ou manual do vendedor.
    - **Forma de Proteção:** Campo para selecionar proteção de preço ou garantia.
    - **Conta para Recebimento:** Seleção da conta financeira (Caixa, Banco) vinculada ao recebimento imediato.
    - **Observações:** Área de texto para notas adicionais sobre a venda.
- **Layout:** Reorganização para aproximar o design atual do fluxo visto na imagem `image-33.png`.

### 3. Sincronização de Dados
- **Ação:** Garantir que o campo "Conta para Recebimento" selecione contas reais da tabela `financial_accounts`.
- **Ação:** Integrar os novos campos ao `createServerFn` de criação de venda para registro histórico.

### 4. Melhorias no Comprovante
- **Componente:** `src/components/sales/ReceiptModal.tsx`
- **Ação:** Incluir as observações e o código completo da venda no comprovante gerado.

## Detalhes Técnicos

- **Frontend:** Atualização dos estados locais no `POSModal` para gerenciar os novos inputs.
- **Backend (RPC):** O `create_complete_sale` já suporta `p_notes`. Adicionaremos lógica para vincular a conta financeira correta na transação gerada pela venda.
- **Segurança:** Manter RLS e validações Zod em todas as entradas.
