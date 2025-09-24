/**
 * Vitest Configuration for E2E Integration Tests
 * Comprehensive BRC Stack Testing Configuration
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'E2E Integration Tests',
    environment: 'node',
    testTimeout: 120000, // 2 minutes timeout for complex integration tests
    hookTimeout: 60000, // 1 minute timeout for setup/teardown
    globals: true,
    include: [
      'test/integration/**/*.spec.ts',
      'test/integration/**/*.test.ts'
    ],
    exclude: [
      'test/integration/helpers/**',
      'test/integration/fixtures/**'
    ],
    setupFiles: [
      'test/integration/setup/test-environment.ts'
    ],
    reporters: [
      'verbose',
      'json'
    ],
    outputFile: {
      json: 'test-results/integration-test-results.json'
    },
    coverage: {
      enabled: false, // Disable coverage for integration tests
      provider: 'v8'
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Run tests sequentially to avoid conflicts
      }
    },
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      OVERLAY_BASE_URL: 'http://localhost:3000',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'overlay_test',
      DB_USER: 'postgres',
      DB_PASSWORD: 'password',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_DB: '0',
      BRC31_ENABLED: 'true',
      BRC41_ENABLED: 'true',
      BRC64_ENABLED: 'true',
      D21_ENABLED: 'true',
      D22_ENABLED: 'true',
      LOG_LEVEL: 'warn'
    },
    globalSetup: 'test/integration/setup/global-setup.ts',
    globalTeardown: 'test/integration/setup/global-teardown.ts'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@test': path.resolve(__dirname, '.'),
      '@helpers': path.resolve(__dirname, 'helpers'),
      '@fixtures': path.resolve(__dirname, 'fixtures')
    }
  },
  define: {
    __INTEGRATION_TEST__: true,
    __BRC_STACK_VERSION__: '"1.0.0"'
  }
});