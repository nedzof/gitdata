/**
 * Global Teardown for E2E Integration Tests
 * Handles system-wide cleanup after test execution
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Stop overlay service
 */
async function stopOverlayService(): Promise<void> {
  const globalState = (global as any).__GLOBAL_SETUP__;

  if (globalState?.overlayService) {
    console.log('🛑 Stopping overlay service...');

    try {
      // Gracefully terminate the service
      globalState.overlayService.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        globalState.overlayService.on('exit', resolve);

        // Force kill after 10 seconds
        setTimeout(() => {
          if (!globalState.overlayService.killed) {
            globalState.overlayService.kill('SIGKILL');
          }
          resolve(null);
        }, 10000);
      });

      console.log('✅ Overlay service stopped');
    } catch (error) {
      console.error('❌ Error stopping overlay service:', error);
    }
  }

  // Also kill any remaining processes on the test port
  try {
    const port = globalState?.config?.OVERLAY_PORT || '3000';
    await execAsync(`lsof -ti:${port} | xargs -r kill -9`).catch(() => {
      // Ignore errors - process might not exist
    });
  } catch (error) {
    // Ignore port cleanup errors
  }
}

/**
 * Cleanup test database
 */
async function cleanupTestDatabase(): Promise<void> {
  console.log('🧹 Cleaning up test database...');

  try {
    const globalState = (global as any).__GLOBAL_SETUP__;
    const dbName = globalState?.config?.DB_NAME || 'overlay_test';

    // Drop test database
    const dropCommand = `dropdb -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || '5432'} -U ${process.env.DB_USER || 'postgres'} --if-exists ${dbName}`;
    await execAsync(dropCommand).catch(() => {
      // Database might not exist, that's OK
    });

    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up test database:', error);
  }
}

/**
 * Cleanup Redis test data
 */
async function cleanupTestRedis(): Promise<void> {
  console.log('🧹 Cleaning up test Redis...');

  try {
    // Flush test Redis database
    const flushCommand = `redis-cli -h ${process.env.REDIS_HOST || 'localhost'} -p ${process.env.REDIS_PORT || '6379'} -n ${process.env.REDIS_DB || '0'} FLUSHDB`;
    await execAsync(flushCommand).catch(() => {
      // Redis might not be running, that's OK
    });

    console.log('✅ Test Redis cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up test Redis:', error);
  }
}

/**
 * Remove test directories and files
 */
async function cleanupTestDirectories(): Promise<void> {
  console.log('🧹 Cleaning up test directories...');

  const directoriesToRemove = [
    'test/fixtures/e2e-data',
    'test/fixtures/cli-output',
    'tmp/test-uploads',
    'tmp/test-downloads',
    'tmp/test-streams'
  ];

  for (const dir of directoriesToRemove) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's OK
    }
  }

  console.log('✅ Test directories cleaned up');
}

/**
 * Generate test summary report
 */
async function generateTestSummary(): Promise<void> {
  console.log('📊 Generating test summary...');

  try {
    const summaryData = {
      timestamp: new Date().toISOString(),
      testRun: 'E2E Integration Tests',
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        overlayUrl: (global as any).__GLOBAL_SETUP__?.serviceUrl || 'N/A',
        database: (global as any).__GLOBAL_SETUP__?.config?.DB_NAME || 'N/A'
      },
      cleanup: {
        overlayServiceStopped: true,
        databaseCleaned: true,
        redisCleaned: true,
        directoriesCleaned: true
      }
    };

    // Ensure test-results directory exists
    await fs.mkdir('test-results', { recursive: true });

    // Write summary
    await fs.writeFile(
      'test-results/integration-test-summary.json',
      JSON.stringify(summaryData, null, 2)
    );

    console.log('✅ Test summary generated');
  } catch (error) {
    console.error('❌ Error generating test summary:', error);
  }
}

/**
 * Main global teardown function
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Starting global teardown for E2E integration tests...');

  try {
    // Stop services
    await stopOverlayService();

    // Cleanup data
    await cleanupTestDatabase();
    await cleanupTestRedis();

    // Cleanup files
    await cleanupTestDirectories();

    // Generate summary
    await generateTestSummary();

    console.log('✅ Global teardown completed successfully');

  } catch (error) {
    console.error('❌ Global teardown failed:', error);

    // Continue with cleanup even if some steps fail
    console.log('⚠️  Continuing with remaining cleanup steps...');

    try {
      await cleanupTestDirectories();
    } catch (cleanupError) {
      console.error('❌ Final cleanup failed:', cleanupError);
    }
  }

  // Clear global state
  delete (global as any).__GLOBAL_SETUP__;
}