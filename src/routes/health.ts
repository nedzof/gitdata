import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { getHybridDatabase } from '../db';

export function healthRouter(): Router {
  const router = makeRouter();

  router.get('/health', async (req: Request, res: Response) => {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'postgresql',
      cache: 'redis'
    };

    try {
      // Check hybrid database health
      const hybridDb = getHybridDatabase();
      const dbHealth = await hybridDb.healthCheck();

      health.database = dbHealth.pg ? 'postgresql:ok' : 'postgresql:error';
      health.cache = dbHealth.redis ? 'redis:ok' : 'redis:error';

      if (!dbHealth.pg || !dbHealth.redis) {
        health.status = 'degraded';
        return res.status(503).json(health);
      }

      return res.status(200).json(health);
    } catch (error) {
      health.status = 'error';
      health.error = String(error);
      return res.status(503).json(health);
    }
  });

  // Extended health check with database details
  router.get('/health/db', async (req: Request, res: Response) => {
    try {
      const hybridDb = getHybridDatabase();
      const health = await hybridDb.healthCheck();

      const details = {
        postgresql: health.pg,
        redis: health.redis,
        features: {
          hybrid_db: true,
          cache_aside: true,
          redis_bundles: process.env.USE_REDIS_BUNDLES === 'true'
        }
      };

      const status = health.pg && health.redis ? 200 : 503;
      return res.status(status).json(details);
    } catch (error) {
      return res.status(503).json({
        error: String(error)
      });
    }
  });

  return router;
}