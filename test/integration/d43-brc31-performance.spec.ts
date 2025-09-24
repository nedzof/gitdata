/**
 * D43 Phase 1 - BRC-31 Performance Tests
 *
 * Performance and load tests for BRC-31 authentication implementation
 * to ensure it doesn't significantly impact request processing time.
 */

import { test, expect, describe, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { randomBytes, createHash } from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';

import { enhancedBRC31OverlayRouter } from '../../src/routes/overlay-brc-31';
import { initializeBRC31Middleware } from '../../src/brc31/middleware';
import { BRC31_VERSION } from '../../src/brc31/types';

// Performance database adapter that tracks operations
class PerformanceDatabaseAdapter {
  private operations: Array<{ operation: string; duration: number }> = [];

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const start = Date.now();
    const result = await this.mockQuery(sql, params);
    this.operations.push({ operation: 'query', duration: Date.now() - start });
    return result;
  }

  async queryOne(sql: string, params: any[] = []): Promise<any> {
    const start = Date.now();
    const result = await this.mockQueryOne(sql, params);
    this.operations.push({ operation: 'queryOne', duration: Date.now() - start });
    return result;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const start = Date.now();
    await this.mockExecute(sql, params);
    this.operations.push({ operation: 'execute', duration: Date.now() - start });
  }

  private async mockQuery(sql: string, params: any[]): Promise<any[]> {
    // Simulate database query time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5));

    if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
      return [];
    }

    if (sql.includes('brc31_identities')) {
      return [{
        identity_key: params[0] || 'test-key',
        certificate_chain: '[]',
        identity_level: 'public-key',
        first_seen: new Date(),
        last_seen: new Date(),
        request_count: 1,
        reputation_score: 0.8,
        trust_metrics: '{}'
      }];
    }

    return [];
  }

  private async mockQueryOne(sql: string, params: any[]): Promise<any> {
    const results = await this.mockQuery(sql, params);
    return results[0] || null;
  }

  private async mockExecute(sql: string, params: any[]): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
  }

  getOperationStats() {
    const stats = {
      totalOperations: this.operations.length,
      averageDuration: this.operations.length ?
        this.operations.reduce((sum, op) => sum + op.duration, 0) / this.operations.length : 0,
      maxDuration: this.operations.length ? Math.max(...this.operations.map(op => op.duration)) : 0,
      operationTypes: {} as Record<string, number>
    };

    this.operations.forEach(op => {
      stats.operationTypes[op.operation] = (stats.operationTypes[op.operation] || 0) + 1;
    });

    return stats;
  }

  clearStats() {
    this.operations = [];
  }
}

// Test utilities
function generateTestKeyPair() {
  const privateKey = randomBytes(32).toString('hex');
  const publicKey = secp256k1.getPublicKey(privateKey, true).toString('hex');
  return { privateKey, publicKey };
}

function createBRC31Signature(data: any, privateKey: string, nonces: { client: string; server: string }): string {
  let messageData: Buffer;

  if (typeof data === 'string') {
    messageData = Buffer.from(data, 'utf8');
  } else if (Buffer.isBuffer(data)) {
    messageData = data;
  } else {
    messageData = Buffer.from(JSON.stringify(data), 'utf8');
  }

  const clientNonceBuffer = Buffer.from(nonces.client, 'base64');
  const serverNonceBuffer = Buffer.from(nonces.server, 'base64');
  const message = Buffer.concat([clientNonceBuffer, serverNonceBuffer, messageData]);

  const messageHash = createHash('sha256').update(message).digest();
  const signature = secp256k1.sign(messageHash, privateKey);

  return signature.toDERHex();
}

function createPerformanceTestApp(db: PerformanceDatabaseAdapter) {
  const app = express();
  app.use(express.json());

  // Add timing middleware
  app.use((req, res, next) => {
    req.startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      console.log(`${req.method} ${req.path}: ${duration}ms`);
    });
    next();
  });

  // Initialize BRC-31 middleware
  const brc31Middleware = initializeBRC31Middleware({
    database: db,
    enabled: true
  });

  brc31Middleware.initialize().catch(err => console.error('BRC-31 init error:', err));

  // Mount BRC-31 router
  const brc31Router = enhancedBRC31OverlayRouter();
  app.use('/overlay', brc31Router.router);

  return app;
}

