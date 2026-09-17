import { useEffect, useState } from 'react';
import { Download, Share, X, Smartphone, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { setupPWA } from '@/lib/pwa';
import { useBranding } from '@/contexts/BrandingContext';

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
  const { pwaIcon } = useBranding();

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

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "granted";
  });

  const handleEnableNotifications = async () => {
    const { requestNotificationPermission, sendLocalNotification } = await import('@/lib/pwa');
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      await sendLocalNotification({
        title: "Amstore Bagshoes",
        body: "Notificações em tempo real ativadas com sucesso!",
        icon: "/app-icon-192.png",
      });
    }
  };

  return (
    <AnimatePresence>
      {showInstallModal && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-x-3 bottom-3 z-[100] sm:left-auto sm:right-4 sm:w-[420px]"
        >
          <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-card/95 backdrop-blur-xl p-5 shadow-2xl">
            <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-gold via-amber-300 to-gold" />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar aviso"
              onClick={dismiss}
              className="absolute right-2 top-2 size-8 text-muted-foreground hover:text-foreground rounded-full"
            >
              <X className="size-4" />
            </Button>

            <div className="flex items-start gap-4">
              <div className="size-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-gold/40 bg-black/40 shadow-lg shadow-gold/10 p-0.5">
                <img 
                  src={pwaIcon || "/app-icon-192.png"} 
                  alt="Amstore Bagshoes" 
                  className="size-full rounded-[14px] object-cover" 
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gold">App Oficial</span>
                </div>
                <h3 className="text-base font-black text-foreground tracking-tight">Amstore Bagshoes</h3>

                {isIOS ? (
                  <p className="mt-1 mb-3 text-xs leading-relaxed text-muted-foreground">
                    Instale como aplicativo nativo: toque em <Share className="mx-1 inline size-3.5 text-gold" />
                    <strong>Compartilhar</strong> e escolha <strong>Adicionar à Tela de Início</strong>.
                  </p>
                ) : deferredPrompt ? (
                  <p className="mt-1 mb-3 text-xs leading-relaxed text-muted-foreground">
                    {isMobile
                      ? 'Instale o app nativo no seu celular para acesso rápido em tela cheia e notificações instantâneas.'
                      : 'Instale o aplicativo na sua área de trabalho para acesso instantâneo.'}
                  </p>
                ) : (
                  <p className="mt-1 mb-3 text-xs leading-relaxed text-muted-foreground">
                    Toque no menu <MoreVertical className="mx-1 inline size-3.5 text-gold" /> do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {deferredPrompt && !isIOS && (
                    <Button
                      onClick={handleInstallClick}
                      className="w-full h-10 bg-gold hover:bg-gold/90 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md gap-2"
                    >
                      <Download className="size-4" /> Instalar Aplicativo
                    </Button>
                  )}

                  {notifPermission === "default" && (
                    <Button
                      variant="outline"
                      onClick={handleEnableNotifications}
                      className="w-full h-9 border-gold/30 text-gold hover:bg-gold/10 font-bold text-xs rounded-xl"
                    >
                      🔔 Ativar Notificações em Tempo Real
                    </Button>
                  )}

                  {(!deferredPrompt || isIOS) && (
                    <Button
                      onClick={dismiss}
                      className="w-full h-9 bg-gold/15 text-gold hover:bg-gold/25 font-black text-xs rounded-xl"
                    >
                      Entendido
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
