
// Cache-first service worker for offline support.
// Version bumped to refresh the updated Kannada audio references.

const CACHE = "stud-help-v3";

const SHELL = [
  "./",
  "index.html",
  "teacher.html",
  "style.css",
  "app.js",
  "adaptive.js",
  "store.js",
  "teacher.js",
  "config.js",
  "manifest.json",
  "icon.svg",
  "content/pack-v1.json"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    await cache.addAll(SHELL);

    // Cache audio files referenced by the latest content pack.
    try {
      const response = await fetch("content/pack-v1.json", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Could not load content pack");
      }

      const pack = await response.json();

      const clips = pack.items.flatMap(item =>
        Object.values(item.audio || {})
      );

      await Promise.allSettled(
        clips.map(async clip => {
          const response = await fetch(clip, {
            cache: "no-store"
          });

          if (response.ok) {
            await cache.put(clip, response);
          }
        })
      );
    } catch (error) {
      console.error("Audio caching failed:", error);
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key !== CACHE)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);

    if (cached) return cached;

    const response = await fetch(event.request);

    if (
      response.ok &&
      new URL(event.request.url).origin === location.origin
    ) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }

    return response;
  })());
});
