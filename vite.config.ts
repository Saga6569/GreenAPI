import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages project site: https://<user>.github.io/GreenAPI/
export default defineConfig({
  base: '/GreenAPI/',
  plugins: [react()],
})
