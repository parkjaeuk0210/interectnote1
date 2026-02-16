import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const buildSha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_REF ||
  'dev'
const buildRef =
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.GITHUB_REF_NAME ||
  process.env.HEAD ||
  ''
const buildTime = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_REF__: JSON.stringify(buildRef),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: false,
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512.svg'],
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,json}'],
        globIgnores: ['**/pdf.worker.min-*.mjs'],
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
          },
          {
            urlPattern: /\/assets\/pdf\.worker\.min-.*\.mjs$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-worker-cache',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ],
        // Use prompt-based updates so installed PWA users can control reload timing.
        // (Also avoids unexpected reloads during editing.)
        skipWaiting: false,
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
