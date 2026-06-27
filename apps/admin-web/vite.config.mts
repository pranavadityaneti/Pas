import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 3001,
    proxy: {
      '/api': {
        // Default: a local API on :3000 (full-stack local dev). Override with
        // VITE_API_PROXY=https://api.pickatstore.io to point local admin-web at
        // the live API (e.g. to browse/log in without running the API locally).
        target: process.env.VITE_API_PROXY || 'http://localhost:3000',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    }
  }
});