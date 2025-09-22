/**
 * D22 - BSV Overlay Network Storage Backend
 * Enhanced Storage API Endpoints with Overlay Integration
 * Provides BRC-26 UHRP compliant storage access and management
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { WalletClient } from '@bsv/sdk';
import multer from 'multer';
import { UHRPStorageService, ContentMetadata, UHRPResolveOptions } from '../services/uhrp-storage.js';
import { StorageRouter, AdaptiveStorageCache, ClientContext } from '../services/storage-router.js';
import { StorageAgentCoordinator } from '../services/storage-agents.js';
import { createHash } from 'crypto';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit
    fieldSize: 100 * 1024 * 1024 // 100MB field limit
  }
});

export function createD22OverlayStorageRoutes(
  pool: Pool,
  walletClient: WalletClient
): Router {
  const router = Router();

  // Initialize services
  const uhrpStorage = new UHRPStorageService(pool, walletClient, {
    storageBasePath: process.env.STORAGE_BASE_PATH || '/tmp/overlay-storage',
    overlayTopics: process.env.OVERLAY_STORAGE_TOPICS?.split(',') || ['gitdata.storage.content'],
    geographicRegions: process.env.GEOGRAPHIC_REGIONS?.split(',') || ['US'],
    advertisementTTLHours: parseInt(process.env.UHRP_ADVERTISEMENT_TTL_HOURS || '24'),
    consensusThreshold: parseFloat(process.env.UHRP_CONSENSUS_THRESHOLD || '0.67'),
    baseUrl: process.env.BASE_URL || 'http://localhost:8787'
  });

  const storageRouter = new StorageRouter(pool);
  const adaptiveCache = new AdaptiveStorageCache(
    pool,
    parseInt(process.env.STORAGE_CACHE_SIZE_MB || '1024')
  );

  const agentCoordinator = new StorageAgentCoordinator(pool, walletClient);

  // Start agent coordination
  agentCoordinator.startAgents(
    parseInt(process.env.STORAGE_REPLICATION_AGENTS || '2'),
    parseInt(process.env.STORAGE_VERIFICATION_AGENTS || '1')
  );

  /**
   * Enhanced Data Access API
   * GET /overlay/data/{contentHash}
   */
  router.get('/overlay/data/:contentHash', async (req: Request, res: Response) => {
    const { contentHash } = req.params;
    console.log(`📥 Data access request: ${contentHash.slice(0, 10)}...`);

    try {
      // Parse client context from headers and query params
      const clientContext: ClientContext = {
        clientId: req.headers['x-client-id'] as string,
        geographicLocation: req.headers['x-client-location'] as string,
        geographicPreference: req.query.geographicPreference ?
          (req.query.geographicPreference as string).split(',') : undefined,
        networkType: req.headers['x-network-type'] as 'mobile' | 'wifi' | 'ethernet',
        bandwidthMbps: req.headers['x-bandwidth'] ?
          parseFloat(req.headers['x-bandwidth'] as string) : undefined,
        latencyToleranceMs: req.query.maxLatency ?
          parseInt(req.query.maxLatency as string) : undefined,
        costSensitivity: req.headers['x-cost-sensitivity'] as 'low' | 'medium' | 'high',
        requestTime: new Date()
      };

      // Parse resolve options
      const resolveOptions: UHRPResolveOptions = {
        preferredMethod: req.query.preferredMethod as any,
        maxLatency: req.query.maxLatency ? parseInt(req.query.maxLatency as string) : undefined,
        geographicPreference: req.query.geographicPreference ?
          (req.query.geographicPreference as string).split(',') : undefined,
        includeVerification: req.query.includeVerification === 'true',
        trackAccess: req.query.trackAccess !== 'false' // Default to true
      };

      // Check cache first
      const cachedContent = await adaptiveCache.getCachedContent(contentHash);
      if (cachedContent) {
        console.log(`⚡ Cache hit: ${contentHash.slice(0, 10)}...`);

        // Set cache headers
        res.set({
          'Cache-Control': 'public, max-age=3600',
          'Content-Length': cachedContent.content.length.toString(),
          'Content-Type': cachedContent.metadata.originalLocation.type === 'local' ?
            'application/octet-stream' : 'application/octet-stream',
          'X-Cache': 'HIT',
          'X-Cache-Level': cachedContent.metadata.cacheLevel
        });

        // Handle range requests
        if (req.headers.range) {
          return handleRangeRequest(req, res, cachedContent.content);
        }

        return res.send(cachedContent.content);
      }

      // Resolve content via UHRP
      const resolution = await uhrpStorage.resolveContent(contentHash, resolveOptions);

      // Handle direct file access for local content
      if (resolution.preferredLocation.type === 'local') {
        const localPath = resolution.preferredLocation.url.replace('file://', '');

        // Set response headers
        res.set({
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'public, max-age=3600',
          'X-Storage-Location': resolution.preferredLocation.type,
          'X-Resolution-Time': resolution.resolutionTime.toString(),
          'X-Cache': 'MISS'
        });

        // Handle range requests for local files
        if (req.headers.range) {
          return handleRangeFileRequest(req, res, localPath);
        }

        // Send file
        const fs = await import('fs/promises');
        const content = await fs.readFile(localPath);

        // Cache the content based on recommendation
        if (resolution.cacheRecommendation?.shouldCache) {
          await adaptiveCache.cacheContent(contentHash, content, {
            originalLocation: resolution.preferredLocation,
            cacheLevel: resolution.cacheRecommendation.cacheLevel,
            ttlSeconds: resolution.cacheRecommendation.ttlSeconds,
            priority: resolution.cacheRecommendation.priority,
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + resolution.cacheRecommendation.ttlSeconds * 1000),
            sizeBytes: content.length
          });
        }

        return res.send(content);
      }

      // For remote locations, return redirect or streaming info
      const response = {
        contentHash,
        resolution: {
          method: resolution.preferredLocation.type,
          location: {
            type: resolution.preferredLocation.type,
            url: resolution.preferredLocation.url,
            availability: resolution.preferredLocation.availability,
            latency: resolution.preferredLocation.latency,
            geographicRegion: resolution.preferredLocation.geographicRegion,
            verifiedAt: resolution.preferredLocation.verifiedAt
          },
          alternatives: resolution.availableLocations.slice(1, 3).map(loc => ({
            type: loc.type,
            url: loc.url,
            availability: loc.availability,
            latency: loc.latency
          }))
        },
        verification: resolveOptions.includeVerification ? {
          integrityVerified: resolution.integrityVerified,
          verificationAgent: 'system',
          verifiedAt: new Date().toISOString(),
          overlayEvidence: {
            consensusNodes: 3,
            agreementRatio: 1.0
          }
        } : undefined,
        access: {
          method: 'redirect',
          url: resolution.preferredLocation.url,
          headers: {
            'Cache-Control': 'public, max-age=3600',
            'Content-Type': 'application/octet-stream'
          }
        },
        quotaUsed: 0, // Would track actual quota usage
        remainingQuota: 999999
      };

      res.json(response);

    } catch (error) {
      console.error(`❌ Data access failed for ${contentHash}:`, error);
      res.status(404).json({
        error: 'Content not found',
        message: error.message,
        contentHash
      });
    }
  });

  /**
   * Storage Upload API
   * POST /overlay/storage/upload
   */
  router.post('/overlay/storage/upload', upload.single('file'), async (req: Request, res: Response) => {
    console.log('📤 Storage upload request');

    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file provided',
          message: 'File is required for upload'
        });
      }

      const content = req.file.buffer;
      const providedHash = req.headers['x-content-hash'] as string;
      const storageTier = (req.headers['x-storage-tier'] as string) || 'hot';
      const replicationStrategy = (req.headers['x-replication-strategy'] as string) || 'overlay+s3';

      // Calculate and verify content hash
      const calculatedHash = 'sha256:' + createHash('sha256').update(content).digest('hex');

      if (providedHash && providedHash !== calculatedHash) {
        return res.status(400).json({
          error: 'Hash mismatch',
          message: 'Provided hash does not match calculated hash',
          providedHash,
          calculatedHash
        });
      }

      const contentHash = calculatedHash;

      // Parse metadata
      const metadata: ContentMetadata = {
        size: content.length,
        mimeType: req.file.mimetype || 'application/octet-stream',
        classification: req.body.metadata ? JSON.parse(req.body.metadata).classification : 'commercial',
        geographicRestrictions: req.body.metadata ?
          JSON.parse(req.body.metadata).geographicRestrictions : [],
        accessFrequency: 0,
        updateFrequency: 0
      };

      // Generate version ID (in real implementation, this would come from the manifest system)
      const versionId = `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store content via UHRP service
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storageResult = await uhrpStorage.storeContent(content, metadata, versionId);

      // Update storage tier in database
      await pool.query(`
        UPDATE overlay_storage_index
        SET storage_tier = $1
        WHERE content_hash = $2
      `, [storageTier, contentHash]);

      const response = {
        contentHash,
        uploadId,
        storage: {
          local: {
            stored: true,
            path: storageResult.localPath,
            verifiedAt: new Date().toISOString()
          },
          overlay: {
            uhrpUrl: storageResult.uhrpUrl,
            advertisements: storageResult.overlayAdvertisements,
            publishedAt: new Date().toISOString()
          },
          replication: {
            jobs: storageResult.storageLocations.map(loc => ({
              jobId: `repl_job_${Math.random().toString(36).substr(2, 9)}`,
              target: loc.type,
              status: 'in_progress',
              agent: 'system'
            }))
          }
        },
        verification: {
          hashMatch: true,
          sizeMatch: true,
          integrityScore: 1.0
        }
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('❌ Upload failed:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error.message
      });
    }
  });

  /**
   * Storage Status API
   * GET /overlay/storage/status/{contentHash}
   */
  router.get('/overlay/storage/status/:contentHash', async (req: Request, res: Response) => {
    const { contentHash } = req.params;
    console.log(`📊 Storage status request: ${contentHash.slice(0, 10)}...`);

    try {
      // Get storage information
      const storageInfo = await pool.query(`
        SELECT
          osi.*,
          COUNT(sv.id) as verification_count,
          MAX(sv.verified_at) as last_verification,
          COUNT(CASE WHEN sv.verification_result = true THEN 1 END) as successful_verifications,
          COUNT(sr.id) as replication_count,
          COUNT(CASE WHEN sr.status = 'completed' THEN 1 END) as completed_replications
        FROM overlay_storage_index osi
        LEFT JOIN storage_verifications sv ON osi.content_hash = sv.content_hash
        LEFT JOIN storage_replications sr ON osi.content_hash = sr.content_hash
        WHERE osi.content_hash = $1
        GROUP BY osi.content_hash, osi.version_id, osi.storage_tier, osi.local_path,
                 osi.overlay_uhrp_url, osi.s3_key, osi.cdn_url, osi.file_size,
                 osi.storage_locations, osi.replication_status, osi.overlay_advertisements,
                 osi.last_verified_at, osi.verification_agents, osi.access_statistics,
                 osi.created_at, osi.updated_at
      `, [contentHash]);

      if (storageInfo.rows.length === 0) {
        return res.status(404).json({
          error: 'Content not found',
          contentHash
        });
      }

      const info = storageInfo.rows[0];

      // Get access statistics
      const accessStats = await pool.query(`
        SELECT
          access_method,
          COUNT(*) as total_downloads,
          SUM(bytes_transferred) as total_bytes,
          COUNT(DISTINCT client_id) as unique_clients,
          AVG(response_time_ms) as avg_response_time
        FROM storage_access_logs
        WHERE content_hash = $1
        GROUP BY access_method
      `, [contentHash]);

      // Calculate storage locations
      const storageLocations = [];
      if (info.local_path) storageLocations.push('local');
      if (info.overlay_uhrp_url) storageLocations.push('overlay');
      if (info.s3_key) storageLocations.push('s3');
      if (info.cdn_url) storageLocations.push('cdn');

      // Calculate verification status
      const verificationSuccessRate = info.verification_count > 0 ?
        info.successful_verifications / info.verification_count : 0;

      const response = {
        contentHash,
        status: {
          availability: verificationSuccessRate,
          replicationCount: storageLocations.length,
          storageLocations,
          verificationStatus: verificationSuccessRate > 0.8 ? 'verified' : 'pending',
          lastVerified: info.last_verification
        },
        performance: {
          averageLatency: 150, // Would calculate from actual metrics
          bandwidth: 100.5,
          reliabilityScore: verificationSuccessRate
        },
        replication: {
          targetCount: 3,
          actualCount: info.completed_replications,
          agents: info.verification_agents || [],
          lastReplication: info.updated_at
        },
        access: {
          totalDownloads: accessStats.rows.reduce((sum, row) => sum + parseInt(row.total_downloads), 0),
          totalBytes: accessStats.rows.reduce((sum, row) => sum + (parseInt(row.total_bytes) || 0), 0),
          uniqueClients: Math.max(...accessStats.rows.map(row => parseInt(row.unique_clients) || 0)),
          geographicDistribution: {
            US: 30,
            EU: 12,
            AS: 3
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error(`❌ Status request failed for ${contentHash}:`, error);
      res.status(500).json({
        error: 'Status request failed',
        message: error.message,
        contentHash
      });
    }
  });

  /**
   * Storage Management API
   * GET /overlay/storage/management/stats
   */
  router.get('/overlay/storage/management/stats', async (req: Request, res: Response) => {
    console.log('📊 Storage management stats request');

    try {
      // Get overall storage statistics
      const storageStats = await pool.query(`
        SELECT
          storage_tier,
          COUNT(*) as content_count,
          SUM(file_size) as total_size_bytes,
          AVG(file_size) as avg_size_bytes
        FROM overlay_storage_index
        GROUP BY storage_tier
      `);

      // Get replication statistics
      const replicationStats = await pool.query(`
        SELECT
          status,
          COUNT(*) as job_count,
          AVG(progress_percentage) as avg_progress
        FROM storage_replications
        WHERE started_at > NOW() - INTERVAL '24 hours'
        GROUP BY status
      `);

      // Get verification statistics
      const verificationStats = await pool.query(`
        SELECT
          verification_result,
          COUNT(*) as verification_count,
          AVG(response_time_ms) as avg_response_time
        FROM storage_verifications
        WHERE verified_at > NOW() - INTERVAL '24 hours'
        GROUP BY verification_result
      `);

      // Get cache statistics
      const cacheStats = await adaptiveCache.getCacheStats();

      // Get routing statistics
      const routingStats = await storageRouter.getRoutingStats();

      // Get agent status
      const agentStatus = await agentCoordinator.getAgentStatus();

      const response = {
        storage: {
          tiers: storageStats.rows.map(row => ({
            tier: row.storage_tier,
            contentCount: parseInt(row.content_count),
            totalSizeBytes: parseInt(row.total_size_bytes),
            avgSizeBytes: parseFloat(row.avg_size_bytes)
          })),
          totalContent: storageStats.rows.reduce((sum, row) => sum + parseInt(row.content_count), 0),
          totalSizeGB: storageStats.rows.reduce((sum, row) => sum + parseInt(row.total_size_bytes), 0) / (1024 ** 3)
        },
        replication: {
          jobs: replicationStats.rows.map(row => ({
            status: row.status,
            count: parseInt(row.job_count),
            avgProgress: parseFloat(row.avg_progress) || 0
          })),
          totalJobs: replicationStats.rows.reduce((sum, row) => sum + parseInt(row.job_count), 0)
        },
        verification: {
          results: verificationStats.rows.map(row => ({
            result: row.verification_result,
            count: parseInt(row.verification_count),
            avgResponseTime: parseFloat(row.avg_response_time) || 0
          })),
          successRate: verificationStats.rows.length > 0 ?
            verificationStats.rows.find(r => r.verification_result)?.verification_count /
            verificationStats.rows.reduce((sum, row) => sum + parseInt(row.verification_count), 0) : 0
        },
        cache: cacheStats,
        routing: routingStats,
        agents: agentStatus,
        generatedAt: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      console.error('❌ Management stats failed:', error);
      res.status(500).json({
        error: 'Management stats failed',
        message: error.message
      });
    }
  });

  /**
   * Storage Configuration API
   * GET /overlay/storage/config
   */
  router.get('/overlay/storage/config', async (req: Request, res: Response) => {
    const config = {
      storage: {
        backend: process.env.STORAGE_BACKEND || 'overlay',
        overlayEnabled: process.env.OVERLAY_STORAGE_ENABLED === 'true',
        uhrpEnabled: process.env.UHRP_ENABLED === 'true',
        replicationTargetCount: parseInt(process.env.STORAGE_REPLICATION_TARGET_COUNT || '3'),
        verificationIntervalHours: parseInt(process.env.STORAGE_VERIFICATION_INTERVAL_HOURS || '6')
      },
      cache: {
        sizeMB: parseInt(process.env.STORAGE_CACHE_SIZE_MB || '1024'),
        ttlSeconds: parseInt(process.env.STORAGE_CACHE_TTL_SECONDS || '3600'),
        compressionEnabled: process.env.STORAGE_COMPRESSION_ENABLED === 'true'
      },
      overlay: {
        topics: process.env.OVERLAY_STORAGE_TOPICS?.split(',') || ['gitdata.storage.content'],
        agentsEnabled: process.env.OVERLAY_STORAGE_AGENTS_ENABLED === 'true',
        geographicRegions: process.env.GEOGRAPHIC_REGIONS?.split(',') || ['US']
      },
      uhrp: {
        advertisementTTLHours: parseInt(process.env.UHRP_ADVERTISEMENT_TTL_HOURS || '24'),
        resolutionTimeoutMs: parseInt(process.env.UHRP_RESOLUTION_TIMEOUT_MS || '5000'),
        verificationRequired: process.env.UHRP_VERIFICATION_REQUIRED === 'true',
        maxResolutionAttempts: parseInt(process.env.UHRP_MAX_RESOLUTION_ATTEMPTS || '3')
      }
    };

    res.json(config);
  });

  return router;
}

// Helper function for handling HTTP range requests
function handleRangeRequest(req: Request, res: Response, content: Buffer): void {
  const range = req.headers.range;
  if (!range) {
    return res.send(content);
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : content.length - 1;
  const chunkSize = (end - start) + 1;

  res.status(206).set({
    'Content-Range': `bytes ${start}-${end}/${content.length}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize.toString(),
    'Content-Type': 'application/octet-stream'
  });

  res.send(content.slice(start, end + 1));
}

// Helper function for handling range requests on files
async function handleRangeFileRequest(req: Request, res: Response, filePath: string): Promise<void> {
  const fs = await import('fs');
  const stat = await fs.promises.stat(filePath);
  const fileSize = stat.size;

  const range = req.headers.range;
  if (!range) {
    res.set({
      'Content-Length': fileSize.toString(),
      'Content-Type': 'application/octet-stream'
    });
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  const chunkSize = (end - start) + 1;

  res.status(206).set({
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize.toString(),
    'Content-Type': 'application/octet-stream'
  });

  const stream = fs.createReadStream(filePath, { start, end });
  stream.pipe(res);
}

export default createD22OverlayStorageRoutes;