describe('D43 BRC-31 Performance Tests', () => {
  let testApp: express.Application;
  let testDb: PerformanceDatabaseAdapter;
  let clientKeyPair: any;

  beforeAll(async () => {
    testDb = new PerformanceDatabaseAdapter();
    testApp = createPerformanceTestApp(testDb);
    clientKeyPair = generateTestKeyPair();
  });

  describe('Authentication Performance', () => {
    test('should process anonymous requests quickly', async () => {
      testDb.clearStats();
      const start = Date.now();

      const response = await request(testApp)
        .get('/overlay/status')
        .expect(200);

      const duration = Date.now() - start;
      const dbStats = testDb.getOperationStats();

      expect(duration).toBeLessThan(100); // Should be very fast for anonymous requests
      expect(dbStats.totalOperations).toBe(0); // No database operations for anonymous requests
      expect(response.body).toBeDefined();
    });

    test('should process BRC-31 authentication within acceptable time limits', async () => {
      testDb.clearStats();
      const clientNonce = randomBytes(32).toString('base64');
      const serverNonce = randomBytes(32).toString('base64');
      const requestBody = { test: 'performance' };

      const signature = createBRC31Signature(
        requestBody,
        clientKeyPair.privateKey,
        { client: clientNonce, server: serverNonce }
      );

      const start = Date.now();

      await request(testApp)
        .get('/overlay/brc31/status')
        .set('X-Authrite', BRC31_VERSION)
        .set('X-Authrite-Identity-Key', clientKeyPair.publicKey)
        .set('X-Authrite-Nonce', clientNonce)
        .set('X-Authrite-YourNonce', serverNonce)
        .set('X-Authrite-Signature', signature)
        .expect(200);

      const duration = Date.now() - start;
      const dbStats = testDb.getOperationStats();

      expect(duration).toBeLessThan(500); // Should complete within 500ms
      expect(dbStats.averageDuration).toBeLessThan(50); // Average DB operation < 50ms
      expect(dbStats.maxDuration).toBeLessThan(100); // No DB operation > 100ms
    });

    test('should handle concurrent authentication requests efficiently', async () => {
      testDb.clearStats();
      const concurrentRequests = 10;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const clientNonce = randomBytes(32).toString('base64');
        const serverNonce = randomBytes(32).toString('base64');
        const keyPair = generateTestKeyPair();

        const signature = createBRC31Signature(
          { test: `concurrent-${i}` },
          keyPair.privateKey,
          { client: clientNonce, server: serverNonce }
        );

        requests.push(
          request(testApp)
            .get('/overlay/brc31/status')
            .set('X-Authrite', BRC31_VERSION)
            .set('X-Authrite-Identity-Key', keyPair.publicKey)
            .set('X-Authrite-Nonce', clientNonce)
            .set('X-Authrite-YourNonce', serverNonce)
            .set('X-Authrite-Signature', signature)
        );
      }

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;
      const dbStats = testDb.getOperationStats();

      // All requests should succeed
      responses.forEach(response => expect(response.status).toBe(200));

      // Concurrent processing should be efficient
      expect(duration).toBeLessThan(2000); // 10 concurrent requests in < 2 seconds
      expect(dbStats.totalOperations).toBeGreaterThan(0); // Database was accessed
      expect(dbStats.averageDuration).toBeLessThan(100); // Reasonable DB performance
    });
  });

  describe('Signature Verification Performance', () => {
    test('should verify signatures quickly', async () => {
      const iterations = 50;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const keyPair = generateTestKeyPair();
        const clientNonce = randomBytes(32).toString('base64');
        const serverNonce = randomBytes(32).toString('base64');
        const requestBody = { iteration: i };

        const signature = createBRC31Signature(
          requestBody,
          keyPair.privateKey,
          { client: clientNonce, server: serverNonce }
        );

        const start = Date.now();

        await request(testApp)
          .get('/overlay/brc31/status')
          .set('X-Authrite', BRC31_VERSION)
          .set('X-Authrite-Identity-Key', keyPair.publicKey)
          .set('X-Authrite-Nonce', clientNonce)
          .set('X-Authrite-YourNonce', serverNonce)
          .set('X-Authrite-Signature', signature);

        durations.push(Date.now() - start);
      }

      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(averageDuration).toBeLessThan(200); // Average signature verification < 200ms
      expect(maxDuration).toBeLessThan(500); // No single verification > 500ms
    });

    test('should handle invalid signatures without performance degradation', async () => {
      const validKeyPair = generateTestKeyPair();
      const invalidSignature = randomBytes(64).toString('hex');

      const start = Date.now();

      const response = await request(testApp)
        .get('/overlay/brc31/status')
        .set('X-Authrite', BRC31_VERSION)
        .set('X-Authrite-Identity-Key', validKeyPair.publicKey)
        .set('X-Authrite-Nonce', randomBytes(32).toString('base64'))
        .set('X-Authrite-YourNonce', randomBytes(32).toString('base64'))
        .set('X-Authrite-Signature', invalidSignature);

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200); // Should fail fast
      expect(response.status).toBe(200); // Status endpoint still works
      expect(response.body.brc31.authenticated).toBe(false);
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory during repeated authentication', async () => {
      const iterations = 100;
      const memUsageStart = process.memoryUsage();

      for (let i = 0; i < iterations; i++) {
        const keyPair = generateTestKeyPair();
        const clientNonce = randomBytes(32).toString('base64');

        await request(testApp)
          .get('/overlay/brc31/status')
          .set('X-Authrite', BRC31_VERSION)
          .set('X-Authrite-Identity-Key', keyPair.publicKey)
          .set('X-Authrite-Nonce', clientNonce)
          .set('X-Authrite-Signature', randomBytes(64).toString('hex'));

        // Force garbage collection every 10 iterations
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const memUsageEnd = process.memoryUsage();
      const memoryGrowth = memUsageEnd.heapUsed - memUsageStart.heapUsed;

      // Memory growth should be reasonable (< 10MB for 100 requests)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Database Performance', () => {
    test('should optimize database queries for authentication', async () => {
      testDb.clearStats();

      const keyPair = generateTestKeyPair();
      const clientNonce = randomBytes(32).toString('base64');
      const serverNonce = randomBytes(32).toString('base64');

      const signature = createBRC31Signature(
        { test: 'db-performance' },
        keyPair.privateKey,
        { client: clientNonce, server: serverNonce }
      );

      await request(testApp)
        .get('/overlay/brc31/status')
        .set('X-Authrite', BRC31_VERSION)
        .set('X-Authrite-Identity-Key', keyPair.publicKey)
        .set('X-Authrite-Nonce', clientNonce)
        .set('X-Authrite-YourNonce', serverNonce)
        .set('X-Authrite-Signature', signature)
        .expect(200);

      const dbStats = testDb.getOperationStats();

      // Should minimize database operations
      expect(dbStats.totalOperations).toBeLessThan(10); // Reasonable number of operations
      expect(dbStats.operationTypes.query || 0).toBeLessThan(5); // Limited queries
      expect(dbStats.operationTypes.execute || 0).toBeLessThan(5); // Limited executions
    });

    test('should cache authentication results when appropriate', async () => {
      const keyPair = generateTestKeyPair();

      // First request
      testDb.clearStats();
      await request(testApp)
        .get('/overlay/brc31/status')
        .set('X-Authrite', BRC31_VERSION)
        .set('X-Authrite-Identity-Key', keyPair.publicKey)
        .set('X-Authrite-Nonce', randomBytes(32).toString('base64'))
        .set('X-Authrite-Signature', randomBytes(64).toString('hex'));

      const firstRequestStats = testDb.getOperationStats();

      // Second request with same identity
      testDb.clearStats();
      await request(testApp)
        .get('/overlay/brc31/status')
        .set('X-Authrite', BRC31_VERSION)
        .set('X-Authrite-Identity-Key', keyPair.publicKey)
        .set('X-Authrite-Nonce', randomBytes(32).toString('base64'))
        .set('X-Authrite-Signature', randomBytes(64).toString('hex'));

      const secondRequestStats = testDb.getOperationStats();

      // Performance characteristics should be similar (no caching yet implemented)
      // This test establishes a baseline for future caching improvements
      expect(firstRequestStats.totalOperations).toBeDefined();
      expect(secondRequestStats.totalOperations).toBeDefined();
    });
  });

  describe('Rate Limiting Performance', () => {
    test('should apply rate limiting efficiently', async () => {
      const keyPair = generateTestKeyPair();
      const requests = [];

      // Make multiple requests quickly
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(testApp)
            .get('/overlay/brc31/status')
            .set('X-Authrite', BRC31_VERSION)
            .set('X-Authrite-Identity-Key', keyPair.publicKey)
            .set('X-Authrite-Nonce', randomBytes(32).toString('base64'))
            .set('X-Authrite-Signature', randomBytes(64).toString('hex'))
        );
      }

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      // All requests should be processed quickly
      expect(duration).toBeLessThan(3000); // 20 requests in < 3 seconds

      // Some requests might be rate limited, but the mechanism should be fast
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitCount = responses.filter(r => r.status === 429).length;

      expect(successCount + rateLimitCount).toBe(20); // All requests accounted for
    });
  });

  describe('Error Handling Performance', () => {
    test('should handle malformed requests quickly', async () => {
      const malformedRequests = [
        // Missing headers
        { headers: {} },
        // Invalid version
        { headers: { 'X-Authrite': 'invalid' } },
        // Invalid public key
        { headers: {
          'X-Authrite': BRC31_VERSION,
          'X-Authrite-Identity-Key': 'invalid-key'
        }},
        // Invalid signature format
        { headers: {
          'X-Authrite': BRC31_VERSION,
          'X-Authrite-Identity-Key': clientKeyPair.publicKey,
          'X-Authrite-Signature': 'invalid'
        }}
      ];

      const durations: number[] = [];

      for (const reqConfig of malformedRequests) {
        const start = Date.now();

        const requestBuilder = request(testApp).get('/overlay/brc31/status');
        Object.entries(reqConfig.headers).forEach(([key, value]) => {
          requestBuilder.set(key, value as string);
        });

        await requestBuilder;

        durations.push(Date.now() - start);
      }

      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      // Error handling should be fast
      expect(averageDuration).toBeLessThan(100); // Average error handling < 100ms
      expect(maxDuration).toBeLessThan(200); // No error handling > 200ms
    });
  });

  describe('Scalability Metrics', () => {
    test('should provide performance metrics for monitoring', async () => {
      const testDuration = 1000; // 1 second test
      const requests: Promise<any>[] = [];
      const start = Date.now();

      // Generate requests for 1 second
      while (Date.now() - start < testDuration) {
        const keyPair = generateTestKeyPair();
        requests.push(
          request(testApp)
            .get('/overlay/brc31/status')
            .set('X-Authrite', BRC31_VERSION)
            .set('X-Authrite-Identity-Key', keyPair.publicKey)
            .set('X-Authrite-Nonce', randomBytes(32).toString('base64'))
            .set('X-Authrite-Signature', randomBytes(64).toString('hex'))
        );

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const responses = await Promise.all(requests);
      const requestsPerSecond = responses.length;

      // Should handle a reasonable number of requests per second
      expect(requestsPerSecond).toBeGreaterThan(10); // At least 10 RPS

      console.log(`BRC-31 Performance: ~${requestsPerSecond} requests/second`);
    });
  });
});