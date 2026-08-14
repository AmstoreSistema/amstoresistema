# Plano de Estabilização e Auditoria de Vendas

Este plano visa corrigir os erros críticos no fluxo de finalização de vendas, garantir a integridade dos dados no banco e adicionar proteções para evitar que o aplicativo pare de funcionar (quebre) durante o uso.

## Auditoria de Banco de Dados e Sincronização
- Garantir que as tabelas `sales` e `sale_items` tenham todas as colunas necessárias (`discount_amount`, `numeracao`, etc.).
- Verificar se os tipos de dados são compatíveis com o frontend (numeric para valores, text para numeração).
- Validar se as chaves estrangeiras e relacionamentos estão corretos.

## Proteção e Robustez do Frontend
- **POSModal**: Adicionar blocos `try/catch` e verificações de nulidade antes de acessar propriedades de objetos.
- **ReceiptModal**: Garantir que o componente não falhe se os dados da venda ou itens estiverem incompletos.
- **Transições**: Tratar erros de redirecionamento ou carregamento após a venda, garantindo que o usuário veja uma mensagem clara em vez de uma tela em branco.

## Detalhes Técnicos
- Migração SQL para garantir colunas:
  - `sales`: `discount_amount` (já presente), `financial_account_id` (uuid).
  - `sale_items`: `numeracao` (text, já presente), `discount` (numeric).
- Refatoração de `POSModal.tsx`:
  - Envolver `createSale` em um `try/catch` mais detalhado.
  - Verificar se `finalTotal` é um número válido antes de enviar.
  - Usar optional chaining (`?.`) ao renderizar o recibo.
- Refatoração de `ReceiptModal.tsx`:
  - Adicionar proteções para `sale.items`, `sale.installments` e `client`.
  - Garantir que o QR Code não quebre a página se a biblioteca falhar ao carregar.
- Atualização da RPC `create_complete_sale`:
  - Sincronizar todos os campos novos (`discount_amount`, `numeracao`).

Este plano será executado de forma atômica para garantir que o sistema volte a ficar funcional imediatamente.