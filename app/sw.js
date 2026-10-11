/* Service worker de la page du coach (publié à la racine : sw.js).
   - push : affiche les notifications envoyées par collecte/notifier.mjs ;
   - clic : rouvre la page (avec sa clé, mémorisée sur le téléphone) ;
   - hors réseau : la dernière page reçue s'ouvre quand même (données chiffrées,
     la clé reste dans le lien). Réseau d'abord, toujours : jamais une page
     périmée quand le réseau répond. */
const CACHE = "coach-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (r.mode === "navigate" || u.pathname === "/" || u.pathname === "/index.html") {
    e.respondWith(fetch(r).then(rep => {
      if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then(c => c.put("/", copie)); }
      return rep;
    }).catch(() => caches.match("/").then(x => x || Response.error())));
  } else if (u.pathname === "/apple-touch-icon.png") {
    e.respondWith(fetch(r).then(rep => { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(r, copie)); return rep; })
      .catch(() => caches.match(r).then(x => x || Response.error())));
  }
});

/* La page envoie son adresse complète (avec la clé) : c'est elle qu'on rouvre au clic. */
self.addEventListener("message", e => {
  if (e.data && e.data.type === "lien" && typeof e.data.url === "string")
    e.waitUntil(caches.open(CACHE).then(c => c.put("/__lien", new Response(e.data.url))));
});

self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { m = { corps:e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(m.titre || "Coach", {
    body:m.corps || "", tag:m.tag || undefined, icon:"/apple-touch-icon.png", badge:"/apple-touch-icon.png"
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type:"window", includeUncontrolled:true });
    if (fenetres.length) return fenetres[0].focus();
    const lien = await caches.open(CACHE).then(c => c.match("/__lien")).then(x => x ? x.text() : "/");
    return self.clients.openWindow(lien);
  })());
});
