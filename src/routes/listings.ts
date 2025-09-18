import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { listListings } from '../db';

export function listingsRouter(db: Database.Database): Router {
  const router = makeRouter();

  router.get('/listings', (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const items = listListings(db, limit, offset);
    return res.status(200).json({ items, limit, offset });
  });

  return router;
}
