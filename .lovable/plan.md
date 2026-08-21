# Plano de Finalização dos Relatórios

Este plano detalha as melhorias e funcionalidades necessárias para tornar a Central de Relatórios totalmente funcional, permitindo a exportação de dados, visualização de totais e uma interface profissional.

## Alterações

### Dependências
- Adicionar `xlsx` para exportação de planilhas.
- Adicionar `jspdf-autotable` para geração de tabelas em PDF.

### Funcionalidades
- **Exportação de Dados**: 
  - Botão para exportar em **PDF** com cabeçalho personalizado (incluindo logo da loja).
  - Botão para exportar em **Excel (XLSX)**.
  - Botão de **Impressão** otimizado para papel A4.
- **Resumo Financeiro/Quantitativo**:
  - Adição de cartões de resumo (Ex: Total de Vendas, Quantidade de Itens, Saldo Geral) acima da tabela de resultados.
- **Melhoria na Exibição de Dados**:
  - Implementação de um layout de tabela mais robusto com cabeçalhos claros.
  - Inclusão de campos faltantes nos relatórios (Ex: nome do cliente em Vendas, fornecedor em Compras).
- **Filtros Adicionais**:
  - Possibilidade de filtrar por status (ex: pedidos pendentes vs concluídos).

## Detalhes Técnicos
- Utilizar `window.print()` com CSS `@media print` para garantir que apenas o relatório seja impresso.
- Implementar funções de utilidade para conversão de JSON para Excel e PDF.
- Ajustar os loaders de dados para garantir que as informações relacionadas (joins) sejam carregadas quando necessário.

---

Eu interpretarei "finalize todos os relatórios" como a necessidade de tornar a ferramenta útil para gestão real, saindo de uma visualização simples para um sistema de exportação e análise completo.
