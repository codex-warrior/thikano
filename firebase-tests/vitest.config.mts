import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Emulator-backed suites share state; run files sequentially.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
