# Plano de Restauração do Backup AmStore (formato com meta/ordem_importacao/schema/dados)

O arquivo descrito (com `meta.contagens_por_entidade`, `ordem_importacao`, `schema`, `dados` e os contextos `contexto_venda`/`contexto_cliente`) ainda não chegou aqui — os backups disponíveis são os antigos de setembro. Anexe o arquivo novo e eu executo o plano abaixo sobre ele.

## (a) Mapeamento entidade → tabela de destino

| Entidade no arquivo | Tabela de destino |
| --- | --- |
| Cliente | clients |
| Produto | products |
| EstoqueProduto | stock_products |
| Material | materials |
| CategoriaMaterial | material_categories |
| ComposicaoMaterial | product_materials |
| PecaCouro / MoldeCorte | material_cuts |
| CupomProducao | material_variations |
| OrdemProducao | production_orders |
| Fornecedor | suppliers |
| Compra / ItemCompra | purchases / purchase_items |
| ContaFinanceira | financial_accounts |
| Venda e Venda_Fiado (merge por id) | sales |
| ItemVenda | sale_items |
| PagamentoVenda | sale_payments |
| ParcelaVenda | sale_installments |
| TransacaoFinanceira | transactions |
| Cashback / Promocao | cashback_entries / promotions |
| ConfiguracaoMaterial, CategoriaTransacao | ignoradas (sem tabela equivalente) |

## (b) Campos ignorados

- Metadados do sistema antigo: `created_by`, `created_by_id`, `is_sample`, `_app_id`, `updated_by` e afins.
- `contexto_venda` e `contexto_cliente` em TransacaoFinanceira: usados só para reconciliar venda/itens/pagamentos/parcelas/cliente que não vierem no arquivo; depois descartados.
- Campos do arquivo sem coluna correspondente no destino (ex.: rótulos de categoria de transação, campos de layout/etiqueta antigos).

## (c) Ordem de inserção

Se o arquivo trouxer `ordem_importacao`, ela é seguida literalmente. Caso falte, uso: categorias de material → materiais → cortes/variações → produtos → composições → estoque → fornecedores → compras/itens → clientes → contas financeiras → vendas → itens de venda → pagamentos → parcelas → transações → cashback/promoções.

## Regras de execução

- IDs originais preservados: gravação por `upsert` na chave primária `id`, sem gerar novos IDs, para que `venda_id`, `cliente_id` etc. continuem válidos.
- Merge sem duplicar: exportações filtradas (fiado, pendente/parcial/atrasado) são unidas por `id` com a versão completa, que prevalece.
- Filhos só entram após o pai existir; qualquer registro órfão é relatado, não silenciosamente descartado.
- Relatório final comparando `meta.contagens_por_entidade` com o efetivamente gravado, com divergências e motivos linha a linha.

## Detalhes técnicos

- `src/lib/backup-mapping.ts`: reconhecer o formato `meta/ordem_importacao/schema/dados`, respeitar `ordem_importacao`, adicionar aliases faltantes e preservar `id`.
- `src/lib/backup.functions.ts`: importar na ordem declarada, upsert por `id`, extrair `contexto_venda`/`contexto_cliente` como fonte de reconciliação e devolver o relatório comparativo.
- `src/routes/_authenticated.settings.tsx`: exibir o relatório esperado × importado com destaque para divergências.
