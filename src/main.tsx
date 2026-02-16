import React from 'react'
import ReactDOM from 'react-dom/client'
import { Router } from './Router'
import './index.css'
import Konva from 'konva'
import { isMacOS, isMobile } from './utils/device'
// Register service worker (vite-plugin-pwa)
// eslint-disable-next-line import/no-unresolved
import { registerSW } from 'virtual:pwa-register'
import { usePwaUpdateStore } from './store/pwaUpdateStore'

let swRegistration: ServiceWorkerRegistration | undefined

if (typeof window !== 'undefined') {
  const isStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches

  if (isStandalone && isMacOS() && !isMobile()) {
    ;(Konva.DD as any).useDragLayer = false
  }
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    usePwaUpdateStore.getState().setNeedRefresh(true)
  },
  onOfflineReady() {
    usePwaUpdateStore.getState().setOfflineReady(true)
  },
  onRegisteredSW(_swScriptUrl, registration) {
    swRegistration = registration
  },
})

usePwaUpdateStore.getState().setUpdateServiceWorker(updateSW)

if (typeof window !== 'undefined') {
  const CHECK_COOLDOWN_MS = 60_000
  let lastCheckedAt = 0

  const maybeCheckForUpdate = () => {
    const now = Date.now()
    if (now - lastCheckedAt < CHECK_COOLDOWN_MS) return
    lastCheckedAt = now
    swRegistration?.update().catch(() => {})
  }

  window.addEventListener('focus', maybeCheckForUpdate)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) maybeCheckForUpdate()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
