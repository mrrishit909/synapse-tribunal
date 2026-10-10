import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/synapse-tribunal/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    // vitest's default glob also matches Playwright's e2e/*.spec.ts, which
    // errors because those files call test() outside Playwright's runner.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
