/**
 * Global Setup for E2E Integration Tests
 * Handles system-wide initialization before test execution
 */

import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Global test services
let overlayService: ChildProcess | null = null;
let testDatabaseInitialized = false;

interface GlobalSetupConfig {
  OVERLAY_PORT: string;
  OVERLAY_HOST: string;
  DB_NAME: string;
  START_SERVICES: boolean;
  SERVICE_TIMEOUT: number;
}

const config: GlobalSetupConfig = {
  OVERLAY_PORT: process.env.PORT || '3000',
  OVERLAY_HOST: process.env.HOST || 'localhost',
  DB_NAME: process.env.DB_NAME || 'overlay_test',
  START_SERVICES: process.env.START_SERVICES !== 'false',
  SERVICE_TIMEOUT: 60000
};

/**
 * Check if port is available
 */
async function isPortAvailable(port: string): Promise<boolean> {
  try {
    const result = await execAsync(`lsof -ti:${port}`);
    return result.stdout.trim() === '';
  } catch (error) {
    return true; // Port is available if lsof fails
  }
}

/**
 * Wait for service to start
 */
async function waitForServiceStart(url: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Service not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return false;
}

/**
 * Initialize test database with schema and test data
 */
async function initializeTestDatabase(): Promise<void> {
  if (testDatabaseInitialized) {
    return;
  }

  console.log('🔧 Initializing test database...');

  try {
    // Drop and recreate test database
    const dropCommand = `dropdb -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || '5432'} -U ${process.env.DB_USER || 'postgres'} --if-exists ${config.DB_NAME}`;
    await execAsync(dropCommand).catch(() => {
      // Database might not exist, that's OK
    });

    const createCommand = `createdb -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || '5432'} -U ${process.env.DB_USER || 'postgres'} ${config.DB_NAME}`;
    await execAsync(createCommand);

    // Apply schema
    const schemaPath = path.resolve(__dirname, '../../../src/db/postgresql-schema-complete.sql');
    const applySchemaCommand = `psql -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || '5432'} -U ${process.env.DB_USER || 'postgres'} -d ${config.DB_NAME} -f ${schemaPath}`;
    await execAsync(applySchemaCommand);

    // Initialize test data
    await seedTestData();

    testDatabaseInitialized = true;
    console.log('✅ Test database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    throw error;
  }
}

/**
 * Seed test database with initial data
 */
async function seedTestData(): Promise<void> {
  const seedQueries = [
    // Create test producers
    `INSERT INTO producers (producer_id, identity_key, name, description, status, created_at) VALUES
     ('test-producer-001', 'test-producer-key-001', 'E2E Test Producer 1', 'Producer for E2E integration tests', 'active', NOW()),
     ('test-producer-002', 'test-producer-key-002', 'E2E Test Producer 2', 'Secondary producer for E2E tests', 'active', NOW())`,

    // Create test lookup services
    `INSERT INTO lookup_services (service_id, name, domain, endpoint, status, created_at) VALUES
     ('test-lookup-001', 'E2E Test Lookup', 'e2e-test', 'http://localhost:3000/api/lookup', 'active', NOW())`,

    // Create test service advertisements
    `INSERT INTO service_advertisements (advertisement_id, identity_key, service_type, capabilities, pricing, status, created_at) VALUES
     ('test-ad-001', 'test-producer-key-001', 'content-streaming', '["real-time", "historical"]', '{"basePrice": 100, "currency": "BSV"}', 'active', NOW())`,

    // Create test payment quotes (expired for testing)
    `INSERT INTO payment_quotes (quote_id, payer_identity, recipient_identity, amount, currency, status, expires_at, created_at) VALUES
     ('test-quote-expired', 'test-consumer-001', 'test-producer-key-001', 100, 'BSV', 'expired', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '2 hours')`,

    // Create test streaming sessions
    `INSERT INTO streaming_sessions (session_id, producer_identity, stream_type, pricing_model, status, created_at) VALUES
     ('test-session-001', 'test-producer-key-001', 'data-feed', 'per-packet', 'ended', NOW() - INTERVAL '1 hour')`
  ];

  for (const query of seedQueries) {
    try {
      const command = `psql -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || '5432'} -U ${process.env.DB_USER || 'postgres'} -d ${config.DB_NAME} -c "${query.replace(/"/g, '\\"')}"`;
      await execAsync(command);
    } catch (error) {
      console.warn(`⚠️  Failed to execute seed query: ${query.substring(0, 50)}...`);
      // Continue with other queries
    }
  }

  console.log('✅ Test data seeded successfully');
}

/**
 * Start overlay service for testing
 */
async function startOverlayService(): Promise<void> {
  if (!config.START_SERVICES) {
    console.log('⏭️  Skipping service startup (START_SERVICES=false)');
    return;
  }

  const serviceUrl = `http://${config.OVERLAY_HOST}:${config.OVERLAY_PORT}`;

  // Check if service is already running
  try {
    const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
    if (response.status === 200) {
      console.log('✅ Overlay service is already running');
      return;
    }
  } catch (error) {
    // Service not running, we'll start it
  }

  // Check if port is available
  const portAvailable = await isPortAvailable(config.OVERLAY_PORT);
  if (!portAvailable) {
    console.log(`⚠️  Port ${config.OVERLAY_PORT} is in use, assuming service is running`);
    return;
  }

  console.log('🚀 Starting overlay service for integration tests...');

  // Start the overlay service
  overlayService = spawn('npm', ['run', 'dev'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: config.OVERLAY_PORT,
      DB_NAME: config.DB_NAME,
      LOG_LEVEL: 'warn'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Handle service output
  overlayService.stdout?.on('data', (data) => {
    if (process.env.DEBUG_SERVICES) {
      console.log(`[OVERLAY] ${data.toString().trim()}`);
    }
  });

  overlayService.stderr?.on('data', (data) => {
    if (process.env.DEBUG_SERVICES) {
      console.error(`[OVERLAY ERROR] ${data.toString().trim()}`);
    }
  });

  overlayService.on('error', (error) => {
    console.error('❌ Overlay service error:', error);
  });

  // Wait for service to start
  const serviceStarted = await waitForServiceStart(serviceUrl, config.SERVICE_TIMEOUT);

  if (!serviceStarted) {
    if (overlayService) {
      overlayService.kill();
    }
    throw new Error(`Overlay service failed to start within ${config.SERVICE_TIMEOUT}ms`);
  }

  console.log('✅ Overlay service started successfully');
}

/**
 * Create necessary directories for testing
 */
async function createTestDirectories(): Promise<void> {
  const directories = [
    'test-results',
    'test/fixtures/e2e-data',
    'test/fixtures/cli-output',
    'tmp/test-uploads',
    'tmp/test-downloads',
    'tmp/test-streams'
  ];

  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true });
  }

  console.log('✅ Test directories created');
}

/**
 * Main global setup function
 */
export default async function globalSetup(): Promise<void> {
  console.log('🏗️  Starting global setup for E2E integration tests...');

  try {
    // Create test directories
    await createTestDirectories();

    // Initialize test database
    await initializeTestDatabase();

    // Start overlay service
    await startOverlayService();

    // Verify all systems are ready
    const serviceUrl = `http://${config.OVERLAY_HOST}:${config.OVERLAY_PORT}`;
    const healthResponse = await axios.get(`${serviceUrl}/health/extended`, { timeout: 10000 });

    console.log('🔍 Service health check:', healthResponse.data);

    // Store global state for cleanup
    (global as any).__GLOBAL_SETUP__ = {
      overlayService,
      config,
      serviceUrl
    };

    console.log('✅ Global setup completed successfully');
    console.log(`🌐 Services available at: ${serviceUrl}`);
    console.log(`🗄️  Test database: ${config.DB_NAME}`);

  } catch (error) {
    console.error('❌ Global setup failed:', error);

    // Cleanup on failure
    if (overlayService) {
      overlayService.kill();
    }

    throw error;
  }
}