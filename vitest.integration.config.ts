import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/integration/**/*.spec.ts', 'test/integration/**/*.test.ts'],
    exclude: ['test/integration/sdk.spec.ts', 'test/integration/submit-flow.spec.ts', 'test/integration/tx-builder.spec.ts', 'test/integration/ingest.spec.ts'],
    timeout: 30000,
    // Disable parallelism to prevent database conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Run tests sequentially
    sequence: {
      concurrent: false,
    },
  },
});