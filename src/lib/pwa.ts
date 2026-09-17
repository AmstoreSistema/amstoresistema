/**
 * Gerenciador de PWA e Notificações Push para Amstore Bagshoes
 */

export async function setupPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[PWA] Service Worker registrado com sucesso:", reg.scope);

    // Auto-update do Service Worker quando houver nova versão
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[PWA] Nova versão disponível do sistema.");
          }
        });
      }
    });
  } catch (err) {
    console.warn("[PWA] Erro ao registrar Service Worker:", err);
  }
}

/**
 * Solicita permissão para notificações nativas
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error("[PWA] Erro ao solicitar permissão de notificação:", err);
    return "denied";
  }
}

/**
 * Retorna status atual da permissão de notificação
 */
export function getNotificationPermissionStatus(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Dispara uma notificação nativa através do Service Worker
 */
export async function sendLocalNotification(params: {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}) {
  if (typeof window === "undefined") return;

  // Se o usuário ainda não respondeu, solicita permissão
  if (Notification.permission === "default") {
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return;
  }

  if (Notification.permission !== "granted") return;

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(params.title, {
          body: params.body,
          icon: params.icon || "/app-icon-192.png",
          badge: "/app-icon-192.png",
          data: { url: params.url || "/dashboard" },
          vibrate: [100, 50, 100],
        } as any);
        return;
      }
    }

    // Fallback caso Service Worker não esteja pronto
    new Notification(params.title, {
      body: params.body,
      icon: params.icon || "/app-icon-192.png",
    });
  } catch (err) {
    console.error("[PWA] Erro ao disparar notificação:", err);
  }
}
