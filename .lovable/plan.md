# Plano de Implementação: Promoção QR Code

Implementação do sistema completo de promoção via QR Code conforme as telas de referência, integrando com o PDV e garantindo persistência no backend.

## 1. Backend e Lógica
- **Esquema de Dados**: Criar tabelas `qr_promo_config` (configurações) e `qr_promo_history` (logs e premiações).
- **Server Functions**: Implementar `qr-promo.functions.ts` para CRUD de configurações e gerenciamento do contador.
- **Integração PDV**: Modificar a server function `createSale` para:
  - Incrementar o contador global.
  - Verificar se a venda atual é premiada com base nas configurações.
  - Registrar a entrada no histórico.
  - Gerar o código único do QR Promo.

## 2. Interface do Usuário (Noir & Gold)
- **Página de Promoções**: Refatorar `_authenticated.promotions.tsx` para incluir a nova interface tabulada ou criar uma rota específica `/qr-promo`.
- **Tela de Configurações**: Formulário para Nome, Limites, Bônus, Posições Premiadas e Mensagens (Padrão vs Premiado).
- **Painel de Status**: Indicadores visuais do contador atual, premiados gerados e bônus resgatados.
- **Histórico**: Lista detalhada com filtros de status (Premiado, Pendente, Padrão) e opção de exclusão.
- **Visualização de Cupom**: Simulador de impressão fiscal 80mm com QR Code dinâmico.

## 3. Experiência do Cliente
- **Recibo**: Atualizar `ReceiptModal.tsx` para renderizar a seção promocional condicionalmente, exibindo a mensagem correspondente ao resultado (venda premiada ou não).

## Detalhes Técnicos
- Utilização de `supabaseAdmin` em server functions para garantir integridade do contador.
- Validação com Zod para entrada de posições premiadas (string separada por vírgula).
- Sincronização em tempo real via React Query.
