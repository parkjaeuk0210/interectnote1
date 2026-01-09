import React from 'react'
import ReactDOM from 'react-dom/client'
import { Router } from './Router'
import './index.css'
// Register service worker (vite-plugin-pwa)
// eslint-disable-next-line import/no-unresolved
import { registerSW } from 'virtual:pwa-register'
import { usePwaUpdateStore } from './store/pwaUpdateStore'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    usePwaUpdateStore.getState().setNeedRefresh(true)
  },
  onOfflineReady() {
    usePwaUpdateStore.getState().setOfflineReady(true)
  },
})

usePwaUpdateStore.getState().setUpdateServiceWorker(updateSW)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
