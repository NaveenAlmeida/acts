/* MEDIA CHURCH — service worker mínimo.
   Durante o desenvolvimento ativo, NÃO cacheamos HTML/CSS/JS: o app sempre
   busca do servidor (evita PWA travado em versão antiga no iPhone).
   Mantém apenas instalabilidade (PWA) + limpeza de caches antigos. */
const CACHE = "acts-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sem interceptar fetch: o navegador vai direto à rede (assets do Next são
// versionados por hash, então já ficam frescos automaticamente).
