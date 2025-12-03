import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
    // Use base path only in production (build)
    base: command === 'build' ? '/APSmanager/' : '/',
  }
})
