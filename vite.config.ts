// vite.config.ts
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tailwindcss from '@tailwindcss/vite' // Adicionado no passo anterior

export default defineConfig({
  plugins: [react(), tailwindcss()], // tailwindcss() já deve estar aqui
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})