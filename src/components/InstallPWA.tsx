import { useEffect, useState } from 'react';
import { Download, MoreVertical, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'amstore-install-dismissed';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Service worker registration is handled by vite-plugin-pwa in production.
    // We only manage the install prompt here.

    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    const wasDismissed = window.localStorage.getItem(DISMISSED_KEY) === 'true';
    if (ios && !standalone && !wasDismissed) setShowInstallModal(true);

    const handler = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
      if (!standalone && !wasDismissed) {
        setShowInstallModal(true);
      }
    };

    const installed = () => {
      setDeferredPrompt(null);
      setShowInstallModal(false);
      window.localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallModal(false);
    }
  };

  const dismiss = () => {
    setShowInstallModal(false);
    window.localStorage.setItem(DISMISSED_KEY, 'true');
  };

  return (
    <AnimatePresence>
      {showInstallModal && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-x-3 bottom-3 z-[100] sm:left-auto sm:right-4 sm:w-96"
        >
          <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-card p-4 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/20" />
            
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar aviso de instalação"
              onClick={dismiss}
              className="absolute right-1.5 top-1.5 size-8 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </Button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Download className="w-6 h-6 text-primary" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-foreground text-lg mb-1">Instalar Aplicativo</h3>
                {isIOS ? (
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    Toque em <Share className="mx-1 inline size-4" /> <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
                  </p>
                ) : (
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    Instale o AmStore para abrir direto da sua tela inicial. No computador, você também pode usar o ícone de instalação na barra do navegador.
                  </p>
                )}
                
                <div className="flex gap-2">
                   <Button
                    onClick={handleInstallClick}
                     disabled={!deferredPrompt}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  >
                     <Download className="size-4" /> {isIOS ? 'Siga os passos acima' : 'Instalar agora'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
