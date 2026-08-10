Entendi perfeitamente o seu pedido. Você quer uma réplica funcional do sistema AmStore Gestão, com foco no fluxo de produção e vendas:

1.  **Matérias-Primas**: Cadastro de insumos com controle de custo e unidade.
2.  **Produtos & Ficha Técnica**: Criação de produtos compostos por matérias-primas cadastradas.
3.  **Produção**: Fluxo de "Produzir" -> "Iniciar" -> "Concluir" com baixa automática nos insumos e entrada no estoque do produto acabado.
4.  **Estoque**: Controle centralizado de saldo de matérias-primas e produtos.
5.  **Vendas**: Registro de saídas, escolha de cliente, baixa no estoque e gestão de "Fiado" integrada às transações financeiras.
6.  **Dashboard**: Visão geral baseada no seu sistema atual.

Vou estruturar o banco de dados (Lovable Cloud) e a interface (TanStack Start + Tailwind) para refletir exatamente essa lógica e visual.

### Próximos Passos:
1.  **Modelagem do Banco**: Criar tabelas para `materials`, `products`, `product_materials` (ficha técnica), `production_orders`, `stock_entries`, `sales`, `clients` e `transactions`.
2.  **Interface de Sidebar**: Implementar o menu lateral idêntico ao AmStore.
3.  **Dashboard Inicial**: Implementar os indicadores (Cards) e gráficos de Materiais e Produção.
4.  **Módulos de Cadastro**: Telas de Materiais e Produtos com a lógica de composição.

Posso prosseguir com a criação da estrutura inicial do banco de dados e do layout?
