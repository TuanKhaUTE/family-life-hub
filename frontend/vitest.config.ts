import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Unbounded jsdom startup starves interaction timers on high-core machines.
    // Keep per-file isolation and the default test timeout; limit only concurrency.
    maxWorkers: 2,
    restoreMocks: true,
  },
})
