import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { Readable } from 'stream';
import { initSchema } from '../../src/db';
import { createStorageDriver, FilesystemStorageDriver, calculateContentHash } from '../../src/storage';
import { StorageLifecycleManager, createStorageEventsMigration } from '../../src/storage/lifecycle';
import { StorageMigrator } from '../../src/storage/migration';
import { dataRouter } from '../../src/routes/data';
import { storageRouter } from '../../src/routes/storage';
import { runPaymentsMigrations } from '../../src/payments';

describe('D22 Storage Backend Integration Tests', () => {
  let app: express.Application;
  let db: Database.Database;
  let storage: FilesystemStorageDriver;

  beforeEach(async () => {
    // Fresh in-memory database
    db = new Database(':memory:');
    initSchema(db);
    runPaymentsMigrations(db);
    createStorageEventsMigration(db);

    // Create filesystem storage driver for testing
    storage = new FilesystemStorageDriver({
      backend: 'fs',
      cdn: { mode: 'off' },
      presignTtlSec: 3600,
      defaultTier: 'hot',
      maxRangeBytes: 16777216,
      dataRoot: './test-data'
    });

    // Setup Express app
    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use(dataRouter(db));
    app.use(storageRouter(db));

    // Setup test data
    db.prepare(`INSERT INTO producers (producer_id, name, identity_key, payout_script_hex, created_at)
               VALUES (?, ?, ?, ?, ?)`).run('prod-1', 'Test Producer', 'test-key', '76a914deadbeef88ac', Date.now());

    db.prepare(`INSERT INTO manifests (version_id, manifest_hash, content_hash, dataset_id, producer_id, manifest_json)
               VALUES (?, ?, ?, ?, ?, ?)`).run(
      'ver-1', 'hash1', 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de', 'dataset-1', 'prod-1',
      JSON.stringify({ type: 'datasetVersionManifest', datasetId: 'dataset-1' })
    );

    db.prepare(`INSERT INTO receipts (receipt_id, version_id, quantity, amount_sat, status, created_at, expires_at, bytes_used, last_seen, content_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'receipt-1', 'ver-1', 1, 5000, 'paid', Date.now(), Date.now() + 3600000, 0, null,
      'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de'
    );

    // Create test content in storage
    const testContent = Buffer.from('Hello, D22 Storage World!');
    const contentHash = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de';
    await storage.putObject(contentHash, testContent, 'hot');
  });

  afterEach(async () => {
    try {
      // Cleanup test data
      await storage.deleteObject('abc123def456abc123def456abc123def456abc123def456abc123def456abc123de', 'hot');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Storage Driver Core Functionality', () => {
    test('should store and retrieve objects', async () => {
      const testData = Buffer.from('Test storage data');
      const contentHash = await calculateContentHash(testData);

      // Store object
      await storage.putObject(contentHash, testData, 'hot');

      // Verify existence
      const exists = await storage.objectExists(contentHash, 'hot');
      expect(exists).toBe(true);

      // Retrieve object
      const { data, metadata } = await storage.getObject(contentHash, 'hot');

      // Read stream data
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(chunk);
      }
      const retrieved = Buffer.concat(chunks);

      expect(retrieved.equals(testData)).toBe(true);
      expect(metadata.tier).toBe('hot');
      expect(metadata.contentLength).toBe(testData.length);
    });

    test('should handle range requests', async () => {
      const testData = Buffer.from('0123456789ABCDEF');
      const contentHash = await calculateContentHash(testData);

      await storage.putObject(contentHash, testData, 'hot');

      // Request bytes 5-10
      const { data } = await storage.getObject(contentHash, 'hot', { start: 5, end: 10 });

      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(chunk);
      }
      const retrieved = Buffer.concat(chunks);

      expect(retrieved.toString()).toBe('56789A');
    });

    test('should move objects between tiers', async () => {
      const testData = Buffer.from('Tier migration test');
      const contentHash = await calculateContentHash(testData);

      // Store in hot tier
      await storage.putObject(contentHash, testData, 'hot');
      expect(await storage.objectExists(contentHash, 'hot')).toBe(true);

      // Move to warm tier
      await storage.moveObject(contentHash, 'hot', 'warm');
      expect(await storage.objectExists(contentHash, 'hot')).toBe(false);
      expect(await storage.objectExists(contentHash, 'warm')).toBe(true);
    });

    test('should generate presigned URLs', async () => {
      const testData = Buffer.from('Presigned URL test');
      const contentHash = await calculateContentHash(testData);

      await storage.putObject(contentHash, testData, 'hot');

      const presignedUrl = await storage.getPresignedUrl(contentHash, 'hot');

      expect(presignedUrl.url).toContain(contentHash);
      expect(presignedUrl.expiresAt).toBeGreaterThan(Date.now());
    });

    test('should perform health checks', async () => {
      const health = await storage.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThan(0);
    });

    test('should list objects in tiers', async () => {
      const testData1 = Buffer.from('Object 1');
      const testData2 = Buffer.from('Object 2');
      const hash1 = await calculateContentHash(testData1);
      const hash2 = await calculateContentHash(testData2);

      await storage.putObject(hash1, testData1, 'hot');
      await storage.putObject(hash2, testData2, 'hot');

      const objects = await storage.listObjects('hot');

      expect(objects.length).toBeGreaterThanOrEqual(2);
      const hashes = objects.map(o => o.contentHash);
      expect(hashes).toContain(hash1);
      expect(hashes).toContain(hash2);
    });
  });

  describe('Modernized Data Endpoint', () => {
    test('should return presigned URL by default', async () => {
      // Mock environment for presigned mode
      process.env.DATA_DELIVERY_MODE = 'presigned';

      const response = await request(app)
        .get('/v1/data')
        .query({
          contentHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de',
          receiptId: 'receipt-1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.delivery.method).toBe('presigned-url');
      expect(response.body.delivery.url).toBeTruthy();
      expect(response.body.metadata.contentHash).toBe('abc123def456abc123def456abc123def456abc123def456abc123def456abc123de');
    });

    test('should redirect when redirect=true', async () => {
      process.env.DATA_DELIVERY_MODE = 'presigned';

      const response = await request(app)
        .get('/v1/data')
        .query({
          contentHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de',
          receiptId: 'receipt-1',
          redirect: 'true'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBeTruthy();
    });

    test('should stream data when presigned fails', async () => {
      process.env.DATA_DELIVERY_MODE = 'stream';

      const response = await request(app)
        .get('/v1/data')
        .query({
          contentHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de',
          receiptId: 'receipt-1'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/octet-stream');
      expect(response.headers['x-storage-tier']).toBe('hot');
      expect(response.text).toBe('Hello, D22 Storage World!');
    });

    test('should handle range requests in stream mode', async () => {
      process.env.DATA_DELIVERY_MODE = 'stream';

      const response = await request(app)
        .get('/v1/data')
        .set('Range', 'bytes=0-4')
        .query({
          contentHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de',
          receiptId: 'receipt-1'
        });

      expect(response.status).toBe(206);
      expect(response.headers['content-range']).toBeTruthy();
      expect(response.text).toBe('Hello');
    });
  });

  describe('Storage Lifecycle Management', () => {
    test('should analyze tiering decisions', async () => {
      const lifecycle = new StorageLifecycleManager(storage, db);

      // Create some test access patterns
      db.prepare(`
        INSERT INTO receipts (receipt_id, version_id, quantity, amount_sat, status, created_at, expires_at, bytes_used, last_seen, content_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'receipt-old', 'ver-1', 1, 5000, 'paid',
        Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        Date.now() + 3600000, 1000,
        Date.now() - 5 * 24 * 60 * 60 * 1000, // Last seen 5 days ago
        'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de'
      );

      const result = await lifecycle.runTieringJob();

      expect(result.moved).toBeGreaterThanOrEqual(0);
      expect(result.skipped).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBe(0);
    });

    test('should get storage statistics', async () => {
      const lifecycle = new StorageLifecycleManager(storage, db);

      const stats = await lifecycle.getStorageStats();

      expect(stats.tierBreakdown).toBeDefined();
      expect(stats.tierBreakdown.hot).toBeDefined();
      expect(stats.tierBreakdown.hot.objectCount).toBeGreaterThanOrEqual(1);
      expect(stats.recentMoves).toBeGreaterThanOrEqual(0);
    });

    test('should cleanup expired content', async () => {
      const lifecycle = new StorageLifecycleManager(storage, db, {
        deleteAfterDays: 1,
        orphanCleanupEnabled: true
      });

      const result = await lifecycle.cleanupExpiredContent();

      expect(result.deleted).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('Storage Migration', () => {
    test('should discover objects for migration', async () => {
      // Create another storage driver as target
      const targetStorage = new FilesystemStorageDriver({
        backend: 'fs',
        cdn: { mode: 'off' },
        presignTtlSec: 3600,
        defaultTier: 'hot',
        maxRangeBytes: 16777216,
        dataRoot: './test-data-target'
      });

      const migrator = new StorageMigrator(storage, targetStorage, {
        batchSize: 10,
        parallelTransfers: 2,
        verifyChecksums: true,
        deleteSourceAfterCopy: false
      });

      // Test discovery without actual migration
      const allObjects = await (migrator as any).discoverAllObjects();

      expect(allObjects).toBeDefined();
      expect(Array.isArray(allObjects)).toBe(true);
      expect(allObjects.length).toBeGreaterThanOrEqual(1);

      const hasTestObject = allObjects.some(obj =>
        obj.contentHash === 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de'
      );
      expect(hasTestObject).toBe(true);
    });

    test('should verify migration integrity', async () => {
      const targetStorage = new FilesystemStorageDriver({
        backend: 'fs',
        cdn: { mode: 'off' },
        presignTtlSec: 3600,
        defaultTier: 'hot',
        maxRangeBytes: 16777216,
        dataRoot: './test-data-target'
      });

      // Copy the test object to target
      const testContent = Buffer.from('Hello, D22 Storage World!');
      const contentHash = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de';
      await targetStorage.putObject(contentHash, testContent, 'hot');

      const migrator = new StorageMigrator(storage, targetStorage);
      const results = await migrator.verifyMigration();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      const testResult = results.find(r => r.contentHash === contentHash);
      expect(testResult).toBeDefined();
      expect(testResult?.status).toBe('verified');

      // Cleanup
      await targetStorage.deleteObject(contentHash, 'hot');
    });
  });

  describe('Storage Monitoring Routes', () => {
    test('GET /v1/storage/health should return health status', async () => {
      const response = await request(app)
        .get('/v1/storage/health');

      expect(response.status).toBe(200);
      expect(response.body.healthy).toBe(true);
      expect(response.body.storage.backend).toBe('fs');
      expect(response.body.storage.tiers.hot.healthy).toBe(true);
    });

    test('GET /v1/storage/stats should require auth', async () => {
      const response = await request(app)
        .get('/v1/storage/stats');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('unauthorized');
    });

    test('GET /v1/storage/stats should return stats with valid auth', async () => {
      process.env.STORAGE_ADMIN_API_KEY = 'test-key';

      const response = await request(app)
        .get('/v1/storage/stats')
        .set('x-api-key', 'test-key');

      expect(response.status).toBe(200);
      expect(response.body.usage).toBeDefined();
      expect(response.body.performance).toBeDefined();
      expect(response.body.lifecycle).toBeDefined();
      expect(response.body.usage.totalObjects).toBeGreaterThanOrEqual(1);

      delete process.env.STORAGE_ADMIN_API_KEY;
    });

    test('POST /v1/storage/tier should move objects manually', async () => {
      process.env.STORAGE_ADMIN_API_KEY = 'test-key';

      // First store object in warm tier
      const testData = Buffer.from('Manual tier test');
      const contentHash = await calculateContentHash(testData);
      await storage.putObject(contentHash, testData, 'warm');

      const response = await request(app)
        .post('/v1/storage/tier')
        .set('x-api-key', 'test-key')
        .send({
          contentHash,
          fromTier: 'warm',
          toTier: 'cold'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.fromTier).toBe('warm');
      expect(response.body.toTier).toBe('cold');

      // Verify the move
      expect(await storage.objectExists(contentHash, 'warm')).toBe(false);
      expect(await storage.objectExists(contentHash, 'cold')).toBe(true);

      // Cleanup
      await storage.deleteObject(contentHash, 'cold');
      delete process.env.STORAGE_ADMIN_API_KEY;
    });

    test('POST /v1/storage/lifecycle should trigger operations', async () => {
      process.env.STORAGE_ADMIN_API_KEY = 'test-key';

      const response = await request(app)
        .post('/v1/storage/lifecycle')
        .set('x-api-key', 'test-key')
        .send({ operation: 'stats' });

      expect(response.status).toBe(200);
      expect(response.body.operation).toBe('stats');
      expect(response.body.result.tierBreakdown).toBeDefined();

      delete process.env.STORAGE_ADMIN_API_KEY;
    });
  });

  describe('Error Handling', () => {
    test('should handle missing objects gracefully', async () => {
      const response = await request(app)
        .get('/v1/data')
        .query({
          contentHash: 'nonexistent123456789012345678901234567890123456789012345678901234',
          receiptId: 'receipt-1'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not-found');
    });

    test('should handle invalid content hashes', async () => {
      const response = await request(app)
        .get('/v1/data')
        .query({
          contentHash: 'invalid-hash',
          receiptId: 'receipt-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('bad-request');
    });

    test('should handle expired receipts', async () => {
      db.prepare(`UPDATE receipts SET expires_at = ? WHERE receipt_id = ?`)
        .run(Date.now() - 1000, 'receipt-1'); // Expired 1 second ago

      const response = await request(app)
        .get('/v1/data')
        .query({
          contentHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de',
          receiptId: 'receipt-1'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('expired');
    });
  });

  console.log('✅ D22 Storage Backend integration tests completed.');
});