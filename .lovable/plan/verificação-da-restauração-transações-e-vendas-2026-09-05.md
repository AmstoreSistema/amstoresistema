# Verificação da Restauração: Transações e Vendas

Após você restaurar os dois arquivos (Transações e Vendas) pela tela Configurações > Backup, verificarei se as contagens gravadas no banco batem com as contagens declaradas em cada arquivo.

## O que será feito

1. Identificar os arquivos de backup enviados (transações e vendas).
2. Ler a seção `meta.contagens_por_entidade` de cada arquivo para obter o número esperado de registros por entidade.
3. Consultar as tabelas de destino no banco e contar quantos registros existem.
4. Comparar arquivo × banco e apontar divergências.
5. Informar o resultado de forma clara: OK ou lista de entidades que não bateram.

## Entidades esperadas

- **Transações**: `TransacaoFinanceira` (787) e `CategoriaTransacao` (28) — mas a categoria já vem embutida em cada lançamento.
- **Vendas**: provavelmente `Venda`, `ItemVenda`, `PagamentoVenda`, `ParcelaVenda`, além de `Cliente` e possivelmente `Cashback` relacionado.

## Critério de sucesso

Toda entidade presente no arquivo deve ter no mínimo a mesma quantidade de registros no banco após a restauração. Se alguma contagem não bater, informo qual entidade e a diferença.

Me avise quando terminar a restauração dos dois arquivos que eu faço a verificação.