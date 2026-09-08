# Corrigir a restauração dos detalhes de Vendas e Transações

## O que os dados mostram agora

Conferi o banco depois da sua restauração:

- Vendas: 354 gravadas (com código, valor, status e cliente na maioria).
- Itens das vendas: 0
- Pagamentos das vendas: 0
- Parcelas das vendas: 0
- Transações: 788 gravadas, mas **todas** sem cliente vinculado.

Ou seja: a venda entrou, mas o "recheio" dela (produtos, pagamentos e parcelas) não.

## Por que aconteceu

No arquivo do sistema antigo, os produtos, pagamentos e parcelas **não vêm em listas
separadas**: eles vêm embutidos dentro de cada venda (campos `itens_venda`,
`pagamentos_venda`, `parcelas_venda`). O restaurador só olha as listas principais do
arquivo e ignora essas listas de dentro de cada registro — por isso nada foi criado.

Nas transações acontece algo parecido: o nome do cliente vem dentro do campo de
contexto da transação (`contexto_cliente`), que o restaurador não lê, então nenhuma
transação ficou ligada a um cliente.

## O que vou fazer

1. **Ler as listas embutidas em cada venda** e transformá-las em itens, pagamentos e
   parcelas de verdade, sempre ligados à venda correta pelo código da venda.
2. **Ligar cada item ao produto** pelo nome/código. Quando o produto não existir no
   sistema, ele é criado automaticamente (mesma solução que resolveu o Estoque), para o
   item nunca aparecer em branco.
3. **Ligar as parcelas ao pagamento correspondente** da mesma venda, comparando valor e
   data, como o arquivo instrui.
4. **Preencher o cliente e a venda das transações** usando os campos de contexto — sem
   criar cliente ou venda nova a partir deles (apenas vínculo).
5. **Não duplicar nada**: vendas já restauradas são atualizadas pelo código da venda, e
   itens/pagamentos/parcelas já existentes da mesma venda não são recriados.
6. **Corrigir o que já está no banco**: ligo as 788 transações aos clientes e vendas
   correspondentes, quando o nome/código bater.
7. **Relatório no final da restauração** mostrando quantos itens, pagamentos e parcelas
   entraram por venda e o que não conseguiu vínculo.

Depois disso você reenvia os dois arquivos (Vendas e Transações) em Configurações >
Backup — as vendas não serão duplicadas, e os detalhes passam a aparecer.

## Detalhes técnicos

- `src/lib/backup-mapping.ts`: em `extractAllCollections`, extrair coleções filhas de
  dentro dos registros (`itens_venda`, `pagamentos_venda`, `parcelas_venda`,
  `produto_dados`), propagando `codigo_venda`/`id` do pai para cada filho; mapper de
  `transactions` passa a ler `contexto_cliente` (nome/id) e `contexto_venda`
  (codigo_venda) como `__client_name` / `__sale_code`.
- `src/lib/backup.functions.ts`: em `resolveRefs`, aceitar `__sale_code` também em
  `transactions` (preenchendo `sale_id`), criar produtos ausentes para `sale_items`
  (reaproveitando o bloco já usado em `stock_products`) e deduplicar filhos por
  (`sale_id`, número da parcela / valor+data do pagamento / produto+quantidade).
- Remapeamento de `pagamento_id` das parcelas feito após inserir `sale_payments`,
  casando `amount` + `created_at` dentro da mesma venda.
- Backfill único por SQL: `transactions.client_id` via nome do cliente e
  `transactions.sale_id` via `sales.sale_code`.
