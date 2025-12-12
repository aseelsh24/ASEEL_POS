import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const resolvePath = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@backend': resolvePath('../../backend'),
      '@core': resolvePath('../../packages/core/src'),
      '@db': resolvePath('../../packages/db/src'),
      dexie: resolvePath('./node_modules/dexie/dist/dexie.mjs'),
    },
  },
  plugins: [react()],
})
