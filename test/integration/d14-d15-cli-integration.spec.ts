/**
 * D14-D15 CLI Integration Tests
 *
 * This test suite validates the complete integration between:
 * - D14 Ready CLI (Consumer) - Python-based consumer CLI
 * - D15 Producer Onboard CLI (Producer) - TypeScript-based producer CLI
 *
 * Tests real-world scenarios where the consumer CLI interacts with
 * the producer CLI through the full BRC stack overlay network.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import {
  BRC31TestHelper,
  BRC88TestHelper,
  BRC24TestHelper,
  BRC41TestHelper,
  BRC26TestHelper,
  BRC22TestHelper,
  BRC64TestHelper,
  D21TestHelper,
  D22TestHelper,
  StreamingTestHelper,
  IntegrationTestUtils,
  TestIdentity
} from './helpers/brc-test-helpers';

const execAsync = promisify(exec);

// Test Configuration
const CLI_TEST_CONFIG = {
  OVERLAY_URL: 'http://localhost:3000',
  D14_CLI_PATH: './cli/consumer/overlay-consumer-cli.py',
  D15_CLI_PATH: './cli/producer/producer.ts',
  TEST_OUTPUT_DIR: './test/fixtures/cli-output',
  PYTHON_ENV: 'python3',
  NODE_ENV: 'npx tsx',
  TIMEOUT: {
    CLI_COMMAND: 30000,
    STREAM_SETUP: 60000,
    PAYMENT_PROCESSING: 45000
  }
};

interface CLITestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTime: number;
}

// CLI Test Utilities
class CLITestUtils {
  static async executeProducerCLI(
    command: string,
    args: string[] = [],
    options: { timeout?: number; env?: Record<string, string> } = {}
  ): Promise<CLITestResult> {
    const startTime = Date.now();
    const fullCommand = `${CLI_TEST_CONFIG.NODE_ENV} ${CLI_TEST_CONFIG.D15_CLI_PATH} ${command} ${args.join(' ')}`;

    try {
      const result = await execAsync(fullCommand, {
        timeout: options.timeout || CLI_TEST_CONFIG.TIMEOUT.CLI_COMMAND,
        env: { ...process.env, ...options.env }
      });

      return {
        exitCode: 0,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  static async executeConsumerCLI(
    command: string,
    args: string[] = [],
    options: { timeout?: number; env?: Record<string, string> } = {}
  ): Promise<CLITestResult> {
    const startTime = Date.now();
    const fullCommand = `${CLI_TEST_CONFIG.PYTHON_ENV} ${CLI_TEST_CONFIG.D14_CLI_PATH} ${command} ${args.join(' ')}`;

    try {
      const result = await execAsync(fullCommand, {
        timeout: options.timeout || CLI_TEST_CONFIG.TIMEOUT.CLI_COMMAND,
        env: { ...process.env, ...options.env }
      });

      return {
        exitCode: 0,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  static async createTestConfigFile(identity: TestIdentity, type: 'producer' | 'consumer'): Promise<string> {
    const configData = {
      identity: {
        identityKey: identity.identityKey,
        privateKey: identity.privateKey,
        publicKey: identity.publicKey
      },
      overlay: {
        baseUrl: CLI_TEST_CONFIG.OVERLAY_URL,
        timeout: 30000
      },
      type
    };

    const configPath = path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, `${type}-config-${identity.identityKey.slice(0, 8)}.json`);
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
    return configPath;
  }

  static parseCliOutput(output: string, format: 'json' | 'text' = 'json'): any {
    if (format === 'json') {
      try {
        // Find JSON objects in the output
        const jsonMatches = output.match(/\{.*\}/g);
        return jsonMatches ? JSON.parse(jsonMatches[jsonMatches.length - 1]) : null;
      } catch (error) {
        return null;
      }
    }
    return output.trim();
  }
}

// Test Suite
describe('D14-D15 CLI Integration Tests', () => {
  let producerIdentity: TestIdentity;
  let consumerIdentity: TestIdentity;
  let producerConfigPath: string;
  let consumerConfigPath: string;

  beforeAll(async () => {
    // Create test output directory
    await fs.mkdir(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, { recursive: true });

    // Wait for overlay service
    await IntegrationTestUtils.waitForServiceReady(CLI_TEST_CONFIG.OVERLAY_URL);

    // Generate test identities
    producerIdentity = await BRC31TestHelper.generateTestIdentity();
    consumerIdentity = await BRC31TestHelper.generateTestIdentity();

    // Create CLI configuration files
    producerConfigPath = await CLITestUtils.createTestConfigFile(producerIdentity, 'producer');
    consumerConfigPath = await CLITestUtils.createTestConfigFile(consumerIdentity, 'consumer');

    // Register identities through API first
    await BRC31TestHelper.registerIdentity(
      CLI_TEST_CONFIG.OVERLAY_URL,
      producerIdentity,
      'producer',
      ['content-publishing', 'streaming', 'micropayments']
    );

    await BRC31TestHelper.registerIdentity(
      CLI_TEST_CONFIG.OVERLAY_URL,
      consumerIdentity,
      'consumer',
      ['content-access', 'streaming-consumption', 'micropayments']
    );
  }, 60000);

  afterAll(async () => {
    // Cleanup test files
    await fs.rm(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, { recursive: true, force: true });
  });

  describe('D15 Producer CLI Functionality', () => {
    it('should initialize producer with identity registration via CLI', async () => {
      const result = await CLITestUtils.executeProducerCLI('init', [
        '--config', producerConfigPath,
        '--overlay-url', CLI_TEST_CONFIG.OVERLAY_URL
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Producer initialized successfully');

      const output = CLITestUtils.parseCliOutput(result.stdout);
      if (output) {
        expect(output).toHaveProperty('identityKey');
        expect(output).toHaveProperty('status', 'initialized');
      }
    });

    it('should advertise services via BRC-88 using CLI', async () => {
      const result = await CLITestUtils.executeProducerCLI('advertise', [
        '--config', producerConfigPath,
        '--service-type', 'content-streaming',
        '--capabilities', 'real-time,historical,analytics',
        '--price', '100',
        '--currency', 'BSV',
        '--endpoint', '/stream/test'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Service advertised successfully');

      const output = CLITestUtils.parseCliOutput(result.stdout);
      if (output) {
        expect(output).toHaveProperty('advertisementId');
        expect(output).toHaveProperty('services');
        expect(output.services).toHaveLength(1);
      }
    });

    it('should publish content via BRC-26 using CLI', async () => {
      // Create test content file
      const testContentPath = path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'test-content.json');
      const testContent = {
        timestamp: new Date().toISOString(),
        data: 'Test content for CLI integration',
        metadata: { type: 'test', source: 'cli-integration' }
      };
      await fs.writeFile(testContentPath, JSON.stringify(testContent));

      const result = await CLITestUtils.executeProducerCLI('publish', [
        '--config', producerConfigPath,
        '--file', testContentPath,
        '--content-type', 'application/json',
        '--price', '50',
        '--replication', '2',
        '--title', 'CLI Integration Test Content'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Content published successfully');

      const output = CLITestUtils.parseCliOutput(result.stdout);
      if (output) {
        expect(output).toHaveProperty('contentId');
        expect(output).toHaveProperty('uhrpUrl');
        expect(output).toHaveProperty('price', 50);
      }
    });

    it('should start streaming session with real-time pricing via CLI', async () => {
      const result = await CLITestUtils.executeProducerCLI('stream', [
        '--config', producerConfigPath,
        '--stream-type', 'live-data',
        '--pricing-model', 'per-second',
        '--rate', '10',
        '--quality', 'high',
        '--duration', '30' // 30 seconds for testing
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Streaming session started');

      const output = CLITestUtils.parseCliOutput(result.stdout);
      if (output) {
        expect(output).toHaveProperty('sessionId');
        expect(output).toHaveProperty('streamUrl');
        expect(output).toHaveProperty('pricing');
      }
    }, CLI_TEST_CONFIG.TIMEOUT.STREAM_SETUP);

    it('should generate analytics report via CLI', async () => {
      const result = await CLITestUtils.executeProducerCLI('analytics', [
        '--config', producerConfigPath,
        '--report-type', 'usage',
        '--time-range', '24h',
        '--format', 'json',
        '--output', path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'producer-analytics.json')
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Analytics report generated');

      // Verify report file was created
      const reportExists = await fs.access(path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'producer-analytics.json'))
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);
    });
  });

  describe('D14 Consumer CLI Functionality', () => {
    it('should initialize consumer with identity registration via CLI', async () => {
      const result = await CLITestUtils.executeConsumerCLI('init', [
        '--config', consumerConfigPath,
        '--overlay-url', CLI_TEST_CONFIG.OVERLAY_URL,
        '--wallet-setup'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Consumer initialized successfully');

      const output = CLITestUtils.parseCliOutput(result.stdout);
      if (output) {
        expect(output).toHaveProperty('identityKey');
        expect(output).toHaveProperty('wallet');
        expect(output).toHaveProperty('status', 'initialized');
      }
    });

    it('should discover services via BRC-88 using CLI', async () => {
      const result = await CLITestUtils.executeConsumerCLI('discover', [
        '--config', consumerConfigPath,
        '--service-type', 'content-streaming',
        '--capabilities', 'real-time',
        '--max-price', '200',
        '--location', 'any',
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Services discovered');

      const output = CLITestUtils.parseCliOutput(result.stdout);
      if (output) {
        expect(output).toHaveProperty('services');
        expect(Array.isArray(output.services)).toBe(true);

        if (output.services.length > 0) {
          const service = output.services.find((s: any) => s.producer === producerIdentity.identityKey);
          expect(service).toBeDefined();
        }
      }
    });

    it('should search and lookup content via BRC-24 using CLI', async () => {
      const result = await CLITestUtils.executeConsumerCLI('search', [
        '--config', consumerConfigPath,
        '--content-type', 'application/json',
        '--tags', 'test,cli-integration',
        '--max-price', '100',
        '--producer', producerIdentity.identityKey,
        '--limit', '10'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Content search completed');

      const output = CLITestUtils.parseCliOutput(result.stdout);
      if (output) {
        expect(output).toHaveProperty('results');
        expect(Array.isArray(output.results)).toBe(true);
        expect(output).toHaveProperty('totalCount');
      }
    });

    it('should create payment quote via BRC-41 using CLI', async () => {
      const result = await CLITestUtils.executeConsumerCLI('quote', [
        '--config', consumerConfigPath,
        '--provider', producerIdentity.identityKey,
        '--service-type', 'content-access',
        '--resource-id', 'test-content-001',
        '--expected-cost', '50'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Payment quote created');

      const output = CLITestUtils.parseCliOutput(result.stdout);
      if (output) {
        expect(output).toHaveProperty('quoteId');
        expect(output).toHaveProperty('amount');
        expect(output).toHaveProperty('paymentAddress');
        expect(output).toHaveProperty('expiresAt');
      }
    });

    it('should process payment and access content via CLI', async () => {
      // First get a content item to access
      const searchResult = await CLITestUtils.executeConsumerCLI('search', [
        '--config', consumerConfigPath,
        '--producer', producerIdentity.identityKey,
        '--limit', '1',
        '--format', 'json'
      ]);

      const searchOutput = CLITestUtils.parseCliOutput(searchResult.stdout);
      if (!searchOutput || !searchOutput.results || searchOutput.results.length === 0) {
        // Skip test if no content available
        return;
      }

      const contentItem = searchOutput.results[0];

      // Create payment quote
      const quoteResult = await CLITestUtils.executeConsumerCLI('quote', [
        '--config', consumerConfigPath,
        '--provider', producerIdentity.identityKey,
        '--service-type', 'content-access',
        '--resource-id', contentItem.contentId,
        '--expected-cost', contentItem.metadata.price.toString()
      ]);

      const quoteOutput = CLITestUtils.parseCliOutput(quoteResult.stdout);
      expect(quoteOutput).toHaveProperty('quoteId');

      // Process payment
      const paymentResult = await CLITestUtils.executeConsumerCLI('pay', [
        '--config', consumerConfigPath,
        '--quote-id', quoteOutput.quoteId,
        '--confirm'
      ]);

      expect(paymentResult.exitCode).toBe(0);
      expect(paymentResult.stdout).toContain('Payment processed');

      // Access content
      const accessResult = await CLITestUtils.executeConsumerCLI('access', [
        '--config', consumerConfigPath,
        '--content-id', contentItem.contentId,
        '--uhrp-url', contentItem.uhrpUrl,
        '--output', path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'accessed-content.json')
      ]);

      expect(accessResult.exitCode).toBe(0);
      expect(accessResult.stdout).toContain('Content accessed successfully');

      // Verify content file was downloaded
      const contentExists = await fs.access(path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'accessed-content.json'))
        .then(() => true)
        .catch(() => false);
      expect(contentExists).toBe(true);
    }, CLI_TEST_CONFIG.TIMEOUT.PAYMENT_PROCESSING);

    it('should subscribe to stream with micropayments via CLI', async () => {
      // First discover streaming services
      const discoverResult = await CLITestUtils.executeConsumerCLI('discover', [
        '--config', consumerConfigPath,
        '--service-type', 'live-streaming',
        '--format', 'json'
      ]);

      const discoverOutput = CLITestUtils.parseCliOutput(discoverResult.stdout);
      if (!discoverOutput || !discoverOutput.services || discoverOutput.services.length === 0) {
        // Skip if no streaming services available
        return;
      }

      const streamService = discoverOutput.services.find((s: any) => s.producer === producerIdentity.identityKey);
      if (!streamService) {
        // Skip if producer doesn't have streaming service
        return;
      }

      // Subscribe to stream
      const subscribeResult = await CLITestUtils.executeConsumerCLI('subscribe', [
        '--config', consumerConfigPath,
        '--stream-id', 'test-stream-001',
        '--provider', producerIdentity.identityKey,
        '--max-amount', '1000',
        '--auto-pay-interval', '10',
        '--duration', '30' // 30 seconds for testing
      ]);

      expect(subscribeResult.exitCode).toBe(0);
      expect(subscribeResult.stdout).toContain('Stream subscription');

      const subscribeOutput = CLITestUtils.parseCliOutput(subscribeResult.stdout);
      if (subscribeOutput) {
        expect(subscribeOutput).toHaveProperty('subscriptionId');
        expect(subscribeOutput).toHaveProperty('streamUrl');
      }
    }, CLI_TEST_CONFIG.TIMEOUT.STREAM_SETUP);

    it('should generate consumer usage report via CLI', async () => {
      const result = await CLITestUtils.executeConsumerCLI('report', [
        '--config', consumerConfigPath,
        '--report-type', 'usage',
        '--time-range', '24h',
        '--include-payments',
        '--include-content',
        '--format', 'json',
        '--output', path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'consumer-report.json')
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage report generated');

      // Verify report file was created
      const reportExists = await fs.access(path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'consumer-report.json'))
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);

      // Validate report content
      const reportContent = await fs.readFile(
        path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'consumer-report.json'),
        'utf-8'
      );
      const report = JSON.parse(reportContent);

      expect(report).toHaveProperty('timeRange');
      expect(report).toHaveProperty('totalPayments');
      expect(report).toHaveProperty('contentAccessed');
      expect(report).toHaveProperty('streamingActivity');
    });
  });

  describe('End-to-End CLI Workflow Integration', () => {
    it('should complete full producer-to-consumer workflow using CLI commands', async () => {
      const workflowId = `cli-workflow-${Date.now()}`;
      const results: Record<string, any> = {};

      // Step 1: Producer publishes new content
      const testContentPath = path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, `${workflowId}-content.json`);
      const workflowContent = {
        workflowId,
        timestamp: new Date().toISOString(),
        data: 'End-to-end CLI workflow test content',
        metadata: {
          type: 'e2e-test',
          workflow: 'cli-integration',
          version: '1.0'
        }
      };
      await fs.writeFile(testContentPath, JSON.stringify(workflowContent));

      const publishResult = await CLITestUtils.executeProducerCLI('publish', [
        '--config', producerConfigPath,
        '--file', testContentPath,
        '--content-type', 'application/json',
        '--price', '75',
        '--title', `CLI Workflow ${workflowId}`,
        '--tags', 'e2e-test,cli-integration'
      ]);

      expect(publishResult.exitCode).toBe(0);
      results.publish = CLITestUtils.parseCliOutput(publishResult.stdout);
      expect(results.publish).toHaveProperty('contentId');

      // Step 2: Consumer discovers the new content
      const searchResult = await CLITestUtils.executeConsumerCLI('search', [
        '--config', consumerConfigPath,
        '--tags', 'e2e-test,cli-integration',
        '--producer', producerIdentity.identityKey,
        '--format', 'json'
      ]);

      expect(searchResult.exitCode).toBe(0);
      results.search = CLITestUtils.parseCliOutput(searchResult.stdout);
      expect(results.search).toHaveProperty('results');
      expect(results.search.results.length).toBeGreaterThan(0);

      const foundContent = results.search.results.find(
        (item: any) => item.contentId === results.publish.contentId
      );
      expect(foundContent).toBeDefined();

      // Step 3: Consumer creates payment quote
      const quoteResult = await CLITestUtils.executeConsumerCLI('quote', [
        '--config', consumerConfigPath,
        '--provider', producerIdentity.identityKey,
        '--service-type', 'content-access',
        '--resource-id', results.publish.contentId,
        '--expected-cost', '75'
      ]);

      expect(quoteResult.exitCode).toBe(0);
      results.quote = CLITestUtils.parseCliOutput(quoteResult.stdout);
      expect(results.quote).toHaveProperty('quoteId');

      // Step 4: Consumer processes payment
      const paymentResult = await CLITestUtils.executeConsumerCLI('pay', [
        '--config', consumerConfigPath,
        '--quote-id', results.quote.quoteId,
        '--confirm',
        '--wait-for-confirmation'
      ]);

      expect(paymentResult.exitCode).toBe(0);
      results.payment = CLITestUtils.parseCliOutput(paymentResult.stdout);
      expect(results.payment).toHaveProperty('paymentId');

      // Step 5: Consumer accesses the content
      const accessResult = await CLITestUtils.executeConsumerCLI('access', [
        '--config', consumerConfigPath,
        '--content-id', results.publish.contentId,
        '--uhrp-url', results.publish.uhrpUrl,
        '--output', path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, `${workflowId}-accessed.json`)
      ]);

      expect(accessResult.exitCode).toBe(0);
      results.access = CLITestUtils.parseCliOutput(accessResult.stdout);

      // Step 6: Verify content integrity
      const accessedContent = await fs.readFile(
        path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, `${workflowId}-accessed.json`),
        'utf-8'
      );
      const parsedAccessed = JSON.parse(accessedContent);
      expect(parsedAccessed.workflowId).toBe(workflowId);
      expect(parsedAccessed.data).toBe(workflowContent.data);

      // Step 7: Producer checks analytics
      const producerAnalyticsResult = await CLITestUtils.executeProducerCLI('analytics', [
        '--config', producerConfigPath,
        '--content-id', results.publish.contentId,
        '--report-type', 'access',
        '--format', 'json'
      ]);

      expect(producerAnalyticsResult.exitCode).toBe(0);
      results.producerAnalytics = CLITestUtils.parseCliOutput(producerAnalyticsResult.stdout);

      // Step 8: Consumer checks usage history
      const consumerReportResult = await CLITestUtils.executeConsumerCLI('history', [
        '--config', consumerConfigPath,
        '--content-id', results.publish.contentId,
        '--include-payments',
        '--format', 'json'
      ]);

      expect(consumerReportResult.exitCode).toBe(0);
      results.consumerHistory = CLITestUtils.parseCliOutput(consumerReportResult.stdout);

      // Validate complete workflow
      expect(results).toHaveProperty('publish');
      expect(results).toHaveProperty('search');
      expect(results).toHaveProperty('quote');
      expect(results).toHaveProperty('payment');
      expect(results).toHaveProperty('access');
      expect(results).toHaveProperty('producerAnalytics');
      expect(results).toHaveProperty('consumerHistory');

      console.log('Complete CLI workflow results:', {
        workflowId,
        contentId: results.publish.contentId,
        paymentAmount: results.quote.amount,
        accessSuccess: !!results.access,
        analyticsGenerated: !!results.producerAnalytics,
        historyTracked: !!results.consumerHistory
      });
    }, 120000);

    it('should demonstrate cross-CLI streaming with real-time payments', async () => {
      const streamingWorkflowId = `streaming-workflow-${Date.now()}`;

      // Producer starts streaming session
      const streamStartResult = await CLITestUtils.executeProducerCLI('stream', [
        '--config', producerConfigPath,
        '--stream-id', streamingWorkflowId,
        '--stream-type', 'data-feed',
        '--pricing-model', 'per-packet',
        '--rate', '5', // 5 satoshis per packet
        '--quality', 'medium',
        '--duration', '45', // 45 seconds
        '--real-time'
      ]);

      expect(streamStartResult.exitCode).toBe(0);
      const streamData = CLITestUtils.parseCliOutput(streamStartResult.stdout);
      expect(streamData).toHaveProperty('sessionId');
      expect(streamData).toHaveProperty('streamUrl');

      // Consumer discovers and subscribes to the stream
      const subscribeResult = await CLITestUtils.executeConsumerCLI('subscribe', [
        '--config', consumerConfigPath,
        '--stream-id', streamingWorkflowId,
        '--provider', producerIdentity.identityKey,
        '--max-amount', '500', // Max 500 satoshis
        '--auto-pay-interval', '5', // Pay every 5 seconds
        '--duration', '30', // Subscribe for 30 seconds
        '--real-time'
      ]);

      expect(subscribeResult.exitCode).toBe(0);
      const subscriptionData = CLITestUtils.parseCliOutput(subscribeResult.stdout);
      expect(subscriptionData).toHaveProperty('subscriptionId');

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 35000));

      // Check streaming session results from producer
      const producerSessionResult = await CLITestUtils.executeProducerCLI('session-status', [
        '--config', producerConfigPath,
        '--session-id', streamData.sessionId
      ]);

      expect(producerSessionResult.exitCode).toBe(0);
      const sessionStatus = CLITestUtils.parseCliOutput(producerSessionResult.stdout);
      expect(sessionStatus).toHaveProperty('totalDuration');
      expect(sessionStatus).toHaveProperty('totalPayments');

      // Check subscription results from consumer
      const consumerSessionResult = await CLITestUtils.executeConsumerCLI('subscription-status', [
        '--config', consumerConfigPath,
        '--subscription-id', subscriptionData.subscriptionId
      ]);

      expect(consumerSessionResult.exitCode).toBe(0);
      const subscriptionStatus = CLITestUtils.parseCliOutput(consumerSessionResult.stdout);
      expect(subscriptionStatus).toHaveProperty('totalPaid');
      expect(subscriptionStatus).toHaveProperty('packetsReceived');

      console.log('Streaming workflow completed:', {
        streamingWorkflowId,
        sessionDuration: sessionStatus?.totalDuration,
        totalPayments: sessionStatus?.totalPayments,
        totalPaid: subscriptionStatus?.totalPaid,
        packetsReceived: subscriptionStatus?.packetsReceived
      });
    }, 90000);
  });

  describe('CLI Error Handling and Edge Cases', () => {
    it('should handle invalid configuration gracefully', async () => {
      const invalidConfigPath = path.join(CLI_TEST_CONFIG.TEST_OUTPUT_DIR, 'invalid-config.json');
      await fs.writeFile(invalidConfigPath, '{ "invalid": "config" }');

      const result = await CLITestUtils.executeConsumerCLI('init', [
        '--config', invalidConfigPath
      ]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('configuration');
    });

    it('should handle network connectivity issues', async () => {
      const result = await CLITestUtils.executeProducerCLI('advertise', [
        '--config', producerConfigPath,
        '--overlay-url', 'http://invalid-url:9999',
        '--service-type', 'test'
      ]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('connection') || expect(result.stderr).toContain('network');
    });

    it('should handle insufficient payment scenarios', async () => {
      const result = await CLITestUtils.executeConsumerCLI('pay', [
        '--config', consumerConfigPath,
        '--quote-id', 'non-existent-quote',
        '--confirm'
      ]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('quote') || expect(result.stderr).toContain('payment');
    });

    it('should validate input parameters', async () => {
      const result = await CLITestUtils.executeProducerCLI('publish', [
        '--config', producerConfigPath,
        '--price', 'invalid-price',
        '--file', 'non-existent-file.txt'
      ]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('price') || expect(result.stderr).toContain('file');
    });
  });
});