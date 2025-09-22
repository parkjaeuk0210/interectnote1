import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(api|__)/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],
  server: {
    port: 3000,
    host: true
  },
  build: {
    // 번들 사이즈 최적화
    rollupOptions: {
      output: {
        manualChunks: {
          // React 관련 라이브러리 분리
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // Firebase 관련 분리 (가장 큰 덩어리)
          'firebase': [
            'firebase/app', 
            'firebase/auth', 
            'firebase/database', 
            'firebase/storage'
          ],
          
          // 캔버스 관련 라이브러리 분리
          'canvas': ['konva', 'react-konva'],
          
          // 제스처/UI 라이브러리 분리
          'gestures': ['@use-gesture/react'],
          
          // 상태 관리
          'state': ['zustand']
        }
      }
    },
    
    // 청크 크기 경고 임계값 조정
    chunkSizeWarningLimit: 600,
    
    // 소스맵 비활성화 (프로덕션)
    sourcemap: false,
    
    // 최소화 설정
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // console.log 제거
        drop_debugger: true
      }
    }
  }
})
