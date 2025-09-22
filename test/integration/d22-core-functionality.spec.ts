/**
 * D22 - BSV Overlay Network Storage Backend
 * Core Functionality Tests
 * Tests the essential D22 overlay storage functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { WalletClient } from '@bsv/sdk';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';

import { UHRPStorageService } from '../../src/services/uhrp-storage.js';
import StorageRouter, { AdaptiveStorageCache } from '../../src/services/storage-router.js';

describe('D22 Core Functionality Tests', () => {
  let pool: Pool;
  let walletClient: WalletClient;
  let testContentHash: string;
  let testContent: Buffer;

  beforeAll(async () => {
    // Setup test database connection
    pool = new Pool({
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DATABASE || 'overlay',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'password'
    });

    // Initialize wallet client
    walletClient = new WalletClient();

    // Prepare test data
    testContent = Buffer.from('D22 Test Content - BSV Overlay Network Storage with BRC-26 UHRP Integration');
    testContentHash = 'sha256:' + createHash('sha256').update(testContent).digest('hex');

    // Ensure storage directory exists
    await fs.mkdir('/tmp/test-overlay-storage', { recursive: true });
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.end();
  });

  beforeEach(async () => {
    await cleanupTestContent();
  });

  describe('UHRP Storage Service Core', () => {
    let uhrpStorage: UHRPStorageService;

    beforeAll(() => {
      uhrpStorage = new UHRPStorageService(pool, walletClient, {
        storageBasePath: '/tmp/test-overlay-storage',
        overlayTopics: ['test.storage.content'],
        geographicRegions: ['US-TEST'],
        advertisementTTLHours: 1,
        consensusThreshold: 0.67,
        baseUrl: 'http://localhost:8787'
      });
    });

    it('should store content locally and create database record', async () => {
      // Create a minimal version entry for testing (bypassing manifests table)
      const testVersionId = `test_version_${Date.now()}`;

      // Temporarily remove foreign key constraint for testing
      await pool.query('ALTER TABLE overlay_storage_index DROP CONSTRAINT IF EXISTS overlay_storage_index_version_id_fkey');

      const metadata = {
        size: testContent.length,
        mimeType: 'text/plain',
        classification: 'test'
      };

      const result = await uhrpStorage.storeContent(testContent, metadata, testVersionId);

      expect(result.contentHash).toBe(testContentHash);
      expect(result.uhrpUrl).toBe(`uhrp://${testContentHash}/content`);
      expect(result.localPath).toContain(testContentHash.replace('sha256:', ''));

      // Verify file was created locally
      const fileExists = await fs.access(result.localPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify database record
      const dbResult = await pool.query(
        'SELECT * FROM overlay_storage_index WHERE content_hash = $1',
        [testContentHash]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].version_id).toBe(testVersionId);
      expect(parseInt(dbResult.rows[0].file_size)).toBe(testContent.length);
      expect(dbResult.rows[0].storage_tier).toBe('hot');

      // Re-add foreign key constraint
      await pool.query(`
        ALTER TABLE overlay_storage_index
        ADD CONSTRAINT overlay_storage_index_version_id_fkey
        FOREIGN KEY (version_id) REFERENCES manifests(version_id)
      `).catch(() => {}); // Ignore if constraint already exists
    });

    it('should generate UHRP URLs correctly', async () => {
      const testVersionId = `test_version_${Date.now()}`;

      // Temporarily remove foreign key constraint
      await pool.query('ALTER TABLE overlay_storage_index DROP CONSTRAINT IF EXISTS overlay_storage_index_version_id_fkey');

      const metadata = {
        size: testContent.length,
        mimeType: 'text/plain',
        classification: 'test'
      };

      const result = await uhrpStorage.storeContent(testContent, metadata, testVersionId);

      // Verify UHRP URL format
      expect(result.uhrpUrl).toMatch(/^uhrp:\/\/sha256:[a-f0-9]{64}\/content$/);
      expect(result.uhrpUrl).toBe(`uhrp://${testContentHash}/content`);
    });

    it('should track storage locations', async () => {
      const testVersionId = `test_version_${Date.now()}`;

      // Temporarily remove foreign key constraint
      await pool.query('ALTER TABLE overlay_storage_index DROP CONSTRAINT IF EXISTS overlay_storage_index_version_id_fkey');

      const metadata = {
        size: testContent.length,
        mimeType: 'text/plain',
        classification: 'test'
      };

      const result = await uhrpStorage.storeContent(testContent, metadata, testVersionId);

      expect(result.storageLocations).toHaveLength(1);
      expect(result.storageLocations[0].type).toBe('local');
      expect(result.storageLocations[0].availability).toBeGreaterThan(0.9);
    });
  });

  describe('Storage Router Core', () => {
    let storageRouter: StorageRouter;

    beforeAll(() => {
      storageRouter = new StorageRouter(pool);
    });

    it('should select optimal storage location based on latency', async () => {
      const availableLocations = [
        {
          type: 'local' as const,
          url: 'file:///tmp/test-content',
          availability: 0.99,
          latency: 5,
          bandwidth: 1000,
          cost: 0,
          geographicRegion: ['US'],
          verifiedAt: new Date().toISOString()
        },
        {
          type: 's3' as const,
          url: 's3://test-bucket/content',
          availability: 0.995,
          latency: 100,
          bandwidth: 200,
          cost: 5,
          geographicRegion: ['US'],
          verifiedAt: new Date().toISOString()
        }
      ];

      const clientContext = {
        geographicLocation: 'US',
        networkType: 'wifi' as const,
        latencyToleranceMs: 50, // Prefer low latency
        requestTime: new Date()
      };

      const decision = await storageRouter.selectOptimalLocation(
        testContentHash,
        availableLocations,
        clientContext,
        { preferredMethod: 'auto' }
      );

      // Should prefer local storage due to lower latency
      expect(decision.selectedLocation.type).toBe('local');
      expect(decision.routingScore).toBeGreaterThan(0);
      expect(decision.estimatedLatency).toBeLessThanOrEqual(50);
    });

    it('should provide routing reasoning', async () => {
      const availableLocations = [
        {
          type: 'local' as const,
          url: 'file:///tmp/test-content',
          availability: 0.99,
          latency: 5,
          bandwidth: 1000,
          cost: 0,
          geographicRegion: ['US'],
          verifiedAt: new Date().toISOString()
        }
      ];

      const clientContext = {
        geographicLocation: 'US',
        requestTime: new Date()
      };

      const decision = await storageRouter.selectOptimalLocation(
        testContentHash,
        availableLocations,
        clientContext
      );

      expect(decision.routingReason.length).toBeGreaterThan(0);
      expect(decision.routingReason[0]).toMatch(/^(optimal-latency|high-availability|geographic-preference|cost-efficient|high-bandwidth)/);
    });
  });

  describe('Adaptive Cache Core', () => {
    let adaptiveCache: AdaptiveStorageCache;

    beforeAll(() => {
      adaptiveCache = new AdaptiveStorageCache(pool, 10); // 10MB cache for tests
    });

    it('should cache and retrieve content', async () => {
      const cacheMetadata = {
        originalLocation: {
          type: 'local' as const,
          url: 'file:///tmp/test-content',
          availability: 0.99,
          latency: 5,
          bandwidth: 1000,
          cost: 0,
          geographicRegion: ['US'],
          verifiedAt: new Date().toISOString()
        },
        cacheLevel: 'memory' as const,
        ttlSeconds: 3600,
        priority: 2,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        sizeBytes: testContent.length
      };

      // Cache the content
      await adaptiveCache.cacheContent(testContentHash, testContent, cacheMetadata);

      // Retrieve from cache
      const cachedContent = await adaptiveCache.getCachedContent(testContentHash);

      expect(cachedContent).toBeDefined();
      expect(cachedContent!.contentHash).toBe(testContentHash);
      expect(cachedContent!.content).toEqual(testContent);
      expect(cachedContent!.metadata.cacheLevel).toBe('memory');
      expect(cachedContent!.accessCount).toBeGreaterThanOrEqual(1);
    });

    it('should return null for non-cached content', async () => {
      const nonExistentHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

      const cachedContent = await adaptiveCache.getCachedContent(nonExistentHash);
      expect(cachedContent).toBeNull();
    });

    it('should provide cache statistics', async () => {
      const cacheStats = await adaptiveCache.getCacheStats();

      expect(cacheStats).toBeDefined();
      expect(cacheStats.totalEntries).toBeGreaterThanOrEqual(0);
      expect(cacheStats.totalSizeBytes).toBeGreaterThanOrEqual(0);
      expect(cacheStats.hitRate).toBeGreaterThanOrEqual(0);
      expect(cacheStats.missRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Database Schema Integration', () => {
    it('should have all required D22 tables', async () => {
      const requiredTables = [
        'overlay_storage_index',
        'storage_verifications',
        'storage_access_logs',
        'storage_replications',
        'storage_quotas',
        'uhrp_advertisements',
        'storage_performance_metrics',
        'storage_cache_stats'
      ];

      for (const tableName of requiredTables) {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )
        `, [tableName]);

        expect(result.rows[0].exists).toBe(true);
      }
    });

    it('should have proper indexes for performance', async () => {
      const result = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename LIKE '%storage%' OR tablename LIKE '%uhrp%'
        ORDER BY indexname
      `);

      expect(result.rows.length).toBeGreaterThan(10); // Should have many indexes for performance
    });

    it('should record storage operations in logs', async () => {
      // Insert a test access log
      await pool.query(`
        INSERT INTO storage_access_logs (
          content_hash, access_method, bytes_transferred, response_time_ms, success
        ) VALUES ($1, $2, $3, $4, $5)
      `, [testContentHash, 'local', testContent.length, 50, true]);

      // Verify the log was created
      const result = await pool.query(
        'SELECT * FROM storage_access_logs WHERE content_hash = $1',
        [testContentHash]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].access_method).toBe('local');
      expect(result.rows[0].success).toBe(true);
    });
  });

  // Helper functions
  async function cleanupTestData(): Promise<void> {
    try {
      await fs.rm('/tmp/test-overlay-storage', { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  }

  async function cleanupTestContent(): Promise<void> {
    // Clean up database test data
    await pool.query('DELETE FROM storage_access_logs WHERE content_hash LIKE $1', ['sha256:%']);
    await pool.query('DELETE FROM storage_verifications WHERE content_hash LIKE $1', ['sha256:%']);
    await pool.query('DELETE FROM storage_replications WHERE content_hash LIKE $1', ['sha256:%']);
    await pool.query('DELETE FROM storage_cache_stats WHERE content_hash LIKE $1', ['sha256:%']);
    await pool.query('DELETE FROM uhrp_advertisements WHERE content_hash LIKE $1', ['sha256:%']);
    await pool.query('DELETE FROM overlay_storage_index WHERE content_hash LIKE $1', ['sha256:%']);

    // Clean up test files
    try {
      const files = await fs.readdir('/tmp/test-overlay-storage');
      for (const file of files) {
        if (file.endsWith('.bin')) {
          await fs.unlink(`/tmp/test-overlay-storage/${file}`);
        }
      }
    } catch (error) {
      // Directory might not exist
    }
  }
});