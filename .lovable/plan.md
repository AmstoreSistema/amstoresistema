# Plano de Implementação: Automação de Produção e Baixa de Estoque

Este plano detalha a implementação da lógica para processar ordens de produção, garantindo que a conclusão de uma ordem atualize automaticamente o estoque de matérias-primas (incluindo variações e cortes) e adicione o produto acabado ao estoque.

## Objetivos
- Automatizar a baixa de materiais (couro, ferragens, forro, etc.) ao concluir uma produção.
- Garantir que cortes reservados sejam marcados como utilizados.
- Atualizar o estoque do produto final.
- Manter integridade nos cálculos de estoque.

## Etapas Técnicas

### 1. Lógica do Servidor (Concluído)
- Criada a função de servidor `processProductionCompletion` em `src/lib/production.functions.ts`.
- A função realiza as seguintes operações em transação lógica:
    - Recupera a composição (BOM) do produto vinculado à ordem.
    - Para cada item da composição:
        - Se for um **Corte**: Altera o status para `utilizado`.
        - Se for uma **Variação**: Subtrai a quantidade necessária do estoque da variação.
        - Se for um **Material Comum**: Subtrai a quantidade do estoque principal do material.
    - Atualiza o estoque atual do **Produto** somando a quantidade produzida.
    - Marca a ordem de produção como `completed` com data de finalização.

### 2. Integração com a Interface de Produção (Concluído)
- Modificado `src/routes/_authenticated.production.tsx` para importar a nova função de servidor.
- Atualizada a função `updateStatus`:
    - Quando o status é alterado para "Concluído", a função de servidor é chamada.
    - Adicionado feedback visual via `toast.loading` e `toast.success/error`.
    - Invalidação automática do cache do React Query para atualizar a UI instantaneamente.

### 3. Validação e Segurança
- A função de servidor valida se a ordem já foi concluída para evitar execuções duplicadas.
- Utiliza o cliente Supabase para garantir persistência correta no banco de dados.

## Próximos Passos
- O usuário deve testar o fluxo completo: Criar Ordem -> Iniciar -> Concluir e verificar os estoques em "Materiais" e "Estoque".
- Implementar lógica similar para a página de **Vendas** (baixa de estoque de produto acabado) em uma etapa futura se necessário.
