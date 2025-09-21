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

// Console log to confirm test environment
console.log('Test environment configured for hybrid database tests');