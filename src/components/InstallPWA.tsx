import { useEffect, useState } from 'react';
import { Download, Share, X, Smartphone, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { setupPWA } from '@/lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'amstore-install-dismissed';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    void setupPWA();

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) return;

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const mobile = ios || /android|mobile|iemobile|opera mini/i.test(ua) || window.innerWidth < 768;

    setIsIOS(ios);
    setIsMobile(mobile);

    const wasDismissed = window.localStorage.getItem(DISMISSED_KEY) === 'true';

    // Em celular, sempre orienta a instalação como aplicativo
    if (mobile && !wasDismissed) {
      setShowInstallModal(true);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!wasDismissed) setShowInstallModal(true);
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
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary to-primary/20" />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar aviso de instalação"
              onClick={dismiss}
              className="absolute right-1.5 top-1.5 size-8 text-muted-foreground"
            >
              <X className="size-4" />
            </Button>

            <div className="flex items-start gap-4">
              <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                {isMobile ? (
                  <Smartphone className="size-6 text-primary" />
                ) : (
                  <Download className="size-6 text-primary" />
                )}
              </div>

              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-foreground">Instalar Aplicativo</h3>

                {isIOS ? (
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    Detectamos que você está no celular. Toque em <Share className="mx-1 inline size-4" />
                    <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong> para usar o
                    AmStore como aplicativo.
                  </p>
                ) : deferredPrompt ? (
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    {isMobile
                      ? 'Detectamos acesso pelo celular. Instale o AmStore para usar em tela cheia, como um aplicativo nativo.'
                      : 'Instale o AmStore para abrir direto da sua área de trabalho.'}
                  </p>
                ) : (
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    Detectamos acesso pelo celular. Toque em <MoreVertical className="mx-1 inline size-4" />
                    <strong>Menu do navegador</strong> e escolha <strong>Instalar aplicativo</strong> (ou
                    <strong> Adicionar à tela inicial</strong>).
                  </p>
                )}

                <div className="flex gap-2">
                  {deferredPrompt && !isIOS ? (
                    <Button
                      onClick={handleInstallClick}
                      className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Download className="mr-2 size-4" /> Instalar agora
                    </Button>
                  ) : (
                    <Button
                      onClick={dismiss}
                      className="w-full bg-primary/10 font-semibold text-primary hover:bg-primary/20"
                    >
                      Entendi
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
