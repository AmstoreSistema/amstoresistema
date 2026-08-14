# Plano de Correção: Logomarca e Nome da Promoção

Este plano aborda a correção da exibição da logomarca (Configurações e Cupom) e garante que o nome da promoção cadastrado seja refletido no cupom fiscal.

## Alterações

### 1. Configurações Gerais (`src/routes/_authenticated.settings.tsx`)
- Ajustar `handleLogoUpload` para garantir que a URL pública seja salva corretamente no bucket e no `app_settings`.
- Corrigir a prévia da imagem para usar o valor mais atualizado de `localSettings`.
- Garantir que `saveSettingsBatch` seja chamado com o formato correto para a chave `store_logo`.

### 2. Cupom Fiscal (`src/components/sales/ReceiptModal.tsx`)
- Atualizar a lógica de busca da logomarca:
  - Tentar buscar `store_logo` das `app_settings`.
  - Se não houver, usar a logomarca padrão do sistema (`logoAsset`).
- Atualizar a exibição do nome da promoção:
  - Buscar `promoConfig.name` para exibir no título do bloco da promoção (ao invés de "PROMOÇÃO AMSTORE" estático).
- Garantir que a imagem da logo tenha `object-fit: contain` e dimensões apropriadas para impressão térmica.

### 3. Backend (`src/lib/settings.functions.ts`)
- Verificar se `upsert` na `app_settings` está funcionando corretamente para strings de URL.

## Verificação
- Fazer um novo upload de logomarca nas Configurações.
- Salvar as configurações.
- Abrir o PDV e gerar uma "Prévia do Recibo".
- Confirmar se a nova logo aparece e se o nome da promoção condiz com o cadastrado.
