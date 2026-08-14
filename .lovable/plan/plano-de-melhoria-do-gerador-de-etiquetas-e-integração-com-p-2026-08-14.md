# Plano de Melhoria do Gerador de Etiquetas e Integração com Produção

Este plano detalha as alterações para restringir a seleção de numeração, adicionar configurações de impressão ajustáveis, exportação em PDF e vínculo automático com a produção.

## Alterações de Interface (UI)

- **Restrição de Numeração**: O modal de adicionar etiquetas só mostrará a grade de tamanhos (33-40) se a categoria do produto for "Sandália". Para outros produtos, mostrará apenas um campo de quantidade total.
- **Painel de Configurações de Impressão**: Adição de uma seção no dashboard de etiquetas para configurar margens (superior, esquerda), espaçamento entre colunas/linhas e dimensões da etiqueta (L x A).
- **Exportação em PDF**: Botão "Exportar PDF" que utiliza `html2canvas` e `jspdf` para gerar um arquivo fiel ao layout da tela.
- **Vínculo com Produção**:
    - Na tela de Produção, ao concluir uma ordem, adicionar um passo opcional (ou automático) para gerar as etiquetas correspondentes.
    - As etiquetas geradas via produção serão vinculadas ao `order_id`.

## Alterações Técnicas

### Banco de Dados (Supabase)
- Utilização da tabela `print_settings` (já criada) para persistir as preferências de margem do usuário.
- Utilização das colunas `order_id` e `impressa` na tabela `etiqueta_gerada`.

### Lógica de Servidor (Server Functions)
- **`generateLabelGrid`**: Atualizar para aceitar `order_id` opcional.
- **`savePrintSettings`**: Nova função para salvar as configurações de margem.
- **`getPrintSettings`**: Nova função para recuperar as configurações.

### Componentes Frontend
- **`src/routes/_authenticated.labels.tsx`**:
    - Implementar lógica condicional de categoria no modal.
    - Adicionar modal/seção de "Configuração de Página".
    - Implementar `handleExportPDF` usando as bibliotecas instaladas.
    - Aplicar as margens dinâmicas via variáveis CSS no estilo de impressão.
- **`src/routes/_authenticated.production.tsx`**:
    - Após `processProductionCompletion`, chamar `generateLabelGrid` se o usuário confirmar a geração de etiquetas.

## Detalhes Técnicos (Desenvolvedor)

- **PDF**: O PDF será gerado capturando a `div.print-grid` que já tem as dimensões em `mm`.
- **CSS Print**: As variáveis CSS `--print-margin-top`, `--print-margin-left`, etc., serão injetadas dinamicamente no componente para que o `@media print` as utilize.
- **Filtro de Categoria**: `selectedProduct.category === 'Sandália'` controlará a exibição da grade.
