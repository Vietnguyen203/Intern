import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose to LAN
    proxy: {
      // Chuyển tất cả các API calls về Gateway chạy ở cổng 8080
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: { 'Origin': 'http://localhost:5173' }
      },
      '/order': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: { 'Origin': 'http://localhost:5173' }
      },
      '/catalog': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: { 'Origin': 'http://localhost:5173' }
      },
      '/payment': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: { 'Origin': 'http://localhost:5173' }
      },
      '/loyalty': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: { 'Origin': 'http://localhost:5173' }
      },
      '/ws-notifications': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
        headers: { 'Origin': 'http://localhost:5173' }
      }
    }
  }
})
