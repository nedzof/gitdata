/**
 * Test Environment Setup
 * Initializes the testing environment for E2E integration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Test environment configuration
const TEST_ENV = {
  OVERLAY_URL: process.env.OVERLAY_BASE_URL || 'http://localhost:3000',
  TEST_DB: process.env.DB_NAME || 'overlay_test',
  CLEANUP_TIMEOUT: 10000,
  SETUP_TIMEOUT: 30000
};

// Global test state
let testEnvironmentReady = false;
let cleanupTasks: Array<() => Promise<void>> = [];

/**
 * Wait for service to be ready
 */
async function waitForService(url: string, timeoutMs = 30000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await axios.get(`${url}/health`, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });

      if (response.status === 200 && response.data.status === 'ok') {
        return true;
      }
    } catch (error) {
      // Service not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * Initialize test database
 */
async function initializeTestDatabase(): Promise<void> {
  try {
    // Create test database if it doesn't exist
    const createDbCommand = `createdb -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || '5432'} -U ${process.env.DB_USER || 'postgres'} ${TEST_ENV.TEST_DB} || true`;
    await execAsync(createDbCommand).catch(() => {
      // Database might already exist, that's OK
    });

    // Run database setup script
    const setupCommand = `DB_NAME=${TEST_ENV.TEST_DB} npm run setup:database`;
    await execAsync(setupCommand);

    console.log('✅ Test database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    throw error;
  }
}

/**
 * Initialize Redis for testing
 */
async function initializeTestRedis(): Promise<void> {
  try {
    // Flush test Redis database
    const flushCommand = `redis-cli -h ${process.env.REDIS_HOST || 'localhost'} -p ${process.env.REDIS_PORT || '6379'} -n ${process.env.REDIS_DB || '0'} FLUSHDB`;
    await execAsync(flushCommand);

    console.log('✅ Test Redis initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize test Redis:', error);
    throw error;
  }
}

/**
 * Create test directories
 */
async function createTestDirectories(): Promise<void> {
  const testDirs = [
    'test/fixtures/e2e-data',
    'test/fixtures/cli-output',
    'test-results',
    'tmp/test-uploads',
    'tmp/test-downloads'
  ];

  for (const dir of testDirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  console.log('✅ Test directories created successfully');
}

/**
 * Setup test environment variables
 */
function setupTestEnvironment(): void {
  // Ensure test environment variables are set
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'warn';

  // Override production URLs with test URLs
  process.env.OVERLAY_BASE_URL = TEST_ENV.OVERLAY_URL;
  process.env.DB_NAME = TEST_ENV.TEST_DB;

  // Enable all BRC features for testing
  process.env.BRC31_ENABLED = 'true';
  process.env.BRC41_ENABLED = 'true';
  process.env.BRC64_ENABLED = 'true';
  process.env.D21_ENABLED = 'true';
  process.env.D22_ENABLED = 'true';

  console.log('✅ Test environment variables configured');
}

/**
 * Global setup before all tests
 */
beforeAll(async () => {
  if (testEnvironmentReady) {
    return;
  }

  console.log('🔧 Setting up E2E integration test environment...');

  try {
    // Setup environment variables
    setupTestEnvironment();

    // Create necessary directories
    await createTestDirectories();

    // Initialize databases
    await initializeTestDatabase();
    await initializeTestRedis();

    // Wait for overlay service to be ready
    console.log('⏳ Waiting for overlay service to be ready...');
    const serviceReady = await waitForService(TEST_ENV.OVERLAY_URL, TEST_ENV.SETUP_TIMEOUT);

    if (!serviceReady) {
      throw new Error(`Overlay service at ${TEST_ENV.OVERLAY_URL} is not ready after ${TEST_ENV.SETUP_TIMEOUT}ms`);
    }

    console.log('✅ Overlay service is ready');

    // Verify all BRC endpoints are available
    const healthResponse = await axios.get(`${TEST_ENV.OVERLAY_URL}/health/extended`);
    const healthData = healthResponse.data;

    const requiredServices = [
      'database',
      'cache',
      'brc31-identity',
      'brc41-payments',
      'brc64-analytics'
    ];

    for (const service of requiredServices) {
      if (healthData[service] !== 'ok') {
        console.warn(`⚠️  Service ${service} is not healthy: ${healthData[service]}`);
      }
    }

    testEnvironmentReady = true;
    console.log('✅ E2E integration test environment setup complete');

  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
}, TEST_ENV.SETUP_TIMEOUT);

/**
 * Setup before each test
 */
beforeEach(async () => {
  // Clear any test-specific state
  cleanupTasks = [];

  // Add timestamp to help with debugging
  console.log(`🧪 Starting test at ${new Date().toISOString()}`);
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  // Run any registered cleanup tasks
  for (const cleanupTask of cleanupTasks) {
    try {
      await cleanupTask();
    } catch (error) {
      console.warn('⚠️  Cleanup task failed:', error);
    }
  }

  cleanupTasks = [];
  console.log(`✅ Test cleanup completed at ${new Date().toISOString()}`);
});

/**
 * Global cleanup after all tests
 */
afterAll(async () => {
  console.log('🧹 Cleaning up E2E integration test environment...');

  try {
    // Clean up test directories
    const testDirs = [
      'test/fixtures/e2e-data',
      'test/fixtures/cli-output',
      'tmp/test-uploads',
      'tmp/test-downloads'
    ];

    for (const dir of testDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist, that's OK
      }
    }

    // Flush test Redis
    try {
      const flushCommand = `redis-cli -h ${process.env.REDIS_HOST || 'localhost'} -p ${process.env.REDIS_PORT || '6379'} -n ${process.env.REDIS_DB || '0'} FLUSHDB`;
      await execAsync(flushCommand);
    } catch (error) {
      console.warn('⚠️  Failed to flush test Redis:', error);
    }

    console.log('✅ E2E integration test environment cleanup complete');

  } catch (error) {
    console.error('❌ Failed to cleanup test environment:', error);
  }
}, TEST_ENV.CLEANUP_TIMEOUT);

/**
 * Utility function to register cleanup tasks
 */
export function registerCleanupTask(task: () => Promise<void>): void {
  cleanupTasks.push(task);
}

/**
 * Utility function to check if test environment is ready
 */
export function isTestEnvironmentReady(): boolean {
  return testEnvironmentReady;
}

/**
 * Utility function to get test environment configuration
 */
export function getTestEnvironment() {
  return {
    ...TEST_ENV,
    isReady: testEnvironmentReady
  };
}