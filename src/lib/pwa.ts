/**
 * PWA manifest-only: o app é instalável, mas não usa service worker para cache.
 * Esta função apenas remove registros antigos e limpa caches herdados.
 */
export async function setupPWA() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((r) => r.unregister()));
  } catch {
    // best-effort
  }

  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // best-effort
  }
}
