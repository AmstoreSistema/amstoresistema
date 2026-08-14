# Plano de Implementação: Gerador de Etiquetas Profissional

O objetivo é aprimorar o módulo de etiquetas para permitir a seleção de produtos por tamanho (numeração), suporte a código de barras e QR Code, e uma interface de visualização mais próxima das referências enviadas.

## Mudanças do Usuário
- Seleção de produtos com filtros e pesquisa.
- Escolha de numerações específicas de um produto para imprimir.
- Opção de alternar entre Código de Barras e QR Code.
- Interface de grade 3xN com visualização realista das etiquetas.
- Botões de ação como "Limpar", "Salvar e Imprimir" e "Nova Etiqueta".
- Estatísticas de etiquetas na folha (0/30), total gerado e não impressas.

## Detalhes Técnicos
- **Database**: Atualizar `generateLabelGrid` para aceitar numerações.
- **Frontend**:
    - Novo modal de "Adicionar Etiquetas à Folha" com fluxo de: Buscar Produto -> Ver Detalhes/Tamanhos -> Adicionar Quantidades por Numeração.
    - Suporte a `qrcode.react` para geração de QR Codes no preview.
    - Implementação de réguas e marcadores visuais no container da folha.
    - Layout de impressão A4 Pimaco (3 colunas, 10 linhas).

## Etapas
1. **Modelagem**: Garantir que a tabela `etiqueta_gerada` suporte os campos necessários para QR Code e variações.
2. **Componentes**: Criar o novo modal de busca e seleção por numeração.
3. **Página de Etiquetas**: Refatorar o layout para incluir os cards de estatísticas e a régua de margens.
4. **Lógica de Impressão**: Ajustar o CSS `@media print` para precisão milimétrica.
