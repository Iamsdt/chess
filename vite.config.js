import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@context": path.resolve(__dirname, "src/lib/context"),
      "@pages": path.resolve(__dirname, "src/pages"),
      "@constants": path.resolve(__dirname, "src/lib/constants"),
      "@api": path.resolve(__dirname, "src/services/api"),
      "@query": path.resolve(__dirname, "src/services/query"),
      "@store": path.resolve(__dirname, "src/services/store"),
      "@public": path.resolve(__dirname, "public/images"),
      "@assets": path.resolve(__dirname, "assets"),
    },
  },
})
