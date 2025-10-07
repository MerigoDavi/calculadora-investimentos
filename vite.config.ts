import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tailwindcss from '@tailwindcss/vite' 

export default defineConfig({
  base: '/calculadora-investimentos/', 
  plugins: [react(), tailwindcss()],
})