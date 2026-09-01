// Kill-switch: desregistra qualquer service worker antigo e limpa caches.
// O app é PWA "manifest-only" (instalável, sem cache offline).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clientList = await self.clients.matchAll({ type: "window" });
      clientList.forEach((client) => client.navigate(client.url));
    })(),
  );
});
