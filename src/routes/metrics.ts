import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
 //import fs from 'fs';
import { snapshotMetrics } from '../metrics/registry';
import { getHeadersSnapshot } from '../spv/headers-cache';
import { getPolicyMetrics } from '../middleware/policy';

const HEADERS_FILE = process.env.HEADERS_FILE || './data/headers.json';

export function opsRouter(db: Database.Database): Router {
  const router = makeRouter();

  router.get('/health', async (_req: Request, res: Response) => {
    try {
      // DB ping
      const { getPostgreSQLClient } = await import('../db/postgresql');
      const pgClient = getPostgreSQLClient();
      const result = await pgClient.query('SELECT 1 AS ok');
      const row = result.rows[0] as any;
      if (!row || row.ok !== 1) {
        return res.status(500).json({ ok: false, reason: 'db' });
      }
      // Headers file check
      if (!fs.existsSync(HEADERS_FILE)) {
        return res.status(200).json({ ok: true, warn: 'headers-missing' });
      }
      try {
        getHeadersSnapshot(HEADERS_FILE);
      } catch {
        return res.status(200).json({ ok: true, warn: 'headers-unreadable' });
      }
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ ok: false, reason: String(e?.message || e) });
    }
  });

  router.get('/metrics', (_req: Request, res: Response) => {
    try {
      const m = snapshotMetrics();
      const policyMetrics = getPolicyMetrics(db);

      return res.status(200).json({
        ...m,
        policy: policyMetrics
      });
    } catch (e: any) {
      return res.status(500).json({ error: 'metrics-failed', message: String(e?.message || e) });
    }
  });

  return router;
}