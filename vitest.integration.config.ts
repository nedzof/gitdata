import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.spec.ts', 'test/integration/**/*.test.ts'],
    exclude: ['test/integration/sdk.spec.ts', 'test/integration/submit-flow.spec.ts', 'test/integration/tx-builder.spec.ts'],
    timeout: 30000,
  },
});