# Plano de Implementação: Gestão de Produção e Estornos de Estoque

Melhoria da interface de produção com ações rápidas no card e implementação da lógica de exclusão (estorno) de ordens de produção para restaurar o estoque de materiais e remover o produto acabado.

## Alterações Propostas

### 1. Backend (Server Functions)
- **Novo helper no `src/lib/production.functions.ts`**: 
  - `deleteProductionOrder`: Função para estornar e excluir uma ordem de produção.
    - Se a ordem estiver "completed" (concluída):
      1. Recupera a composição do produto (BOM).
      2. Devolve as quantidades aos materiais e variações (`current_stock`).
      3. Altera o status dos cortes (`material_cuts`) de "utilizado" para "reservado".
      4. Subtrai a quantidade do estoque do produto acabado (`products`).
    - Exclui o registro da ordem em `production_orders`.

### 2. Frontend (UI de Produção)
- **Arquivo `src/routes/_authenticated.production.tsx`**:
  - Adicionar botões "Iniciar" e "Concluir" diretamente no card (quando aplicável).
  - Adicionar botão de "Excluir" (ícone de lixeira) no card.
  - Exibir diálogo de confirmação antes de excluir, alertando sobre o estorno de estoque.
  - Implementar estados de carregamento e feedback de sucesso/erro.

## Detalhes Técnicos
- Utilização de `createServerFn` para garantir integridade dos dados no servidor.
- Validação de segurança para garantir que apenas ordens existentes sejam processadas.
- Invalidação de queries do TanStack Query para atualização instantânea da UI.
