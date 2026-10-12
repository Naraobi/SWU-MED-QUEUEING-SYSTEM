const CACHE_NAME = 'swumed-app-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        const response = await fetch('/');
        await cache.put('/', response.clone());
        const html = await response.text();
        const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
          .map((match) => match[1])
          .filter((path) => path.startsWith('/') && !path.startsWith('//'));
        const scriptAssets = assets.filter((path) => path.endsWith('.js'));
        const bundledAssets = await Promise.all(scriptAssets.map(async (path) => {
          try {
            const script = await (await fetch(path)).text();
            return [...script.matchAll(/["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]);
          } catch {
            return [];
          }
        }));
        assets.push('/favicon.svg', '/icons.svg', '/sounds/queue-call.mp3', ...bundledAssets.flat());
        await Promise.all(assets.map((path) => cache.add(path).catch(() => {})));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('swumed-app-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put('/', response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')))
    );
    return;
  }

  // Cache built JS/CSS/images as they are loaded while online, so an
  // installed app can reopen after a reload without a network connection.
  event.respondWith(
    caches.match(request).then((cached) => {
      const update = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => cached);
      return cached || update;
    })
  );
});
