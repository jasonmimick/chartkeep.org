import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,  // expose on LAN so phone can connect via laptop's IP
    proxy: {
      '/api': 'http://127.0.0.1:8765',
      '/previews': 'http://127.0.0.1:8765',
      '/dicom': 'http://127.0.0.1:8765',
    }
  }
})
