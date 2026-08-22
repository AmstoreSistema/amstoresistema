# Plano de Padronização de Relatórios

Padronizar a visualização e impressão dos relatórios da loja com um layout profissional, incluindo logomarca, informações da empresa, títulos destacados e tabelas organizadas (estilo planilha).

## Alterações

### Componentes e Estilos
- Criar `src/components/report-layout.tsx` para encapsular a estrutura do topo (Logo, Info, Título, Período).
- Adicionar estilos globais de impressão em `src/styles.css` para esconder elementos desnecessários (sidebar, filtros) e formatar a página (zebrado suave, cabeçalhos destacados).

### Módulo de Relatórios
- Atualizar `src/routes/_authenticated.store-reports.tsx`:
  - Integrar o novo `ReportLayout` na visualização gerada.
  - Substituir a tabela HTML básica pela estrutura do `ReportLayout` que utiliza componentes de `Table` do shadcn.
  - Ajustar o comando de impressão para focar apenas na área do relatório.
  - Adicionar suporte para exibir informações da loja (Nome, CNPJ) recuperadas das configurações do sistema.

### Configurações
- Garantir que `store_logo`, `store_name` e `store_cnpj` estejam acessíveis via `app_settings` para popular o cabeçalho do relatório.

## Detalhes Técnicos
- Uso de `@media print` para forçar fundo branco, remover margens do navegador e ajustar o layout para A4/Carta.
- Implementação de linhas zebradas via utilitários Tailwind (`even:bg-muted/30`).
- Centralização da logomarca no topo com redimensionamento automático.
- Formatação de datas e valores consistente com o restante do sistema.
