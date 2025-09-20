// Test setup for integration tests
// Ensures test environment is properly configured

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

// Set test-specific environment variables
process.env.PG_URL = 'test://localhost';
process.env.REDIS_URL = 'test://localhost';

// Console log to confirm test environment
console.log('Test environment configured for hybrid database tests');