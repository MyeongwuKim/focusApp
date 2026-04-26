import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  server: {
    host: "0.0.0.0",
    proxy: {
      "/auth": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/graphql": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/daily-log": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/daily-logs": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2017',
  },
  plugins: [react(), tailwindcss()],
})
