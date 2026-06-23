import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../assets/dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: 'src/main.tsx',
    },
  },
  server: {
    port: 5173,
    cors: true,
  },
  base: './',
})
