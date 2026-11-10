import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.e2e.ts'],
    globalSetup: ['./src/global-setup.ts'],
    // Files share DB state and the BFF rate-limits auth per IP: run strictly one at a time.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
