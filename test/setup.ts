// Test setup for integration tests
// Ensures test environment is properly configured

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

// Set test-specific environment variables for PostgreSQL and Redis
if (!process.env.PG_HOST) process.env.PG_HOST = 'localhost';
if (!process.env.PG_PORT) process.env.PG_PORT = '5432';
if (!process.env.PG_DATABASE) process.env.PG_DATABASE = 'overlay';
if (!process.env.PG_USER) process.env.PG_USER = 'postgres';
if (!process.env.PG_PASSWORD) process.env.PG_PASSWORD = 'password';
if (!process.env.REDIS_URL) process.env.REDIS_URL = 'redis://localhost:6379';

// Set test-specific pricing and payment variables
if (!process.env.PRICE_DEFAULT_SATS) process.env.PRICE_DEFAULT_SATS = '1234';
if (!process.env.RECEIPT_TTL_SEC) process.env.RECEIPT_TTL_SEC = '120';
if (!process.env.PRICE_QUOTE_TTL_SEC) process.env.PRICE_QUOTE_TTL_SEC = '120';

// Console log to confirm test environment
console.log('Test environment configured for hybrid database tests');

// Global setup for database cleanup
import { afterEach } from 'vitest';

// Only clean after each test to prevent contamination of next test
afterEach(async () => {
  // Skip cleanup for template tests to preserve beforeAll setup
  if (process.env.VITEST_POOL_ID && process.env.VITEST_POOL_ID.includes('d24-templates')) {
    return;
  }

  // Clean the most commonly contaminating tables
  const { getPostgreSQLClient } = await import('../src/db/postgresql');
  const pgClient = getPostgreSQLClient();

  const quickCleanup = [
    'DELETE FROM jobs',
    'DELETE FROM agents WHERE name LIKE \'%Test%\'',
    'DELETE FROM rules WHERE name LIKE \'%Test%\'',
    'DELETE FROM artifacts',
  ];

  for (const query of quickCleanup) {
    try {
      await pgClient.query(query);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});