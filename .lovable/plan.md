# Plano de Implementação: Melhoria nas Configurações

O objetivo é substituir o salvamento automático das configurações por um botão de salvamento explícito e adicionar uma função de salvamento em lote no backend para garantir robustez e evitar erros de sincronização.

## Alterações Técnicas

### Backend (Server Functions)
- Criar a função `updateAppSettingsBatch` em `src/lib/settings.functions.ts`.
- Esta função receberá um array de pares chave-valor e realizará o `upsert` em massa no banco de dados.

### Frontend (Página de Configurações)
- Modificar `src/routes/_authenticated.settings.tsx` para gerenciar o estado local das configurações separadamente do estado vindo do banco.
- Remover chamadas de `handleSaveSetting` nos eventos `onBlur` e `onValueChange`.
- Adicionar botões "Salvar Configurações" nas abas relevantes (Geral, Alertas, Avançado).
- Implementar a lógica de salvar todas as alterações pendentes de uma vez ao clicar no botão.
- Adicionar um estado de "saving" para fornecer feedback visual durante o processo.

## Detalhes de Implementação

### 1. Novo RPC de Lote
Implementar `updateAppSettingsBatch` que itera sobre o array de inputs e persiste no Supabase.

### 2. Refatoração do Estado da UI
- Usar um objeto de estado local para armazenar as edições temporárias.
- Sincronizar esse objeto quando os dados forem carregados inicialmente.
- Criar um componente de botão flutuante ou fixo no rodapé de cada card de configuração.

### 3. Remoção do Auto-save
Limpar as propriedades `onBlur` e similares que disparavam salvamento imediato, substituindo-as por atualizações no estado local.
