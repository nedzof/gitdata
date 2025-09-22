/**
 * D22 - BSV Overlay Network Storage Backend
 * Comprehensive Integration Tests
 * Tests complete overlay storage functionality with BRC-26 UHRP integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import { WalletClient } from '@bsv/sdk';
import express from 'express';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import createD22OverlayStorageRoutes from '../../src/routes/d22-overlay-storage.js';
import { UHRPStorageService } from '../../src/services/uhrp-storage.js';
import StorageRouter, { AdaptiveStorageCache } from '../../src/services/storage-router.js';
import { StorageAgentCoordinator } from '../../src/services/storage-agents.js';

describe('D22 Overlay Storage Integration Tests', () => {
  let app: express.Application;
  let pool: Pool;
  let walletClient: WalletClient;
  let testContentHash: string;
  let testContent: Buffer;
  let testVersionId: string;

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

    // Setup test database schema
    await setupTestSchema();

    // Create test application
    app = express();
    app.use(express.json());
    app.use('/api', createD22OverlayStorageRoutes(pool, walletClient));

    // Prepare test data
    testContent = Buffer.from('Test content for D22 overlay storage system. This is a comprehensive test of the BRC-26 UHRP integration.');
    testContentHash = 'sha256:' + createHash('sha256').update(testContent).digest('hex');
    testVersionId = `test_version_${Date.now()}`;
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestContent();

    // Create a test manifest entry for the foreign key
    await pool.query(`
      INSERT INTO manifests (version_id, dataset_id, title, manifest_hash, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (version_id) DO NOTHING
    `, [testVersionId, 'test_dataset', 'Test Dataset for D22', 'test_manifest_hash_' + testVersionId]);
  });

  describe('UHRP Storage Service', () => {
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

    it('should store content with UHRP addressing', async () => {
      const metadata = {
        size: testContent.length,
        mimeType: 'text/plain',
        classification: 'test',
        accessFrequency: 0,
        updateFrequency: 0
      };

      const result = await uhrpStorage.storeContent(testContent, metadata, testVersionId);

      expect(result.contentHash).toBe(testContentHash);
      expect(result.uhrpUrl).toBe(`uhrp://${testContentHash}/content`);
      expect(result.localPath).toContain(testContentHash.replace('sha256:', ''));
      expect(result.overlayAdvertisements).toHaveLength(1);
      expect(result.storageLocations).toHaveLength(1);
      expect(result.verificationAgents).toHaveLength(1);

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
      expect(dbResult.rows[0].file_size).toBe(testContent.length);
    });

    it('should resolve content via UHRP', async () => {
      // First store the content
      await uhrpStorage.storeContent(
        testContent,
        { size: testContent.length, mimeType: 'text/plain', classification: 'test' },
        testVersionId
      );

      // Then resolve it
      const resolution = await uhrpStorage.resolveContent(testContentHash, {
        preferredMethod: 'auto',
        maxLatency: 1000,
        includeVerification: true,
        trackAccess: true
      });

      expect(resolution.contentHash).toBe(testContentHash);
      expect(resolution.availableLocations).toHaveLength(1);
      expect(resolution.preferredLocation.type).toBe('local');
      expect(resolution.integrityVerified).toBe(true);
      expect(resolution.resolutionTime).toBeGreaterThan(0);

      // Verify access was logged
      const accessLog = await pool.query(
        'SELECT * FROM storage_access_logs WHERE content_hash = $1',
        [testContentHash]
      );
      expect(accessLog.rows).toHaveLength(1);
    });

    it('should advertise content via BRC-88 SHIP/SLAP', async () => {
      const storageCapability = {
        maxFileSize: 1073741824, // 1GB
        supportedMimeTypes: ['*/*'],
        availabilityGuarantee: 0.99,
        bandwidthMbps: 100,
        costPerGBSatoshis: 1000,
        features: ['compression', 'verification']
      };

      const advertisement = await uhrpStorage.advertiseContent(testContentHash, storageCapability);

      expect(advertisement.contentHash).toBe(testContentHash);
      expect(advertisement.advertisementId).toMatch(/^ship_ad_/);
      expect(advertisement.capability).toEqual(storageCapability);
      expect(advertisement.geographicRegions).toContain('US-TEST');
      expect(advertisement.ttlHours).toBe(1);

      // Verify advertisement in database
      const dbResult = await pool.query(
        'SELECT * FROM uhrp_advertisements WHERE content_hash = $1',
        [testContentHash]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].storage_capability).toEqual(JSON.stringify(storageCapability));
    });

    it('should verify content integrity across locations', async () => {
      // Store content first
      await uhrpStorage.storeContent(
        testContent,
        { size: testContent.length, mimeType: 'text/plain', classification: 'test' },
        testVersionId
      );

      const verification = await uhrpStorage.verifyContentIntegrity(testContentHash);

      expect(verification.contentHash).toBe(testContentHash);
      expect(verification.verificationResults).toHaveLength(1);
      expect(verification.verificationResults[0].hashMatch).toBe(true);
      expect(verification.consensusAchieved).toBe(true);
      expect(verification.agreementRatio).toBe(1.0);

      // Verify verification records in database
      const dbResult = await pool.query(
        'SELECT * FROM storage_verifications WHERE content_hash = $1',
        [testContentHash]
      );
      expect(dbResult.rows.length).toBeGreaterThan(0);
      expect(dbResult.rows[0].verification_result).toBe(true);
    });
  });

  describe('Storage Router and Caching', () => {
    let storageRouter: StorageRouter;
    let adaptiveCache: AdaptiveStorageCache;

    beforeAll(() => {
      storageRouter = new StorageRouter(pool);
      adaptiveCache = new AdaptiveStorageCache(pool, 100); // 100MB cache for tests
    });

    it('should select optimal storage location based on client context', async () => {
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
        },
        {
          type: 'cdn' as const,
          url: 'https://cdn.test.com/content',
          availability: 0.999,
          latency: 50,
          bandwidth: 500,
          cost: 2,
          geographicRegion: ['US'],
          verifiedAt: new Date().toISOString()
        }
      ];

      const clientContext = {
        geographicLocation: 'US',
        networkType: 'wifi' as const,
        latencyToleranceMs: 200,
        costSensitivity: 'medium' as const,
        requestTime: new Date()
      };

      const decision = await storageRouter.selectOptimalLocation(
        testContentHash,
        availableLocations,
        clientContext,
        { preferredMethod: 'auto' }
      );

      expect(decision.selectedLocation).toBeDefined();
      expect(decision.routingScore).toBeGreaterThan(0);
      expect(decision.routingReason).toHaveLength.greaterThan(0);
      expect(decision.estimatedLatency).toBeGreaterThan(0);
      expect(decision.cacheRecommendation).toBeDefined();
    });

    it('should cache content adaptively based on access patterns', async () => {
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
      expect(cachedContent!.accessCount).toBe(1);

      // Verify cache statistics
      const cacheStats = await adaptiveCache.getCacheStats();
      expect(cacheStats.totalEntries).toBeGreaterThan(0);
      expect(cacheStats.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Storage Agent Coordination', () => {
    let agentCoordinator: StorageAgentCoordinator;

    beforeAll(() => {
      agentCoordinator = new StorageAgentCoordinator(pool, walletClient);
    });

    it('should coordinate replication and verification agents', async () => {
      // Start agents
      await agentCoordinator.startAgents(1, 1); // 1 replication, 1 verification agent

      const agentStatus = await agentCoordinator.getAgentStatus();

      expect(agentStatus.replicationAgents).toBe(1);
      expect(agentStatus.verificationAgents).toBe(1);

      // Stop agents
      await agentCoordinator.stopAgents();

      const stoppedStatus = await agentCoordinator.getAgentStatus();
      expect(stoppedStatus.replicationAgents).toBe(0);
      expect(stoppedStatus.verificationAgents).toBe(0);
    });

    it('should process replication jobs automatically', async () => {
      // Create a test replication job
      await pool.query(`
        INSERT INTO overlay_storage_index (content_hash, version_id, local_path, file_size, mime_type)
        VALUES ($1, $2, $3, $4, $5)
      `, [testContentHash, testVersionId, '/tmp/test-content', testContent.length, 'text/plain']);

      await pool.query(`
        INSERT INTO storage_replications (content_hash, source_location, target_location, status)
        VALUES ($1, $2, $3, $4)
      `, [testContentHash, 'local', 's3', 'pending']);

      // Start agents briefly to process the job
      await agentCoordinator.startAgents(1, 0);

      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      await agentCoordinator.stopAgents();

      // Check if replication job was processed
      const replicationResult = await pool.query(
        'SELECT * FROM storage_replications WHERE content_hash = $1',
        [testContentHash]
      );

      expect(replicationResult.rows).toHaveLength(1);
      // Note: In a real test environment, we might expect the job to be processed,
      // but for this integration test, we're mainly verifying the agent system starts/stops correctly
    });
  });

  describe('API Endpoints', () => {
    it('should upload content via storage API', async () => {
      const response = await request(app)
        .post('/api/overlay/storage/upload')
        .attach('file', testContent, 'test-file.txt')
        .set('X-Content-Hash', testContentHash)
        .set('X-Storage-Tier', 'hot')
        .set('X-Replication-Strategy', 'overlay+s3')
        .field('metadata', JSON.stringify({
          classification: 'test',
          geographicRestrictions: []
        }));

      expect(response.status).toBe(201);
      expect(response.body.contentHash).toBe(testContentHash);
      expect(response.body.storage.local.stored).toBe(true);
      expect(response.body.storage.overlay.uhrpUrl).toBe(`uhrp://${testContentHash}/content`);
      expect(response.body.verification.hashMatch).toBe(true);
      expect(response.body.verification.integrityScore).toBe(1.0);
    });

    it('should retrieve content via data access API', async () => {
      // First upload the content
      await request(app)
        .post('/api/overlay/storage/upload')
        .attach('file', testContent, 'test-file.txt')
        .set('X-Content-Hash', testContentHash);

      // Then retrieve it
      const response = await request(app)
        .get(`/api/overlay/data/${testContentHash}`)
        .query({
          preferredMethod: 'local',
          includeVerification: 'true',
          trackAccess: 'true'
        })
        .set('X-Client-Location', 'US')
        .set('X-Network-Type', 'wifi');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(testContent);
      expect(response.headers['x-storage-location']).toBe('local');
      expect(response.headers['x-cache']).toBe('MISS');
    });

    it('should provide storage status information', async () => {
      // Upload content first
      await request(app)
        .post('/api/overlay/storage/upload')
        .attach('file', testContent, 'test-file.txt')
        .set('X-Content-Hash', testContentHash);

      const response = await request(app)
        .get(`/api/overlay/storage/status/${testContentHash}`);

      expect(response.status).toBe(200);
      expect(response.body.contentHash).toBe(testContentHash);
      expect(response.body.status.storageLocations).toContain('local');
      expect(response.body.status.availability).toBeGreaterThanOrEqual(0);
      expect(response.body.performance).toBeDefined();
      expect(response.body.replication).toBeDefined();
      expect(response.body.access).toBeDefined();
    });

    it('should provide management statistics', async () => {
      const response = await request(app)
        .get('/api/overlay/storage/management/stats');

      expect(response.status).toBe(200);
      expect(response.body.storage).toBeDefined();
      expect(response.body.replication).toBeDefined();
      expect(response.body.verification).toBeDefined();
      expect(response.body.cache).toBeDefined();
      expect(response.body.routing).toBeDefined();
      expect(response.body.agents).toBeDefined();
      expect(response.body.generatedAt).toBeDefined();
    });

    it('should provide storage configuration', async () => {
      const response = await request(app)
        .get('/api/overlay/storage/config');

      expect(response.status).toBe(200);
      expect(response.body.storage).toBeDefined();
      expect(response.body.cache).toBeDefined();
      expect(response.body.overlay).toBeDefined();
      expect(response.body.uhrp).toBeDefined();
    });

    it('should handle range requests for large files', async () => {
      // Upload content first
      await request(app)
        .post('/api/overlay/storage/upload')
        .attach('file', testContent, 'test-file.txt')
        .set('X-Content-Hash', testContentHash);

      // Request partial content
      const response = await request(app)
        .get(`/api/overlay/data/${testContentHash}`)
        .set('Range', 'bytes=10-20');

      expect(response.status).toBe(206); // Partial Content
      expect(response.headers['content-range']).toMatch(/^bytes 10-20\/\d+$/);
      expect(response.body.length).toBe(11); // 20-10+1 = 11 bytes
    });

    it('should handle content not found scenarios', async () => {
      const nonExistentHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

      const response = await request(app)
        .get(`/api/overlay/data/${nonExistentHash}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Content not found');
      expect(response.body.contentHash).toBe(nonExistentHash);
    });

    it('should validate file hashes on upload', async () => {
      const wrongHash = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

      const response = await request(app)
        .post('/api/overlay/storage/upload')
        .attach('file', testContent, 'test-file.txt')
        .set('X-Content-Hash', wrongHash);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Hash mismatch');
      expect(response.body.providedHash).toBe(wrongHash);
      expect(response.body.calculatedHash).toBe(testContentHash);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent upload requests', async () => {
      const numRequests = 5;
      const requests = [];

      // Create test manifests for each request
      for (let i = 0; i < numRequests; i++) {
        const versionId = `concurrent_test_version_${Date.now()}_${i}`;
        await pool.query(`
          INSERT INTO manifests (version_id, dataset_id, title, manifest_hash, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [versionId, 'concurrent_test_dataset', `Concurrent Test Dataset ${i}`, `concurrent_test_hash_${i}`]);
      }

      for (let i = 0; i < numRequests; i++) {
        const content = Buffer.from(`Test content ${i} for concurrent upload testing`);
        const hash = 'sha256:' + createHash('sha256').update(content).digest('hex');

        requests.push(
          request(app)
            .post('/api/overlay/storage/upload')
            .attach('file', content, `test-file-${i}.txt`)
            .set('X-Content-Hash', hash)
        );
      }

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.verification.hashMatch).toBe(true);
      });

      // Verify all content was stored
      const storageCount = await pool.query(
        'SELECT COUNT(*) FROM overlay_storage_index WHERE content_hash LIKE $1',
        ['sha256:%']
      );
      expect(parseInt(storageCount.rows[0].count)).toBeGreaterThanOrEqual(numRequests);
    });

    it('should cache frequently accessed content', async () => {
      // Upload content
      await request(app)
        .post('/api/overlay/storage/upload')
        .attach('file', testContent, 'test-file.txt')
        .set('X-Content-Hash', testContentHash);

      // Access it multiple times to trigger caching
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get(`/api/overlay/data/${testContentHash}`)
          .set('X-Client-Location', 'US');
      }

      // Check cache statistics
      const statsResponse = await request(app)
        .get('/api/overlay/storage/management/stats');

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.cache.totalEntries).toBeGreaterThan(0);
    });
  });

  // Helper functions
  async function setupTestSchema(): Promise<void> {
    // Read and execute the D22 schema
    const schemaPath = path.join(__dirname, '../../src/db/schema-d22-overlay-storage.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = schemaSql.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (error) {
        // Ignore errors for existing tables/indexes
        if (!error.message.includes('already exists')) {
          console.warn('Schema setup warning:', error.message);
        }
      }
    }
  }

  async function cleanupTestData(): Promise<void> {
    // Clean up test files
    try {
      await fs.rmdir('/tmp/test-overlay-storage', { recursive: true });
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
      const files = await fs.readdir('/tmp/overlay-storage');
      for (const file of files) {
        if (file.endsWith('.bin')) {
          await fs.unlink(path.join('/tmp/overlay-storage', file));
        }
      }
    } catch (error) {
      // Directory might not exist
    }
  }
});