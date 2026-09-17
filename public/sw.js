const CACHE_NAME = "amstore-pwa-v2";
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/manifest.webmanifest",
  "/app-icon-192.png",
  "/app-icon-512.png",
  "/app-icon-192-maskable.png",
  "/app-icon-512-maskable.png",
  "/bagshoes-logo-white.png",
  "/bagshoes-logo.png",
  "/splash-startup.png",
  "/favicon.png"
];

// Instalação do Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("Pre-cache best effort warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de versões antigas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de busca de rede primeiro com fallback para cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Ignora requisições de API e Supabase para não cachear dados dinâmicos
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api") || url.pathname.includes("supabase")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Suporte a Push Notifications nativas em tempo real
self.addEventListener("push", (event) => {
  let data = {
    title: "Amstore Bagshoes",
    body: "Você tem uma nova atualização no sistema.",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    url: "/dashboard"
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/app-icon-192.png",
    badge: data.badge || "/app-icon-192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard",
      dateOfArrival: Date.now()
    },
    actions: [
      { action: "open", title: "Abrir App" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique na notificação abre ou foca no app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
