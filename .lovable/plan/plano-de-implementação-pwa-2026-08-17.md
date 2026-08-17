# Plano de Implementação PWA

Implementação de Progressive Web App (PWA) para permitir instalação nativa em desktop e dispositivos móveis (Android/iOS).

## Alterações

### Configuração
- Configurar `vite-plugin-pwa` no `vite.config.ts` com manifesto completo e estratégia de cache Workbox.
- Garantir que ícones de 192x192 e 512x512 estejam presentes na pasta `public`.
- Remover o Service Worker manual (`sw.js`) para evitar conflitos com o gerado pelo plugin.

### Interface (UI)
- Ajustar o componente `InstallPWA` para focar na captura do evento `beforeinstallprompt` e suporte a iOS (Safari).
- Integrar o banner de instalação no layout raiz (`__root.tsx`).

### Metadados
- Validar as tags `<meta>` e `<link>` no `__root.tsx` para garantir compatibilidade com dispositivos Apple e Android.

## Detalhes Técnicos
- **Plugin**: `vite-plugin-pwa` para automação de manifesto e service worker.
- **Service Worker**: Configurado com `autoUpdate` e `navigateFallback` para suporte offline básico.
- **Instalação**: Suporte nativo para navegadores que suportam `beforeinstallprompt` e guia visual para iOS.
