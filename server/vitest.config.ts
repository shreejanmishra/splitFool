import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    hookTimeout: 120_000,
    testTimeout: 20_000,
    // Tests share one in-memory MongoDB per file; run files sequentially to keep it simple.
    fileParallelism: false,
  },
})
