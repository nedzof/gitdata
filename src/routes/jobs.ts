import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { listJobs } from '../db';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function jobsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // GET /?state=queued|running|done|failed|dead
  router.get('/', (req: Request, res: Response) => {
    const state = req.query.state ? String(req.query.state) : undefined;
    const items = listJobs(db, state, 100, 0);
    return json(res, 200, { items });
  });

  return router;
}