# Reestruturação do Cupom Fiscal

O objetivo é atualizar o componente de recibo de venda para replicar o layout e as informações contidas na imagem de referência, garantindo que todos os dados (empresa, itens, totais, pagamentos, cashback e promoção) estejam formatados corretamente para impressão térmica de 80mm.

## Alterações Visuais e Funcionais

- **Cabeçalho**:
  - Exibir o logo da Amstore (usando o asset existente).
  - Incluir nome "AMSTORE BAGSHOES".
  - Endereço: "Rua Medeiros Neto, 12-A - Centro, Jequié - Ba".
  - Telefone: "73 999269136" (ou o valor configurado se disponível).
- **Informações do Pedido**:
  - Organizar campos: Pedido, Data (com hora), Cliente e Vendedor.
- **Seção de Itens**:
  - Listar: `Quantidade x Nome do Produto (Numeração)`.
  - Exibir preço unitário em parênteses e total do item à direita.
  - Adicionar resumo de Subtotal, Desconto e TOTAL final.
  - Adicionar indicador "Qtdad: X itens".
- **Seção de Pagamento**:
  - Bloco "PAGAMENTOS REALIZADOS" detalhando a forma de pagamento e valor.
- **Bloco de Cashback**:
  - Exibição do "CASHBACK DISPONÍVEL" (valor gerado na venda).
  - Quadro amarelo destacado para "SALDO TOTAL CASHBACK" com a frase "Use na próxima compra!".
- **Rodapé e Promoção**:
  - Mensagem "Obrigado! Volte sempre!".
  - Caixa pontilhada roxa/rosa contendo:
    - Título "PROMOÇÃO AMSTORE" com ícone de presente.
    - QR Code funcional.
    - Texto "Escaneie e veja sua surpresa!".
    - Código alfanumérico único.
  - Link final: `www.amstorebagshoes.com.br`.

## Detalhes Técnicos

- **Componente**: `src/components/sales/ReceiptModal.tsx`
- **Estilização**:
  - Utilização da fonte `Courier New` para aparência de ECF.
  - Implementação de classes Tailwind para bordas tracejadas (dashed) e cores específicas (amarelo para cashback, roxo/rosa para promoção).
  - Ajuste nas margens e paddings para melhor legibilidade no papel térmico.
- **Dados**:
  - Mapeamento correto das propriedades do objeto `sale` e `client`.
  - Utilização de configurações globais (`app_settings`) para endereço e telefone, com fallbacks estáticos conforme solicitado.
- **Limpeza**:
  - Remoção de textos de instrução ou debug no `src/routes/index.tsx` (se houver).
