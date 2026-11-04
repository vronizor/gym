const VERSION = "gym-v2";
const SHELL = [
  "./", "index.html", "app.js", "style.css", "manifest.webmanifest",
  "icon.svg", "icon-192.png", "icon-512.png", "routines.json",
  "fonts/inter-tight.woff2", "fonts/jetbrains-mono.woff2",
];
const DATA = "routines.json";
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function markCached(res) {
  const headers = new Headers(res.headers);
  headers.set("x-gym-cache", "1");
  return res.blob().then((body) => new Response(body, { status: res.status, statusText: res.statusText, headers }));
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  const key = new URL(DATA, self.registration.scope).href;
  try {
    const res = await Promise.race([
      fetch(request, { cache: "no-cache" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    const cached = await cache.match(key);
    if (cached) return markCached(cached);
    throw new Error("offline and not cached");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  const refresh = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  if (cached) return cached;
  const res = await refresh;
  if (res) return res;
  if (request.mode === "navigate") return cache.match("index.html");
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/" + DATA)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
