// 🚀 Auto-update immediately on new deploy
self.skipWaiting();

// 🔄 Version bump = full refresh for users
const CACHE_VERSION = `v-${Date.now()}`;
const SHELL_CACHE = `addremarks-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `addremarks-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `addremarks-runtime-${CACHE_VERSION}`;

// 🤲 App shell that must always load
const CRITICAL_URLS = ["/", "/manifest.json"];

// 🧊 Static assets that rarely change
const STATIC_ASSETS = [
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// -----------------------------
//  INSTALL — Precache App Shell
// -----------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(CRITICAL_URLS)),
      caches.open(STATIC_CACHE).then((cache) =>
        cache.addAll(STATIC_ASSETS).catch(() => {})
      ),
    ])
  );
});

// ----------------------------------------
//  ACTIVATE — Delete old caches for update
// ----------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.includes(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
});

// ----------------------------------------
//  FETCH — smart routing (optimized)
// ----------------------------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ❌ Never cache API calls or cross-origin requests
  if (url.origin !== self.location.origin || url.pathname.includes("/api/")) {
    event.respondWith(networkOnlyWithFallback(req));
    return;
  }

  // ❌ Don’t cache POST/PUT/DELETE/etc.
  if (req.method !== "GET") return;

  // 📄 Navigation → Network first / Offline shell fallback
  if (req.mode === "navigate") {
    event.respondWith(networkFirstShellFallback(req));
    return;
  }

  // 🖼 Static assets → Cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 🔄 Everything else → Network-first + runtime cache
  event.respondWith(networkFirstRuntimeCache(req));
});

// -----------------------------------------------------------------------------
// ⭐ STRATEGY HELPERS
// -----------------------------------------------------------------------------

// Network-only but return shell on failure (for API)
async function networkOnlyWithFallback(req) {
  try {
    return await fetch(req);
  } catch {
    return caches.match("/");
  }
}

// Navigation: always try network first
async function networkFirstShellFallback(req) {
  try {
    const res = await fetch(req);
    const clone = res.clone();
    caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone));
    return res;
  } catch {
    return (await caches.match(req)) || (await caches.match("/"));
  }
}

// Static items: cache-first
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    const cacheClone = res.clone(); // clone immediately
    const cache = await caches.open(cacheName);
    await cache.put(req, cacheClone);
    return res; // return original to page
  } catch {
    return caches.match("/");
  }
}

// Dynamic runtime cache: network-first
async function networkFirstRuntimeCache(req) {
  try {
    const res = await fetch(req);
    const cacheClone = res.clone(); // clone immediately
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(req, cacheClone);
    return res;
  } catch {
    return caches.match(req);
  }
}


// Detect static file extensions
function isStaticAsset(pathname) {
  const extensions = [
    ".js", ".css", ".woff", ".woff2", ".ttf",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"
  ];
  return extensions.some((ext) => pathname.endsWith(ext));
}
