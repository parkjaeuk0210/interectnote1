/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { registerRoute } from 'workbox-routing'
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<import('workbox-build').ManifestEntry>
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

clientsClaim()
cleanupOutdatedCaches()

// Precache build assets.
precacheAndRoute(self.__WB_MANIFEST)

// Use network-first for HTML navigations to prevent stale app-shell causing blank screens
// after deployments (common on iOS when cached assets are evicted).
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event, request }) => {
    try {
      const preloadResponse = await (event as any).preloadResponse
      if (preloadResponse) return preloadResponse
      return await fetch(request)
    } catch {
      return (
        (await matchPrecache('/index.html')) ??
        (await matchPrecache('index.html')) ??
        Response.error()
      )
    }
  },
)

// Cache Firebase RTDB reads to reduce load and improve perceived performance.
registerRoute(
  /^https:\/\/.*\.firebaseio\.com\/.*/i,
  new NetworkFirst({
    cacheName: 'firebase-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  }),
  'GET',
)

// Cache the PDF worker separately; it's big and rarely changes.
registerRoute(
  /\/assets\/pdf\.worker\.min-.*\.mjs$/i,
  new CacheFirst({
    cacheName: 'pdf-worker-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
  'GET',
)

self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.navigationPreload?.enable().catch(() => {}))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
