import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { listJobs, getTestDatabase, isTestEnvironment } from '../db';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function jobsRouter(testDb?: Database.Database): Router {
  // Get appropriate database
  const db = testDb || (isTestEnvironment() ? getTestDatabase() : null);
  const router = makeRouter();

  // GET /?state=queued|running|done|failed|dead
  router.get('/', (req: Request, res: Response) => {
    if (!db) {
      return json(res, 501, { error: 'not-implemented', message: 'Jobs not yet implemented for PostgreSQL' });
    }
    const state = req.query.state ? String(req.query.state) : undefined;
    const items = listJobs(db, state, 100, 0);
    return json(res, 200, { items });
  });

  return router;
}