import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  server: {
    proxy: {
      "/graphql": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/daily-log": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/daily-logs": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2017',
  },
  plugins: [react(), tailwindcss()],
})
