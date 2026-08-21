# Plano de Correção: Backup e Restauração (Base44)

O objetivo é garantir que todos os dados reconhecíveis sejam restaurados corretamente e evitar duplicidade durante a importação.

## Alterações

### 1. Sistema de Backup (Servidor e Mapeamento)
- **Evitar Duplicidade**: Alterar a lógica de importação para usar `upsert` com base em chaves únicas ou campos identificadores (como `sku`, `name` ou `email`), garantindo que registros existentes sejam atualizados em vez de duplicados.
- **Melhorar Reconhecimento**: Expandir o mapeamento em `src/lib/backup-mapping.ts` para capturar campos adicionais e variações de nomes de colunas comuns em backups externos.
- **Tratamento de Erros**: Refinar o tratamento de exceções durante a importação em lote para garantir que a falha em um registro não interrompa todo o processo.

### 2. Interface de Configurações
- **Barra de Progresso**: Assegurar que a barra de progresso reflita fielmente o estado da restauração.
- **Feedback Visual**: Melhorar as mensagens de sucesso/erro após a conclusão da restauração.

## Detalhes Técnicos
- Modificar `importSystemData` em `src/lib/backup.functions.ts` para implementar a lógica de prevenção de duplicidade.
- Atualizar `mapForeignBackup` e `MAPPERS` em `src/lib/backup-mapping.ts`.
- Ajustar `handleConfirmImport` em `src/routes/_authenticated.settings.tsx`.
