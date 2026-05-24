// Service worker da ReformAI: Web Push + suporte offline (app-shell).
const VERSION = "v1"
const STATIC_CACHE = `reformai-static-${VERSION}`
const PAGE_CACHE = `reformai-pages-${VERSION}`
const OFFLINE_URL = "/offline"

const PRECACHE = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Nunca interceptar API nem o próprio SW — sempre rede.
  if (url.pathname.startsWith("/api/")) return

  // Navegação (HTML): network-first com fallback para cache e, por fim, /offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(PAGE_CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(async () => {
          const cached = await caches.match(req)
          return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error()
        }),
    )
    return
  }

  // Assets estáticos do Next e ícones: stale-while-revalidate.
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => cached)
        return cached ?? network
      }),
    )
  }
})

// ─── Web Push ─────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_e) {
    data = { title: "ReformAI", body: event.data ? event.data.text() : "" }
  }
  const title = data.title || "ReformAI"
  const options = {
    body: data.body || "",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(targetUrl) && "focus" in w) return w.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    }),
  )
})
