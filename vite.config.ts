import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // stellar-sdk ships browser bundles that still reference Node's `global`.
  define: { global: 'globalThis' },
})
