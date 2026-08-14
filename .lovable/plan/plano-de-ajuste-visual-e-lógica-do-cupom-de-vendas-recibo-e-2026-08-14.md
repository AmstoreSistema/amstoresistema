# Plano de Ajuste Visual e Lógica do Cupom de Vendas (Recibo) e Promoção

O objetivo deste plano é alinhar o layout do cupom de vendas ao padrão solicitado, implementar uma página pública para consulta de prêmios (evitando a necessidade de login para o cliente) e corrigir a lógica de exibição de cashback e códigos promocionais.

## Alterações

### 1. Página Pública de Sorteio
- Criar a rota `src/routes/sorteio.tsx` como uma rota pública (fora do grupo `_authenticated`).
- Esta página receberá o parâmetro `codigo` via query string.
- Implementar a lógica para buscar no banco de dados (via `supabaseAdmin` em uma server function ou rota de API) se o código é premiado ou não.
- Design limpo e atraente para o cliente, exibindo mensagens de parabéns ou incentivo.

### 2. Ajustes no Cupom de Venda (ReceiptModal)
- **Topo do Cupom:** Adicionar bloco "SALDO TOTAL CASHBACK" exibindo o valor gerado na venda atual e a frase "Use na próxima compra!".
- **Área do QR Code:**
    - Atualizar a URL do QR Code para apontar para a nova página pública: `https://[DOMINIO]/sorteio?codigo=[CODIGO]`.
    - Remover a mensagem antecipada de "ganhou/não ganhou".
    - Texto abaixo do QR Code: "Escaneie e veja sua surpresa!".
    - Logo abaixo, exibir o código alfanumérico no formato "Código: QR-...".
- **Sincronia:** Garantir que o código esteja disponível imediatamente, sem mensagens de "GERANDO...".

### 3. Backend e Integração
- Criar a rota de API pública `src/routes/api/public/sorteio-info.ts` (ou similar) para consultar o status do prêmio de forma segura sem exigir login.
- Atualizar a lógica de `createSale` se necessário para garantir que o `promo_qr` seja retornado de forma consistente.

## Detalhes Técnicos

- **Tecnologia:** React 19, TanStack Start v1, Tailwind CSS v4.
- **Roteamento:** TanStack Router (rotas públicas vs privadas).
- **QR Code:** Biblioteca `qrcodejs` já integrada no projeto.
- **Segurança:** A consulta pública será limitada a informações básicas da promoção vinculadas ao código único, sem expor dados sensíveis do cliente.

---
*Prioridade: Corrigir a experiência do cliente final (acesso público ao sorteio) e a fidelidade visual do cupom.*
