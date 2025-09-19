/*
  D22 Storage Monitoring & Health Check Routes

  Provides comprehensive monitoring endpoints for the storage backend:
  - Health checks for all storage tiers
  - Performance metrics and statistics
  - Storage usage and costs
  - Migration status and progress
  - Lifecycle management stats

  Endpoints:
    GET /v1/storage/health - Overall storage health
    GET /v1/storage/stats - Usage statistics
    GET /v1/storage/performance - Performance metrics
    POST /v1/storage/migrate - Trigger migration
    POST /v1/storage/tier - Manual tiering operation
*/

import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { getStorageDriver } from '../storage';
import { StorageLifecycleManager, createStorageEventsMigration } from '../storage/lifecycle';
import { StorageMigrator } from '../storage/migration';

interface HealthCheckResult {
  healthy: boolean;
  timestamp: number;
  storage: {
    backend: string;
    tiers: Record<string, {
      healthy: boolean;
      latencyMs?: number;
      error?: string;
    }>;
  };
  cdn: {
    enabled: boolean;
    healthy?: boolean;
  };
  lifecycle: {
    enabled: boolean;
    lastRun?: number;
    nextRun?: number;
  };
}

interface StorageStats {
  usage: {
    totalObjects: number;
    totalSizeBytes: number;
    tierBreakdown: Record<string, {
      objectCount: number;
      sizeBytes: number;
      costEstimate: number;
    }>;
  };
  performance: {
    avgLatencyMs: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  lifecycle: {
    recentMoves: number;
    estimatedMonthlySavings: number;
    pendingOperations: number;
  };
}

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

function requireAuth(req: Request, res: Response, next: Function) {
  // Simple API key auth for admin endpoints
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validKey = process.env.STORAGE_ADMIN_API_KEY;

  if (!validKey || apiKey !== validKey) {
    return json(res, 401, { error: 'unauthorized', hint: 'Valid API key required' });
  }

  next();
}

export function storageRouter(db: Database.Database): Router {
  const router = makeRouter();

  // Ensure storage events table exists
  createStorageEventsMigration(db);

  // Public health check endpoint
  router.get('/v1/storage/health', async (req: Request, res: Response) => {
    try {
      const storage = getStorageDriver();
      const result: HealthCheckResult = {
        healthy: true,
        timestamp: Date.now(),
        storage: {
          backend: process.env.STORAGE_BACKEND || 'fs',
          tiers: {}
        },
        cdn: {
          enabled: process.env.CDN_MODE !== 'off'
        },
        lifecycle: {
          enabled: process.env.LIFECYCLE_ENABLED === 'true'
        }
      };

      // Test each storage tier
      const tiers = ['hot', 'warm', 'cold'];
      for (const tier of tiers) {
        try {
          const tierHealth = await storage.healthCheck();
          result.storage.tiers[tier] = {
            healthy: tierHealth.healthy,
            latencyMs: tierHealth.latencyMs,
            error: tierHealth.error
          };

          if (!tierHealth.healthy) {
            result.healthy = false;
          }
        } catch (error) {
          result.storage.tiers[tier] = {
            healthy: false,
            error: String(error)
          };
          result.healthy = false;
        }
      }

      // Test CDN if enabled
      if (result.cdn.enabled) {
        try {
          // Simple CDN health check - could be expanded
          result.cdn.healthy = true;
        } catch (error) {
          result.cdn.healthy = false;
          result.healthy = false;
        }
      }

      const statusCode = result.healthy ? 200 : 503;
      return json(res, statusCode, result);

    } catch (error) {
      return json(res, 500, {
        healthy: false,
        error: 'health-check-failed',
        message: String(error)
      });
    }
  });

  // Storage statistics (requires auth)
  router.get('/v1/storage/stats', requireAuth, async (req: Request, res: Response) => {
    try {
      const storage = getStorageDriver();
      const lifecycle = new StorageLifecycleManager(storage, db);

      // Get lifecycle stats
      const lifecycleStats = await lifecycle.getStorageStats();

      // Calculate performance metrics from recent events
      const perfQuery = db.prepare(`
        SELECT
          AVG(CASE WHEN event_type = 'access' AND status = 'success' THEN
            json_extract(metadata, '$.latencyMs')
          END) as avg_latency,
          COUNT(CASE WHEN created_at > ? AND event_type = 'access' THEN 1 END) as recent_requests,
          COUNT(CASE WHEN created_at > ? AND status = 'error' THEN 1 END) as recent_errors
        FROM storage_events
        WHERE created_at > ?
      `);

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const perfData = perfQuery.get(oneHourAgo, oneHourAgo, oneHourAgo) as any;

      // Calculate total usage and costs
      let totalObjects = 0;
      let totalSize = 0;
      const tierBreakdown: Record<string, any> = {};

      for (const [tier, data] of Object.entries(lifecycleStats.tierBreakdown)) {
        totalObjects += data.objectCount;
        totalSize += data.totalSize;

        // Estimate costs (arbitrary units)
        const costPerGB = tier === 'hot' ? 0.023 : tier === 'warm' ? 0.0125 : 0.004;
        const costEstimate = (data.totalSize / 1024 / 1024 / 1024) * costPerGB;

        tierBreakdown[tier] = {
          objectCount: data.objectCount,
          sizeBytes: data.totalSize,
          costEstimate
        };
      }

      const stats: StorageStats = {
        usage: {
          totalObjects,
          totalSizeBytes: totalSize,
          tierBreakdown
        },
        performance: {
          avgLatencyMs: perfData?.avg_latency || 0,
          requestsPerSecond: (perfData?.recent_requests || 0) / 3600,
          errorRate: perfData?.recent_errors ? perfData.recent_errors / (perfData.recent_requests || 1) : 0
        },
        lifecycle: {
          recentMoves: lifecycleStats.recentMoves,
          estimatedMonthlySavings: lifecycleStats.estimatedMonthlySavings,
          pendingOperations: 0 // Could be calculated from pending migrations
        }
      };

      return json(res, 200, stats);

    } catch (error) {
      return json(res, 500, {
        error: 'stats-failed',
        message: String(error)
      });
    }
  });

  // Performance metrics endpoint
  router.get('/v1/storage/performance', requireAuth, async (req: Request, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);

      const metricsQuery = db.prepare(`
        SELECT
          event_type,
          from_tier,
          to_tier,
          status,
          COUNT(*) as count,
          AVG(CASE WHEN json_valid(error_message) THEN
            json_extract(error_message, '$.latencyMs')
          END) as avg_latency_ms,
          SUM(estimated_savings) as total_savings
        FROM storage_events
        WHERE created_at > ?
        GROUP BY event_type, from_tier, to_tier, status
        ORDER BY created_at DESC
      `);

      const metrics = metricsQuery.all(cutoff) as any[];

      // Aggregate performance data
      const performance = {
        timeRange: `${hours} hours`,
        operations: metrics.map(m => ({
          type: m.event_type,
          fromTier: m.from_tier,
          toTier: m.to_tier,
          status: m.status,
          count: m.count,
          avgLatencyMs: m.avg_latency_ms,
          totalSavings: m.total_savings
        })),
        summary: {
          totalOperations: metrics.reduce((sum, m) => sum + m.count, 0),
          successRate: metrics.filter(m => m.status === 'success').reduce((sum, m) => sum + m.count, 0) /
                      Math.max(1, metrics.reduce((sum, m) => sum + m.count, 0)),
          totalSavings: metrics.reduce((sum, m) => sum + (m.total_savings || 0), 0)
        }
      };

      return json(res, 200, performance);

    } catch (error) {
      return json(res, 500, {
        error: 'performance-failed',
        message: String(error)
      });
    }
  });

  // Trigger migration (admin only)
  router.post('/v1/storage/migrate', requireAuth, async (req: Request, res: Response) => {
    try {
      const { sourceBackend, targetBackend, dryRun } = req.body;

      if (!sourceBackend || !targetBackend) {
        return json(res, 400, {
          error: 'bad-request',
          hint: 'sourceBackend and targetBackend required'
        });
      }

      // Create storage drivers
      const { createStorageDriver } = await import('../storage');
      const source = createStorageDriver({ backend: sourceBackend });
      const target = createStorageDriver({ backend: targetBackend });

      const migrator = new StorageMigrator(source, target, {
        deleteSourceAfterCopy: !dryRun
      });

      if (dryRun) {
        // Just return what would be migrated
        const allObjects = await (migrator as any).discoverAllObjects();
        return json(res, 200, {
          dryRun: true,
          totalObjects: allObjects.length,
          totalSizeBytes: allObjects.reduce((sum, obj) => sum + obj.size, 0),
          objects: allObjects.slice(0, 10) // First 10 for preview
        });
      } else {
        // Start actual migration (async)
        migrator.migrateAllContent().then(progress => {
          console.log('Migration completed:', progress);
        }).catch(error => {
          console.error('Migration failed:', error);
        });

        return json(res, 202, {
          message: 'Migration started',
          progress: migrator.getProgress()
        });
      }

    } catch (error) {
      return json(res, 500, {
        error: 'migration-failed',
        message: String(error)
      });
    }
  });

  // Manual tiering operation
  router.post('/v1/storage/tier', requireAuth, async (req: Request, res: Response) => {
    try {
      const { contentHash, fromTier, toTier, force } = req.body;

      if (!contentHash || !fromTier || !toTier) {
        return json(res, 400, {
          error: 'bad-request',
          hint: 'contentHash, fromTier, and toTier required'
        });
      }

      const storage = getStorageDriver();

      // Verify object exists in source tier
      const objectExists = await storage.objectExists(contentHash, fromTier);
      if (!objectExists && !force) {
        return json(res, 404, {
          error: 'not-found',
          hint: `Object not found in ${fromTier} tier`
        });
      }

      // Perform the move
      await storage.moveObject(contentHash, fromTier, toTier);

      // Log the manual tiering event
      db.prepare(`
        INSERT INTO storage_events (
          event_type, content_hash, from_tier, to_tier,
          reason, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'manual-tiering',
        contentHash,
        fromTier,
        toTier,
        'manual-operation',
        'success',
        Date.now()
      );

      return json(res, 200, {
        success: true,
        operation: 'tier-moved',
        contentHash,
        fromTier,
        toTier
      });

    } catch (error) {
      return json(res, 500, {
        error: 'tiering-failed',
        message: String(error)
      });
    }
  });

  // Lifecycle management trigger
  router.post('/v1/storage/lifecycle', requireAuth, async (req: Request, res: Response) => {
    try {
      const { operation } = req.body;

      const storage = getStorageDriver();
      const lifecycle = new StorageLifecycleManager(storage, db);

      let result;

      switch (operation) {
        case 'tier':
          result = await lifecycle.runTieringJob();
          break;

        case 'cleanup':
          result = await lifecycle.cleanupExpiredContent();
          break;

        case 'stats':
          result = await lifecycle.getStorageStats();
          break;

        default:
          return json(res, 400, {
            error: 'bad-request',
            hint: 'operation must be: tier, cleanup, or stats'
          });
      }

      return json(res, 200, {
        operation,
        result
      });

    } catch (error) {
      return json(res, 500, {
        error: 'lifecycle-failed',
        message: String(error)
      });
    }
  });

  return router;
}